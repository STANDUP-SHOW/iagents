/**
 * Banc de l'entretien d'embauche. Ce qui est vérifié ici n'est pas du confort : c'est la
 * limite entre un agent qui dit ce qu'il sait faire et un agent qui promet.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { economiePour } from '../dimensionnement/economie.ts';
import { INTENSITES, REPARTITIONS } from '../dimensionnement/intensite.ts';
import { planningDuClient } from './src/agents/fiche.ts';
import {
  planningDepuisAutonomie,
  AUTONOMIE_TOUT_SEUL,
  AUTONOMIE_CONSEILLEE,
  AUTONOMIE_TOUT_RELU,
  questionsCadre,
  reconnaitreActivite,
  confirmationActivite,
  reglesDeLaBranche,
  documentsDeLaBranche,
  horairesDeLaFiche,
  dossiersDeLaFiche,
  questionsEntretien,
  reconnaitre,
  configurer,
  porteeReelle,
  phrasePortee,
  resumeParle,
  normaliser,
  type Referentiel,
  type FicheQualifiee,
  type FicheCompelete,
  type ReferentielActivites,
  INTITULES,
  reglagesDepuisEntretien,
  REPARTITION_TOUT_LOCAL,
  REPARTITION_MIXTE,
  REPARTITION_TOUT_API,
} from './src/agents/entretien.ts';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..');
const ref: Referentiel = JSON.parse(readFileSync(join(racine, 'catalogue/logiciels.json'), 'utf8'));
const activites: ReferentielActivites = JSON.parse(readFileSync(join(racine, 'catalogue/activites.json'), 'utf8'));

function fiche(id: string): FicheQualifiee {
  const f = readdirSync(join(racine, 'agents')).find((n) => n.startsWith(`${id}-`));
  if (!f) throw new Error(`fiche ${id} absente`);
  return JSON.parse(readFileSync(join(racine, 'agents', f), 'utf8'));
}

let echecs = 0;
function verifier(intitule: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok  ${intitule}`);
  else { echecs++; console.log(`  ✗   ${intitule}${detail ? ` — ${detail}` : ''}`); }
}

const paie = fiche('AG-0133');       // Assistant paie : Silae, PayFit, Sage Paie, ADP, Cegid, DSN
const courrier = fiche('AG-0009');   // Gestionnaire de courrier

// --- Les questions ---------------------------------------------------------
const questions = questionsEntretien(paie, ref);
verifier(
  "l'agent pose une question par famille d'outils, pas une par produit",
  questions.length < (paie.qualifications?.logiciels.length ?? 0),
  `${questions.length} questions pour ${paie.qualifications?.logiciels.length} logiciels`
);
verifier(
  "les familles sans lesquelles le poste n'existe pas viennent en premier",
  questions[0].principale === true,
  questions[0].categorie
);
verifier(
  "la question de paie cite les logiciels que l'agent sait tenir",
  questions.some((q) => q.categorie === 'paie' && q.propositions.includes('Silae')),
);
verifier(
  "chaque question est une phrase parlée, pas un nom de champ",
  questions.every((q) => q.intitule.endsWith('?') && q.intitule.length > 20),
);

// --- La reconnaissance de ce que le client dit -----------------------------
verifier("« silae » sans majuscule est reconnu", (() => {
  const v = reconnaitre('silae', ref, 'paie');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Silae';
})());
verifier("« on est sur Pennylane » est reconnu dans la phrase", (() => {
  const v = reconnaitre('on est sur Pennylane', ref, 'comptabilite');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Pennylane';
})());
verifier("un alias du relevé V6 est reconnu", (() => {
  const v = reconnaitre('Workday', ref, 'sirh');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Workday HCM';
})(), 'Workday → Workday HCM');
verifier("les accents ne changent rien", normaliser('Eurécia') === normaliser('eurecia'));
verifier("« Sage » sans famille désigne trop de produits pour être tranché", (() => {
  const v = reconnaitre('Sage', ref);
  return v.etat === 'ambigu' && v.candidats.length > 2;
})());
verifier("dans une famille donnée, « Sage » se résout au produit de cette famille", (() => {
  const v = reconnaitre('Sage', ref, 'paie');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Sage Paie & RH';
})());
verifier("« Microsoft » reste ambigu même dans sa famille, il y en a deux", (() => {
  const v = reconnaitre('Microsoft', ref, 'bureautique');
  return v.etat === 'ambigu' && v.candidats.length === 2;
})());
verifier("un outil inconnu reste inconnu, il n'est pas rapproché du plus proche", (() => {
  const v = reconnaitre('Gestipaye 3000', ref, 'paie');
  return v.etat === 'inconnu';
})());

// --- La configuration ------------------------------------------------------
const config = configurer(paie, ref, [{ categorie: 'paie', dit: 'Silae' }]);
verifier(
  "un outil reconnu et déclaré par la fiche est retenu",
  config.retenus.some((o) => o.logiciel.nom === 'Silae'),
);

// Le gestionnaire de courrier travaille dans quatre familles : on n'en renseigne qu'une.
const partielle = configurer(courrier, ref, [{ categorie: 'bureautique', dit: 'Microsoft 365' }]);
verifier(
  "une famille restée sans réponse est signalée comme telle",
  partielle.sansReponse.length === 3,
  partielle.sansReponse.map((s) => s.categorie).join(', ')
);
verifier(
  "l'agent distingue ce qui lui manque d'essentiel du reste",
  partielle.sansReponse.some((s) => s.principale) &&
    resumeParle(partielle).some((l) => l.includes('Il me manque l\'essentiel')),
);

const horsMetier = configurer(paie, ref, [{ categorie: 'paie', dit: 'Procore' }]);
verifier(
  "un outil que la fiche n'a jamais déclaré savoir tenir n'est pas retenu",
  horsMetier.retenus.length === 0 && horsMetier.horsMetier.some((l) => l.nom === 'Procore'),
);

const inconnu = configurer(paie, ref, [{ categorie: 'paie', dit: 'notre logiciel maison Paie2001' }]);
verifier(
  "ce que le référentiel ignore est conservé mot pour mot, jamais deviné",
  inconnu.inconnus.includes('notre logiciel maison Paie2001') && inconnu.retenus.length === 0,
);

const ambigu = configurer(courrier, ref, [{ categorie: 'bureautique', dit: 'Microsoft' }]);
verifier(
  "une réponse qui désigne plusieurs produits fait redemander, pas choisir",
  ambigu.aPreciser.length === 1 && ambigu.retenus.length === 0,
);
verifier(
  "et l'agent redemande à voix haute en citant les produits possibles",
  resumeParle(ambigu).some((l) => l.includes('Lequel est le vôtre ?') && l.includes('Microsoft 365')),
);

// --- Le client parle comme il parle ---------------------------------------
verifier("« on fait ça sur Excel » tombe sur la suite bureautique", (() => {
  const v = reconnaitre('on fait ça sur Excel', ref, 'bureautique');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Microsoft 365';
})());
verifier("« LinkedIn » tout court désigne l'outil de recrutement", (() => {
  const v = reconnaitre('LinkedIn', ref, 'ats');
  return v.etat === 'reconnu' && v.logiciel.nom === 'LinkedIn Recruiter';
})());
verifier("« on n'a rien » est une réponse, pas une incompréhension", (() => {
  const v = reconnaitre("on n'a rien", ref, 'facturation');
  return v.etat === 'sans-outil';
})());
verifier("« tout est sur papier » aussi", (() => {
  const v = reconnaitre('tout est sur papier', ref, 'ged');
  return v.etat === 'sans-outil';
})());
const rien = configurer(courrier, ref, [{ categorie: 'facturation', dit: "on n'a rien pour ça" }]);
verifier(
  "une famille sans outil n'est ni retenue, ni notée comme inconnue",
  rien.sansOutil.length === 1 && rien.inconnus.length === 0 && rien.retenus.length === 0,
);
verifier(
  "l'agent le dit à voix haute et annonce comment il fera sans",
  resumeParle(rien).some((l) => l.includes("Vous n'avez pas d'outil") && l.includes('vos fichiers')),
);
verifier(
  "un nom de produit contenant un mot de négation reste reconnu comme produit",
  (() => {
    const v = reconnaitre('Pennylane', ref, 'comptabilite');
    return v.etat === 'reconnu';
  })(),
);
verifier(
  "un nom d'outil caché dans un mot plus long n'est pas reconnu comme cet outil",
  (() => {
    // « papier » contient « PAP », « sapin » contient « SAP » : sans mots entiers,
    // le client qui dit n'avoir aucun outil se voit proposer un portail d'annonces.
    const v = reconnaitre('tout est sur papier', ref);
    const w = reconnaitre('on range ça dans un sapin de dossiers', ref);
    return v.etat !== 'reconnu' && w.etat !== 'reconnu';
  })(),
);
verifier(
  "mais un nom d'outil dit au milieu d'une phrase reste reconnu",
  (() => {
    const v = reconnaitre('on est passé sur Odoo', ref, 'erp');
    const w = reconnaitre('on est sur Pennylane', ref, 'comptabilite');
    return v.etat === 'reconnu' && v.logiciel.nom === 'Odoo'
      && w.etat === 'reconnu' && w.logiciel.nom === 'Pennylane';
  })(),
);
verifier(
  "un produit dont le nom contient celui d'un autre ne rend pas la réponse ambiguë",
  (() => {
    // « Pipedrive » contient « Drive », « Lexoffice » contient « Office » : demander au
    // client de choisir entre l'outil qu'il vient de nommer et un autre le déroute.
    const a = reconnaitre('Pipedrive', ref, 'crm');
    const b = reconnaitre('Lexoffice', ref);
    return a.etat === 'reconnu' && a.logiciel.nom === 'Pipedrive'
      && b.etat === 'reconnu' && b.logiciel.nom === 'Lexoffice';
  })(),
);

// --- Ce que l'agent promet -------------------------------------------------
const sansApi = ref.logiciels.filter((l) => porteeReelle(l) === 'navigateur');
verifier(
  "un outil sans interface annonce le navigateur et la validation du client",
  sansApi.length > 0 && sansApi.every((l) => {
    const p = phrasePortee(l);
    return p.includes('navigateur') && p.includes('valid');
  }),
  `${sansApi.length} outils concernés`
);
const avecApi = ref.logiciels.filter((l) => porteeReelle(l) === 'api');
verifier(
  "même avec une interface officielle, l'agent ne se dit jamais déjà connecté",
  avecApi.every((l) => {
    const p = phrasePortee(l).toLowerCase();
    return !p.includes('je suis connecté') && !p.includes('je suis branché');
  }),
);
verifier(
  "un outil à interface officielle dit que l'accès reste à ouvrir sur le compte du client",
  avecApi.every((l) => phrasePortee(l).includes('votre compte')),
);

const resume = resumeParle(inconnu);
verifier(
  "devant un outil inconnu, l'agent dit qu'il ne prétendra pas savoir s'en servir",
  resume.some((l) => l.includes('Paie2001') && l.includes('ne prétendrai pas')),
);

// --- Toutes les fiches qualifiées passent l'entretien ----------------------
const fichiers = readdirSync(join(racine, 'agents'));
let qualifiees = 0;
let sansQuestion = 0;
for (const f of fichiers) {
  const p: FicheQualifiee = JSON.parse(readFileSync(join(racine, 'agents', f), 'utf8'));
  if (!p.qualifications) continue;
  qualifiees++;
  if (questionsEntretien(p, ref).length === 0) sansQuestion++;
}
verifier(
  "toute fiche qualifiée sait mener son entretien",
  sansQuestion === 0,
  `${qualifiees} fiches qualifiées, ${sansQuestion} sans question`
);
verifier(
  "un agent sans qualification ne pose aucune question plutôt que d'en inventer",
  questionsEntretien({ nom: 'témoin' }, ref).length === 0,
);

// --- Le cadrage : activité, horaires, intensité, répartition, autonomie ----
const pleine = paie as FicheCompelete;
const couts = {
  light: economiePour(pleine as never, { intensite: 'light' }).apiResiduelle,
  medium: economiePour(pleine as never, { intensite: 'medium' }).apiResiduelle,
  high: economiePour(pleine as never, { intensite: 'high' }).apiResiduelle,
};
const cadre = questionsCadre(pleine, couts);
const sujets = cadre.map((q) => q.sujet);
verifier(
  "l'entretien couvre l'activité, les horaires, l'intensité, la répartition, l'autonomie et les dossiers",
  ['activite', 'horaires', 'intensite', 'repartition', 'autonomie', 'dossiers'].every((s) => sujets.includes(s as never)),
  sujets.join(', ')
);
verifier(
  "chaque question de cadrage porte déjà sa réponse, sauf celle que l'agent ne peut pas deviner",
  cadre.filter((q) => !q.defaut).length === 1 && cadre.find((q) => !q.defaut)?.sujet === 'activite',
);
verifier(
  "les horaires proposés viennent des heures écrites sur la fiche",
  (() => {
    const h = horairesDeLaFiche(pleine.taches ?? []);
    const q = cadre.find((x) => x.sujet === 'horaires');
    return !!h && !!q && q.intitule.includes(String(Number(h.debut.split(':')[0])));
  })(),
);
verifier(
  "le choix de l'intensité est présenté avec son coût en euros, pas avec un adjectif",
  (() => {
    const q = cadre.find((x) => x.sujet === 'intensite');
    return !!q && /\d+ € d'API par mois/.test(q.intitule);
  })(),
);
verifier(
  "un rythme soutenu coûte plus cher qu'un rythme normal, qui coûte plus qu'un rythme léger",
  couts.high > couts.medium && couts.medium > couts.light,
  `${couts.light} < ${couts.medium} < ${couts.high}`
);
verifier(
  "en tout local, rien ne se paie au jeton",
  economiePour(pleine as never, { repartition: 'local' }).apiResiduelle === 0,
);
verifier(
  "et l'agent dit alors que ce que la machine ne tient pas s'arrête au lieu d'être fait en moins bien",
  REPARTITIONS.local.phrase.includes("s'arrête"),
);
verifier(
  "changer d'intensité ne change aucune autonomie : c'est un réglage de charge, pas de droits",
  Object.values(INTENSITES).every((i) => !/autonom|valid|accord/i.test(i.phrase)),
);
verifier(
  "la question d'autonomie dit combien de tâches attendent l'accord du client",
  (() => {
    const q = cadre.find((x) => x.sujet === 'autonomie');
    const aValider = (pleine.taches ?? []).filter((t) => t.validationHumaine).length;
    return !!q && q.intitule.includes(String(aValider));
  })(),
);
verifier(
  "les dossiers annoncés sont ceux où la fiche écrit vraiment",
  dossiersDeLaFiche(pleine.taches ?? []).length > 0,
);

// --- L'activité du client --------------------------------------------------
verifier("« on est dans la quincaillerie de gros » est reconnu", (() => {
  const v = reconnaitreActivite('on est dans la quincaillerie de gros', activites);
  return v.etat === 'reconnu' && v.activite.nom === 'Quincaillerie de gros';
})());
verifier("« imprimeur » tombe sur l'imprimerie", (() => {
  const v = reconnaitreActivite('imprimeur', activites);
  return v.etat === 'reconnu' && v.activite.famille === 'industrie';
})());
verifier("une activité inconnue reste inconnue plutôt que rapprochée de force", (() => {
  const v = reconnaitreActivite('fabricant de soucoupes volantes', activites);
  return v.etat === 'inconnu';
})());
verifier(
  "chaque activité dit ce qui caractérise la branche, pas seulement son nom",
  activites.activites.every((a) => a.trait.length >= 40),
);

// Le pack d'activité est ce qui fait la différence entre un agent générique et un agent qui
// connaît la branche du client. Tant qu'il n'est pas écrit, l'agent doit rester correct :
// il redit ce qui caractérise la branche au lieu de réciter des mots qu'il n'a pas.
verifier("sans pack, l'agent dit quand même ce qu'il a compris de la branche", (() => {
  const sans = activites.activites.find((a) => !a.pack);
  return !sans || confirmationActivite(sans).includes(sans.trait);
})());
verifier("avec un pack, l'agent emploie les mots de la branche", (() => {
  const avec = activites.activites.filter((a) => a.pack);
  return avec.every((a) => {
    const dit = confirmationActivite(a).toLowerCase();
    return a.pack!.vocabulaire.slice(0, 3).every((v) => dit.includes(v.terme.toLowerCase()));
  });
})());
verifier("les règles de la branche s'ajoutent à celles de la fiche, elles ne s'y substituent pas", (() => {
  const avec = activites.activites.filter((a) => a.pack);
  return avec.every((a) => reglesDeLaBranche(a).length >= 2 && documentsDeLaBranche(a).length >= 3);
})());
verifier("les outils de la branche s'ajoutent aux propositions sans ouvrir de famille inutile", (() => {
  const avec = activites.activites.find((a) => a.pack);
  if (!avec) return true;
  const sansPack = questionsEntretien(pleine, ref);
  const avecPack = questionsEntretien(pleine, ref, avec);
  return avecPack.length === sansPack.length;
})());

// Une catégorie sans question écrite retombe sur une phrase fabriquée à partir de son
// identifiant (« Quel outil utilisez-vous pour note de frais ? ») : lue à voix haute, elle
// trahit la fiche produit derrière l'agent.
verifier(
  "chaque famille de logiciels a sa question dite en français, aucune n'est fabriquée",
  ref.categories.every((c) => typeof INTITULES[c] === 'string' && INTITULES[c].length > 10),
);


// La réponse du client sur l'autonomie doit ARRIVER quelque part. Elle était
// posée, affichée, et jetée : l'écran d'embauche n'écrivait que le prénom, la
// fiche et la voix, donc le client n'avait aucun moyen de mettre une tâche sous
// contrôle. Une question dont la réponse ne règle rien fait croire au client
// qu'il a décidé. Ce banc va jusqu'au bout de la chaîne : la réponse devient un
// planning, et le planning change ce que `planningDuClient` conclut — c'est la
// même fonction que l'application lit, et `temoins-planning.json` la tient déjà
// d'accord avec le Rust.
{
  const fiches = readdirSync(join(racine, 'agents')).filter((f) => f.endsWith('.json')).sort();
  const f = JSON.parse(readFileSync(join(racine, 'agents', fiches[0]), 'utf8'));
  const actives = f.taches.filter((t: { active?: boolean }) => t.active !== false);
  const conseillees = actives.filter((t: { validationHumaine?: boolean }) => t.validationHumaine === true);
  const idDe = (t: { id?: string }) => t.id ?? '';
  const controlees = (dit: string) =>
    planningDuClient(f, planningDepuisAutonomie(f.taches, dit, idDe) ?? {})
      .filter((t) => t.validationHumaine).length;

  verifier(
    "la question d'autonomie dit que l'agent va seul, pas qu'il attend un accord",
    (() => {
      const q = questionsCadre(f).find((x) => x.sujet === 'autonomie');
      return !!q && /travaille seul|tournent seules/.test(q.intitule) && (q.options ?? []).length >= 2;
    })(),
  );
  verifier(
    "« j'y vais seul » n'écrit aucun réglage : c'est déjà la règle",
    planningDepuisAutonomie(f.taches, AUTONOMIE_TOUT_SEUL, idDe) === undefined,
  );
  verifier(
    "une réponse que l'agent ne comprend pas ne pose pas de réglage non demandé",
    planningDepuisAutonomie(f.taches, 'euh, comme vous voulez', idDe) === undefined,
  );
  verifier(
    "« soumettez-moi celles que vous conseillez » met sous contrôle celles-là, et pas d'autres",
    controlees(AUTONOMIE_CONSEILLEE) === conseillees.length && conseillees.length > 0,
    `${controlees(AUTONOMIE_CONSEILLEE)} sur ${conseillees.length} conseillées`,
  );
  verifier(
    "« soumettez-moi tout » met sous contrôle toutes les tâches allumées",
    controlees(AUTONOMIE_TOUT_RELU) === actives.length && actives.length > 0,
    `${controlees(AUTONOMIE_TOUT_RELU)} sur ${actives.length} actives`,
  );
  verifier(
    'sans réponse du client, rien n\'attend d\'accord : la règle de max tient jusqu\'au bout',
    planningDuClient(f, {}).every((t) => !t.validationHumaine),
  );
  // Une tâche éteinte que le client rallumerait ensuite ne doit pas arriver
  // sous contrôle sans qu'il l'ait demandé.
  verifier(
    "une tâche éteinte ne reçoit pas de réglage d'autonomie",
    (() => {
      const eteintes = f.taches.filter((t: { active?: boolean }) => t.active === false).map(idDe);
      const p = planningDepuisAutonomie(f.taches, AUTONOMIE_TOUT_RELU, idDe);
      return (p?.ajustements ?? []).every((a) => !eteintes.includes(a.tacheId));
    })(),
  );
}

// --- Ce que le client répond arrive-t-il quelque part ? ----------------------
// Six questions, une seule réponse gardée jusqu'au 24/09/2026 : l'écran
// n'écrivait que le prénom, la fiche, la voix et le planning. Une question dont
// la réponse ne règle rien est pire qu'une question qu'on ne pose pas, elle fait
// croire au client qu'il a décidé. Ce banc vérifie que chaque sujet a une
// destination, et que la liste ne se referme pas en silence sur un sujet ajouté.
{
  const noms = readdirSync(join(racine, 'agents')).filter((n) => n.endsWith('.json')).sort();
  const f = JSON.parse(readFileSync(join(racine, 'agents', noms[0]), 'utf8'));
  const questions = questionsCadre(f);
  const reponses: Record<string, string> = { activite: 'imprimerie de labeur, douze salariés' };
  const regle = reglagesDepuisEntretien(questions, reponses);

  verifier(
    "ce que le client dit de son activité arrive au modèle, avec SES mots",
    regle.competences.some((c) => c.resume === 'imprimerie de labeur, douze salariés'),
    JSON.stringify(regle.competences.map((c) => c.titre)),
  );
  verifier(
    "la répartition devient un réglage, pas un savoir",
    regle.repartition === REPARTITION_MIXTE &&
      !regle.competences.some((c) => c.resume === REPARTITION_MIXTE),
    `repartition=${regle.repartition}`,
  );
  verifier(
    "l'autonomie n'est pas recopiée en savoir : elle devient un planning",
    !regle.competences.some((c) =>
      [AUTONOMIE_CONSEILLEE, AUTONOMIE_TOUT_SEUL, AUTONOMIE_TOUT_RELU].includes(c.resume)
    ),
  );
  // Une proposition que le client laisse passer vaut réponse : c'est tout le
  // principe de l'entretien, il confirme d'un mot ou corrige.
  verifier(
    "un défaut non touché vaut réponse",
    reglagesDepuisEntretien(questions, {}).competences.length > 0,
  );
  // Le vrai garde : un sujet ajouté sans destination retomberait par terre
  // exactement comme les cinq d'avant, et personne ne le verrait.
  const sansDestination = questions
    .map((q) => q.sujet)
    .filter((sujet) => {
      if (sujet === 'autonomie') return false; // devient un planning
      if (sujet === 'repartition') return regle.repartition === undefined;
      const seul = reglagesDepuisEntretien(
        questions.filter((q) => q.sujet === sujet),
        { [sujet]: 'une réponse du client' }
      );
      return seul.competences.length === 0;
    });
  verifier(
    "chaque sujet de l'entretien a une destination",
    sansDestination.length === 0,
    `sans destination : ${sansDestination.join(', ')}`,
  );
}

// --- Les libellés de répartition disent la même chose des deux côtés ---------
// Le client choisit un libellé à l'écran ; c'est Rust qui le relit pour fermer
// une voie. Écrits deux fois, ils auraient fini par diverger, et le client
// aurait choisi une option qui ne réglait rien — sans que rien n'échoue.
{
  const rust = readFileSync(join(racine, 'desktop/src-tauri/src/modele.rs'), 'utf8');
  const cote = (nom: string) =>
    rust.match(new RegExp(`pub const ${nom}: &str = "([^"]+)"`))?.[1];
  for (const [nom, ecran] of [
    ['CLIENT_TOUT_LOCAL', REPARTITION_TOUT_LOCAL],
    ['CLIENT_MIXTE', REPARTITION_MIXTE],
    ['CLIENT_TOUT_API', REPARTITION_TOUT_API],
  ] as const) {
    verifier(
      `${nom} : l'écran et Rust lisent le même libellé`,
      cote(nom) === ecran,
      `Rust dit « ${cote(nom)} », l'écran dit « ${ecran} »`,
    );
  }
}

console.log(`${echecs === 0 ? `${qualifiees} fiches qualifiées — entretien d'embauche ok` : `${echecs} attente(s) non tenue(s)`}`);
if (echecs) process.exit(1);
