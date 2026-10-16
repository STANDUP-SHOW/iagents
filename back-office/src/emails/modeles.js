// The e-mail studio's engine: the ten templates of max's kit (iAgent Studio
// E-mail V4, KIT-README.md) and the HTML / plain-text rendering, ported from
// its studio.js into pure functions. No DOM, no network: the screen, the bench
// and the empreinte all call the same functions.
//
// What changed from the kit, on purpose:
//  - agents come from the real catalogue (catalogue.json, generated from
//    catalogue/personnel.json and agents/), never from the kit's demo profiles,
//    and the kit's mock portraits are not shipped at all;
//  - images are not « to host »: for sending, the logo and illustration are
//    attached to the message (cid:) and the portraits are fetched from
//    iagent.agency and attached as JPEG by Rust (Outlook does not show WebP);
//  - the sender, legal footer and unsubscribe default to iAgent Tech's real
//    details.
import catalogue from './catalogue.json';

export const CATALOGUE = catalogue;
export const SITE = 'https://iagent.agency';

// Same rule as frontend/src/data/portraits.js (the bench compares the two).
export const NOMBRE_DE_PORTRAITS = 428;
export const numeroDePortrait = (id) => {
  const n = parseInt(String(id ?? '').slice(3), 10) || 0;
  return ((n * 37) % NOMBRE_DE_PORTRAITS) + 1;
};
export const nomDePortrait = (id) => `a${String(numeroDePortrait(id)).padStart(3, '0')}`;

export const MODELES = [
  { id: 'investisseur-prestige', num: '01', famille: 'Investisseurs', titre: 'Investisseurs · Dossier premium', aide: 'Présentation, stratégie et liens sécurisés', hero: 'Le futur du travail a déjà commencé.', intro: 'iAgent prépare le déploiement commercial de collaborateurs IA spécialisés par métier, pilotables à la voix et disponibles en local, dans le cloud ou en mode hybride.', objet: 'iAgent — une nouvelle force de travail IA pour les entreprises', preEntete: 'Découvrez notre architecture hybride, nos agents spécialisés et notre programme de financement.', message: 'Je souhaitais vous présenter iAgent et vous proposer un échange sur notre stratégie de déploiement commercial. Notre priorité : documenter le fonctionnement du produit, déployer les premiers clients et accélérer notre croissance avec les bons partenaires.', bouton: 'Découvrir iAgent', lien: 'https://iagent.agency/', genre: 'investor', ton: 'pink', sections: ['about', 'funding', 'resources', 'pillars'] },
  { id: 'investisseur-vision', num: '02', famille: 'Investisseurs', titre: 'Investisseurs · Vision & technologie', aide: 'Différenciation, Box et architecture', hero: 'Vous n’investissez pas dans un chatbot.', intro: 'Vous découvrez une plateforme où l’entreprise peut recruter, superviser et équiper de véritables collaborateurs numériques, accessibles par la voix.', objet: 'iAgent — l’IA que l’on recrute et que l’on dirige', preEntete: 'Une technologie locale, cloud et hybride conçue pour les équipes professionnelles.', message: 'Nous recherchons des partenaires capables de soutenir une industrialisation et une commercialisation structurées, avec une attention particulière portée à la maîtrise des données, aux coûts d’exploitation et à la relation naturelle avec les agents.', bouton: 'Échanger sur notre projet', lien: 'https://iagent.agency/', genre: 'investor', ton: 'cyan', sections: ['pillars', 'about', 'resources', 'funding'] },
  { id: 'prospection-metier', num: '03', famille: 'Acquisition B2B', titre: 'Prospection · Agents par métier', aide: '3 portraits et fonctions adaptées à l’activité', hero: 'Et si votre prochain collaborateur était une IA ?', intro: 'Des agents spécialisés dans votre activité, que vous pouvez rencontrer, former à vos méthodes et faire travailler avec vos logiciels.', objet: '{{entreprise}} — rencontrez vos futurs collaborateurs IA', preEntete: 'Trois agents spécialisés dans votre activité, présentés par iAgent.', message: 'Bonjour {{prenom}},\n\nJ’ai sélectionné pour {{entreprise}} trois profils iAgent adaptés à votre activité. Je vous propose de choisir une tâche répétitive de votre équipe et de découvrir ce que l’un de ces agents peut prendre en charge, sous votre supervision.\n\nSeriez-vous disponible pour une démonstration de 15 minutes ?', bouton: 'Découvrir ces agents', lien: 'https://iagent.agency/', genre: 'agents', ton: 'pink', sections: ['agents', 'benefits', 'pillars'] },
  { id: 'cercle-50', num: '04', famille: 'Acquisition B2B', titre: 'Cercle des 50 · Entreprises pilotes', aide: 'Invitation à un programme d’essai accompagné', hero: 'Faites partie des 50 entreprises fondatrices.', intro: 'Une invitation à découvrir une nouvelle façon de renforcer vos équipes avec des collaborateurs IA spécialisés.', objet: '{{entreprise}} — invitation au Cercle Fondateur iAgent 50', preEntete: 'Démonstration métier et accompagnement privilégié au lancement.', message: 'Bonjour {{prenom}},\n\nNous sélectionnons nos 50 premières entreprises partenaires. Nous aimerions vous présenter plusieurs agents spécialisés dans votre métier, puis étudier avec vous une première mission concrète.\n\nSi votre entreprise souhaite participer, je peux vous proposer une démonstration personnalisée.', bouton: 'Demander ma démonstration', lien: 'https://iagent.agency/', genre: 'agents', ton: 'orange', sections: ['agents', 'offer', 'benefits', 'pillars'] },
  { id: 'marketing-decouverte', num: '05', famille: 'Marketing', titre: 'Marketing · Découvrir iAgent', aide: 'Campagne et notoriété multi-secteurs', hero: 'Une équipe entière. À portée de main.', intro: 'Parlez à vos agents, confiez-leur des missions et suivez leur travail. Des compétences adaptées à chaque métier, sans multiplier les logiciels.', objet: 'Découvrez la nouvelle génération de collaborateurs IA', preEntete: 'Votre métier a déjà ses experts IA : découvrez-les.', message: 'Et si vous pouviez agrandir votre équipe sans alourdir vos processus ? Découvrez comment iAgent transforme vos tâches professionnelles en missions confiées à des collaborateurs numériques spécialisés.', bouton: 'Explorer le catalogue', lien: 'https://iagent.agency/', genre: 'marketing', ton: 'cyan', sections: ['agents', 'benefits', 'pillars'] },
  { id: 'marketing-campagne', num: '06', famille: 'Marketing', titre: 'Marketing · Campagne événementielle', aide: 'Offre, annonce ou invitation éditable', hero: 'Vos ambitions. De nouveaux talents IA.', intro: 'Une nouvelle façon de travailler : des agents spécialisés et un dialogue naturel, à la voix ou à l’écrit.', objet: '{{entreprise}} — une nouvelle façon de travailler', preEntete: 'Découvrez les possibilités d’iAgent pour votre entreprise.', message: 'Nous vous invitons à découvrir iAgent lors d’une présentation dédiée aux entreprises. À partir de votre métier et de vos objectifs, nous montrons comment constituer une équipe IA et superviser ses missions.', bouton: 'Réserver une présentation', lien: 'https://iagent.agency/', genre: 'marketing', ton: 'violet', sections: ['pillars', 'agents', 'benefits'] },
  { id: 'bienvenue', num: '07', famille: 'Clients', titre: 'Clients · Bienvenue', aide: 'Inscription et activation du compte', hero: 'Bienvenue dans votre nouvelle équipe.', intro: 'Votre espace iAgent est prêt à être configuré. Commencez par choisir votre métier et les responsabilités de vos premiers agents.', objet: 'Bienvenue chez iAgent, {{prenom}} !', preEntete: 'Votre prochaine étape : rencontrer vos premiers collaborateurs IA.', message: 'Bonjour {{prenom}},\n\nBienvenue chez iAgent ! Vous pouvez désormais préparer votre espace, découvrir les profils correspondant à votre activité et définir la première mission de votre équipe IA.\n\nNous sommes ravis de vous accompagner.', bouton: 'Accéder à mon espace', lien: '', genre: 'client', ton: 'pink', sections: ['steps', 'agents', 'pillars'] },
  { id: 'activation', num: '08', famille: 'Clients', titre: 'Clients · Activation / installation', aide: 'Desktop, Box, premier agent et support', hero: 'Votre première mission commence ici.', intro: 'Votre assistant numérique devient un collaborateur : accueillez-le, définissez son poste et choisissez ses outils.', objet: '{{prenom}}, préparons votre premier agent iAgent', preEntete: 'Recrutement, voix, connexion des outils et première mission.', message: 'Bonjour {{prenom}},\n\nPour démarrer dans de bonnes conditions, nous vous proposons trois étapes : choisir un agent, définir ses autorisations, puis lancer une première mission avec un résultat mesurable.\n\nBesoin d’un accompagnement ? Notre équipe peut vous guider.', bouton: 'Configurer mon agent', lien: '', genre: 'client', ton: 'cyan', sections: ['steps', 'pillars', 'agents'] },
  { id: 'relance-demo', num: '09', famille: 'Relances', titre: 'Relance · Démonstration', aide: 'Après contact ou proposition commerciale', hero: 'On vous présente votre futur collaborateur ?', intro: 'Une démonstration pensée autour de votre métier, de vos outils et d’une mission que vous aimeriez déléguer.', objet: '{{prenom}}, puis-je vous montrer iAgent en 15 minutes ?', preEntete: 'Une démonstration courte, adaptée à vos besoins.', message: 'Bonjour {{prenom}},\n\nJe reviens vers vous concernant notre présentation d’iAgent. Si le sujet reste d’actualité, nous pouvons sélectionner ensemble une tâche récurrente de {{entreprise}} et regarder ce qu’un agent spécialisé peut exécuter sous votre contrôle.\n\nUn échange de 15 minutes vous conviendrait-il ?', bouton: 'Organiser une démonstration', lien: 'https://iagent.agency/', genre: 'agents', ton: 'orange', sections: ['agents', 'benefits', 'pillars'] },
  { id: 'a-propos', num: '10', famille: 'Institutionnel', titre: 'À propos · Notre différence', aide: 'Recrutement, voix, logiciel, local/cloud', hero: 'N’installez pas une IA. Recrutez un collaborateur.', intro: 'iAgent humanise la relation avec l’intelligence artificielle : un métier, une voix, des responsabilités, une place dans votre organisation.', objet: 'iAgent — plus qu’un logiciel, une force de travail', preEntete: 'Une architecture hybride et des agents que l’on recrute, dirige et supervise.', message: 'Avec iAgent, on choisit un métier, on réalise un entretien d’embauche et on définit les responsabilités de chaque agent. On lui parle naturellement et on lui confie des tâches dans les outils autorisés de l’entreprise. Notre architecture propose un fonctionnement local, cloud ou hybride, avec permissions, approbations et traçabilité.', bouton: 'Découvrir notre vision', lien: 'https://iagent.agency/', genre: 'about', ton: 'violet', sections: ['pillars', 'about', 'agents'] },
];

export const MENTIONS_IAGENT = 'iAgent Tech, SASU au capital de 10 000 € · 2 rue Julien Imbert, 34500 Béziers · contact@iagent.agency';
export const DESINSCRIPTION_IAGENT = 'mailto:contact@iagent.agency?subject=D%C3%A9sinscription';
export const LIENS_INVESTISSEURS = [['lienPitch', 'Pitch deck'], ['lienSynthese', 'Executive summary'], ['lienBusinessPlan', 'Business plan'], ['lienPresse', 'Dossier de presse'], ['lienDataRoom', 'Data room sécurisée']];

/** The editable fields of a draft, with their default value. */
export const CHAMPS = {
  objet: '', preEntete: '', titre: '', intro: '', message: '', bouton: '', lien: '',
  prenom: '', entreprise: '', destinataire: '',
  signature: 'Maxime Martinel, iAgent', adresseReponse: 'contact@iagent.agency',
  mentions: MENTIONS_IAGENT, desinscription: DESINSCRIPTION_IAGENT,
  lienPitch: '', lienSynthese: '', lienBusinessPlan: '', lienPresse: '', lienDataRoom: '',
};

const ACTIVITE_PAR_DEFAUT = CATALOGUE.activites.find((a) => /imprimerie/i.test(a[1]))?.[0] ?? CATALOGUE.activites[0][0];

export const activite = (id) => CATALOGUE.activites.find((a) => a[0] === id) ?? null;
export const postesDe = (idActivite) => {
  const a = activite(idActivite);
  return a ? CATALOGUE.organigrammes[a[2]].postes : [];
};

/** The three agents proposed first for an activity: commercial side first, then the others. */
export function agentsProposes(idActivite) {
  const postes = postesDe(idActivite);
  const ordre = ['Commercial et devis', 'Gestion et administration', 'Production', 'Terrain', 'Direction'];
  const tries = [...postes].sort((x, y) => ordre.indexOf(x[0]) - ordre.indexOf(y[0]));
  return [...new Set(tries.map((p) => p[2]))].slice(0, 3);
}

/** A new draft for a template, keeping who it goes to and the sender's details. */
export function brouillonDepuis(idModele, precedent = null) {
  const m = MODELES.find((x) => x.id === idModele) ?? MODELES[2];
  const champs = { ...CHAMPS, ...(precedent?.champs ?? {}) };
  Object.assign(champs, { objet: m.objet, preEntete: m.preEntete, titre: m.hero, intro: m.intro, message: m.message, bouton: m.bouton, lien: m.lien });
  const idActivite = precedent?.activite ?? ACTIVITE_PAR_DEFAUT;
  return { modele: m.id, activite: idActivite, agents: precedent?.agents ?? agentsProposes(idActivite), champs };
}

export const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
export const lienSur = (u) => { try { const x = new URL(String(u || '').trim()); return x.protocol === 'https:' ? x.href : ''; } catch { return ''; } };
const lienDesinscription = (u) => { const s = String(u || '').trim(); return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/i.test(s) ? s : lienSur(s); };
export const adresseValide = (a) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(a ?? '').trim());

const ACCENTS = ['#e5007e', '#76cae9', '#bcce00', '#fdc802', '#ed744b'];

/** The agents of a draft, as cards: name, post, hook, portrait, public page. */
export function agentsDuBrouillon(b) {
  const postes = postesDe(b.activite);
  return (b.agents ?? []).map((id, i) => {
    const f = CATALOGUE.agents[id];
    if (!f) return null;
    const poste = postes.find((p) => p[2] === id);
    return { id, slug: f[0], nom: f[1], accroche: f[2], service: poste ? poste[0] : '', poste: poste ? poste[1] : f[1], portrait: nomDePortrait(id), page: `${SITE}/agents/${f[0]}`, accent: ACCENTS[i % ACCENTS.length] };
  }).filter(Boolean);
}

/**
 * Renders a draft.
 * @param images  how images are addressed: { logo, hero: { investor, client, marketing }, portrait(nom) }.
 *                For the preview, local URLs; for sending, `cid:` references Rust attaches.
 */
export function rendreHtml(b, images) {
  const m = MODELES.find((x) => x.id === b.modele) ?? MODELES[0];
  const c = { ...CHAMPS, ...b.champs };
  const act = activite(b.activite);
  const vars = { prenom: c.prenom || '[Prénom]', entreprise: c.entreprise || '[Entreprise]', secteur: act ? act[1] : '', signature: c.signature || 'L’équipe iAgent' };
  const fusion = (s) => String(s ?? '').replace(/\{\{\s*(prenom|entreprise|secteur|signature)\s*\}\}/gi, (x, k) => vars[k.toLowerCase()] || x);
  const lignes = (s) => echapper(fusion(s)).replace(/\r\n/g, '\n').split('\n').map((t) => (t.trim() ? t : '&nbsp;')).join('<br>');
  const pad = (html, p = 20) => `<tr><td style="padding:${p}px 27px;">${html}</td></tr>`;
  const trait = () => '<div style="width:74px;height:4px;border-radius:10px;background:#e5007e;background-image:linear-gradient(90deg,#e5007e 0%,#bcce00 38%,#76cae9 58%,#fdc802 97%);margin:13px 0 17px"></div>';
  const surtitre = (s) => `<div style="color:#99add2;font:700 10px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase">${echapper(s)}</div>`;
  const bouton = (libelle, url) => (lienSur(url)
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:23px 0 5px;"><tr><td bgcolor="#e5007e" style="background:#e5007e;background-image:linear-gradient(95deg,#e5007e,#de6970 42%,#fdc802 69%,#76cae9);border-radius:0 22px 0 22px;"><a target="_blank" href="${echapper(lienSur(url))}" style="display:inline-block;text-align:center;color:#fff;font:700 15px Arial,sans-serif;text-decoration:none;text-transform:uppercase;padding:15px 22px;min-width:210px;">${echapper(fusion(libelle))} &nbsp;→</a></td></tr></table>`
    : '');
  const titreBloc = (t) => `<div style="font:800 23px/1.2 Arial,Helvetica,sans-serif;color:#fff;letter-spacing:-.6px">${echapper(t)}</div>${trait()}`;
  const bloc = (h, corps, etiquette) => pad(`<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr><td style="border:1px solid #28518d;border-radius:16px;background:#0c1b40;padding:23px 19px;">${surtitre(etiquette)}<div style="height:9px"></div>${titreBloc(h)}${corps}</td></tr></table>`, 10);

  const cartes = agentsDuBrouillon(b);
  const sections = {
    agents: () => {
      if (!cartes.length) return '';
      const largeur = cartes.length >= 3 ? '33.3%' : cartes.length === 2 ? '50%' : '100%';
      const rangees = [];
      for (let i = 0; i < cartes.length; i += 3) rangees.push(cartes.slice(i, i + 3));
      const html = rangees.map((r) => `<tr>${r.map((a) => `<td class="iagent-agent-cell" valign="top" width="${largeur}" style="width:${largeur};padding:4px;vertical-align:top;"><table role="presentation" width="100%" style="background:#0b173a;border:1px solid ${a.accent};border-radius:13px;border-collapse:separate;overflow:hidden;" cellpadding="0" cellspacing="0"><tr><td style="padding:6px;"><img src="${echapper(images.portrait(a.portrait))}" alt="${echapper(a.poste)}" width="155" height="155" style="display:block;object-fit:cover;width:100%;height:155px;max-width:100%;border:0;background:#143362;border-radius:10px 10px 3px 3px;"></td></tr><tr><td style="padding:8px 10px 16px;"><span style="color:${a.accent};font:800 9px Arial;letter-spacing:1px;text-transform:uppercase;">${echapper(a.service)}</span><div style="color:#fff;font:800 16px/1.2 Arial;margin-top:8px;">${echapper(a.poste)}</div><div style="font:12px/1.55 Arial;color:#bdcbe6;margin-top:9px;">${echapper(a.accroche)}</div><a href="${echapper(a.page)}" target="_blank" style="display:inline-block;margin-top:13px;color:${a.accent};font:800 12px Arial;text-decoration:none;">Voir le profil →</a></td></tr></table></td>`).join('')}</tr>`).join('');
      const chapeau = act ? `Des postes d’une entreprise « ${act[1]} », tenus par des agents iAgent.` : 'Des postes tenus par des agents iAgent.';
      return bloc('Rencontrez les experts de votre métier', `<div style="font:13px/1.6 Arial;color:#b9c9e5;margin:-4px 0 19px;">${echapper(chapeau)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${html}</table>`, 'VOTRE SÉLECTION MÉTIER');
    },
    benefits: () => bloc('Ce que votre équipe peut gagner', `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${[['GAIN DE TEMPS', 'Des tâches répétitives mieux organisées.', '#e5007e'], ['CONTRÔLE', 'Permissions, approbations et traçabilité.', '#76cae9'], ['ÉQUIPE', 'Des agents spécialisés, adaptés aux métiers.', '#bcce00']].map((q) => `<td style="padding:3px;width:33%;vertical-align:top;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${q[2]};border-radius:11px;background:#071631"><tr><td style="padding:15px 9px;color:#fff;"><div style="color:${q[2]};font:800 10px Arial;">${q[0]}</div><div style="color:#c1d0ed;font:11px/1.6 Arial;margin-top:9px;">${q[1]}</div></td></tr></table></td>`).join('')}</tr></table>`, 'NOTRE APPROCHE'),
    pillars: () => {
      const piliers = [['🎙', 'Un dialogue naturel', 'Parlez à vos agents et échangez sur leurs missions.'], ['🤝', 'Un véritable recrutement', 'Choisissez leur rôle, leur voix et leurs responsabilités.'], ['⌘', 'Vos logiciels', 'Des missions dans les outils auxquels vous leur donnez accès.'], ['◈', 'Local, cloud ou hybride', 'Choisissez où s’exécutent les traitements selon votre contexte.']];
      return bloc('Plus qu’un logiciel, un collaborateur.', `<div style="font:13px/1.65 Arial;color:#b9cbed;margin-bottom:18px;">Un agent que l’on choisit, que l’on accueille, à qui l’on parle et dont on supervise le travail.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${[0, 2].map((i) => `<tr>${piliers.slice(i, i + 2).map((p) => `<td width="50%" valign="top" style="padding:5px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0d2651;border:1px solid #38568f;border-radius:10px;"><tr><td style="padding:13px;"><span style="font:24px Arial;">${p[0]}</span><div style="font:800 13px Arial;color:#fff;margin:8px 0;">${p[1]}</div><div style="font:11px/1.6 Arial;color:#c0d0e7;">${p[2]}</div></td></tr></table></td>`).join('')}</tr>`).join('')}</table>`, 'L’EXPÉRIENCE IAGENT');
    },
    about: () => bloc('Une technologie conçue pour votre entreprise.', `<div style="color:#c3d1ec;font:13px/1.75 Arial;">Chez iAgent, vous pouvez recruter un collaborateur numérique, lui faire passer un entretien, lui confier des responsabilités et le piloter à la voix. Son travail s’inscrit dans les outils et les connexions explicitement autorisés.</div><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;"><tr>${[['LOCAL', 'Sur le matériel dédié', '#e5007e'], ['CLOUD', 'Selon les services connectés', '#76cae9'], ['HYBRIDE', 'Selon les tâches et les règles', '#bcce00']].map((x, i) => `${i ? '<td width="9"></td>' : ''}<td style="padding:10px;background:#13274c;border-radius:10px;"><div style="color:${x[2]};font:800 14px Arial;">${x[0]}</div><div style="color:#c0d1ee;font:11px/1.5 Arial;">${x[1]}</div></td>`).join('')}</tr></table>`, 'NOTRE DIFFÉRENCE'),
    funding: () => bloc('Trois stratégies de déploiement', `<div style="font:12px/1.6 Arial;color:#b6c5df;margin:0 0 17px;">Des scénarios de financement alternatifs, adaptés au périmètre de déploiement visé.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${[['FRANCE', '500 K€', '#e5007e'], ['EUROPE', '3,5 M€', '#76cae9'], ['MONDE', '12 M€', '#bcce00']].map((x) => `<td style="width:33%;padding:3px;"><div style="border:1px solid ${x[2]};background:#091937;border-radius:10px;padding:16px 8px;"><div style="color:${x[2]};font:800 10px Arial;">${x[0]}</div><div style="color:#fff;font:850 23px Arial;margin-top:8px;">${x[1]}</div></div></td>`).join('')}</tr></table>`, 'FINANCEMENT · SCÉNARIOS'),
    resources: () => {
      const liens = LIENS_INVESTISSEURS.map(([k, l]) => [l, lienSur(c[k])]).filter((q) => q[1]);
      const corps = liens.length
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${liens.map((x) => `<tr><td style="padding:7px 0;"><a href="${echapper(x[1])}" target="_blank" style="display:block;border:1px solid #3769a6;background:#0e2450;border-radius:9px;text-decoration:none;padding:14px 15px;color:#f5f9ff;font:700 13px Arial;">${echapper(x[0])}<span style="float:right;color:#76cae9">↗</span></a></td></tr>`).join('')}</table>`
        : '<div style="padding:16px;border-radius:9px;background:#12284c;border:1px dashed #406393;color:#c8d5ed;font:13px/1.6 Arial;">La documentation investisseurs est disponible sur simple demande, en réponse à ce message.</div>';
      return bloc('Votre espace documentation', corps, 'DOCUMENTATION INVESTISSEURS');
    },
    steps: () => bloc('Vos trois prochaines étapes', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${[['01', 'Compléter votre profil', '#e5007e'], ['02', 'Choisir un agent', '#76cae9'], ['03', 'Définir sa mission', '#bcce00']].map((x) => `<td valign="top" width="33%" style="padding:4px;"><div style="padding:14px 9px;background:#0b2450;border:1px solid ${x[2]};border-radius:12px;min-height:95px;"><div style="color:${x[2]};font:800 24px Arial;">${x[0]}</div><div style="color:#fff;font:800 12px/1.5 Arial;margin-top:9px;">${x[1]}</div></div></td>`).join('')}</tr></table>`, 'ONBOARDING IAGENT'),
    offer: () => bloc('Le Cercle Fondateur iAgent 50', '<div style="font:14px/1.75 Arial;color:#d9e5ff;">Une démarche pilote pour sélectionner les premières entreprises partenaires : démonstration métier, installation accompagnée selon le périmètre convenu et bilan d’expérience. Les conditions commerciales définitives sont précisées dans une offre écrite.</div>', '50 ENTREPRISES PILOTES'),
  };

  const etiquetteHero = m.famille === 'Investisseurs' ? 'INNOVATION · COLLABORATEURS IA' : m.famille === 'Clients' ? 'BIENVENUE DANS VOTRE ÉQUIPE' : 'UNE NOUVELLE FORCE DE TRAVAIL';
  const couleurTrait = m.ton === 'orange' ? '#fdc802' : m.ton === 'cyan' ? '#76cae9' : '#e5007e';
  const illustration = images.hero[m.genre === 'investor' ? 'investor' : m.genre === 'client' ? 'client' : 'marketing'];
  const hero = pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="iagent-hero-text" valign="top" width="67%" style="padding-right:10px;">${surtitre(etiquetteHero)}<h1 style="font:850 ${m.genre === 'investor' ? 32 : 34}px/1.12 Arial,Helvetica,sans-serif;letter-spacing:-1.35px;color:#fff;margin:21px 0 14px;">${echapper(fusion(c.titre))}</h1><div style="width:66px;height:4px;background:${couleurTrait};margin:0 0 17px;"></div><div style="font:14px/1.65 Arial,Helvetica,sans-serif;color:#c7d6f2;">${echapper(fusion(c.intro))}</div>${bouton(c.bouton, c.lien)}</td><td class="iagent-hero-mark" width="33%" valign="middle" style="text-align:center;background:#0e1840;border-radius:18px;padding:15px 3px;"><img src="${echapper(illustration)}" alt="Univers iAgent" width="188" style="display:block;width:100%;max-width:188px;height:auto;margin:0 auto;border-radius:11px;"><div style="padding-top:10px;color:#adbbd8;letter-spacing:1px;font:700 9px/1.5 Arial,sans-serif;">DES COLLABORATEURS<br>IA PAR MÉTIER</div></td></tr></table>`, 19);
  const message = String(c.message).trim()
    ? pad(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;"><tr><td style="padding:22px 22px;background:#151334;border:1px solid #62417e;border-left:3px solid #e5007e;border-radius:13px;">${surtitre('UN MESSAGE POUR VOUS')}<div style="height:12px"></div><div style="font:14px/1.75 Arial,Helvetica,sans-serif;color:#f2edff">${lignes(c.message)}</div><div style="color:#94aad0;font:11px/1.5 Arial;padding-top:15px;">${echapper(fusion(c.signature || 'L’équipe iAgent'))}</div></td></tr></table>`, 0).replace('padding:0px 27px;', 'padding:7px 27px 12px;')
    : '';
  const desinscription = lienDesinscription(c.desinscription);
  const reponse = adresseValide(c.adresseReponse) ? `<a href="mailto:${echapper(c.adresseReponse.trim())}" style="color:#a9c0e9;">${echapper(c.adresseReponse.trim())}</a> &nbsp; · &nbsp; ` : '';
  const pied = pad(`<div style="border-top:1px solid #304a79;padding-top:23px;text-align:center;"><img src="${echapper(images.logo)}" alt="iAgent" width="120" style="display:inline-block;border:0;width:120px;height:auto;margin-bottom:12px;"><div style="font:11px/1.65 Arial;color:#a6bbdd;">${echapper(fusion(c.mentions))}</div><div style="font:11px/1.75 Arial;color:#a6bbdd;margin-top:8px;">${reponse}<a href="https://iagent.agency/" style="color:#a9c0e9;">iagent.agency</a></div>${desinscription ? `<div style="font:10px/1.6 Arial;margin-top:11px;"><a href="${echapper(desinscription)}" style="color:#9eb1d4;">Se désinscrire</a></div>` : ''}</div>`, 20);
  const entete = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0e0827;border-bottom:1px solid #24376b;"><tr><td style="padding:23px 28px;"><img src="${echapper(images.logo)}" alt="iAgent" width="194" style="display:block;border:0;width:194px;max-width:100%;height:auto;"></td><td valign="middle" align="right" style="padding:20px 22px;color:#b7bde8;font:800 10px/1.5 Arial;letter-spacing:1px;">${echapper(m.famille.toUpperCase())}<br><span style="color:#76cae9;">HUMAN AMBITION · AGENTIC EXECUTION</span></td></tr></table>`;
  const corps = (m.sections ?? []).map((id) => (sections[id] ?? (() => ''))()).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${echapper(fusion(c.objet))}</title><style>@media only screen and (max-width:600px){.iagent-wrap{width:100%!important;max-width:100%!important}td{word-wrap:break-word}img{max-width:100%!important;height:auto!important}.iagent-agent-cell{display:block!important;width:100%!important;padding:5px 0!important}.iagent-hero-mark{display:none!important}.iagent-hero-text{display:block!important;width:100%!important}h1{font-size:28px!important}}a{color:inherit}</style></head><body style="margin:0;padding:0;background:#04091b;color:#fff;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${echapper(fusion(c.preEntete))}</div><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#04091b" style="background:#04091b;"><tr><td align="center" style="padding:26px 8px;"><table class="iagent-wrap" role="presentation" width="650" border="0" cellspacing="0" cellpadding="0" bgcolor="#08122f" style="width:650px;max-width:650px;background:#08122f;background-image:linear-gradient(145deg,#150041 0%,#091b43 55%,#090d29 100%);border:1px solid #2c4178;border-collapse:separate;border-radius:15px;overflow:hidden;"><tr><td>${entete}</td></tr>${hero}${message}${corps}${pied}</table></td></tr></table></body></html>`;
}

/** The plain-text part (multipart/alternative): same words, no markup. */
export function rendreTexte(b) {
  const m = MODELES.find((x) => x.id === b.modele) ?? MODELES[0];
  const c = { ...CHAMPS, ...b.champs };
  const act = activite(b.activite);
  const vars = { prenom: c.prenom || '[Prénom]', entreprise: c.entreprise || '[Entreprise]', secteur: act ? act[1] : '', signature: c.signature || 'L’équipe iAgent' };
  const fusion = (s) => String(s ?? '').replace(/\{\{\s*(prenom|entreprise|secteur|signature)\s*\}\}/gi, (x, k) => vars[k.toLowerCase()] || x);
  const t = [fusion(c.titre), fusion(c.intro)];
  if (String(c.message).trim()) t.push(fusion(c.message));
  const cartes = m.sections.includes('agents') ? agentsDuBrouillon(b) : [];
  if (cartes.length) { t.push('LES AGENTS DE VOTRE MÉTIER'); for (const a of cartes) t.push(`- ${a.poste} : ${a.accroche}\n  ${a.page}`); }
  if (m.sections.includes('resources')) {
    const liens = LIENS_INVESTISSEURS.map(([k, l]) => [l, lienSur(c[k])]).filter((q) => q[1]);
    t.push('DOCUMENTATION INVESTISSEURS');
    t.push(liens.length ? liens.map((x) => `${x[0]} : ${x[1]}`).join('\n') : 'Disponible sur simple demande, en réponse à ce message.');
  }
  if (lienSur(c.lien)) t.push(`${fusion(c.bouton)} : ${lienSur(c.lien)}`);
  t.push(fusion(c.signature || 'L’équipe iAgent'));
  t.push(fusion(c.mentions));
  const d = lienDesinscription(c.desinscription);
  if (d) t.push(`Se désinscrire : ${d}`);
  return t.filter((x) => String(x).trim()).join('\n\n');
}

export function objetDe(b) {
  const c = { ...CHAMPS, ...b.champs };
  const act = activite(b.activite);
  const vars = { prenom: c.prenom || '[Prénom]', entreprise: c.entreprise || '[Entreprise]', secteur: act ? act[1] : '', signature: c.signature || 'L’équipe iAgent' };
  return String(c.objet ?? '').replace(/\{\{\s*(prenom|entreprise|secteur|signature)\s*\}\}/gi, (x, k) => vars[k.toLowerCase()] || x).replace(/[\r\n]+/g, ' ').trim();
}

/** Images as the sent message addresses them: Rust attaches each `cid:` it finds. */
export const IMAGES_ENVOI = {
  logo: 'cid:logo',
  hero: { investor: 'cid:hero-investor', client: 'cid:hero-welcome', marketing: 'cid:hero-marketing' },
  portrait: (nom) => `cid:portrait-${nom}`,
};

/** What must be fixed before the message can leave (shown next to the send button). */
export function manques(b) {
  const c = { ...CHAMPS, ...b.champs };
  const m = MODELES.find((x) => x.id === b.modele) ?? MODELES[0];
  const liste = [];
  if (!adresseValide(c.destinataire)) liste.push('une adresse de destinataire valide (une seule)');
  if (!objetDe(b)) liste.push('un objet');
  if (/\{\{|\[Prénom\]|\[Entreprise\]/.test(objetDe(b) + rendreTexte(b))) liste.push('le prénom et l’entreprise du destinataire (des champs {{…}} restent vides)');
  if (!String(c.mentions).trim()) liste.push('les mentions légales');
  if (m.genre !== 'client' && !lienDesinscription(c.desinscription)) liste.push('un lien de désinscription (https:// ou mailto:)');
  if (String(c.lien).trim() && !lienSur(c.lien)) liste.push('un lien de bouton en https://');
  return liste;
}

/** Everything Rust needs to send, plus the fingerprint of exactly that. */
export async function preparerEnvoi(b, sha256Hex) {
  const destinataire = String(b.champs.destinataire ?? '').trim();
  const objet = objetDe(b);
  const html = rendreHtml(b, IMAGES_ENVOI);
  const texte = rendreTexte(b);
  const empreinte = await sha256Hex(empreinteSource({ destinataire, objet, html, texte }));
  return { destinataire, objet, html, texte, modele: b.modele, adresseReponse: String(b.champs.adresseReponse ?? '').trim(), desinscription: lienDesinscription(b.champs.desinscription), empreinte };
}

/** The exact bytes the fingerprint covers (admin/src/courriel.rs builds the same string). */
export const empreinteSource = ({ destinataire, objet, html, texte }) => `${destinataire}\n${objet}\n${html}\n${texte}`;

export async function sha256HexNavigateur(texte) {
  const octets = new TextEncoder().encode(texte);
  const h = await globalThis.crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
