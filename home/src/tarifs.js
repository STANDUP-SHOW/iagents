// The only module of the Home site that knows a price.
//
// No component writes an amount (MASTER §1: no public price hardcoded in the
// front). Prices come from plateforme/tarifs/plans.json, written by the
// pricing workstream; while that file is not in the repository, from
// ./tarifs-home.provisoire.json, which says it is provisional and where its
// numbers come from. The choice is made here and nowhere else.
//
// Limit: the site is static, so it reads the STARTING versions in plans.json
// at build time. Versions published later through POST /tarifs/plans live in
// the platform's storage and reach the site only at the next build.
import provisoire from './tarifs-home.provisoire.json';

// Eager glob: resolves to {} when the file does not exist, instead of failing
// the build. Same answer in the browser build, the prerender and the bench.
const trouve = import.meta.glob('../../plateforme/tarifs/plans.json', { eager: true, import: 'default' });
const officiel = Object.values(trouve)[0] ?? null;

export const IDS_HOME = ['home-digital', 'home-agent', 'home-box', 'home-family'];

const instant = (s) => (s == null ? null : new Date(s).getTime());

/**
 * Reads the four Home plans from a pricing file ({plans: Plan[]} or Plan[]).
 * Throws in French, naming what is missing, rather than showing a wrong price.
 */
export function lirePlans(fichier, origine, date = new Date()) {
  const plans = Array.isArray(fichier) ? fichier : fichier?.plans;
  if (!Array.isArray(plans)) throw new Error(`${origine} : aucune liste « plans » lisible`);
  const t = date.getTime();
  const hypothesesFichier = !Array.isArray(fichier) && (fichier.hypotheses_de_lancement === true || fichier.provisoire === true);
  return IDS_HOME.map((id) => {
    const versions = plans.filter((p) => p.plan_id === id
      && p.public_visibility !== false && p.legacy_flag !== true
      && (p.region ?? 'FR') === 'FR'
      && instant(p.effective_from) <= t
      && (p.effective_to == null || instant(p.effective_to) > t));
    if (!versions.length) throw new Error(`${origine} : aucune version publique en vigueur du plan « ${id} »`);
    const plan = versions.sort((a, b) => instant(b.effective_from) - instant(a.effective_from))[0];
    if (plan.tax_mode !== 'TTC') throw new Error(`${origine} : le plan « ${id} » est en ${plan.tax_mode}, le site Home n'affiche que du TTC`);
    if (typeof plan.base_price !== 'number') throw new Error(`${origine} : le plan « ${id} » n'a pas de prix (sur devis ?) — le site Home n'a pas de case pour ça`);
    if ((plan.currency ?? 'EUR') !== 'EUR') throw new Error(`${origine} : le plan « ${id} » n'est pas en euros`);
    return {
      id,
      nom: plan.nom,
      description: plan.description,
      prix: plan.base_price,
      prixMax: typeof plan.base_price_max === 'number' ? plan.base_price_max : null,
      aPartirDe: plan.a_partir_de === true,
      periode: plan.billing_period === 'annee' ? 'an' : 'mois',
      hypothese: plan.hypothese_de_lancement === true || hypothesesFichier,
    };
  });
}

export const ORIGINE = officiel ? 'plateforme/tarifs/plans.json' : 'home/src/tarifs-home.provisoire.json';
export const PROVISOIRE = !officiel;
export const SOURCE = (officiel ?? provisoire).source ?? null;
export const PLANS = lirePlans(officiel ?? provisoire, ORIGINE);
/** True only when the file says these prices are launch hypotheses. */
export const HYPOTHESES = PLANS.some((p) => p.hypothese);

export const planDe = (id) => {
  const p = PLANS.find((x) => x.id === id);
  if (!p) throw new Error(`plan Home inconnu : ${id}`);
  return p;
};

// Built from its code so that no digit ever sits next to the euro sign here.
const INSECABLE = String.fromCharCode(160);
const nombre = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);

/** Amount with non-breaking spaces: "N €", "N–M €", "à partir de N €". */
export function montant(p) {
  const corps = p.prixMax != null ? `${nombre(p.prix)}–${nombre(p.prixMax)}` : nombre(p.prix);
  return `${p.aPartirDe ? 'à partir de ' : ''}${corps}${INSECABLE}€`;
}

/** "TTC/mois" */
export const unite = (p) => `TTC/${p.periode}`;
