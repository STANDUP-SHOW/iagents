/**
 * Banc du pack d'usine. Le script lui-même ne tourne que sous Windows, avec
 * winget ; ce banc tient ce qui peut se tenir ailleurs, c'est-à-dire les
 * accords entre `logiciels.json`, le script, l'intégration continue et le reste
 * du dépôt. Chacun de ces accords, rompu, donnerait un poste qui se dit prêt
 * sans l'être :
 *
 *  - le script qui recopie un identifiant au lieu de lire la liste (ajouter une
 *    ligne à `logiciels.json` ne changerait plus rien) ;
 *  - l'adresse de l'installeur qui ne porte plus le nom que publie
 *    `build-windows-msi.yml` (404 à la première machine) ;
 *  - un accent dans le script (Windows PowerShell 5.1 lit un .ps1 sans BOM en
 *    ANSI : chaque message deviendrait illisible) ;
 *  - un modèle tiré en usine qu'aucun palier ne connaît (l'application ne le
 *    reconnaîtrait pas et dirait au client qu'il manque un modèle) ;
 *  - le moteur local absent du poste (plus rien ne tourne en local).
 */
import { readFileSync } from 'node:fs';

const ici = new URL('.', import.meta.url);
const lire = (chemin: string) => readFileSync(new URL(chemin, ici), 'utf8');

type Logiciel = {
  id: string;
  source: string;
  nom: string;
  groupe: string;
  libre: boolean;
  role: string;
  argumentsInstalleur?: string;
  familles?: string[];
};
const liste = JSON.parse(lire('logiciels.json')) as {
  iagent: { adresse: string };
  groupes: Record<string, string>;
  logiciels: Logiciel[];
  modeles: { noms: string[] };
};
const script = lire('preparer-poste.ps1');
const lanceur = lire('preparer-poste.cmd');
const flux = lire('../.github/workflows/build-windows-msi.yml');
const modele = lire('../desktop/src-tauri/src/modele.rs');
const referentiel = JSON.parse(lire('../catalogue/logiciels.json')) as { categories: string[] };
const paliers = JSON.parse(lire('../dimensionnement/paliers-modeles.json')) as {
  paliers: Record<string, { exemples: string[] }>;
};

let fautes = 0;
function verifier(quoi: string, vrai: boolean, detail = ''): void {
  if (vrai) console.log(`  ok  ${quoi}`);
  else {
    fautes++;
    console.log(`  FAUTE  ${quoi}${detail ? ` : ${detail}` : ''}`);
  }
}

console.log('Pack d\'usine');

// --- La liste -----------------------------------------------------------------

const ids = liste.logiciels.map((l) => l.id);
verifier('chaque identifiant est unique', new Set(ids).size === ids.length);
for (const l of liste.logiciels) {
  verifier(`${l.id} : source connue`, ['winget', 'msstore'].includes(l.source), l.source);
  verifier(`${l.id} : groupe connu`, l.groupe in liste.groupes, l.groupe);
  verifier(`${l.id} : nom et rôle écrits`, l.nom.trim() !== '' && l.role.trim() !== '');
  verifier(`${l.id} : libre dit oui ou non`, typeof l.libre === 'boolean');
}

// max veut du libre. Ce qui ne l'est pas n'entre dans le poste que nommé ici,
// avec sa raison : WhatsApp n'a pas d'équivalent libre et le client s'en sert.
const EXCEPTIONS_NON_LIBRES = ['9NKSQGP7F2NH'];
const nonLibres = liste.logiciels.filter((l) => l.groupe === 'poste' && !l.libre).map((l) => l.id);
verifier(
  'aucun logiciel non libre dans le poste hors exception nommée',
  nonLibres.every((id) => EXCEPTIONS_NON_LIBRES.includes(id)),
  nonLibres.join(', '),
);

verifier(
  'le moteur local (Ollama) est dans le poste',
  liste.logiciels.some((l) => l.id === 'Ollama.Ollama' && l.groupe === 'poste'),
);

// L'agent ne pilote pas WhatsApp Desktop (Meta l'interdit) : la ligne doit le
// dire, pour que personne ne lise « installé » comme « branché ».
const whatsapp = liste.logiciels.find((l) => l.id === '9NKSQGP7F2NH');
verifier('WhatsApp est dit pour l\'usage humain', !!whatsapp && /usage humain/.test(whatsapp.role));

// Un logiciel de métier ne s'installe que par les familles qu'il sert : sans elles,
// aucune fiche ne le demanderait jamais. Une famille mal écrite ne correspondrait à
// aucune tâche, en silence.
const familles = new Set(referentiel.categories);
for (const l of liste.logiciels) {
  if (l.groupe === 'metier') verifier(`${l.id} : sert au moins une famille`, (l.familles ?? []).length > 0);
  for (const f of l.familles ?? []) verifier(`${l.id} : « ${f} » est une famille du référentiel`, familles.has(f));
}

// La maintenance à distance ouvre le poste à quelqu'un d'autre : le client la choisit.
const rustdesk = liste.logiciels.find((l) => l.id === 'RustDesk.RustDesk');
verifier('RustDesk ne s\'installe que sur demande', !rustdesk || rustdesk.groupe === 'option');

// --- Le script lit la liste, il ne la recopie pas -----------------------------

verifier('le script lit logiciels.json', script.includes("'logiciels.json'"));
verifier('le script lit les logiciels de métier dans la fiche', script.includes('acces.logicielsPoste'));
for (const id of ids) {
  verifier(`le script ne recopie pas ${id}`, !script.includes(id));
}
for (const m of liste.modeles.noms) {
  verifier(`le script ne recopie pas le modèle ${m}`, !script.includes(m));
}

const nonAscii = (texte: string) => [...texte].filter((c) => c.charCodeAt(0) > 127);
verifier('le script est en ASCII', nonAscii(script).length === 0, nonAscii(script).slice(0, 5).join(''));
verifier('le lanceur est en ASCII', nonAscii(lanceur).length === 0);
verifier('le lanceur appelle le script', lanceur.includes('preparer-poste.ps1'));

// --- L'installeur est celui que la CI publie ------------------------------------

const publie = flux.match(/publication\/(iAgent-Windows-setup\.exe)/)?.[1];
verifier('la CI publie iAgent-Windows-setup.exe', publie === 'iAgent-Windows-setup.exe');
verifier(
  'l\'adresse vise la dernière version publiée sous ce nom',
  liste.iagent.adresse === `https://github.com/STANDUP-SHOW/iagents/releases/latest/download/${publie}`,
  liste.iagent.adresse,
);

// --- Le moteur local et ses modèles ----------------------------------------------

const adresseLocale = modele.match(/ADRESSE_LOCALE: &str = "([^"]+)"/)?.[1];
verifier('le script attend le moteur là où l\'application le cherche',
  !!adresseLocale && script.includes(adresseLocale), adresseLocale ?? '(introuvable dans modele.rs)');

// Même comparaison que `meme_modele()` : la base du nom, sans séparateurs.
const base = (nom: string) => nom.toLowerCase().replace(/[\s:_-]/g, '');
const exemples = Object.values(paliers.paliers).flatMap((p) => p.exemples).map(base);
for (const m of liste.modeles.noms) {
  verifier(`le modèle ${m} est un exemple de palier`, exemples.includes(base(m)));
}

if (fautes > 0) {
  console.log(`\n${fautes} faute(s).`);
  process.exit(1);
}
console.log('\nPack d\'usine : tout tient.');
