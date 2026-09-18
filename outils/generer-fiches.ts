/**
 * Generates agent packages from the catalogue with the Anthropic Message
 * Batches API (50 % off, no need for instant results).
 *
 *   npx tsx outils/generer-fiches.ts --sec --ids AG-0002,AG-0003     dry run: writes the requests, calls nothing
 *   npx tsx outils/generer-fiches.ts soumettre --secteur comptabilite  submits one batch, saves its id under outils/lots/
 *   npx tsx outils/generer-fiches.ts soumettre --priorite P1 --tout    every P1 entry without a package yet
 *   npx tsx outils/generer-fiches.ts relever <batchId>                 collects results, validates, writes agents/*.json
 *   npx tsx outils/generer-fiches.ts soumettre ... --attendre           submits, polls until ended, then collects (what the GitHub workflow runs)
 *
 * The model writes ONLY the editorial part of a package (famille, nom, accroche,
 * description, expert, taches, connecteurs, acces, modeles). Everything derived
 * (materiel, commercial, execution, version) is assembled here from the sources
 * of truth, then the whole package is validated against the contract. A package
 * that fails validation is never written: it goes to outils/lots/<id>-echecs.json.
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { materielPour, appelsParJour } from '../dimensionnement/calculer.ts';

/**
 * A key created at organisation level (not inside a workspace) must name the
 * workspace on every request. ANTHROPIC_WORKSPACE_ID is optional: a key created
 * inside a workspace at console.anthropic.com needs nothing.
 */
function clientAnthropic() {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {});
}

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p: string) => readFileSync(join(racine, p), 'utf8');
const catalogue = JSON.parse(lire('catalogue/catalogue.json'));
const schema = JSON.parse(lire('contrat/paquet-agent.schema.json'));
const contrat = lire('contrat/paquet-agent.md');
const paliers = JSON.parse(lire('dimensionnement/paliers-modeles.json'));
const exemple = JSON.parse(lire('agents/AG-0001-secretaire-administratif.json'));

const args = process.argv.slice(2);
const option = (nom: string) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };
const commande = args.find((a) => ['soumettre', 'relever'].includes(a));
const sec = args.includes('--sec');
const refaire = args.includes('--refaire');
const MODELE = option('--modele') ?? 'claude-sonnet-5'; // Sonnet pour les fiches (choix de Max, 18/09/2026) ; --modele claude-opus-5 pour comparer
const dossierLots = join(racine, 'outils/lots');
mkdirSync(dossierLots, { recursive: true });

const API_CAPACITES: Record<string, string> = { texte: 'llm', vision: 'llm-vision', image: 'image', video: 'video', audio: 'parole', musique: 'musique', embeddings: 'embeddings' };
const profils = new Map<string, any>(catalogue.profils.map((p: any) => [p.id, p]));

/** The editorial subset the model must produce: the contract schema minus the derived blocks. */
const schemaFiche = structuredClone(schema);
for (const k of ['format', 'id', 'slug', 'version', 'secteur', 'materiel', 'commercial', 'miseAJour', 'execution']) {
  delete schemaFiche.properties[k];
  schemaFiche.required = schemaFiche.required.filter((r: string) => r !== k);
}
const exempleFiche = Object.fromEntries(Object.entries(exemple).filter(([k]) => k in schemaFiche.properties));

const SYSTEME = `Tu écris des paquets d'agents pour iAgent, une application desktop qui fait tourner des agents IA en local (sans facturation de tokens) ou par API au choix du client. Chaque agent est « un employé qui sait » : un expert de 25 ans d'expérience, renommé, incollable dans son domaine, préconfiguré avec ses tâches quotidiennes.

Voici le contrat du paquet, qui explique chaque champ :

${contrat}

Voici les paliers de modèles locaux disponibles (clé = valeur à écrire dans "modeles") :

${JSON.stringify(Object.fromEntries(Object.entries(paliers.paliers).map(([k, v]: any) => [k, v.usage])), null, 1)}

Voici un exemple complet de la partie que tu dois produire (le paquet du Secrétaire administratif, sans les blocs dérivés) :

${JSON.stringify(exempleFiche, null, 1)}

Client type : un indépendant, une TPE ou une PME qui achète l'agent pour son propre usage. « Administration » désigne les fonctions administratives d'une entreprise, jamais l'administration publique (mairie, préfecture, collectivité, usagers) sauf si le nom du métier le dit explicitement. Au premier lot, six fiches sur vingt-trois parlaient de mairies et d'usagers : c'est faux pour l'acheteur.

Règles d'écriture :
- Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans balises de code, conforme à ce schéma : ${JSON.stringify(schemaFiche)}
- Français soigné pour tout ce que lit le client ; la "consigne" est écrite pour un modèle LOCAL (elle ne suppose ni recherche web, ni outil serveur, ni accès à des comptes que l'utilisateur n'a pas ouverts).
- 4 à 7 tâches concrètes, chacune avec un vrai dossier de sortie ; "validationHumaine" vrai pour tout ce qui part vers l'extérieur ou engage l'entreprise.
- "connaissances" : 3 à 5 domaines réels du métier, résumés avec précision (pas de généralités).
- "regles" : ce que le code empêche, pas des vœux.
- "modeles" : le palier le plus léger qui fait le travail ; "texte-standard" pour la plupart des postes, "texte-avance" quand il faut raisonner (juridique, financier, analyse), les capacités image/vidéo/vision/audio/musique seulement si le métier les exige. "activite" = part du temps sur 24 h où l'agent sollicite ses modèles (0,1 poste de bureau, 0,3 poste qui navigue beaucoup, 0,6 et plus pour un générateur en série).
- "connecteurs" contient toujours "voix" et "conversation".
- "famille" : "metier" par défaut ; "ecommerce" pour le secteur e-commerce ; "reseaux-sociaux" pour les postes social media / community ; "fonction" pour un poste de production (design, photo/vidéo/audio, rédaction en série) ; "configurable" jamais (réservé).
- N'invente aucune obligation légale précise que tu ne connais pas : reste au niveau des usages du métier.`;

function entreesChoisies() {
  const ids = option('--ids')?.split(',').map((s) => s.trim());
  const secteur = option('--secteur');
  const priorite = option('--priorite');
  const dejaFaits = new Set(readdirSync(join(racine, 'agents')).map((f) => f.slice(0, 7)));
  return catalogue.agents.filter((a: any) => {
    if (ids && !ids.includes(a.id)) return false;
    if (secteur && a.secteur !== secteur) return false;
    if (priorite && profils.get(a.profil).priorite !== priorite) return false;
    if (!ids && !secteur && !priorite && !args.includes('--tout')) return false;
    return refaire || !dejaFaits.has(a.id);
  });
}

function requetePour(a: any): Anthropic.Messages.Batches.BatchCreateParams.Request {
  const p = profils.get(a.profil);
  return {
    custom_id: a.id,
    params: {
      model: MODELE,
      max_tokens: 32000, // la réflexion compte dans la limite : AG-0002 a été coupé à 16 000 au premier lot
      system: [{ type: 'text', text: SYSTEME, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `Écris le paquet de l'agent ${a.id} : « ${a.metier} », secteur « ${catalogue.secteurs.find((s: any) => s.id === a.secteur).nom} ».
Profil commercial du catalogue (pour choisir le niveau d'autonomie et de validation) : autonomie « ${p.autonomie} », besoin humain « ${p.besoinHumain} », risque réglementaire « ${p.risqueReglementaire} », workflow « ${p.workflow.join(' → ')} », outils cibles « ${p.outils.join(', ')} ».` }],
    },
  };
}

function assembler(a: any, fiche: any) {
  const p = profils.get(a.profil);
  const modeles = fiche.modeles;
  const paquet = {
    format: 'iagent-paquet/1', id: a.id, slug: a.slug, version: '1.0.0',
    famille: fiche.famille, secteur: a.secteur, nom: fiche.nom, accroche: fiche.accroche, description: fiche.description,
    expert: fiche.expert, taches: fiche.taches, connecteurs: fiche.connecteurs, acces: fiche.acces, modeles,
    execution: { modes: ['local', 'api'], defaut: 'local', bascule: 'automatique',
      api: { capacites: Object.fromEntries(Object.keys(modeles).filter((k) => k in API_CAPACITES).map((k) => [k, API_CAPACITES[k]])) },
      appelsParJourEstimes: appelsParJour(fiche.taches) },
    materiel: materielPour(modeles),
    commercial: { profil: p.id, priorite: p.priorite, pack: p.pack, prixMensuel: { min: p.prixCible.min, max: p.prixCible.max }, autonomie: p.autonomie, besoinHumain: p.besoinHumain, risqueReglementaire: p.risqueReglementaire },
    miseAJour: { canal: 'stable', appMinimum: '1.0.0', notes: 'Première version.' },
  };
  return paquet;
}

function extraireJson(texte: string) {
  const debut = texte.indexOf('{'); const fin = texte.lastIndexOf('}');
  if (debut < 0 || fin < 0) throw new Error('aucun objet JSON dans la réponse');
  return JSON.parse(texte.slice(debut, fin + 1));
}

async function relever(client: Anthropic, id: string) {
  const lot = await client.messages.batches.retrieve(id);
  console.log(`Lot ${id} : ${lot.processing_status} — ${JSON.stringify(lot.request_counts)}`);
  if (lot.processing_status !== 'ended') return false;
  const ajv = new Ajv2020({ allErrors: true, strict: false }); const valider = ajv.compile(schema);
  const parId = new Map<string, any>(catalogue.agents.map((a: any) => [a.id, a]));
  const echecs: any[] = []; let ecrits = 0;
  for await (const r of await client.messages.batches.results(id)) {
    const a = parId.get(r.custom_id);
    if (r.result.type !== 'succeeded') { echecs.push({ id: r.custom_id, type: r.result.type, detail: (r.result as any).error }); continue; }
    const m = r.result.message;
    if (m.stop_reason === 'refusal' || m.stop_reason === 'max_tokens') { echecs.push({ id: r.custom_id, type: m.stop_reason }); continue; }
    try {
      const texte = m.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
      const paquet = assembler(a, extraireJson(texte));
      if (!valider(paquet)) { echecs.push({ id: r.custom_id, type: 'schema', detail: valider.errors }); continue; }
      writeFileSync(join(racine, 'agents', `${a.id}-${a.slug}.json`), JSON.stringify(paquet, null, 2) + '\n'); ecrits++;
    } catch (e) { echecs.push({ id: r.custom_id, type: 'json', detail: (e as Error).message }); }
  }
  if (echecs.length) writeFileSync(join(dossierLots, `${id}-echecs.json`), JSON.stringify(echecs, null, 2));
  console.log(`${ecrits} paquet(s) écrit(s), ${echecs.length} échec(s)${echecs.length ? ` → outils/lots/${id}-echecs.json (relancer avec --ids)` : ''}`);
  return true;
}

async function attendre(client: Anthropic, id: string) {
  // Batches usually end within the hour; the workflow job allows up to five.
  for (let i = 0; i < 300; i++) {
    if (await relever(client, id)) return;
    await new Promise((r) => setTimeout(r, 60_000));
  }
  throw new Error(`Lot ${id} toujours en cours après 5 h : relancer plus tard avec « relever ${id} »`);
}

async function main() {
  if (commande === 'relever') {
    const id = args[args.indexOf('relever') + 1];
    if (!id) throw new Error('relever <batchId>');
    await (args.includes('--attendre') ? attendre(clientAnthropic(), id) : relever(clientAnthropic(), id));
    return;
  }

  const entrees = entreesChoisies();
  if (!entrees.length) { console.log('Aucune entrée sélectionnée (--ids, --secteur, --priorite ou --tout ; --refaire pour réécrire un paquet existant).'); return; }
  const requetes = entrees.map(requetePour);
  // Rough budget: ~9k input tokens (cached after the first request) + ~5k output tokens per package, at batch (50 %) prices.
  const prix: Record<string, [number, number]> = { 'claude-opus-5': [5, 25], 'claude-sonnet-5': [2, 10], 'claude-haiku-4-5': [1, 5] };
  const [pi, po] = prix[MODELE] ?? [5, 25];
  const estimation = requetes.length * ((9000 * pi * 0.1 + 5000 * po) / 1e6) * 0.5;
  console.log(`${requetes.length} fiche(s) à générer avec ${MODELE} — coût estimé ≈ ${estimation.toFixed(2)} $ (lot, cache)`);
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(dossierLots, `requetes-${horodatage}.json`), JSON.stringify(requetes, null, 1));
  if (sec || commande !== 'soumettre') { console.log(`Mode --sec : requêtes écrites dans outils/lots/requetes-${horodatage}.json, rien envoyé.`); return; }
  const client = clientAnthropic();
  const lot = await client.messages.batches.create({ requests: requetes });
  writeFileSync(join(dossierLots, `${lot.id}.json`), JSON.stringify({ id: lot.id, modele: MODELE, cree: lot.created_at, ids: entrees.map((e: any) => e.id) }, null, 2));
  console.log(`Lot soumis : ${lot.id} (${lot.processing_status}). Relever plus tard : npx tsx outils/generer-fiches.ts relever ${lot.id}`);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `lot=${lot.id}\n`, { flag: 'a' });
  if (args.includes('--attendre')) await attendre(client, lot.id);
}

main().catch((e) => { console.error(e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e); process.exit(1); });
