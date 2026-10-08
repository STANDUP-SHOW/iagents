// Bench of the « tarifs » module: talks to a real server on 127.0.0.1.
// Each check fails if its rule is undone (see the comment on each block).
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { creerPlateforme } from '../serveur.ts';
import { Stockage } from '../stockage.ts';
import { routes } from './routes.ts';
import { tarifs } from './donnees.ts';
import { coutAppel, fautesDuPlan, planALaDate, type CoutsFournisseurs, type PlanTarif } from './moteur.ts';

const lireJson = (chemin: string) => JSON.parse(readFileSync(new URL(chemin, import.meta.url), 'utf8'));

/** Differences of shape between two JSON values: same keys, same types; arrays matched by `id` when they have one. */
function ecartsDeForme(a: unknown, b: unknown, ici = '$'): string[] {
  const type = (x: unknown) => (x === null ? 'null' : Array.isArray(x) ? 'tableau' : typeof x);
  if (type(a) !== type(b)) return [`${ici} : ${type(a)} au lieu de ${type(b)}`];
  if (Array.isArray(a) && Array.isArray(b)) {
    const parId = b.every((x) => x && typeof x === 'object' && 'id' in x);
    if (!parId) {
      if (a.length !== b.length) return [`${ici} : ${a.length} éléments au lieu de ${b.length}`];
      return a.flatMap((x, i) => ecartsDeForme(x, b[i], `${ici}[${i}]`));
    }
    const f: string[] = [];
    const ida = a.map((x) => (x as { id: string }).id), idb = b.map((x) => (x as { id: string }).id);
    if (ida.join(',') !== idb.join(',')) f.push(`${ici} : identifiants ${ida.join(',')} au lieu de ${idb.join(',')}`);
    for (const x of b) {
      const y = a.find((z) => (z as { id: string }).id === (x as { id: string }).id);
      if (y) f.push(...ecartsDeForme(y, x, `${ici}[${(x as { id: string }).id}]`));
    }
    return f;
  }
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    const f: string[] = [];
    for (const k of kb) if (!ka.includes(k)) f.push(`${ici}.${k} manque`);
    for (const k of ka) if (!kb.includes(k)) f.push(`${ici}.${k} en trop`);
    for (const k of kb) if (ka.includes(k)) f.push(...ecartsDeForme((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${ici}.${k}`));
    return f;
  }
  return [];
}

/** Every numeric leaf, by path, so that the prices of the export can be compared to the site's. */
function nombres(x: unknown, ici = '$', sortie: Record<string, number> = {}): Record<string, number> {
  if (Array.isArray(x)) x.forEach((y, i) => nombres(y, `${ici}[${(y as { id?: string })?.id ?? i}]`, sortie));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) nombres(v, `${ici}.${k}`, sortie);
  else if (typeof x === 'number') sortie[ici] = x;
  return sortie;
}

export async function lancer(): Promise<number> {
  let fautes = 0;
  const verifier = (quoi: string, vrai: boolean, detail?: unknown) => {
    if (vrai) console.log(`  ok  ${quoi}`);
    else { fautes++; console.log(`  FAUTE  ${quoi}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`); }
  };

  const t = tarifs();
  const depart = t.depart;
  const seed = (id: string) => depart.find((p) => p.plan_id === id);

  // --- seed file: every plan of the contract, with its date, region, source and launch flag
  const attendus = ['box-commander-36', 'box-commander-24', 'agent-essential', 'agent-professional', 'agent-expert', 'task-commander',
    'pack-starter', 'pack-team', 'pack-department', 'pack-enterprise', 'voice-reception', 'voice-reception-pro', 'voice-support-center',
    'voice-sales-center', 'voice-enterprise', 'home-digital', 'home-agent', 'home-box', 'home-family'];
  const anciens = ['box-max', 'puissance-1', 'puissance-2', 'puissance-3', 'agent-unique'];
  verifier('plans.json porte les 24 identifiants fixés par docs/master/routes.md', [...attendus, ...anciens].every((id) => seed(id)) && depart.length === 24);
  verifier('chaque plan porte effective_from 2026-10-07, region FR, tax_mode et une source',
    depart.every((p) => p.effective_from === '2026-10-07' && p.region === 'FR' && (p.tax_mode === 'HT' || p.tax_mode === 'TTC') && p.source.length > 3));
  verifier('les plans du MASTER se disent « hypothèses de lancement »', attendus.every((id) => seed(id)!.hypothese_de_lancement === true));
  verifier('les plans de départ passent tous la validation', depart.every((p) => fautesDuPlan(p, t.fiscalite).length === 0),
    depart.map((p) => fautesDuPlan(p, t.fiscalite)).flat());

  // --- prices exactly as the MASTER writes them (§5, §12, §13)
  const master: Record<string, [number | null, number | null, boolean, 'HT' | 'TTC']> = {
    'box-commander-36': [69, null, false, 'HT'], 'box-commander-24': [89, null, false, 'HT'],
    'agent-essential': [149, null, false, 'HT'], 'agent-professional': [249, null, false, 'HT'], 'agent-expert': [399, null, false, 'HT'],
    'task-commander': [249, 349, false, 'HT'], 'pack-team': [599, 749, false, 'HT'], 'pack-department': [999, null, true, 'HT'],
    'pack-enterprise': [null, null, false, 'HT'], 'voice-reception': [49, null, false, 'HT'], 'voice-reception-pro': [99, null, false, 'HT'],
    'voice-support-center': [299, null, true, 'HT'], 'voice-sales-center': [399, null, true, 'HT'], 'voice-enterprise': [null, null, false, 'HT'],
    'home-digital': [49, null, false, 'TTC'], 'home-agent': [79, null, false, 'TTC'], 'home-box': [129, null, false, 'TTC'], 'home-family': [149, 169, false, 'TTC'],
  };
  const ecartsMaster = Object.entries(master).filter(([id, [p, m, apd, tm]]) => {
    const s = seed(id)!;
    return s.base_price !== p || s.base_price_max !== m || s.a_partir_de !== apd || s.tax_mode !== tm;
  }).map(([id]) => id);
  verifier('prix, fourchettes, « à partir de » et HT/TTC égaux au MASTER', ecartsMaster.length === 0, ecartsMaster);
  const starter = seed('pack-starter')!;
  verifier('Starter : aucun prix forcé (décision de max du 07/10), composition 1 Essential + Box 36 mois',
    starter.prix_force == null && !!starter.source && starter.base_price === null && !starter.a_partir_de
      && JSON.stringify(starter.composition) === JSON.stringify([{ plan_id: 'agent-essential', quantite: 1 }, { plan_id: 'box-commander-36', quantite: 1 }]));
  verifier('Task Commander inclus à partir de 5 agents, lu dans plans.json', seed('task-commander')!.inclus_a_partir_de_agents === 5);

  // --- legacy plans: prices read in offre-box.json, never invented; hidden
  const offre = lireJson('../../dimensionnement/offre-box.json') as { offres: { id: string; abonnementMensuel: number; prixAchat: number }[] };
  verifier('box-max et puissance-1/2/3 lisent leur prix dans offre-box.json',
    ['box-max', 'puissance-1', 'puissance-2', 'puissance-3'].every((id) => {
      const o = offre.offres.find((x) => x.id === id)!;
      return seed(id)!.base_price === o.abonnementMensuel && seed(id)!.prix_achat === o.prixAchat;
    }));
  const brut = lireJson('./plans.json') as { plans: PlanTarif[] };
  verifier("plans.json n'écrit pas les prix des anciennes machines (lus, pas recopiés)",
    brut.plans.filter((p) => p.prix_depuis).every((p) => p.base_price === null));
  verifier('agent-unique à 9,90 €/mois, masqué', seed('agent-unique')!.base_price === 9.9 && !seed('agent-unique')!.public_visibility);
  verifier('toutes les anciennes offres : legacy_flag vrai, public_visibility faux', anciens.every((id) => seed(id)!.legacy_flag && !seed(id)!.public_visibility));
  // Undoing the rule « legacy is never public » must be caught by the validator.
  verifier('la validation refuse une ancienne offre rendue publique',
    fautesDuPlan({ ...seed('box-max')!, public_visibility: true }, t.fiscalite).some((f) => f.includes('ancienne offre')));

  // --- real server
  const stockage = new Stockage(null);
  const secret = 'secret-admin-du-banc-des-tarifs';
  const { serveur } = creerPlateforme({ secretAdmin: secret, fichierDonnees: null }, { stockage, routes, maintenant: () => new Date('2026-10-07T12:00:00Z') });
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  const admin = { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };
  const get = async (chemin: string, h: Record<string, string> = {}) => { const r = await fetch(base + chemin, { headers: h }); return { statut: r.status, corps: await r.json() as any }; };
  const post = async (chemin: string, corps: unknown, h: Record<string, string> = { 'content-type': 'application/json' }) => {
    const r = await fetch(base + chemin, { method: 'POST', headers: h, body: JSON.stringify(corps) });
    return { statut: r.status, corps: await r.json() as any };
  };

  try {
    const pub = await get('/tarifs/plans?region=FR&date=2026-10-07');
    const ids = (pub.corps.plans as PlanTarif[]).map((p) => p.plan_id);
    verifier('GET /tarifs/plans rend les 19 plans publics', pub.statut === 200 && ids.length === 19 && attendus.every((id) => ids.includes(id)), ids);
    verifier('aucune ancienne offre visible publiquement', anciens.every((id) => !ids.includes(id)) && (pub.corps.plans as PlanTarif[]).every((p) => !p.legacy_flag));
    const home = await get('/tarifs/plans?segment=home&date=2026-10-07');
    const digital = home.corps.plans.find((p: PlanTarif) => p.plan_id === 'home-digital');
    verifier('Home : 4 plans TTC, HT calculé (49 TTC → 40,83 HT + 8,17 TVA)',
      home.corps.plans.length === 4 && digital.prix.ttc === 49 && digital.prix.ht === 40.83 && digital.prix.tva === 8.17, digital?.prix);
    verifier('avant le 07/10/2026 aucun plan n\'est en vigueur', (await get('/tarifs/plans?date=2026-10-06')).corps.plans.length === 0);
    verifier('/tarifs/plans/tous refusé sans jeton', (await get('/tarifs/plans/tous')).statut === 401);
    const tous = await get('/tarifs/plans/tous', admin);
    verifier('/tarifs/plans/tous montre les anciennes offres', tous.statut === 200 && anciens.every((id) => tous.corps.versions.some((v: PlanTarif) => v.plan_id === id)));

    // --- refusal of a plan without a source (rule: a price is written with what says it)
    const sansSource = { ...seed('agent-expert')!, effective_from: '2027-01-01', base_price: 409 } as Partial<PlanTarif>;
    delete sansSource.source;
    const r1 = await post('/tarifs/plans', sansSource, admin);
    verifier('POST /tarifs/plans refuse un plan sans source', r1.statut === 400 && /source/.test(r1.corps.erreur), r1.corps);
    verifier("le plan refusé n'a rien écrit", stockage.lister('tarifs_versions').length === 0);
    verifier('POST /tarifs/plans refusé sans jeton', (await post('/tarifs/plans', { ...seed('agent-expert')!, effective_from: '2027-01-01' })).statut === 401);

    // --- versioning: a new version closes the previous one, never overwrites it
    const v2 = { ...seed('agent-essential')!, base_price: 159, effective_from: '2027-01-01', source: 'banc des tarifs : version d\'essai' };
    const r2 = await post('/tarifs/plans', v2, admin);
    verifier('nouvelle version d\'agent-essential acceptée et la précédente fermée au 2027-01-01',
      r2.statut === 201 && r2.corps.precedente_fermee?.effective_to === '2027-01-01' && r2.corps.precedente_fermee?.base_price === 149, r2.corps);
    const avant = (await get('/tarifs/plans?date=2026-12-01')).corps.plans.find((p: PlanTarif) => p.plan_id === 'agent-essential');
    const apres = (await get('/tarifs/plans?date=2027-02-01')).corps.plans.find((p: PlanTarif) => p.plan_id === 'agent-essential');
    verifier('agent-essential lu aux deux dates : 149 € au 01/12/2026, 159 € au 01/02/2027', avant?.base_price === 149 && apres?.base_price === 159, [avant?.base_price, apres?.base_price]);
    const versionsEss = (await get('/tarifs/plans/tous', admin)).corps.versions.filter((v: PlanTarif) => v.plan_id === 'agent-essential');
    verifier("l'ancienne version reste, intacte, avec son effective_to",
      versionsEss.length === 2 && versionsEss.some((v: PlanTarif) => v.base_price === 149 && v.effective_to === '2027-01-01') && seed('agent-essential')!.effective_to === null);
    verifier('une seconde version à la même date est refusée (pas d\'écrasement)', (await post('/tarifs/plans', { ...v2, base_price: 169 }, admin)).statut === 400);
    verifier('une version antérieure à la dernière est refusée', (await post('/tarifs/plans', { ...v2, effective_from: '2026-12-01' }, admin)).statut === 400);
    const starter2027 = planALaDate(routesVersions(), 'pack-starter', '2027-02-01');
    verifier('le Starter suit ses composants : 159 + 69 = 228 € HT au 01/02/2027',
      starter2027?.prix_calcule === 228 && starter2027.base_price === 228 && starter2027.ecart_prix_force === null, starter2027 && [starter2027.prix_calcule, starter2027.base_price]);

    // --- quotes, to the cent
    const d1 = await post('/tarifs/devis', { lignes: [{ plan_id: 'agent-essential', quantite: 1 }, { plan_id: 'box-commander-36', quantite: 1 }], region: 'FR', date: '2026-10-07' });
    verifier('1 Essential + Box 36 mois = 218,00 HT, 43,60 TVA, 261,60 TTC',
      d1.statut === 200 && d1.corps.total_ht === 218 && d1.corps.total_tva === 43.6 && d1.corps.total_ttc === 261.6, d1.corps);
    const d2 = await post('/tarifs/devis', { lignes: [{ plan_id: 'pack-starter', quantite: 1 }], date: '2026-10-07' });
    const e = d2.corps.ecarts?.[0];
    verifier('devis Starter : 218,00 HT (261,60 TTC), sans écart',
      d2.statut === 200 && d2.corps.total_ht === 218 && d2.corps.total_ttc === 261.6 && e === undefined, d2.corps);
    const d3 = await post('/tarifs/devis', { lignes: [{ plan_id: 'agent-essential', quantite: 5 }], date: '2026-10-07' });
    const tc = d3.corps.lignes?.find((l: { plan_id: string }) => l.plan_id === 'task-commander');
    verifier('5 agents : Task Commander ajouté et offert, 745,00 HT', d3.corps.total_ht === 745 && tc?.offert === true && tc.montant_ht === 0 && d3.corps.total_ttc === 894, d3.corps);
    const d4 = await post('/tarifs/devis', { lignes: [{ plan_id: 'agent-essential', quantite: 4 }, { plan_id: 'task-commander', quantite: 1 }], date: '2026-10-07' });
    verifier('4 agents : Task Commander payant, 845,00 à 945,00 HT', d4.corps.total_ht === 845 && d4.corps.total_ht_max === 945 && d4.corps.total_ttc === 1014 && d4.corps.total_ttc_max === 1134, d4.corps);
    const d5 = await post('/tarifs/devis', { lignes: [{ plan_id: 'home-digital', quantite: 2 }, { plan_id: 'home-family', quantite: 1 }], date: '2026-10-07' });
    verifier('Home : 2 × 49 TTC + Home Family 149–169 TTC = 247 TTC (205,83 HT), jusqu\'à 267 TTC',
      d5.corps.total_ttc === 247 && d5.corps.total_ht === 205.83 && d5.corps.total_tva === 41.17 && d5.corps.total_ttc_max === 267, d5.corps);
    verifier('devis d\'une ancienne offre refusé', (await post('/tarifs/devis', { lignes: [{ plan_id: 'agent-unique', quantite: 1 }] })).statut === 400);
    verifier('devis d\'un plan sur devis refusé', (await post('/tarifs/devis', { lignes: [{ plan_id: 'pack-enterprise', quantite: 1 }] })).statut === 400);
    verifier('devis dans un pays sans fiscalité refusé', (await post('/tarifs/devis', { lignes: [{ plan_id: 'agent-essential', quantite: 1 }], region: 'ZZ' })).statut === 400);

    // --- call cost: nothing invented
    const appel = { duree_s: 120, provider_tel: 'telnyx', provider_voix: 'piper', jetons_llm: { entree: 1000, sortie: 500 } };
    verifier('/tarifs/cout-appel refusé sans jeton', (await post('/tarifs/cout-appel', appel)).statut === 401);
    const c1 = await post('/tarifs/cout-appel', appel, admin);
    verifier('/tarifs/cout-appel dit ce qui manque (téléphonie et marge sans source) au lieu d\'inventer',
      c1.statut === 422 && c1.corps.manque.some((m: string) => m.startsWith('téléphonie (telnyx)')) && c1.corps.manque.some((m: string) => m.startsWith('marge')) && c1.corps.detail.voix === 0, c1.corps);
    verifier('opérateur inconnu refusé', (await post('/tarifs/cout-appel', { ...appel, provider_tel: 'inconnu' }, admin)).statut === 400);
    const complets: CoutsFournisseurs = {
      ...t.couts,
      telephonie: { ...t.couts.telephonie, telnyx: { par_minute: 0.01, source: 'banc' } },
      voix: { ...t.couts.voix, elevenlabs: { par_minute: 0.05, source: 'banc' } },
      outils: { taux: { recherche: { par_appel: 0.002, source: 'banc' } } },
      marge: { taux: 0.2, source: 'banc' },
    };
    const c2 = coutAppel({ ...appel, provider_voix: 'elevenlabs', outils: [{ id: 'recherche', appels: 5 }] }, complets, t.tarifsApi);
    // 0.02 + 0.10 + (1000×2 + 500×10)/1e6 × 0.92 = 0.00644 + 0.01 → 0.13644 × 1.2
    verifier('coût d\'un appel complet : téléphonie + voix + LLM + outils + marge = 0,1637 €',
      c2.complet && c2.detail.telephonie === 0.02 && c2.detail.voix === 0.1 && c2.detail.llm === 0.0064 && c2.detail.outils === 0.01 && c2.total === 0.1637, c2);
    const sansSourceTaux = coutAppel(appel, { ...complets, telephonie: { ...complets.telephonie, telnyx: { par_minute: 0.01, source: null } } }, t.tarifsApi);
    verifier('un taux chiffré mais sans source vaut manquant', !sansSourceTaux.complet && sansSourceTaux.total === null);

    // --- site export: same shape as frontend/src/data/tarifs.json (plan-site)
    const ex = await get('/tarifs/export-site?date=2026-10-07');
    const temoin = lireJson('./temoin-site-tarifs.json');
    const forme = ecartsDeForme(ex.corps, temoin);
    verifier('GET /tarifs/export-site a la forme de frontend/src/data/tarifs.json (témoin de plan-site 704e722)', ex.statut === 200 && forme.length === 0, forme);
    const nEx = nombres(ex.corps), nTe = nombres(temoin);
    const prixDiff = Object.keys(nTe).filter((k) => nEx[k] !== nTe[k]).map((k) => `${k}: ${nEx[k]} au lieu de ${nTe[k]}`);
    verifier('les montants exportés sont ceux du site', prixDiff.length === 0, prixDiff);
    verifier("l'export ne publie aucune ancienne offre dans box ni packs",
      !ex.corps.box.some((b: { id: string }) => anciens.includes(b.id)) && ex.corps.archives.masquees.join(',') === 'box-max,puissance-1,puissance-2,puissance-3');
    let vivant: unknown = null;
    try { vivant = JSON.parse(execFileSync('git', ['show', 'origin/plan-site:frontend/src/data/tarifs.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { /* branch not fetched here */ }
    if (vivant) {
      const f = ecartsDeForme(ex.corps, vivant);
      verifier('même forme que le tarifs.json actuel de origin/plan-site', f.length === 0, f);
    } else console.log('  (origin/plan-site absente ici : comparaison au seul témoin)');
  } finally {
    serveur.close();
  }

  function routesVersions(): PlanTarif[] {
    return [...depart, ...stockage.lister<PlanTarif>('tarifs_versions')];
  }
  return fautes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await lancer();
  process.exit(n ? 1 : 0);
}
