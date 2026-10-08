// Banc du module « create ». Sans clé : le moteur d'IA est remplacé par un moteur
// de banc injecté, et tout passe par un VRAI serveur sur 127.0.0.1.
// Vérifie : le refus sans clé, le refus d'une sortie mal formée (rien n'est
// écrit), le plafond de 20 opportunités par jour, la publication, que chaque
// agent proposé existe dans agents/, que l'équipe change par phase, que la règle
// est déterministe, et le budget recalculé ici indépendamment.

import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { creerPlateforme, messageASigner } from '../serveur.ts';
import { Stockage } from '../stockage.ts';
import type { Box, Etude, Opportunity, ProjetCree } from '../modele.ts';
import { C_ETUDES, C_OPPORTUNITES, creerRoutes } from './routes.ts';
import { moteurDepuisEnv, type DemandeMoteur, type MoteurIA } from './moteur.ts';
import { PHASES, equipePour, fautesDesPhases, licencePour, type Phase } from './equipes.ts';
import { AGENTS_PAR_BOX_MAX, PRIX_PROVISOIRES, boxPour } from './budget.ts';
import { pourApi, schemaOpportunites } from './schemas.ts';

let fautes = 0;
function verifier(quoi: string, vrai: boolean): void {
  if (vrai) console.log(`  ok  ${quoi}`);
  else { fautes++; console.log(`  FAUTE  ${quoi}`); }
}

// --- Independent truth, read straight from the repository -------------------
const racine = new URL('../../', import.meta.url);
const fichiersAgents = new Set(readdirSync(new URL('agents/', racine)).map((f) => f.slice(0, 7)));
const catalogue = JSON.parse(readFileSync(new URL('catalogue/catalogue.json', racine), 'utf8')) as { agents: { id: string; metier: string }[] };
const metiers = new Map(catalogue.agents.map((a) => [a.id, a.metier]));
const existe = (id: string) => /^AG-\d{4}$/.test(id) && fichiersAgents.has(id) && metiers.has(id);

// --- Bench engine ------------------------------------------------------------
const est = (min: number, max: number, unite: string) => ({ min, max, unite, hypotheses: [`hypothèse de banc ${min}-${max}`] });
function opportuniteBanc(i: number, besoins: string[] = ['b2c', 'ecommerce']) {
  return {
    titre: `Opportunité de banc ${i}`, marche: 'Marché de banc', score: 50 + (i % 40),
    pourquoi_maintenant: 'Un changement récent', demande: 'Demande observée', concurrence: 'Peu de concurrents',
    contraintes: 'Stock à financer', capital_estime: est(10000, 40000, 'EUR'), complexite: 'moyenne',
    delai_mois: est(3, 6, 'mois'), recurrence: 'recurrente', risques: ['Saisonnalité'], besoins,
  };
}
function etudeBanc(besoins: string[] = ['b2c', 'ecommerce', 'logistique']) {
  const sc = (a: number) => ({ chiffre_affaires_annee1: est(a, a * 2, 'EUR'), couts_annee1: est(a / 2, a, 'EUR'), capital_necessaire: est(20000, 50000, 'EUR'), hypotheses: ['taux de conversion de 1 %'] });
  return {
    titre: 'Étude de banc', resume: 'Une boutique en ligne de produits locaux.', besoins,
    scenarios: { prudent: sc(20000), central: sc(60000), ambitieux: sc(150000) },
    couts: [{ poste: 'Stock initial', montant: est(5000, 15000, 'EUR') }],
    canaux: [{ canal: 'Réseaux sociaux', pourquoi: 'Clientèle jeune' }],
    reglementation: [{ sujet: 'Vente à distance', obligation: 'Droit de rétractation de 14 jours', a_verifier_aupres: 'DGCCRF' }],
    plan_execution: (['01', '02', '03', '04', '05'] as const).map((phase, i) => ({ phase, duree_mois: est(i + 1, i + 3, 'mois'), actions: [`Action ${phase}`] })),
  };
}

const appels: DemandeMoteur[] = [];
let prochaine: (d: DemandeMoteur) => unknown = () => { throw new Error('aucune sortie de banc préparée'); };
const moteurBanc: MoteurIA = { modele: 'moteur-de-banc', generer: async (d) => { appels.push(d); return prochaine(d); } };

// --- Servers -------------------------------------------------------------------
const secret = 'secret-admin-de-banc-create-long';
const admin = { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };

async function demarrer(routes: ReturnType<typeof creerRoutes>, stockage: Stockage) {
  const { serveur } = creerPlateforme({ secretAdmin: secret, fichierDonnees: null }, { stockage, routes });
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  return { serveur, base: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}` };
}

function nouvelleBox(stockage: Stockage, id: string, tenant: string | null): KeyObject {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const box: Box = {
    device_id: id, tenant_id: tenant, serial: `SN-${id}`, gamme: 'business', os: 'ubuntu-core',
    identite_publique: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    version_desktop: '0.2.1', statut: tenant ? 'active' : 'stock', plan_id: null, sante: null, garantie_jusqu_au: null,
  };
  stockage.poser('boxes', id, box);
  return privateKey;
}

async function appelBox(base: string, id: string, cle: KeyObject, methode: 'GET' | 'POST', chemin: string, corps?: unknown) {
  const brut = corps === undefined ? '' : JSON.stringify(corps);
  const h = new Date().toISOString();
  const sig = sign(null, Buffer.from(messageASigner(methode, chemin, h, brut)), cle).toString('base64');
  return fetch(`${base}${chemin}`, { method: methode, body: brut || undefined, headers: { 'x-box-id': id, 'x-horodatage': h, 'x-signature': sig } });
}

const post = (base: string, chemin: string, corps: unknown, entetes: Record<string, string> = admin) =>
  fetch(`${base}${chemin}`, { method: 'POST', headers: entetes, body: JSON.stringify(corps) });

export async function lancer(): Promise<number> {
  fautes = 0;

  // 1. No key: the real engine factory refuses and says what is missing.
  console.log('  Sans clé');
  const sansCle = moteurDepuisEnv({});
  verifier('sans ANTHROPIC_API_KEY, aucun moteur', 'manque' in sansCle && sansCle.manque.includes('ANTHROPIC_API_KEY'));
  {
    const s = new Stockage(null);
    const { serveur, base } = await demarrer(creerRoutes({ moteur: sansCle }), s);
    const r = await post(base, '/create/opportunites/generer', { nombre: 2 });
    const c = await r.json();
    verifier('générer sans clé : 503 et le manque nommé', r.status === 503 && String(c.erreur).includes('ANTHROPIC_API_KEY'));
    const e = await post(base, '/create/etudes', { idee: 'Une épicerie de quartier en ligne' }, { 'content-type': 'application/json' });
    verifier('étude sans clé : 503', e.status === 503);
    verifier('sans clé, rien n\'est écrit', s.lister(C_OPPORTUNITES).length === 0 && s.lister(C_ETUDES).length === 0);
    serveur.close();
  }

  const s = new Stockage(null);
  const { serveur, base } = await demarrer(creerRoutes({ moteur: { moteur: moteurBanc } }), s);
  try {
    // 2. Opportunities.
    console.log('  Opportunités du jour');
    verifier('générer sans jeton admin : refusé', (await post(base, '/create/opportunites/generer', { nombre: 1 }, { 'content-type': 'application/json' })).status === 401);
    prochaine = (d) => ({ opportunites: [1, 2, 3].map((i) => opportuniteBanc(i)) });
    let r = await post(base, '/create/opportunites/generer', { nombre: 3 });
    let c = await r.json();
    verifier('trois brouillons écrits', r.status === 201 && c.brouillons.length === 3 && c.brouillons.every((o: Opportunity) => o.statut === 'brouillon'));
    const carte = c.brouillons[0].carte as Record<string, string>;
    const rubriques = ['pourquoi_maintenant', 'marche', 'demande', 'concurrence', 'contraintes', 'capital_estime', 'complexite', 'delai', 'recurrence', 'risques', 'equipe_recommandee'];
    verifier('la carte porte les onze rubriques du §9', rubriques.every((k) => typeof carte[k] === 'string' && carte[k].length > 0));
    verifier('capital et délai marqués « Estimation » avec leurs hypothèses', carte.capital_estime.startsWith('Estimation') && carte.capital_estime.includes('hypothèses') && carte.delai.startsWith('Estimation'));
    const cites = [...carte.equipe_recommandee.matchAll(/AG-\d{4}/g)].map((m) => m[0]);
    verifier("l'équipe recommandée ne cite que des agents réels", cites.length > 0 && cites.every(existe));
    verifier('le schéma envoyé borne le nombre demandé', JSON.stringify(appels.at(-1)!.schema).includes('"maxItems":3'));
    verifier("la copie pour l'API retire les bornes que la grammaire ne prend pas",
      !JSON.stringify(pourApi(schemaOpportunites(3))).includes('maxItems') && JSON.stringify(pourApi(schemaOpportunites(3))).includes('additionalProperties'));

    let pub = await (await fetch(`${base}/create/opportunites`)).json();
    verifier('un brouillon n\'est pas public', pub.opportunites.length === 0);
    const toutes = await (await fetch(`${base}/create/opportunites/toutes`, { headers: admin })).json();
    verifier('le back-office voit les brouillons', toutes.opportunites.length === 3);
    verifier('/toutes refusé sans jeton', (await fetch(`${base}/create/opportunites/toutes`)).status === 401);
    const idPub = c.brouillons[0].id as string;
    verifier('publier sans jeton : refusé', (await post(base, `/create/opportunites/${idPub}/publier`, {}, { 'content-type': 'application/json' })).status === 401);
    r = await post(base, `/create/opportunites/${idPub}/publier`, {});
    verifier('publier par le back-office', r.status === 200 && (await r.json()).statut === 'publiee');
    pub = await (await fetch(`${base}/create/opportunites`)).json();
    verifier('seule la publiée est publique', pub.opportunites.length === 1 && pub.opportunites[0].id === idPub);
    verifier('date mal écrite refusée', (await fetch(`${base}/create/opportunites?date=hier`)).status === 400);

    // Malformed opportunity outputs: refused whole, nothing written.
    const avant = s.lister(C_OPPORTUNITES).length;
    const malformees: [string, unknown][] = [
      ['un champ manque', { opportunites: [(({ risques, ...x }) => x)(opportuniteBanc(9))] }],
      ['un champ en trop', { opportunites: [{ ...opportuniteBanc(9), rentabilite: 'forte' }] }],
      ['minimum au-dessus du maximum', { opportunites: [{ ...opportuniteBanc(9), capital_estime: est(50000, 1000, 'EUR') }] }],
      ['un besoin hors liste', { opportunites: [opportuniteBanc(9, ['crypto'])] }],
      ['une hypothèse absente', { opportunites: [{ ...opportuniteBanc(9), delai_mois: { min: 1, max: 2, unite: 'mois', hypotheses: [] } }] }],
      ['une promesse de rentabilité', { opportunites: [{ ...opportuniteBanc(9), demande: 'Rentabilité garantie dès la première année' }] }],
      ['plus que demandé', { opportunites: [opportuniteBanc(9), opportuniteBanc(10)] }],
      ['pas un objet', 'du texte'],
    ];
    for (const [quoi, sortie] of malformees) {
      prochaine = () => sortie;
      r = await post(base, '/create/opportunites/generer', { nombre: 1 });
      c = await r.json();
      verifier(`sortie mal formée refusée (${quoi})`, r.status === 502 && String(c.erreur).includes('mal formée'));
    }
    verifier('aucune sortie mal formée n\'a été écrite, ni « réparée »', s.lister(C_OPPORTUNITES).length === avant);

    // Daily ceiling.
    prochaine = (d) => ({ opportunites: Array.from({ length: Number(JSON.stringify(d.schema).match(/"maxItems":(\d+)/)![1]) }, (_, i) => opportuniteBanc(100 + i)) });
    r = await post(base, '/create/opportunites/generer', { nombre: 18 });
    verifier('au-delà du reste du jour : refusé (3 + 18 > 20)', r.status === 429);
    r = await post(base, '/create/opportunites/generer', { nombre: 17 });
    verifier('jusqu\'à 20 le même jour', r.status === 201 && s.lister(C_OPPORTUNITES).length === 20);
    r = await post(base, '/create/opportunites/generer', {});
    verifier('la 21e est refusée', r.status === 429 && s.lister(C_OPPORTUNITES).length === 20);

    // 3. Studies.
    console.log('  Étude gratuite');
    const pub2 = { 'content-type': 'application/json' };
    verifier('idée trop courte refusée', (await post(base, '/create/etudes', { idee: 'vélo' }, pub2)).status === 400);
    verifier('idée et opportunité à la fois refusées', (await post(base, '/create/etudes', { idee: 'Une idée assez longue', opportunite_id: idPub }, pub2)).status === 400);
    const brouillon = s.lister<Opportunity>(C_OPPORTUNITES, (o) => o.statut === 'brouillon')[0];
    verifier('étude depuis un brouillon refusée', (await post(base, '/create/etudes', { opportunite_id: brouillon.id }, pub2)).status === 404);

    const etudesAvant = s.lister(C_ETUDES).length;
    const e0 = etudeBanc();
    const etudesMal: [string, unknown][] = [
      ['phases dans le désordre', { ...e0, plan_execution: [...e0.plan_execution].reverse() }],
      ['scénarios inversés', { ...e0, scenarios: { ...e0.scenarios, prudent: e0.scenarios.ambitieux, ambitieux: e0.scenarios.prudent } }],
      ['unité monétaire inconnue', { ...e0, couts: [{ poste: 'Stock', montant: est(1, 2, 'USD') }] }],
      ['scénario manquant', { ...e0, scenarios: { prudent: e0.scenarios.prudent, central: e0.scenarios.central } }],
      ['agents nommés par le moteur', { ...e0, agents: ['AG-0001'] }],
      ['succès promis', { ...e0, resume: 'Un succès assuré sur ce marché.' }],
    ];
    for (const [quoi, sortie] of etudesMal) {
      prochaine = () => sortie;
      r = await post(base, '/create/etudes', { idee: 'Une boutique en ligne de produits locaux' }, pub2);
      verifier(`étude mal formée refusée (${quoi})`, r.status === 502);
    }
    verifier('aucune étude mal formée écrite', s.lister(C_ETUDES).length === etudesAvant);

    prochaine = () => etudeBanc();
    r = await post(base, '/create/etudes', { idee: 'Une boutique en ligne de produits locaux' }, pub2);
    const etude = (await r.json()) as Etude;
    verifier('étude écrite depuis une idée', r.status === 201 && etude.source.idee !== null);
    verifier("l'idée part au moteur comme une donnée", appels.at(-1)!.utilisateur.includes('"""Une boutique en ligne de produits locaux"""'));
    verifier('identifiant non devinable (144 bits)', /^et_[A-Za-z0-9_-]{24}$/.test(etude.id));
    const estimations = [
      ...Object.values(etude.scenarios).flatMap((x) => [x.chiffre_affaires_annee1, x.couts_annee1, x.capital_necessaire]),
      ...etude.couts.map((x) => x.montant), ...etude.plan_execution.map((x) => x.duree_mois),
    ];
    verifier('chaque chiffre est marqué « estimation » avec ses hypothèses', estimations.every((x) => x.nature === 'estimation' && x.hypotheses.length > 0));
    verifier("l'étude porte l'avertissement « aucune promesse »", /aucun de ces chiffres n'est une promesse/.test(etude.avertissement));
    const proposes = etude.agents_par_phase.flatMap((p) => p.agents);
    verifier('agents par phase : cinq phases', etude.agents_par_phase.map((p) => p.phase).join() === '01,02,03,04,05');
    verifier('chaque agent proposé existe dans agents/ et au catalogue', proposes.length > 0 && proposes.every((a) => existe(a.agent_id)));
    verifier('le métier affiché est celui du catalogue', proposes.every((a) => metiers.get(a.agent_id) === a.metier));
    verifier('lecture publique de l\'étude', (await fetch(`${base}/create/etudes/${etude.id}`)).status === 200);
    verifier('identifiant inconnu : 404', (await fetch(`${base}/create/etudes/et_inconnu`)).status === 404);

    r = await post(base, '/create/etudes', { opportunite_id: idPub }, pub2);
    const etudeOpp = (await r.json()) as Etude;
    verifier("étude depuis l'opportunité publiée", r.status === 201 && etudeOpp.source.opportunite_id === idPub);
    verifier("l'opportunité renvoie à son étude", s.lire<Opportunity>(C_OPPORTUNITES, idPub)!.etude_id === etudeOpp.id);

    // 4. Deterministic team rule.
    console.log('  Règle des équipes');
    verifier('le fichier des phases est sain', fautesDesPhases().length === 0);
    for (const p of PHASES) {
      const a = equipePour(p, ['logistique', 'ecommerce', 'b2c']).map((m) => m.agent_id).join();
      const b = equipePour(p, ['b2c', 'ecommerce', 'logistique']).map((m) => m.agent_id).join();
      if (a !== b) verifier(`phase ${p.numero} : même équipe quel que soit l'ordre des besoins`, false);
    }
    verifier("l'ordre des besoins ne change aucune équipe", true);
    const p03 = PHASES.find((p) => p.numero === '03')!;
    verifier('« ecommerce » ajoute la boutique en phase 03, son absence ne l\'ajoute pas',
      equipePour(p03, ['ecommerce']).some((m) => m.agent_id === 'AG-0360') && !equipePour(p03, ['b2b']).some((m) => m.agent_id === 'AG-0360'));
    verifier('un agent ne figure qu\'une fois par équipe', PHASES.every((p) => {
      const ids = equipePour(p, Object.keys(JSON.parse(readFileSync(new URL('./equipes-phases.json', import.meta.url), 'utf8')).besoins)).map((m) => m.agent_id);
      return new Set(ids).size === ids.length;
    }));
    const faux: Phase[] = PHASES.map((p) => (p.numero === '04' ? { ...p, socle: [...p.socle, { agent: 'AG-9999', role: 'Inventé', pourquoi: 'banc' }] } : p));
    verifier('la règle refuse un agent inventé (garde éprouvée)', fautesDesPhases(faux).some((f) => f.includes('AG-9999')));
    const figees: Phase[] = PHASES.map((p) => ({ ...p, socle: PHASES[0].socle }));
    verifier("la règle refuse une équipe qui ne change pas d'une phase à l'autre", fautesDesPhases(figees).some((f) => f.includes('même équipe')));
    verifier('licence : un poste réglementé est Expert, un poste de marché Professional', licencePour('AG-0026') === 'expert' && licencePour('AG-0654') === 'professional');

    // 5. Composed company.
    console.log('  Entreprise composée');
    verifier('Box : 20 agents tiennent sur une, 21 en demandent deux, 45 trois', boxPour(20) === 1 && boxPour(21) === 2 && boxPour(45) === 3 && AGENTS_PAR_BOX_MAX === 20);
    const cleA = nouvelleBox(s, 'BOX-A', 'tenant-a');
    const cleB = nouvelleBox(s, 'BOX-B', 'tenant-b');
    const cleStock = nouvelleBox(s, 'BOX-STOCK', null);
    verifier('sans signature : refusé', (await post(base, '/create/box/projets', { etude_id: etude.id }, { 'content-type': 'application/json' })).status === 401);
    verifier('Box non attribuée : refusée', (await appelBox(base, 'BOX-STOCK', cleStock, 'POST', '/create/box/projets', { etude_id: etude.id })).status === 403);
    verifier('étude inconnue : 404', (await appelBox(base, 'BOX-A', cleA, 'POST', '/create/box/projets', { etude_id: 'et_x' })).status === 404);
    r = await appelBox(base, 'BOX-A', cleA, 'POST', '/create/box/projets', { etude_id: etude.id });
    const projet = (await r.json()) as ProjetCree;
    verifier('projet composé', r.status === 201 && projet.tenant_id === 'tenant-a');
    verifier('les cinq phases du §9 dans l\'ordre', projet.phases.map((p) => `${p.numero} ${p.nom}`).join(', ') === '01 Étudier, 02 Financer, 03 Construire, 04 Lancer, 05 Exploiter');
    const tous = projet.phases.flatMap((p) => p.equipe);
    verifier('chaque agent du projet existe dans agents/ et au catalogue', tous.every((m) => existe(m.agent_id)));
    const signature = (p: ProjetCree['phases'][number]) => p.equipe.map((m) => m.agent_id).sort().join();
    verifier("l'équipe change à chaque phase", projet.phases.every((p, i) => i === 0 || signature(p) !== signature(projet.phases[i - 1])));
    verifier('jalons et responsabilités humaines à chaque phase', projet.phases.every((p) => p.jalons.length > 0 && p.responsabilites_humaines.length > 0));

    const tarifsBranches = existsSync(new URL('../tarifs/donnees.ts', import.meta.url));
    verifier(tarifsBranches ? 'prix lus au moteur de tarifs' : 'prix provisoires, et le projet le dit', projet.prix_provisoires === !tarifsBranches);
    if (!tarifsBranches) {
      const parLicence: Record<string, string> = { essential: 'agent-essential', professional: 'agent-professional', expert: 'agent-expert' };
      const attendus = projet.phases.map((p) => {
        const n = p.equipe.length;
        return p.equipe.reduce((t, m) => t + PRIX_PROVISOIRES[parLicence[m.licence]], 0)
          + (n < 5 ? PRIX_PROVISOIRES['task-commander'] : 0)
          + Math.ceil(n / 20) * PRIX_PROVISOIRES['box-commander-36'];
      });
      verifier('budget mensuel de chaque phase recalculé ici, au même euro', projet.phases.every((p, i) => p.budget.mensuel_ht === attendus[i]));
      const etudeDurees = etude.plan_execution.map((x) => x.duree_mois);
      verifier('budget de phase = mensuel × durée de l\'étude', projet.phases.every((p, i) => p.budget.total_ht.min === Math.round(attendus[i] * etudeDurees[i].min) && p.budget.total_ht.max === Math.round(attendus[i] * etudeDurees[i].max)));
      verifier('Task Commander compté sous 5 agents, inclus au-delà', projet.phases.every((p) => p.budget.detail.some((d) => (p.equipe.length < 5 ? d.startsWith('task-commander à') : d.startsWith('task-commander inclus')))));
    }
    verifier('budget et consommation marqués « estimation »', projet.phases.every((p) => p.budget.total_ht.nature === 'estimation' && p.budget.consommation_ia.nature === 'estimation' && p.budget.consommation_ia.min <= p.budget.consommation_ia.max && p.budget.consommation_ia.max > 0));
    const sommeMin = projet.phases.reduce((t, p) => t + p.budget.total_ht.min + p.budget.consommation_ia.min, 0);
    verifier('le total est la somme des phases', projet.budget_total_ht.min === sommeMin && projet.budget_total_ht.min <= projet.budget_total_ht.max);
    verifier('Box recommandée : une pour moins de 20 agents', projet.box_recommandee.nombre === boxPour(Math.max(...projet.phases.map((p) => p.equipe.length))) && projet.box_recommandee.plan_id === 'box-commander-36');

    const listeA = await (await appelBox(base, 'BOX-A', cleA, 'GET', '/create/box/projets')).json();
    const listeB = await (await appelBox(base, 'BOX-B', cleB, 'GET', '/create/box/projets')).json();
    verifier('la Box voit son projet', listeA.projets.length === 1 && listeA.projets[0].id === projet.id);
    verifier("une autre Box ne voit pas le projet d'un autre client", listeB.projets.length === 0);
  } finally {
    serveur.close();
  }
  return fautes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await lancer();
  console.log(n ? `\n${n} faute(s).` : '\nCreate : tout passe.');
  process.exit(n ? 1 : 0);
}
