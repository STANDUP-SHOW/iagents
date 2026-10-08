// The pricing engine (MASTER §5, §12, §13): pure functions only, no file and
// no network, so the back-office and the Home site can import them as they are.
// Data comes in as arguments: plan versions (plans.json + versions posted
// later), the VAT table (fiscalite.json), provider rates
// (couts-fournisseurs.json) and the LLM price sheet (dimensionnement/tarifs-api.json).
//
// Rules held here and nowhere else:
//  - a new version closes the previous one (effective_to = its own
//    effective_from) and never overwrites it;
//  - a price is written once, in its tax_mode; the other amount is computed
//    from the VAT table, in cents;
//  - a pack with a composition is worth the sum of its components read at the
//    same date; `prix_force` wins when set, and the gap stays visible;
//  - a legacy plan is never public;
//  - a rate without a source is null, and the call cost names what is missing.

import type { Plan } from '../modele.ts';

export type Famille = 'box' | 'agent' | 'commander' | 'pack' | 'voice' | 'home';
export const FAMILLES: Famille[] = ['box', 'agent', 'commander', 'pack', 'voice', 'home'];
export type FormeSite = 'environ' | 'fourchette' | 'a-partir-de' | 'sur-devis';

export type Ligne = { plan_id: string; quantite: number };

/** A plan version as the engine stores it: the common Plan plus where its price comes from. */
export type PlanTarif = Plan & {
  famille: Famille;
  /** Where this price was read. A plan without a source is refused. */
  source: string;
  /** MASTER: « tarifs à considérer comme hypothèses de lancement ». */
  hypothese_de_lancement: boolean;
  composition?: Ligne[];
  prix_force?: { montant: number; source: string } | null;
  inclus_a_partir_de_agents?: number;
  prix_achat?: number | null;
  forme_site?: FormeSite;
  note?: string;
  /** Seed only: the price lives in another file of the repository. */
  prix_depuis?: { fichier: string; offre: string };
};

/** A version as read at a date: base_price resolved, and the pack gap when there is one. */
export type PlanLu = PlanTarif & { prix_calcule: number | null; ecart_prix_force: number | null };

export type Fiscalite = { pays: Record<string, { devise: string; taux_normal: number; source: string }> };

export type FichierPlans = {
  version: string;
  source: string;
  hypotheses_de_lancement: boolean;
  consommation: { phrase: string; source: string };
  archives_note: string;
  plans: PlanTarif[];
};

type OffreBox = { id: string; nom: string; abonnementMensuel?: number; prixAchat?: number };

// ---------------------------------------------------------------- dates

const JOUR = /^\d{4}-\d{2}-\d{2}/;
function instant(d: string, quoi: string): number {
  const t = Date.parse(d);
  if (!JOUR.test(d) || !Number.isFinite(t)) throw new Error(`${quoi} n'est pas une date lisible (attendu AAAA-MM-JJ) : « ${d} ».`);
  return t;
}
export const aujourdHui = (maintenant: Date): string => maintenant.toISOString().slice(0, 10);

// ---------------------------------------------------------------- seed

/** Resolves the seed file: legacy machine plans read their name and prices from offre-box.json. */
export function plansDeDepart(fichier: FichierPlans, offreBox: { offres: OffreBox[] }): PlanTarif[] {
  return fichier.plans.map((p) => {
    if (!p.prix_depuis) return { ...p };
    const o = offreBox.offres.find((x) => x.id === p.prix_depuis!.offre);
    if (!o || typeof o.abonnementMensuel !== 'number') {
      throw new Error(`Le plan ${p.plan_id} lit son prix dans ${p.prix_depuis.fichier}, qui n'a pas d'offre « ${p.prix_depuis.offre} » avec un abonnement mensuel.`);
    }
    return { ...p, nom: o.nom, base_price: o.abonnementMensuel, prix_achat: typeof o.prixAchat === 'number' ? o.prixAchat : null };
  });
}

// ---------------------------------------------------------------- validation

const nombreOuNull = (x: unknown) => x === null || (typeof x === 'number' && Number.isFinite(x) && x >= 0);

/** Every reason this version cannot be accepted, in French. Empty = accepted. */
export function fautesDuPlan(p: Partial<PlanTarif>, fiscalite: Fiscalite): string[] {
  const f: string[] = [];
  if (typeof p.plan_id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.plan_id)) f.push('plan_id manque ou est mal écrit (minuscules, chiffres et tirets).');
  if (typeof p.source !== 'string' || p.source.trim().length < 3) f.push("le plan n'a pas de source : un prix ne s'écrit qu'avec ce qui le dit (document, page, date).");
  if (typeof p.nom !== 'string' || !p.nom.trim()) f.push('nom manque.');
  if (typeof p.description !== 'string') f.push('description manque.');
  if (!FAMILLES.includes(p.famille as Famille)) f.push(`famille doit être l'une de : ${FAMILLES.join(', ')}.`);
  if (!['business', 'home', 'voice', 'enterprise'].includes(p.segment as string)) f.push('segment doit être business, home, voice ou enterprise.');
  if (p.billing_period !== 'mois' && p.billing_period !== 'annee') f.push('billing_period doit être mois ou annee.');
  if (!Number.isInteger(p.commitment_months) || (p.commitment_months as number) < 0) f.push('commitment_months doit être un nombre entier de mois.');
  const fisc = typeof p.region === 'string' ? fiscalite.pays[p.region] : undefined;
  if (!fisc) f.push(`aucune fiscalité connue pour la région « ${String(p.region)} » (fiscalite.json).`);
  else if (p.currency !== fisc.devise) f.push(`la devise de ${p.region} est ${fisc.devise}, pas ${String(p.currency)}.`);
  if (p.tax_mode !== 'HT' && p.tax_mode !== 'TTC') f.push('tax_mode doit être HT ou TTC.');
  if (!nombreOuNull(p.base_price)) f.push('base_price doit être un montant positif, ou null pour « sur devis ».');
  if (!nombreOuNull(p.base_price_max)) f.push('base_price_max doit être un montant positif ou null.');
  if (typeof p.base_price === 'number' && typeof p.base_price_max === 'number' && p.base_price_max < p.base_price) f.push('base_price_max est plus bas que base_price.');
  for (const k of ['a_partir_de', 'included_commander', 'included_box', 'public_visibility', 'legacy_flag', 'hypothese_de_lancement'] as const) {
    if (typeof p[k] !== 'boolean') f.push(`${k} doit être vrai ou faux.`);
  }
  for (const k of ['included_agents', 'included_voice_minutes'] as const) {
    if (!Number.isInteger(p[k]) || (p[k] as number) < 0) f.push(`${k} doit être un nombre entier.`);
  }
  for (const k of ['usage_rate_llm', 'usage_rate_voice', 'usage_rate_telephony'] as const) {
    if (!nombreOuNull(p[k])) f.push(`${k} doit être un taux positif ou null.`);
  }
  if (p.legacy_flag === true && p.public_visibility === true) f.push('une ancienne offre (legacy_flag) ne peut pas être visible du public.');
  try {
    const de = instant(String(p.effective_from), 'effective_from');
    if (p.effective_to != null && instant(String(p.effective_to), 'effective_to') <= de) f.push("effective_to doit suivre effective_from.");
  } catch (e) { f.push((e as Error).message); }
  if (p.composition !== undefined) {
    if (!Array.isArray(p.composition) || p.composition.length === 0 || p.composition.some((l) => typeof l?.plan_id !== 'string' || !Number.isInteger(l?.quantite) || l.quantite < 1)) {
      f.push('composition doit lister des {plan_id, quantite} (quantité entière).');
    }
  }
  if (p.prix_force != null && (typeof p.prix_force.montant !== 'number' || typeof p.prix_force.source !== 'string' || !p.prix_force.source.trim())) {
    f.push('prix_force doit porter un montant et sa source.');
  }
  return f;
}

// ---------------------------------------------------------------- versions

const cle = (p: { plan_id: string; region: string }) => `${p.plan_id}|${p.region}`;

/** All versions with effective_to derived: each one is closed by the next of the same plan and region. */
export function versionsFermees(versions: PlanTarif[]): PlanTarif[] {
  const groupes = new Map<string, PlanTarif[]>();
  for (const v of versions) {
    const g = groupes.get(cle(v)) ?? [];
    g.push(v);
    groupes.set(cle(v), g);
  }
  const sortie: PlanTarif[] = [];
  for (const g of groupes.values()) {
    g.sort((a, b) => instant(a.effective_from, 'effective_from') - instant(b.effective_from, 'effective_from'));
    g.forEach((v, i) => {
      const suivante = g[i + 1]?.effective_from ?? null;
      let fin = v.effective_to ?? null;
      if (suivante && (!fin || instant(suivante, 'effective_from') < instant(fin, 'effective_to'))) fin = suivante;
      sortie.push({ ...v, effective_to: fin });
    });
  }
  return sortie;
}

/** Refuses a new version that would overwrite or rewrite the past of an existing one. */
export function fautesDeVersion(nouvelle: PlanTarif, existantes: PlanTarif[]): string[] {
  const memes = existantes.filter((v) => cle(v) === cle(nouvelle));
  if (memes.length === 0) return [];
  const derniere = Math.max(...memes.map((v) => instant(v.effective_from, 'effective_from')));
  if (instant(nouvelle.effective_from, 'effective_from') <= derniere) {
    return [`une version de ${nouvelle.plan_id} (${nouvelle.region}) existe déjà à cette date ou après : une nouvelle version doit commencer après la dernière, elle n'en écrase aucune.`];
  }
  return [];
}

function brute(versions: PlanTarif[], plan_id: string, date: string, region: string): PlanTarif | null {
  const t = instant(date, 'La date');
  for (const v of versionsFermees(versions.filter((x) => x.plan_id === plan_id && x.region === region))) {
    if (instant(v.effective_from, 'effective_from') <= t && (v.effective_to == null || t < instant(v.effective_to, 'effective_to'))) return v;
  }
  return null;
}

/** The version of a plan in force at a date, in a region, with its pack price resolved. */
export function planALaDate(versions: PlanTarif[], plan_id: string, date: string, region = 'FR', profondeur = 0): PlanLu | null {
  const v = brute(versions, plan_id, date, region);
  if (!v) return null;
  if (!v.composition) return { ...v, prix_calcule: null, ecart_prix_force: null };
  if (profondeur > 4) throw new Error(`La composition de ${plan_id} tourne en rond.`);
  let somme: number | null = 0;
  for (const l of v.composition) {
    const c = planALaDate(versions, l.plan_id, date, region, profondeur + 1);
    if (!c || c.base_price == null) { somme = null; break; }
    somme = centimes(somme! * 100 + centimes(c.base_price * 100) * l.quantite) / 100;
  }
  const force = v.prix_force?.montant ?? null;
  return {
    ...v,
    base_price: force ?? somme,
    prix_calcule: somme,
    ecart_prix_force: force != null && somme != null ? centimes((force - somme) * 100) / 100 : null,
  };
}

/** Plan ids in the order they first appear (the seed file's order). */
function identifiants(versions: PlanTarif[]): string[] {
  return [...new Set(versions.map((v) => v.plan_id))];
}

/** What the public may see at a date: never a legacy or hidden plan. */
export function plansVisibles(versions: PlanTarif[], o: { date: string; region?: string; segment?: string | null }): PlanLu[] {
  const region = o.region ?? 'FR';
  return identifiants(versions)
    .map((id) => planALaDate(versions, id, o.date, region))
    .filter((p): p is PlanLu => !!p && p.public_visibility && !p.legacy_flag && (!o.segment || p.segment === o.segment));
}

// ---------------------------------------------------------------- tax

const centimes = (x: number) => Math.round(x + 1e-9);

export type Prix = { tax_mode: 'HT' | 'TTC'; taux_tva: number; ht: number; tva: number; ttc: number };

/** One amount written in its tax_mode, the other computed in cents from the region's rate. */
export function prixHTTTC(montant: number, tax_mode: 'HT' | 'TTC', region: string, fiscalite: Fiscalite): Prix {
  const f = fiscalite.pays[region];
  if (!f) throw new Error(`Aucune fiscalité connue pour ${region} : le moteur ne devine pas un taux de TVA.`);
  const t = f.taux_normal;
  let ht: number, ttc: number;
  if (tax_mode === 'HT') { ht = centimes(montant * 100); ttc = ht + centimes(ht * t); }
  else { ttc = centimes(montant * 100); ht = centimes(ttc / (1 + t)); }
  return { tax_mode, taux_tva: t, ht: ht / 100, tva: (ttc - ht) / 100, ttc: ttc / 100 };
}

/** A plan as the public routes show it: the plan plus both amounts, never recopied. */
export function avecPrix(p: PlanLu, fiscalite: Fiscalite) {
  return {
    ...p,
    prix: p.base_price == null ? null : prixHTTTC(p.base_price, p.tax_mode, p.region, fiscalite),
    prix_max: p.base_price_max == null ? null : prixHTTTC(p.base_price_max, p.tax_mode, p.region, fiscalite),
  };
}

// ---------------------------------------------------------------- quote

export type EntreeDevis = { lignes: Ligne[]; region?: string; date?: string };

export function devis(entree: EntreeDevis, d: { versions: PlanTarif[]; fiscalite: Fiscalite; maintenant: Date }) {
  if (!entree || !Array.isArray(entree.lignes) || entree.lignes.length === 0) throw new Error('Le devis demande au moins une ligne {plan_id, quantite}.');
  const region = entree.region ?? 'FR';
  const date = entree.date ?? aujourdHui(d.maintenant);
  instant(date, 'La date');
  const fisc = d.fiscalite.pays[region];
  if (!fisc) throw new Error(`Aucune fiscalité connue pour ${region} : pas de devis possible tant que son taux de TVA n'est pas écrit dans fiscalite.json.`);

  const plans: { plan: PlanLu; quantite: number }[] = [];
  for (const l of entree.lignes) {
    if (typeof l?.plan_id !== 'string') throw new Error('Chaque ligne nomme un plan_id.');
    if (!Number.isInteger(l.quantite) || l.quantite < 1) throw new Error(`La quantité de ${l.plan_id} doit être un nombre entier positif.`);
    const p = planALaDate(d.versions, l.plan_id, date, region);
    if (!p) throw new Error(`Le plan ${l.plan_id} n'a pas de tarif en ${region} au ${date}.`);
    if (p.legacy_flag || !p.public_visibility) throw new Error(`${p.nom} est une ancienne offre, plus proposée.`);
    if (p.base_price == null) throw new Error(`${p.nom} se chiffre sur devis : il n'a pas de prix public.`);
    plans.push({ plan: p, quantite: l.quantite });
  }

  // Task Commander is offered from N agents; N is read on the plan, not written here.
  const commander = planALaDate(d.versions, 'task-commander', date, region);
  const seuil = commander?.inclus_a_partir_de_agents ?? null;
  const agents = plans.reduce((n, x) => n + x.plan.included_agents * x.quantite, 0);
  const offert = seuil != null && agents >= seuil;
  const commanderDejaInclus = plans.some((x) => x.plan.included_commander && x.plan.plan_id !== 'task-commander');
  if (offert && commander && !commanderDejaInclus && !plans.some((x) => x.plan.plan_id === 'task-commander')) {
    plans.push({ plan: commander, quantite: 1 });
  }

  let tHt = 0, tTtc = 0, tHtMax = 0, tTtcMax = 0, fourchette = false;
  const ecarts: { plan_id: string; prix_force: number; prix_calcule: number; ecart: number; source: string }[] = [];
  const lignes = plans.map(({ plan, quantite }) => {
    const gratuit = plan.plan_id === 'task-commander' && offert;
    const u = prixHTTTC(gratuit ? 0 : plan.base_price!, plan.tax_mode, region, d.fiscalite);
    const uMax = plan.base_price_max != null && !gratuit ? prixHTTTC(plan.base_price_max, plan.tax_mode, region, d.fiscalite) : u;
    if (uMax !== u) fourchette = true;
    const ht = Math.round(u.ht * 100) * quantite, ttc = Math.round(u.ttc * 100) * quantite;
    const htMax = Math.round(uMax.ht * 100) * quantite, ttcMax = Math.round(uMax.ttc * 100) * quantite;
    tHt += ht; tTtc += ttc; tHtMax += htMax; tTtcMax += ttcMax;
    if (plan.ecart_prix_force != null && plan.ecart_prix_force !== 0) {
      ecarts.push({ plan_id: plan.plan_id, prix_force: plan.prix_force!.montant, prix_calcule: plan.prix_calcule!, ecart: plan.ecart_prix_force, source: plan.prix_force!.source });
    }
    return {
      plan_id: plan.plan_id, nom: plan.nom, quantite, tax_mode: plan.tax_mode, a_partir_de: plan.a_partir_de,
      prix_unitaire_ht: u.ht, prix_unitaire_ttc: u.ttc,
      montant_ht: ht / 100, tva: (ttc - ht) / 100, montant_ttc: ttc / 100,
      montant_ht_max: uMax !== u ? htMax / 100 : null, montant_ttc_max: uMax !== u ? ttcMax / 100 : null,
      offert: gratuit,
      motif: gratuit ? `Offert à partir de ${seuil} agents (${agents} au devis).` : null,
      hypothese_de_lancement: plan.hypothese_de_lancement,
      source: plan.source,
    };
  });
  return {
    region, date, devise: fisc.devise, taux_tva: fisc.taux_normal,
    lignes,
    total_ht: tHt / 100, total_tva: (tTtc - tHt) / 100, total_ttc: tTtc / 100,
    total_ht_max: fourchette ? tHtMax / 100 : null, total_ttc_max: fourchette ? tTtcMax / 100 : null,
    a_partir_de: lignes.some((l) => l.a_partir_de),
    ecarts,
    hypotheses_de_lancement: lignes.some((l) => l.hypothese_de_lancement),
    consommation: 'La consommation IA (LLM, voix, téléphonie, services tiers) se facture à part, au réel.',
  };
}

// ---------------------------------------------------------------- call cost

type Taux = { par_minute: number | null; source: string | null; manque?: string };
export type CoutsFournisseurs = {
  devise: string;
  telephonie: Record<string, Taux>;
  voix: Record<string, Taux>;
  outils: { taux: Record<string, { par_appel: number | null; source: string | null; manque?: string }> };
  marge: { taux: number | null; source: string | null; manque?: string };
};
export type TarifsApi = {
  tauxUsdEur?: number;
  modeles: Record<string, { id: string; entree: number; entreeCache: number; sortie: number }>;
};
export type EntreeCoutAppel = {
  duree_s: number;
  provider_tel: string;
  provider_voix: string;
  jetons_llm: { entree: number; sortie: number; entree_cache?: number };
  modele_llm?: string;
  outils?: { id: string; appels: number }[];
};

const arrondi4 = (x: number) => Math.round(x * 10000) / 10000;

/** Telephony + voice + LLM + tools + margin. Any rate without a source is named in `manque`, never guessed. */
export function coutAppel(e: EntreeCoutAppel, couts: CoutsFournisseurs, tarifsApi: TarifsApi) {
  if (!e || typeof e.duree_s !== 'number' || !(e.duree_s > 0)) throw new Error('duree_s doit être une durée positive en secondes.');
  if (typeof e.provider_tel !== 'string' || !(e.provider_tel in couts.telephonie)) throw new Error(`Opérateur téléphonique inconnu : « ${String(e.provider_tel)} » (connus : ${Object.keys(couts.telephonie).join(', ')}).`);
  if (typeof e.provider_voix !== 'string' || !(e.provider_voix in couts.voix)) throw new Error(`Moteur de voix inconnu : « ${String(e.provider_voix)} » (connus : ${Object.keys(couts.voix).join(', ')}).`);
  const j = e.jetons_llm;
  if (!j || typeof j !== 'object' || typeof j.entree !== 'number' || typeof j.sortie !== 'number') {
    throw new Error('jetons_llm doit dire {entree, sortie} (et entree_cache si une partie est lue du cache) : entrée et sortie ne coûtent pas le même prix.');
  }
  const outils = e.outils ?? [];
  if (!Array.isArray(outils) || outils.some((o) => typeof o?.id !== 'string' || !Number.isInteger(o?.appels) || o.appels < 0)) throw new Error('outils doit lister des {id, appels}.');

  const manque: string[] = [];
  const minutes = e.duree_s / 60;
  const parMinute = (t: Taux, quoi: string): number | null => {
    if (t.par_minute == null || !t.source) { manque.push(`${quoi} : ${t.manque ?? 'taux sans source'}`); return null; }
    return t.par_minute * minutes;
  };
  const telephonie = parMinute(couts.telephonie[e.provider_tel], `téléphonie (${e.provider_tel})`);
  const voix = parMinute(couts.voix[e.provider_voix], `voix (${e.provider_voix})`);

  const modele = tarifsApi.modeles[e.modele_llm ?? 'reference'];
  let llm: number | null = null;
  if (!modele) manque.push(`LLM : aucun tarif pour le modèle « ${e.modele_llm} » dans dimensionnement/tarifs-api.json.`);
  else if (typeof tarifsApi.tauxUsdEur !== 'number') manque.push('LLM : taux de change USD→EUR absent de dimensionnement/tarifs-api.json.');
  else {
    const cache = j.entree_cache ?? 0;
    llm = ((j.entree * modele.entree + cache * modele.entreeCache + j.sortie * modele.sortie) / 1e6) * tarifsApi.tauxUsdEur;
  }

  let outilsCout: number | null = 0;
  for (const o of outils) {
    const t = couts.outils.taux[o.id];
    if (!t || t.par_appel == null || !t.source) { manque.push(`outil ${o.id} : ${t?.manque ?? "prix d'un appel non lu"}`); outilsCout = null; continue; }
    if (outilsCout != null) outilsCout += t.par_appel * o.appels;
  }
  const marge = couts.marge.taux != null && couts.marge.source ? couts.marge.taux : null;
  if (marge == null) manque.push(`marge : ${couts.marge.manque ?? 'taux sans source'}`);

  const detail = {
    telephonie: telephonie == null ? null : arrondi4(telephonie),
    voix: voix == null ? null : arrondi4(voix),
    llm: llm == null ? null : arrondi4(llm),
    outils: outilsCout == null ? null : arrondi4(outilsCout),
  };
  const complet = manque.length === 0;
  const sousTotal = complet ? telephonie! + voix! + llm! + outilsCout! : null;
  return {
    complet,
    manque,
    devise: couts.devise,
    detail,
    marge: complet ? arrondi4(sousTotal! * marge!) : null,
    total: complet ? arrondi4(sousTotal! * (1 + marge!)) : null,
    hypotheses: ['durée proratisée à la seconde (le palier de facturation des opérateurs n\'a pas été lu)', 'prix LLM et taux de change lus dans dimensionnement/tarifs-api.json, eux-mêmes des hypothèses écrites'],
  };
}

// ---------------------------------------------------------------- site export

const statut = (p: PlanTarif) => (p.legacy_flag ? 'archive' : p.base_price == null && !p.composition ? 'sur-devis' : p.hypothese_de_lancement ? 'pilote' : 'public');

/** The exact shape of frontend/src/data/tarifs.json (branch plan-site), built from the engine. */
export function exportSite(versions: PlanTarif[], fichier: Pick<FichierPlans, 'source' | 'consommation' | 'archives_note'>, fiscalite: Fiscalite, date: string) {
  const region = 'FR';
  const lire = (id: string) => {
    const p = planALaDate(versions, id, date, region);
    if (!p) throw new Error(`Le site attend le plan ${id}, absent au ${date}.`);
    return p;
  };
  const visibles = plansVisibles(versions, { date, region });
  const de = (f: Famille) => visibles.filter((p) => p.famille === f && p.segment !== 'home' && p.segment !== 'voice');
  const unique = lire('agent-unique');
  const commander = lire('task-commander');
  const pack = (p: PlanLu) => {
    const tete = { id: p.plan_id.replace(/^pack-/, ''), nom: p.nom, contenu: p.description };
    switch (p.forme_site) {
      case 'environ': return { ...tete, mensuel: p.base_price, environ: true, statut: statut(p) };
      case 'fourchette': return { ...tete, mensuelMin: p.base_price, mensuelMax: p.base_price_max, environ: true, statut: statut(p) };
      case 'a-partir-de': return { ...tete, aPartirDe: p.base_price, statut: statut(p) };
      case 'sur-devis': return { ...tete, surDevis: true, statut: 'sur-devis' };
      default: throw new Error(`Le pack ${p.plan_id} ne dit pas sa forme_site.`);
    }
  };
  const tous = identifiants(versions).map((id) => planALaDate(versions, id, date, region)).filter((p): p is PlanLu => !!p);
  return {
    version: `${date}-moteur`,
    statut: visibles.some((p) => p.hypothese_de_lancement) ? 'pilote' : 'public',
    source: `Moteur tarifaire de la plateforme (GET /tarifs/export-site), lu au ${date} ; tarifs de départ : ${fichier.source}.`,
    devise: fiscalite.pays[region].devise,
    affichage: 'HT',
    box: de('box').map((b) => ({
      id: b.plan_id, nom: b.nom, mensuel: b.base_price, engagementMois: b.commitment_months,
      materielInclus: b.included_box, public: b.public_visibility, statut: statut(b),
    })),
    agents: {
      affichage: 'paliers',
      paliers: de('agent').map((a) => ({ id: a.plan_id.replace(/^agent-/, ''), nom: a.nom.replace(/^Agent /, ''), mensuel: a.base_price, statut: statut(a) })),
      unique: { mensuel: unique.base_price, achat: unique.prix_achat ?? null, statut: statut(unique) },
    },
    commander: {
      nom: commander.nom, mensuelMin: commander.base_price, mensuelMax: commander.base_price_max,
      inclusAPartirDe: commander.inclus_a_partir_de_agents ?? null, statut: statut(commander),
    },
    packs: de('pack').map(pack),
    consommation: { phrase: fichier.consommation.phrase, statut: 'pilote' },
    archives: {
      note: fichier.archives_note,
      masquees: tous.filter((p) => p.legacy_flag && p.prix_depuis).map((p) => p.plan_id),
    },
  };
}
