/**
 * Validates every package in agents/ against the contract:
 *  - JSON Schema (contrat/paquet-agent.schema.json)
 *  - id known in the catalogue, secteur matching, slug unique
 *  - commercial block equal to the catalogue profile (never invented)
 *  - materiel equal to what the sizing engine derives from `modeles`
 *  - every business software named by a task is a category of catalogue/logiciels.json
 * Exit code 1 on any failure. `--corriger` rewrites materiel/commercial/acces from the sources of truth.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { materielPour, appelsParJourEstimes } from '../dimensionnement/calculer.ts';


/**
 * Compare deux versions par nombres, jamais par texte : en texte « 0.10.0 » est
 * plus ancien que « 0.9.0 ». Meme regle que `comparer_versions` dans fiches.rs.
 */
function plusRecenteQue(a: string, b: string): boolean {
  const n = (v: string) => v.split('.').map((p) => Number.parseInt(p.trim(), 10) || 0);
  const [ga, gb] = [n(a), n(b)];
  for (let i = 0; i < Math.max(ga.length, gb.length); i++) {
    const d = (ga[i] ?? 0) - (gb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}
import { logicielsDesTaches, remplacement } from './logiciels-metier.ts';
import { logicielsPoste } from '../usine/logiciels-poste.ts';
import { logicielsCreation } from './creation-locale.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(racine, 'contrat/paquet-agent.schema.json'), 'utf8'));
/** La version de l'application, lue a son manifeste : la recopier la ferait diverger. */
const VERSION_APP: string = JSON.parse(readFileSync(join(racine, 'desktop/package.json'), 'utf8')).version;
const catalogue = JSON.parse(readFileSync(join(racine, 'catalogue/catalogue.json'), 'utf8'));
const logiciels = JSON.parse(readFileSync(join(racine, 'catalogue/logiciels.json'), 'utf8'));
const logicielsParId = new Map<string, any>(logiciels.logiciels.map((l: any) => [l.id, l]));
const categoriesLogiciels = new Set<string>(logiciels.categories);
const usine = JSON.parse(readFileSync(join(racine, 'usine/logiciels.json'), 'utf8'));
const corriger = process.argv.includes('--corriger');

const LISTE = 'catalogue/identite-a-reecrire.json';
const aReecrire = new Set<string>(
  JSON.parse(readFileSync(join(racine, LISTE), 'utf8')).agents as string[]
);
const restants: string[] = [];

// Une fiche doit décrire le métier vendu sous son identifiant, et non le gabarit du générateur.
// Sur 1249 fiches, 1026 partageaient le même jeu de tâches au mot près, la même persona, les
// mêmes règles, les mêmes connaissances, et une consigne où seul le nom du poste était glissé —
// accroche et résumé venaient de la même fabrique. Les fiches encore à écrire sont listées dans
// fiches-generiques.json, qui ne peut que rétrécir : une fiche n'en sort que lorsque plus rien
// en elle n'est repris du gabarit ni d'une autre fiche.
const LISTE_GENERIQUES = 'catalogue/fiches-generiques.json';
const gabaritsSource = JSON.parse(readFileSync(join(racine, LISTE_GENERIQUES), 'utf8'));
const aReecrireContenu = new Set<string>(gabaritsSource.agents as string[]);
const motif = (g: string) => new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const GAB_ACCROCHE: RegExp[] = (gabaritsSource.gabaritsAccroche as string[]).map(motif);
const GAB_RESUME: RegExp[] = (gabaritsSource.gabaritsResume as string[]).map(motif);
const GAB_CONSIGNE: RegExp[] = (gabaritsSource.gabaritsConsigne as string[]).map(motif);
const TACHES_GENERIQUES = (gabaritsSource.tachesGeneriques as string[]).join('|');
const restantsContenu: string[] = [];
// Une famille qu'une tâche ouvre sans que la fiche y soit qualifiée n'est jamais demandée à
// l'entretien d'embauche (questionsEntretien part de `qualifications`) : le jour de
// l'embauche, l'agent ne sait pas dans quel outil aller. C'était un simple compte
// tant que la réécriture éditoriale n'avait pas rattrapé les 463 fiches concernées ;
// elles le sont toutes depuis le 23/09/2026, donc c'est une faute.
// Chaque champ garde la première fiche qui l'a employé : la reprise ultérieure est la faute.
const vus = {
  accroche: new Map<string, string>(),
  resume: new Map<string, string>(),
  persona: new Map<string, string>(),
  regles: new Map<string, string>(),
  connaissances: new Map<string, string>(),
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
const valider = ajv.compile(schema);

/** Les connecteurs, lus au schéma : une liste recopiée ici vieillirait à part. */
const CONNECTEURS = new Set<string>(schema.properties.connecteurs.items.enum);
const parId = new Map<string, any>(catalogue.agents.map((a: any) => [a.id, a]));
// Le socle : les agents livrés avec l'application (le Team Holder), hors boutique. Mêmes règles
// que les 1 249 métiers, mais un dossier à part (`socle/`) pour que la boutique, qui lit
// `agents/`, ne les mette pas en vente et que les comptes du catalogue restent justes.
const socle = new Map<string, any>((catalogue.socle?.agents ?? []).map((a: any) => [a.id, a]));
for (const [id, a] of socle) {
  if (parId.has(id)) throw new Error(`${id} est à la fois au catalogue et au socle`);
  parId.set(id, a);
}
const profils = new Map<string, any>(catalogue.profils.map((p: any) => [p.id, p]));

/**
 * Le profil de risque d'une fiche, déduit de ses tâches.
 *
 * `profil_risque` est obligatoire au schéma, et il était écrit par le
 * générateur sans jamais regarder les tâches : **1 243 fiches sur 1 249 se
 * disaient « PR-00 (autonome) »**, dont 245 dont CHAQUE tâche attend l'accord
 * d'un humain. Personne ne lisait le champ, donc personne ne le voyait mentir.
 * Il ne reste que 30 fiches réellement autonomes.
 *
 * Attention : ce n'est PAS `commercial.profil`. Les deux s'écrivent « PR-NN » et
 * ne veulent pas dire la même chose — l'autre vient de `catalogue.profils`
 * (automatisation, présence physique, complexité d'intégration) et sert au prix.
 * La collision de noms est ce qui rend l'erreur invisible à la relecture.
 *
 * **PR-00 sur toutes les fiches, décision de max du 24/09/2026 : « l'agent peut
 * fonctionner de manière autonome si l'utilisateur le souhaite ».** Cette
 * étiquette décrit l'agent tel qu'il est vendu, avant que le client ne règle
 * quoi que ce soit — et ce que l'application applique alors est l'autonomie
 * (`accord_attendu` en Rust, `planningDuClient` à l'écran) : l'agent va seul
 * sauf si le client met une tâche sous contrôle. La déduire du
 * `validationHumaine` des tâches mettait 1 219 fiches sur 1 249 en
 * « approbation obligatoire », c'est-à-dire écrivait sur la carte du client une
 * contrainte que le produit n'applique pas et qu'il peut de toute façon lever.
 *
 * **Le champ ne dit donc plus rien qu'une fiche ne dise déjà**, et il n'est
 * affiché nulle part — ni boutique ni application. Ce qui porte l'information,
 * et qui varie vraiment d'une fiche à l'autre (30 fiches sans aucune tâche à
 * relire, 973 avec une partie, 246 avec toutes), c'est `validationHumaine`
 * tâche par tâche : c'est ce que l'agent propose au client à l'entretien
 * d'embauche, et ce que le client tranche. Le jour où la boutique aura un
 * endroit honnête pour le dire, c'est ce compte-là qu'elle affichera, pas cette
 * étiquette.
 */
export function profilRisqueAttendu(_taches: { validationHumaine?: boolean }[]): string {
  return 'PR-00';
}

export function commercialAttendu(profilId: string) {
  const p = profils.get(profilId);
  if (!p) throw new Error(`Profil inconnu : ${profilId}`);
  return { profil: p.id, priorite: p.priorite, pack: p.pack, prixMensuel: { min: p.prixCible.min, max: p.prixCible.max }, autonomie: p.autonomie, besoinHumain: p.besoinHumain, risqueReglementaire: p.risqueReglementaire };
}

const lister = (dossier: string) =>
  readdirSync(join(racine, dossier)).filter((f) => f.endsWith('.json')).sort().map((f) => ({ dossier, f }));
const fichiers = [...lister('agents'), ...lister('socle')];
const slugs = new Map<string, string>();
let fautes = 0;
const faute = (f: string, msg: string) => { fautes++; console.log(`  ✗ ${f} : ${msg}`); };

for (const { dossier, f } of fichiers) {
  const chemin = join(racine, dossier, f);
  const paquet = JSON.parse(readFileSync(chemin, 'utf8'));
  let modifie = false;
  if (!valider(paquet)) for (const e of valider.errors ?? []) faute(f, `${e.instancePath || '/'} ${e.message}`);
  const entree = parId.get(paquet.id);
  if (!entree) { faute(f, `id ${paquet.id} absent du catalogue`); continue; }
  const attenduDans = socle.has(paquet.id) ? 'socle' : 'agents';
  if (dossier !== attenduDans) faute(f, `${paquet.id} doit vivre dans ${attenduDans}/, pas dans ${dossier}/`);
  if (entree.secteur !== paquet.secteur) faute(f, `secteur ${paquet.secteur} ≠ catalogue ${entree.secteur}`);
  // Le métier et le slug appartiennent au catalogue. Sans ce contrôle, une fiche peut décrire
  // un autre métier que celui vendu sous son identifiant — et quatre-vingt-onze l'ont fait sans
  // que rien ne le signale. Les fiches encore à réécrire sont listées dans identite-a-reecrire.json.
  const derive = entree.metier !== paquet.nom || entree.slug !== paquet.slug;
  if (aReecrire.has(paquet.id)) {
    if (!derive) faute(f, `${paquet.id} est corrigé : le retirer de ${LISTE}`);
    else restants.push(`${paquet.id} « ${paquet.nom} » → « ${entree.metier} »`);
  } else {
    if (entree.metier !== paquet.nom) faute(f, `nom « ${paquet.nom} » ≠ catalogue « ${entree.metier} »`);
    if (entree.slug !== paquet.slug) faute(f, `slug ${paquet.slug} ≠ catalogue ${entree.slug}`);
  }
  if (f !== `${paquet.id}-${paquet.slug}.json`) faute(f, `nom de fichier attendu ${paquet.id}-${paquet.slug}.json`);
  if (slugs.has(paquet.slug)) faute(f, `slug en double avec ${slugs.get(paquet.slug)}`); else slugs.set(paquet.slug, f);
  const champs: [keyof typeof vus, string, string][] = [
    ['accroche', paquet.accroche, 'accroche'],
    ['resume', paquet.resume_metier ?? '', 'resume_metier'],
    ['persona', paquet.expert.persona, 'expert.persona'],
    ['regles', JSON.stringify(paquet.expert.regles), 'expert.regles'],
    ['connaissances', JSON.stringify(paquet.expert.connaissances), 'expert.connaissances'],
  ];
  const reprises: string[] = [];
  const gabAccroche = GAB_ACCROCHE.find((r) => r.test(paquet.accroche));
  if (gabAccroche) reprises.push(`accroche reprise du gabarit « ${gabAccroche.source} »`);
  const gabResume = GAB_RESUME.find((r) => r.test(paquet.resume_metier ?? ''));
  if (gabResume) reprises.push(`resume_metier repris du gabarit « ${gabResume.source} »`);
  const gabConsigne = GAB_CONSIGNE.find((r) => r.test(paquet.expert.consigne));
  if (gabConsigne) reprises.push(`consigne reprise du gabarit « ${gabConsigne.source} »`);
  if (paquet.taches.map((t: any) => t.nom).join('|') === TACHES_GENERIQUES) {
    reprises.push('les six tâches sont celles du gabarit, pas celles du métier');
  }
  for (const [cleChamp, valeur, libelle] of champs) {
    const k = valeur.trim().toLowerCase();
    const jumelle = vus[cleChamp].get(k);
    if (jumelle) reprises.push(`${libelle} identique à celui de ${jumelle}`);
    else vus[cleChamp].set(k, f);
  }
  if (aReecrireContenu.has(paquet.id)) {
    if (!reprises.length) faute(f, `fiche réécrite : retirer ${paquet.id} de ${LISTE_GENERIQUES}`);
    else restantsContenu.push(paquet.id);
  } else {
    for (const r of reprises) faute(f, r);
  }
  // Un dossier d'entrée mal écrit ne fait rien échouer : l'application l'ignore
  // et l'agent travaille sans matière, en le disant. Personne ne voit passer la
  // faute de frappe, et le travail sort vraisemblable et vide.
  for (const t of paquet.taches) {
    for (const e of t.entrees ?? []) {
      if (!e.startsWith('dossier:')) continue;
      const chemin = e.slice('dossier:'.length);
      if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(chemin)) {
        faute(f, `tâche « ${t.nom} » : « ${e} » n'est pas un dossier logique (minuscules, chiffres, tirets, barres obliques)`);
      }
    }
    const vues = new Set<string>();
    for (const e of t.entrees ?? []) {
      if (vues.has(e)) faute(f, `tâche « ${t.nom} » : l'entrée « ${e} » est déclarée deux fois`);
      vues.add(e);
    }
    // Une entrée qui porte le nom d'un connecteur EST ce connecteur : la tâche ira
    // lire dans la messagerie, le calendrier ou le navigateur du client. Si la fiche
    // ne le déclare pas, l'application ne lui ouvre rien et la tâche part les mains
    // vides — sans que personne voie passer l'oubli, puisque l'entrée a l'air remplie.
    const declares = new Set<string>(paquet.connecteurs ?? []);
    for (const e of t.entrees ?? []) {
      if (CONNECTEURS.has(e) && !declares.has(e)) {
        faute(f, `tâche « ${t.nom} » : l'entrée « ${e} » est un connecteur que la fiche ne déclare pas`);
      }
    }
  }

  // Un relais qui nomme un agent du catalogue ne réécrit pas son métier : le libellé vient
  // du catalogue, comme partout ailleurs, sinon il finira faux à l'un des deux endroits.
  if (paquet.relais) {
    for (const sens of ['recoitDe', 'transmetA'] as const) {
      for (const lien of paquet.relais[sens] ?? []) {
        if (!lien.agent) continue;
        const cible = parId.get(lien.agent);
        if (!cible) { faute(f, `relais.${sens} : agent ${lien.agent} absent du catalogue`); continue; }
        if (cible.metier !== lien.poste) {
          if (corriger) { lien.poste = cible.metier; modifie = true; }
          else faute(f, `relais.${sens} : poste « ${lien.poste} » ≠ catalogue « ${cible.metier} » pour ${lien.agent}`);
        }
        if (lien.agent === paquet.id) faute(f, `relais.${sens} : la fiche se renvoie à elle-même`);
      }
    }
  }
  // Une qualification ne s'invente pas : l'outil doit exister au référentiel, sinon la boutique
  // promet un savoir-faire que rien ne soutient.
  if (paquet.qualifications) {
    const vusLog = new Set<string>();
    for (const q of paquet.qualifications.logiciels) {
      const outil = logicielsParId.get(q.logiciel);
      if (!outil) { faute(f, `qualifications : ${q.logiciel} absent de catalogue/logiciels.json`); continue; }
      if (vusLog.has(q.logiciel)) faute(f, `qualifications : ${outil.nom} déclaré deux fois`);
      vusLog.add(q.logiciel);
      // L'agent prononce cette phrase à l'entretien d'embauche : à la troisième personne, elle
      // sonne comme une fiche produit lue à voix haute.
      if (!/^(Je |J')/.test(q.usage)) faute(f, `qualifications : ${outil.nom} — l'usage doit être dit à la première personne, il est prononcé à l'entretien : « ${q.usage.slice(0, 40)}… »`);
    }
    const principaux = paquet.qualifications.logiciels.filter((q: any) => q.principal).length;
    if (principaux > 3) faute(f, `qualifications : ${principaux} outils principaux, trois au plus`);
  }
  // Un logiciel nommé par une tâche doit être une famille du référentiel, sinon la boutique
  // affiche le mot lui-même et l'application n'a aucun produit à proposer derrière. Vingt-trois
  // mots ne renvoyaient à rien — « tableur » 855 fois, « client-email » 332 — et rien ne le
  // disait ; outils/logiciels-metier.ts garde ce par quoi chacun a été remplacé.
  for (const t of paquet.taches) {
    for (const mot of t.logiciels ?? []) {
      if (categoriesLogiciels.has(mot)) continue;
      const quoiFaire = remplacement(mot, paquet.id);
      faute(f, `tâche « ${t.nom} » : « ${mot} » n'est pas une famille de catalogue/logiciels.json${quoiFaire ? ` — ${quoiFaire}` : ''}`);
    }
  }
  // Ce que l'agent a le droit d'ouvrir se lit dans ce que ses tâches ouvrent : écrit à part,
  // le bloc débordait de mots qui n'étaient plus dans aucune tâche sur 459 fiches, et en
  // oubliait sur 202 autres — l'agent manipulait un outil qu'il n'avait pas le droit d'ouvrir.
  const accesAttendu = logicielsDesTaches(paquet.taches, categoriesLogiciels);
  if (JSON.stringify(accesAttendu) !== JSON.stringify(paquet.acces.logiciels)) {
    if (corriger) { paquet.acces.logiciels = accesAttendu; modifie = true; }
    else faute(f, `acces.logiciels ≠ ce que les tâches ouvrent : attendu ${JSON.stringify(accesAttendu)}`);
  }
  // Ce que le poste doit porter pour cet agent (GIMP pour un graphiste, OmegaT pour un
  // traducteur) se lit dans les familles qu'il ouvre et dans la liste d'usine : c'est ce que
  // le script d'usine installe pour un agent embauché. Écrit à la main, il dériverait.
  const posteAttendu = logicielsPoste(accesAttendu, usine.logiciels);
  if (JSON.stringify(posteAttendu) !== JSON.stringify(paquet.acces.logicielsPoste)) {
    if (corriger) { paquet.acces.logicielsPoste = posteAttendu; modifie = true; }
    else faute(f, `acces.logicielsPoste ≠ ce que ses familles demandent au poste : attendu ${JSON.stringify(posteAttendu)}`);
  }
  // Les logiciels de création installés sur le poste (Photoshop, AutoCAD, Blender…) que
  // l'agent peut employer : ceux des familles qu'il ouvre (outils/creation-locale.ts).
  const creationAttendue = logicielsCreation(accesAttendu, logiciels.logiciels);
  if (JSON.stringify(creationAttendue) !== JSON.stringify(paquet.acces.logicielsCreation)) {
    if (corriger) { paquet.acces.logicielsCreation = creationAttendue; modifie = true; }
    else faute(f, `acces.logicielsCreation ≠ les logiciels de création de ses familles : attendu ${JSON.stringify(creationAttendue)}`);
  }

  // Une fiche sans qualifications échappait au contrôle ci-dessous : c'est pourtant
  // le pire cas — elle ouvre des familles et n'est qualifiée sur aucune.
  if (!paquet.qualifications?.logiciels?.length) {
    faute(f, `aucun logiciel déclaré : l'entretien ne demandera rien et la boutique ne peut pas filtrer la fiche`);
  } else {
    const familles = new Set<string>();
    for (const q of paquet.qualifications.logiciels) {
      const outil = logicielsParId.get(q.logiciel);
      if (outil) familles.add(outil.categorie);
    }
    const jamaisDemandees = accesAttendu.filter((c) => !familles.has(c));
    if (jamaisDemandees.length) {
      faute(f, `ouvre ${jamaisDemandees.join(', ')} sans savoir tenir un outil de ces familles : l'entretien ne posera jamais la question`);
    }
  }

  const com = commercialAttendu(entree.profil);
  if (JSON.stringify(com) !== JSON.stringify(paquet.commercial)) {
    if (corriger) { paquet.commercial = com; modifie = true; } else faute(f, `commercial ≠ profil ${entree.profil} : attendu ${JSON.stringify(com)}`);
  }
  try {
    const mat = materielPour(paquet.modeles);
    if (JSON.stringify(mat) !== JSON.stringify(paquet.materiel)) {
      if (corriger) { paquet.materiel = mat; modifie = true; } else faute(f, `materiel ≠ calcul : attendu ${JSON.stringify(mat)}`);
    }
  } catch (e) { faute(f, (e as Error).message); }
  if (paquet.execution) {
    const attendu = appelsParJourEstimes(paquet.taches);
    if (paquet.execution.appelsParJourEstimes !== attendu) {
      if (corriger) { paquet.execution.appelsParJourEstimes = attendu; modifie = true; } else faute(f, `appelsParJourEstimes ${paquet.execution.appelsParJourEstimes} ≠ calcul ${attendu}`);
    }
    const risque = profilRisqueAttendu(paquet.taches);
    if (paquet.profil_risque !== risque) {
      if (corriger) { paquet.profil_risque = risque; modifie = true; }
      else faute(f, `profil_risque « ${paquet.profil_risque} » ≠ ${risque} : l'agent est vendu autonome, le client met sous contrôle ce qu'il veut`);
    }

    // Une fiche ne peut pas exiger une application qui n'existe pas. Les 1 249
    // demandaient « 1.0.0 » quand l'application etait en 0.1.0, et rien ne lisait
    // le champ : branche, il aurait ferme le catalogue entier (`fiches.rs`).
    const exigee = paquet.miseAJour?.appMinimum;
    if (typeof exigee === 'string' && plusRecenteQue(exigee, VERSION_APP)) {
      faute(f, `miseAJour.appMinimum « ${exigee} » depasse la version de l'application (${VERSION_APP}) : l'application refuserait cette fiche`);
    }

    const capsModeles = Object.keys(paquet.modeles).filter((k) => k !== 'activite').sort().join(',');
    const capsApi = Object.keys(paquet.execution.api.capacites).sort().join(',');
    if (capsModeles !== capsApi) faute(f, `execution.api.capacites (${capsApi}) ne couvre pas modeles (${capsModeles})`);
  }
  if (modifie) { writeFileSync(chemin, JSON.stringify(paquet, null, 2) + '\n'); console.log(`  ✎ ${f} corrigé`); }
}
if (restants.length) {
  console.log(`  ⟳ ${restants.length} fiche(s) dont le métier reste à réécrire depuis le catalogue :`);
  for (const r of restants) console.log(`     ${r}`);
}
if (restantsContenu.length) {
  console.log(`  ⟳ ${restantsContenu.length} fiche(s) dont le contenu reste à écrire pour son métier (gabarit du générateur).`);
}
console.log(`${fichiers.length} paquets, ${fautes} faute(s)`);
if (fautes) process.exit(1);
