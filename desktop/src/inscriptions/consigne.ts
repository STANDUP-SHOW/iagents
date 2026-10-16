/**
 * Le registre d'inscription d'iAgent (classeur de max du 16/10/2026, converti
 * par importer-registre.py) et la consigne qu'un agent reçoit pour ouvrir un
 * compte. L'écran et le banc lisent tous deux ce fichier : la consigne qui part
 * est celle que le banc a vérifiée.
 */
import registreBrut from './registre.json' with { type: 'json' }

export type Texte = { champ: string; texte: string; plafond: number | null; fiabilite: string; consigne: string }
export type Plateforme = {
  id: string
  nom: string
  priorite: string
  genre: string
  public: string
  adresse: string
  typeCompte: string
  nomPublic: string
  identifiant: string
  categorie: string
  site: string
  avatar: string
  banniere: string | null
  vigilance: string
  source: string
  textes: Texte[]
  premierMessage: { texte: string; visuel: string; lien: string; note: string } | null
  etape: string
  mode: 'agent' | 'dirigeant' | 'plus-tard'
  raison: string | null
  dependDe: string | null
}
export type Registre = {
  source: string
  etapes: string[]
  vigilance: string[]
  marque: { champ: string; valeur: string; statut: string; consigne: string }[]
  plateformes: Plateforme[]
}

export const REGISTRE = registreBrut as Registre

/**
 * Ce que le classeur laisse « à confirmer ». Le dirigeant le dit une fois sur
 * l'écran ; un champ laissé vide n'est jamais deviné par l'agent, il le
 * demande au moment où un formulaire l'exige.
 */
export const INFOS = [
  { cle: 'email', libelle: 'Adresse e-mail des comptes', aide: 'Elle reçoit les codes de confirmation.', defaut: 'contact@iagent.agency' },
  { cle: 'telephone', libelle: 'Téléphone pour les vérifications', aide: 'Il reçoit les codes par SMS ; il n’est jamais publié.', defaut: '07 46 47 69 68' },
  { cle: 'adresse', libelle: 'Adresse légale', aide: 'Donnée seulement si un formulaire l’exige ; jamais publiée.', defaut: '' },
  { cle: 'siren', libelle: 'SIREN et forme sociale', aide: 'Vide tant que l’immatriculation n’est pas faite.', defaut: '' },
  { cle: 'annee', libelle: 'Année de création', aide: 'Celle de la société, pas du produit.', defaut: '' },
  { cle: 'effectif', libelle: 'Effectif humain réel', aide: 'Les agents ne comptent pas.', defaut: '' },
  { cle: 'demo', libelle: 'Lien de démonstration', aide: 'Laisser vide s’il n’existe pas.', defaut: '' },
] as const

export type Infos = Record<(typeof INFOS)[number]['cle'], string>

export const infosParDefaut = (): Infos =>
  Object.fromEntries(INFOS.map((i) => [i.cle, i.defaut])) as Infos

/** Les identifiants à essayer, dans l'ordre, si le premier est pris. */
export function identifiantsEssayes(p: Plateforme): string[] {
  const voulu = p.identifiant.replace(/^@/, '')
  const variantes = ['iagentagency', 'iagent', 'iagent_agency', 'iagentofficial', 'iagent_official']
  return [voulu, ...variantes].filter((v, i, t) => v && t.indexOf(v) === i)
}

const marque = (champ: string) => REGISTRE.marque.find((m) => m.champ === champ)?.valeur ?? ''

/**
 * La consigne d'ouverture d'un compte. Les textes y sont recopiés tels que le
 * classeur les donne : l'agent les colle, il ne les réécrit pas.
 */
export function consigneInscription(p: Plateforme, infos: Infos, publierPremierMessage: boolean): string {
  if (p.mode !== 'agent') throw new Error(`${p.nom} n'est pas ouvert par un agent : ${p.raison}`)
  const l: string[] = []
  const ajouter = (...t: string[]) => l.push(...t)
  const info = (v: string) => (v.trim() ? v.trim() : 'non renseigné : demandez-le au dirigeant seulement si le formulaire l’exige')

  ajouter(
    `Ouvrez le compte officiel de l'entreprise iAgent sur ${p.nom} (${p.typeCompte}), puis remplissez son profil avec les textes et les images ci-dessous.`,
    '',
    `Page de départ : ${p.adresse}`,
    `Type de compte : ${p.typeCompte}. Choisissez toujours l'offre gratuite ; tout paiement ou abonnement se demande au dirigeant.`,
    `Nom public : ${p.nomPublic}`,
    `Identifiant : essayez dans l'ordre ${identifiantsEssayes(p).map((i) => `« ${i} »`).join(', ')} et gardez le premier libre.`,
    `Catégorie : ${p.categorie} (indicative : prenez la plus proche que la plateforme propose).`,
    `Site : ${p.site}`,
    '',
    'Informations de l’entreprise :',
    `- Marque : ${marque('Marque publique') || 'iAgent'} ; activité : ${marque('Métier / activité')}.`,
    `- Région affichable : ${marque('Région')}. Ne publiez jamais une adresse.`,
    `- E-mail d'inscription et de contact : ${info(infos.email)}.`,
    `- Téléphone pour les vérifications (jamais publié) : ${info(infos.telephone)}.`,
    `- Adresse légale (jamais publiée) : ${info(infos.adresse)}.`,
    `- SIREN et forme sociale : ${info(infos.siren)}.`,
    `- Année de création : ${info(infos.annee)}.`,
    `- Effectif humain : ${info(infos.effectif)}. Les agents IA ne comptent jamais dans l'effectif.`,
    `- Lien de démonstration : ${infos.demo.trim() || 'aucun, n’en mettez pas'}.`,
    '',
    'Mot de passe : utilisez toujours saisir_mot_de_passe, qui le crée et le range au coffre. Ne le tapez jamais vous-même.',
    '',
    'Images, dans le dossier des téléversements :',
    `- Photo de profil : ${p.avatar}`,
    p.banniere ? `- Image de couverture : ${p.banniere}` : '- Pas d’image de couverture sur cette plateforme.',
    '',
    'Textes à coller exactement, chacun dans son champ :',
  )
  for (const t of p.textes) {
    ajouter('', `« ${t.champ} »${t.plafond ? ` (${t.plafond} caractères au plus)` : ''} :`, t.texte)
  }
  ajouter(
    '',
    'Si un champ n’existe pas sur la plateforme, passez-le et dites-le dans le compte rendu. Si un champ refuse un texte (trop long, caractères refusés), ne le réécrivez pas : demandez au dirigeant.',
  )
  if (p.premierMessage) {
    ajouter('', 'Premier message :')
    if (publierPremierMessage) {
      ajouter(
        'Le dirigeant l’a relu et demande de le publier une fois le profil complet, sans image s’il en faut une que vous n’avez pas :',
        p.premierMessage.texte,
      )
    } else {
      ajouter('Ne le publiez pas. Si la plateforme permet un brouillon, enregistrez-le en brouillon ; sinon, ne faites rien :', p.premierMessage.texte)
    }
  }
  ajouter(
    '',
    'À respecter :',
    `- ${p.vigilance}`,
    '- Si un compte iAgent existe déjà sur cette plateforme, ne créez pas de doublon : dites-le dans le compte rendu.',
    '- Ne créez jamais le compte personnel d’une personne. Si la plateforme exige d’être connecté à un compte personnel (Facebook, Google…), demandez au dirigeant de s’y connecter lui-même dans la fenêtre du navigateur, puis de répondre « c’est fait ».',
    '- Codes reçus par e-mail ou SMS, captcha, vérification d’identité : demandez au dirigeant, en une phrase.',
    '- N’inventez aucune information : ni chiffre, ni date, ni client, ni effectif.',
  )
  if (p.dependDe) {
    const autre = REGISTRE.plateformes.find((x) => x.id === p.dependDe)
    ajouter(`- Ce compte s'ouvre avec celui de ${autre?.nom ?? p.dependDe} : s'il n'existe pas encore, arrêtez-vous et dites-le.`)
  }
  ajouter(
    '',
    'C’est fini quand le profil public montre le nom, la photo, les textes et le lien du site. Terminez en donnant l’adresse publique du profil et l’identifiant retenu.',
  )
  return l.join('\n')
}

/** Le titre d'une procédure d'inscription ; l'écran s'en sert aussi pour la retrouver. */
export const titreInscription = (p: Plateforme) => `Compte iAgent sur ${p.nom}`
