import donnees from 'virtual:accueil';
import { nombre, LIENS, Icone } from '../accueil/composants.jsx';
import tarifs, { euros, montant, STATUTS, BOX_PUBLIQUES, BOX_DES, prixAgentEnUneLigne, DUREES, DUREES_COURTES, GRILLE_LOCATION, JOUR_DES } from '../data/tarifs.js';
import { Voisines, Bouton, Demande } from './blocs.jsx';
import { Eclat, Heros, Scene, Ecran, Photo, Visage, Collaborateur, Rail, Atouts, Preuves, Liste, Onde, Exemple, Champs, Final, Choix } from './scenes.jsx';

// The offer pages redrawn on max's mockups (11/10): Workforce, how it works,
// the Box, pricing, local AI, security and the FAQ. Same promises as before,
// now shown as scenes: the real Box, real Desktop Commander screens, the iAgent
// portraits. Every price comes from tarifs.json, every count from the catalogue.

const { compteurs } = donnees;
const metiers = nombre(compteurs.fiches);
const logiciels = nombre(compteurs.logiciels);
const secteurs = nombre(compteurs.secteurs);
const activites = nombre(compteurs.activites);
const ESSENTIAL = tarifs.agents.paliers.find((p) => p.id === 'essential') ?? tarifs.agents.paliers[0];

const Statut = ({ s }) => <span className="pg-statut">{STATUTS[s] ?? s}</span>;

export function Packs() {
  return (
    <ul className="pg-prix">
      {tarifs.packs.map((p) => (
        <li key={p.id}>
          <b>{p.nom}</b>
          <small>{p.contenu}</small>
          <strong>{montant(p)}{!p.surDevis && <em> / mois<span className="pg-plus">+ consommation</span></em>}</strong>
          <Statut s={p.statut} />
        </li>
      ))}
    </ul>
  );
}

/** The team, the Box and the Commander screen, as in the Workforce mockup. */
function ScenEquipe() {
  const roles = [[2, 'Assistante commerciale'], [10, 'Analyste de données'], [5, 'Juriste'], [6, 'Chargé de recrutement'], [4, 'Community manager']];
  return (
    <div className="sc-equipe-scene">
      <div className="sc-equipe-rang">
        {roles.map(([n, role]) => <Collaborateur key={n} n={n} role={role} statut="Disponible" />)}
      </div>
      <div className="sc-equipe-ecran"><Ecran src="dc-vos-agents" alt="Desktop Commander : l'écran « Vos agents » avec l'équipe embauchée" charger="eager" /></div>
      <div className="sc-equipe-box"><Photo dossier="/accueil" src="box-commander" alt="La Box iAgent Commander : écran tactile, enceintes et micro" largeur={1122} hauteur={570} charger="eager" /></div>
    </div>
  );
}

const MiniVisages = ({ ns }) => (
  <div className="sc-mini-visages">{ns.map((n) => <Visage key={n} n={n} taille={480} />)}</div>
);

/** The six steps from need to work, each with its small scene. */
function RailRecrutement({ colonnes = 6, complet = false }) {
  const etapes = [
    ['Votre besoin', 'Vous cherchez un métier, ou vous décrivez un objectif : iAgent propose les agents.',
      <p className="sc-bulle">« Je veux relancer mes devis sans y passer mes soirées. »</p>],
    ['Votre équipe', 'Un agent ou une équipe entière, chacun réglé sur votre activité.',
      <div className="sc-rangee-visages">{[12, 2, 19, 15].map((n) => <Visage key={n} n={n} />)}</div>],
    ['Votre installation', 'Sans Box, avec une Box, ou une infrastructure locale sur devis.',
      <Choix items={[['ecran', 'Avec une Box', 'chez vous', true], ['nuage', 'Sans Box', "par l'API d'IA"]]} />],
    ["L'entretien d'embauche", "À l'oral : vos logiciels, vos horaires, ce qui doit attendre votre accord.",
      <div className="sc-entretien"><Visage n={20} /><p className="sc-bulle">« Quels logiciels utilisez-vous pour vos devis ? »</p></div>],
    ['Le prix', 'Agents, Box et estimation de consommation, affichés avant tout engagement.',
      <div className="sc-prix-mini"><small>Agent {ESSENTIAL.nom}, dès</small><strong>{euros(ESSENTIAL.mensuel)}<em> HT / mois</em></strong><small>+ consommation, à part</small></div>],
    ...(complet ? [['La préparation', 'Le contrat signé, la Box est préparée et vos agents y sont installés.',
      <Photo dossier="/accueil" src="box-commander" alt="" largeur={1122} hauteur={570} />]] : []),
    ['La mise en service', 'Vous branchez, vous vous connectez à vos comptes, l’équipe se met au travail.',
      <ul className="sc-coches-mini">{['Box branchée', 'Comptes connectés par vous', 'Équipe au travail'].map((t) => <li key={t}><Icone nom="coche" taille={14} />{t}</li>)}</ul>],
  ];
  return <Rail etapes={etapes} colonnes={colonnes} />;
}

/* ---------------------------------------------------------------- workforce */

export function Workforce() {
  return (
    <>
      <Heros surtitre="iAgent Workforce" titre={<>Votre équipe IA, <Eclat>opérationnelle</Eclat> dans votre entreprise.</>}
        texte="Des collaborateurs numériques par métier, installés sur une Box dans vos bureaux et dirigés depuis Desktop Commander. Pas un agent à programmer : un poste qui travaille."
        actions={<>
          <Bouton href={LIENS.entreprise} evenement="create_company_click">Composer mon équipe</Bouton>
          <Bouton href="/contact" variante="contour-cyan">Demander une démo</Bouton>
        </>}
        preuves={[['equipe', `${metiers} métiers`, 'décrits tâche par tâche'], ['outils', `${logiciels} logiciels`, 'du marché européen'], ['hybride', 'Local ou cloud', 'selon la tâche'], ['ecran', 'Desktop Commander', 'pour tout diriger']]}
        visuel={<ScenEquipe />} />

      <Scene surtitre="La formule" titre={<>Box + agents + Commander + <Eclat>consommation</Eclat></>}
        texte="Quatre pièces, chacune sur sa ligne : vous savez toujours ce que vous payez.">
        <div className="sc-formule">
          <a href="/box" className="sc-verre">
            <div className="sc-formule-visuel"><Photo dossier="/accueil" src="box-commander" alt="La Box iAgent Commander" largeur={1122} hauteur={570} /></div>
            <b>La Box</b><small>Le poste de travail de vos agents, chez vous : écran tactile, voix, micro.</small>
          </a>
          <a href={LIENS.catalogue} className="sc-verre">
            <div className="sc-formule-visuel"><MiniVisages ns={[2, 12, 13, 21, 7]} /></div>
            <b>Les agents</b><small>{metiers} métiers, chacun réglé sur votre secteur et votre activité.</small>
          </a>
          <a href="/how-it-works" className="sc-verre">
            <div className="sc-formule-visuel"><img src="/pages/dc-centre.webp" alt="Desktop Commander, l'écran d'accueil" width="1280" height="720" loading="lazy" decoding="async" /></div>
            <b>Desktop Commander</b><small>L'interface où vous dirigez l'équipe, suivez son travail et validez.</small>
          </a>
          <a href="/pricing" className="sc-verre">
            <div className="sc-formule-visuel"><div className="sc-jauge"><b><span>Consommation</span><span>au réel</span></b><span /></div></div>
            <b>La consommation</b><small>Les appels d'IA, la voix, les services tiers : au réel, à part de l'abonnement.</small>
          </a>
        </div>
      </Scene>

      <Scene surtitre="Comment ça marche" titre={<>Du besoin <Eclat>au travail</Eclat>, sans rien paramétrer</>}
        droite={<Bouton href="/how-it-works" variante="contour-cyan">Le parcours en détail</Bouton>}>
        <RailRecrutement />
      </Scene>

      <Scene surtitre="Ce qui fait la différence" titre="Une présence, un poste de pilotage, un vrai métier">
        <div className="sc-trois">
          <div className="sc-verre sc-panneau">
            <Photo src="box-bureau" alt="La Box iAgent posée sur un bureau, l'écran allumé" largeur={1990} hauteur={940} />
            <p className="mq-surtitre">Pourquoi la Box</p>
            <h3 className="sc-h3">Une présence physique dans vos bureaux</h3>
            <Liste items={['On parle aux agents à voix haute, par leur prénom.', "L'écran tactile se commande au doigt, sans formation.", 'Préparée, maintenue et mise à jour par iAgent.']} />
          </div>
          <div className="sc-verre sc-panneau">
            <img className="sc-photo" src="/pages/dc-travail.webp" alt="Desktop Commander : le travail d'un agent, tâche par tâche" width="1280" height="800" loading="lazy" decoding="async" />
            <p className="mq-surtitre">Pourquoi Commander</p>
            <h3 className="sc-h3">Superviser, autoriser, coordonner</h3>
            <Liste items={['Chaque agent n’ouvre que ce que vous lui confiez.', 'Vous décidez des tâches qui attendent votre accord.', 'Chaque action et chaque envoi sont consignés.']} />
          </div>
          <div className="sc-verre sc-panneau">
            <div className="sc-rangee-visages">{[3, 11, 14, 22].map((n) => <Visage key={n} n={n} />)}</div>
            <p className="mq-surtitre">Pourquoi les agents</p>
            <h3 className="sc-h3">Un métier, pas un outil générique</h3>
            <Liste items={[`${metiers} métiers décrits tâche par tâche, dans ${secteurs} secteurs.`, `${logiciels} logiciels du marché européen dans le référentiel.`, "Un entretien d'embauche à l'oral : l'agent apprend votre entreprise."]} />
          </div>
        </div>
      </Scene>

      <Scene surtitre="Local, cloud ou hybride" titre="Là où vos données doivent rester"
        texte="Vos agents passent par l'API d'IA, travaillent sur une machine chez vous, ou les deux selon la tâche. Pour une forte puissance locale, l'infrastructure se conçoit sur devis.">
        <Preuves colonnes={3} items={[
          ['nuage', 'Cloud', "Sans machine de calcul : les agents passent par l'API d'IA.", '/local-ai'],
          ['serveur', 'Local', 'Les modèles tournent chez vous ; rien ne sort pour être traité.', '/local-ai'],
          ['hybride', 'Hybride', "Le quotidien en local, l'API pour le reste. Vous êtes prévenu avant.", '/local-ai'],
        ]} />
      </Scene>

      <Scene surtitre="Les packs" titre="De la première embauche au service entier">
        <Packs />
      </Scene>

      <Final titre="Composez votre équipe" texte="Partez d'un métier, d'une activité ou d'un objectif." visage={24}>
        <Bouton href={LIENS.entreprise} evenement="create_company_click">Composer mon équipe</Bouton>
        <Bouton href="/contact" variante="contour-cyan">Demander une démo</Bouton>
      </Final>
      <Voisines ici="workforce" />
    </>
  );
}

/* ------------------------------------------------------------- how-it-works */

export function CommentCaMarche() {
  return (
    <>
      <Heros decor="lever" surtitre="Comment ça marche" titre={<>Du recrutement <Eclat>au travail.</Eclat></>}
        texte="Vous n'avez rien à paramétrer : vous dites ce que vous voulez accomplir, vous recrutez, et l'agent apprend votre entreprise en conversation."
        actions={<>
          <Bouton href={LIENS.catalogue} evenement="catalog_click">Explorer les agents</Bouton>
          <Bouton href="/contact" variante="contour-cyan">Parler à un conseiller</Bouton>
        </>}
        preuves={[['equipe', `${metiers} métiers`, 'à recruter'], ['cible', `${activites} activités`, 'reconnues'], ['micro', "À l'oral", "l'entretien d'embauche"], ['ecran', 'Une Box', 'préparée pour vous']]}
        visuel={<Ecran src="dc-embaucher" alt="Desktop Commander : l'écran d'embauche d'un agent" charger="eager" legende="Desktop Commander, l'écran d'embauche" />} />

      <Scene surtitre="Le parcours" titre={<>Sept étapes, dont une seule technique : <Eclat>brancher</Eclat></>}>
        <RailRecrutement colonnes={7} complet />
      </Scene>

      <Scene surtitre="Ce que vous n'avez pas à faire" titre="Le travail invisible est déjà fait">
        <Preuves colonnes={4} items={[
          ['doc', 'Écrire les consignes', 'Chaque métier est décrit tâche par tâche.'],
          ['reseau', 'Brancher vos logiciels', "L'agent les reconnaît pendant l'entretien."],
          ['puce', 'Choisir les modèles', "Local ou API : l'application tranche et vous prévient."],
          ['outils', 'Tenir la machine', 'La Box est préparée et mise à jour par iAgent.'],
        ]} />
      </Scene>

      <Final titre="Commencez par le besoin" visage={8}>
        <Bouton href="/#commencer" evenement="hero_start">Que voulez-vous accomplir ?</Bouton>
        <Bouton href="/pricing" variante="contour-cyan">Voir les tarifs</Bouton>
      </Final>
      <Voisines ici="how-it-works" />
    </>
  );
}

/* ---------------------------------------------------------------------- box */

const PUISSANCES = [
  ['ecran', 'La Box', 'Le poste de commande : vos agents par API.', 'Livrée', 'box-commander'],
  ['puce', 'Mémoire unifiée', 'Un boîtier compact pour les modèles de texte.', 'Sur devis'],
  ['eclair', 'Carte graphique dédiée', 'Pour les agents nombreux et les images.', 'Sur devis'],
  ['serveur', 'Serveur', 'Plusieurs cartes, pour une entreprise entière.', 'Sur devis'],
];

function Puissances() {
  return (
    <ul className="sc-materiel">
      {PUISSANCES.map(([icone, titre, texte, statut, image]) => (
        <li key={titre} className="sc-verre">
          <div className="sc-materiel-visuel">{image ? <Photo dossier="/accueil" src={image} alt="" largeur={1122} hauteur={570} /> : <Icone nom={icone} taille={54} />}</div>
          <em>{statut}</em>
          <b>{titre}</b>
          <small>{texte}</small>
        </li>
      ))}
    </ul>
  );
}

function OffresBox() {
  return (
    <ul className="sc-offres sc-offres-2">
      {BOX_PUBLIQUES.map((b, i) => (
        <li key={b.id} className={`sc-offre sc-verre ${i === 0 ? 'recommandee' : ''}`}>
          {i === 0 && <span className="sc-ruban">Le plus choisi</span>}
          <div className="sc-offre-tete"><span><Icone nom="ecran" taille={20} /></span><div><b>{b.nom}</b><small>Engagement {b.engagementMois} mois</small></div></div>
          <div className="sc-montant"><strong>{euros(b.mensuel)}</strong><em>HT / mois</em></div>
          <Liste items={['Matériel compris, mis à disposition', 'Maintenance et mises à jour', 'Desktop Commander installé']} />
          <span className="sc-offre-statut">{STATUTS[b.statut] ?? b.statut}</span>
        </li>
      ))}
    </ul>
  );
}

export function Box() {
  return (
    <>
      <Heros decor="ville" surtitre="iAgent Box Commander" badge={<><b>Box</b> Préparée, installée et maintenue par iAgent</>}
        titre={<>Votre équipe IA, <Eclat>installée chez vous.</Eclat></>}
        texte={`Un poste préparé pour vos agents, que vous branchez et qui travaille. Le matériel est mis à disposition sous abonnement, à partir de ${euros(BOX_DES.mensuel)} HT par mois.`}
        actions={<>
          <Bouton href="/pricing" evenement="box_click">Voir les tarifs</Bouton>
          <Bouton href="/contact" variante="contour-cyan" evenement="box_quote">Demander un devis Box</Bouton>
        </>}
        preuves={[['micro', 'La voix', 'par leur prénom'], ['ecran', 'Tactile', 'au doigt'], ['bouclier', 'Maintenue', 'mises à jour comprises'], ['equipe', "Jusqu'à 20 agents", 'par Box']]}
        visuel={<Photo src="box-bureau" alt="La Box iAgent Commander sur un bureau : écran tactile allumé, enceintes et micro" largeur={1990} hauteur={940} charger="eager" className="sc-box-heros" />} />

      <Scene surtitre="L'expérience" titre={<>On lui parle, on la touche, <Eclat>elle travaille</Eclat></>}>
        <Atouts items={[
          ['voix', 'Voix', 'Parlez à vos agents', 'Appelez un agent par son prénom : il vous répond à voix haute.', true],
          ['micro', 'Écoute', 'Un micro de conférence', 'Il vous entend dans la pièce, sans casque ni bouton.', true],
          ['ecran', 'Tactile', "Un écran pensé pour le doigt", 'Suivez, validez, corrigez sans clavier.'],
          ['eclair', 'Box autonome', 'Toujours prête', 'Vos agents font leurs tâches aux horaires que vous fixez.'],
        ]} />
      </Scene>

      <Scene surtitre="La mise en service" titre="Brancher, et travailler">
        <Rail colonnes={4} etapes={[
          ['Brancher', 'La Box arrive préparée : on la relie au réseau de l’entreprise.', <Icone nom="cle" taille={38} />],
          ['Se connecter', 'Vous ouvrez vos comptes vous-même, une fois, dans le navigateur de la Box.', <Icone nom="cadenas" taille={38} />],
          ['Appeler les agents', 'Par leur prénom, à la voix ou au doigt sur l’écran.', <Onde className="sc-onde-vivante sc-onde-rail" />],
          ['Travailler', 'Les agents font leurs tâches et déposent les résultats dans vos dossiers.', <Icone nom="doc" taille={38} />],
        ]} />
      </Scene>

      <Scene>
        <div className="sc-deux">
          <div>
            <p className="mq-surtitre">Dans la Box</p>
            <h2 className="sc-h2">Tout ce qu'il faut pour parler à son équipe</h2>
            <Liste items={['Un mini-PC préparé en usine pour vos agents.', 'Un écran tactile, pensé pour le doigt.', 'Une enceinte et un micro de conférence.', 'Un clavier et une souris de secours.', 'Desktop Commander, installé et prêt.']} />
            <p className="mq-surtitre sc-espace">Le service</p>
            <h3 className="sc-h3">Mise à disposition, pas achat</h3>
            <Liste items={['La Box reste à iAgent et se rend en fin de contrat.', 'Mises à jour automatiques des agents et de l’application.', 'Diagnostic et maintenance selon votre contrat.', 'Jusqu’à 20 agents par Box ; au-delà, une deuxième Box.']} />
          </div>
          <Ecran src="dc-vos-agents" alt="Desktop Commander sur l'écran de la Box : vos agents et leur travail" legende="Desktop Commander, installé sur la Box" />
        </div>
      </Scene>

      <Scene className="sc-remote">
        <div className="sc-deux sc-inverse">
          <div>
            <p className="mq-surtitre">Remote Commander</p>
            <h2 className="sc-h2">Votre équipe, <Eclat>dans votre poche</Eclat></h2>
            <p className="sc-texte">L'application pour suivre votre équipe depuis votre téléphone : ce que font vos agents, ce qui attend votre accord.</p>
            <p className="sc-badge sc-espace"><b>Inclus</b> Livrée avec votre Box, installée par iAgent</p>
          </div>
          <div className="sc-remote-visuel"><Photo src="remote-commander" alt="Remote Commander sur un téléphone tenu en main" largeur={370} hauteur={412} /></div>
        </div>
      </Scene>

      <Scene surtitre="Tarif" titre="L'abonnement de la Box" texte="Il s'ajoute à l'abonnement de vos agents et à la consommation, toujours affichés à part.">
        <OffresBox />
      </Scene>

      <Scene surtitre="Plus de puissance" titre="Du poste de commande au serveur"
        texte="La Box fait travailler vos agents surtout par l'API d'IA. Pour faire tourner les modèles chez vous à grande échelle, nous concevons l'infrastructure sur devis."
        droite={<Bouton href="/local-ai" variante="contour-cyan">IA locale et hybride</Bouton>}>
        <Puissances />
      </Scene>

      <Final titre="Installez votre équipe" visage={17}>
        <Bouton href="/pricing" evenement="box_click">Voir les tarifs</Bouton>
        <Bouton href={LIENS.catalogue} variante="contour-cyan" evenement="catalog_click">Explorer les agents</Bouton>
      </Final>
      <Voisines ici="box" />
    </>
  );
}

/* ------------------------------------------------------------------ pricing */

const PALIERS_TEXTE = {
  essential: ['Un expert pour les tâches courantes de son métier.', ['Tâches structurées', 'Administration et contenu', 'Support simple']],
  professional: ["Plus de missions, plus de logiciels, plus d'autonomie.", ['Proactif et multi-outils', 'Communication', 'Automatisations']],
  expert: ['Le niveau le plus avancé, pour les postes qui engagent.', ['Finance et juridique', 'Métiers complexes', 'Forte autonomie']],
};
const PALIERS_ICONE = { essential: 'doc', professional: 'rouage', expert: 'bouclier' };

/** An agent for 24 hours, 7 days, 14 days or a month: every price a rule of three on the month, read from tarifs.json. */
export function GrilleLocation() {
  if (!GRILLE_LOCATION.length || !DUREES.length) return null;
  return (
    <div className="sc-location sc-verre">
      <table>
        <caption>{tarifs.agents.durees.regle} Prix hors taxes par agent, consommation d'IA à part.</caption>
        <thead>
          <tr><th scope="col">Agent</th>{DUREES.map((d) => <th key={d.id} scope="col">{d.nom}</th>)}</tr>
        </thead>
        <tbody>
          {GRILLE_LOCATION.map((f) => (
            <tr key={f.id}>
              <th scope="row">{f.id === 'unique' ? f.nom : `Agent ${f.nom}`}</th>
              {f.prix.map(({ duree, montant: m }) => (
                <td key={duree.id}><b>{euros(m)}</b><small>{duree.recurrent ? 'HT, renouvelé chaque mois' : 'HT, payé une fois'}</small></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrilleTarifs() {
  const a = tarifs.agents;
  return (
    <ul className="sc-offres">
      {a.affichage === 'paliers' && a.paliers.map((p) => {
        const [phrase, points] = PALIERS_TEXTE[p.id] ?? ['', []];
        const reco = p.id === 'professional';
        return (
          <li key={p.id} className={`sc-offre sc-verre ${reco ? 'recommandee' : ''}`}>
            {reco && <span className="sc-ruban">Recommandé</span>}
            <div className="sc-offre-tete"><span><Icone nom={PALIERS_ICONE[p.id] ?? 'equipe'} taille={20} /></span><div><b>Agent {p.nom}</b><small>{phrase}</small></div></div>
            <div className="sc-montant"><strong>{euros(p.mensuel)}</strong><em>HT / mois par agent</em></div>
            <Liste items={points} />
            <Bouton href={LIENS.catalogue} variante={reco ? 'plein' : 'contour-cyan'} evenement="plan_select">Choisir {p.nom}</Bouton>
            <span className="sc-offre-statut">{STATUTS[p.statut] ?? p.statut} · + consommation</span>
          </li>
        );
      })}
      {a.affichage === 'unique' && (
        <li className="sc-offre sc-verre"><div className="sc-offre-tete"><div><b>Un agent</b><small>Par agent</small></div></div><div className="sc-montant"><strong>{euros(a.unique.mensuel)}</strong><em>HT / mois</em></div></li>
      )}
      <li className="sc-offre sc-verre sc-offre-box">
        <div className="sc-offre-tete"><span><Icone nom="ecran" taille={20} /></span><div><b>La Box</b><small>Le poste de vos agents, chez vous.</small></div></div>
        <div className="sc-montant"><strong>{euros(BOX_PUBLIQUES[0].mensuel)}</strong><em>HT / mois sur {BOX_PUBLIQUES[0].engagementMois} mois</em></div>
        {BOX_PUBLIQUES.slice(1).map((b) => <p key={b.id} className="sc-montant-ou">ou <b>{euros(b.mensuel)}</b> HT / mois sur {b.engagementMois} mois</p>)}
        <Photo dossier="/accueil" src="box-commander" alt="" largeur={1122} hauteur={570} className="sc-offre-image" />
        <Bouton href="/box" variante="contour-cyan" evenement="box_click">Découvrir la Box</Bouton>
        <span className="sc-offre-statut">{STATUTS[BOX_PUBLIQUES[0].statut] ?? ''} · matériel compris</span>
      </li>
    </ul>
  );
}

export function Tarifs() {
  const c = tarifs.commander;
  return (
    <>
      <Heros decor="orbite" surtitre="Tarifs" titre={<>Un abonnement fixe. <Eclat>Une consommation à part.</Eclat></>}
        texte={`Vous payez la Box, vos agents et, au-delà de quelques agents, le Task Commander. L'usage de l'IA se paie au réel, à part. Prix hors taxes, ${STATUTS[tarifs.statut]?.toLowerCase() ?? tarifs.statut}.`}
        preuves={[['equipe', 'Par agent', 'un prix par niveau'], ['ecran', 'La Box', 'mise à disposition'], ['eclair', 'Consommation', 'au réel, à part'], ['bouclier', 'Sans surprise', "l'estimation avant"]]}
        visuel={<Photo src="box-bureau" alt="La Box iAgent Commander sur un bureau" largeur={1990} hauteur={940} charger="eager" className="sc-box-heros" />} />

      <Scene surtitre="Les agents et la Box" titre={<>Choisissez le niveau de <Eclat>chaque poste</Eclat></>}
        texte={`Chaque agent a son abonnement, ${prixAgentEnUneLigne()} hors taxes. La Box s'ajoute une fois pour l'équipe.`}>
        <GrilleTarifs />
        <div className="sc-bandeau-offre sc-verre">
          <div className="sc-offre-tete"><span><Icone nom="equipe" taille={20} /></span><div><b>{c.nom}</b><small>Le chef d'équipe de vos agents</small></div></div>
          <div className="sc-montant"><strong className="sc-montant-moyen">{montant(c)}</strong><em>HT / mois</em></div>
          <Liste items={[`Inclus à partir de ${c.inclusAPartirDe} agents`, 'Coordonne les agents et vous rend compte', 'Un seul interlocuteur pour toute l’équipe']} />
          <span className="sc-offre-statut">{STATUTS[c.statut] ?? c.statut}</span>
        </div>
        <div className="sc-bandeau-offre sc-verre">
          <div className="sc-offre-tete"><span><Icone nom="eclair" taille={20} /></span><div><b>La consommation</b><small>Ce qui se paie à l'usage</small></div></div>
          <p className="sc-texte">{tarifs.consommation.phrase}</p>
          <Liste items={["L'estimation avant de vous engager : chaque fiche d'agent l'annonce.", 'L’application vous prévient avant de passer une tâche du local à l’API.']} />
          <span className="sc-offre-statut">{STATUTS[tarifs.consommation.statut] ?? ''}</span>
        </div>
      </Scene>

      <Scene id="location" surtitre="Location à la durée" titre={<>Un agent pour <Eclat>24 heures, 7 jours, 14 jours ou un mois</Eclat></>}
        texte="Le prix d'une location courte est celui du mois, ramené à sa durée. Elle se règle une fois, sans engagement ni renouvellement."
        droite={<Bouton href="/temp-agency" variante="contour-cyan">Temp Agency</Bouton>}>
        <GrilleLocation />
      </Scene>

      <Scene surtitre="Les packs" titre="Box, agents et Commander ensemble">
        <Packs />
      </Scene>

      <Final titre="Choisir une formule" texte="Un conseiller chiffre votre équipe avec vous, consommation comprise." visage={22}>
        <Bouton href="/contact" evenement="plan_select">Choisir ma formule</Bouton>
        <Bouton href="/enterprise" variante="contour-cyan" evenement="enterprise_click">iAgent Enterprise</Bouton>
        <Bouton href={LIENS.catalogue} variante="contour-cyan" evenement="catalog_click">Explorer les agents</Bouton>
      </Final>
      <Voisines ici="pricing" />
    </>
  );
}

/* -------------------------------------------------------------- temp-agency */

// Temp Agency (max, 15/10/2026): an agent rented for 24 hours, 7 days,
// 14 days or a month, like a temp worker, without a Box. Structure ready for
// max's text; every price comes from tarifs.json (agents.durees). The light
// Desktop Commander max describes (one or two agents on the client's own
// computer, downloaded from this page) is not built: the page says nothing
// about it until it exists.
export function TempAgency() {
  const courtes = DUREES_COURTES.map((d) => d.nom).join(', ');
  return (
    <>
      <Heros surtitre="Temp Agency" titre={<>L'intérim de l'IA : <Eclat>un agent pour le temps qu'il vous faut.</Eclat></>}
        texte={`Un pic d'activité, une absence, un projet court : louez un agent iAgent pour ${DUREES.map((d) => d.nom).join(', ').replace(/, ([^,]*)$/, ' ou $1')}, sans Box à installer.${JOUR_DES != null ? ` À partir de ${euros(JOUR_DES)} HT les 24 heures.` : ''}`}
        actions={<>
          <Bouton href={LIENS.catalogue} evenement="catalog_click">Choisir un agent</Bouton>
          <Bouton href="#prix" variante="contour-cyan">Voir les prix</Bouton>
        </>}
        preuves={[['agenda', 'À la durée', courtes], ['pieces', 'Payé une fois', 'sans engagement'], ['equipe', 'Un vrai métier', `${nombre(compteurs.fiches)} postes`], ['ecran', 'Sans Box', 'aucun matériel à louer']]} />

      <Scene surtitre="Quand l'intérim s'impose" titre={<>Le bon agent, <Eclat>juste le temps nécessaire</Eclat></>}>
        <Preuves colonnes={4} items={[
          ['eclair', "Un pic d'activité", 'Une clôture, une saison, une campagne : du renfort sur quelques jours.'],
          ['equipe', 'Une absence', 'Le poste continue de tourner pendant un congé ou un arrêt.'],
          ['cible', 'Un projet court', 'Une étude, un dossier, un lancement : un expert le temps du projet.'],
          ['idee', 'Essayer avant de recruter', "Voir un agent travailler une semaine avant de l'embaucher au mois."],
        ]} />
      </Scene>

      <Scene id="prix" surtitre="Les prix" titre={<>Le prix du mois, <Eclat>ramené à la durée</Eclat></>}
        texte="24 heures, 7 jours ou 14 jours se règlent une fois, sans engagement ni renouvellement. Le mois se renouvelle chaque mois. L'usage de l'IA se paie à part, au réel.">
        <GrilleLocation />
      </Scene>

      <Scene surtitre="Comment ça se passe" titre="De la fiche du métier au travail">
        <Rail colonnes={4} etapes={[
          ['Choisissez le métier', `Parmi les ${nombre(compteurs.fiches)} postes du catalogue, celui dont vous avez besoin.`],
          ['Choisissez la durée', 'Dans votre liste de recrutement, ligne par ligne : 24 heures, 7 jours, 14 jours ou un mois.'],
          ['Validez votre liste', 'Vous la réglez en ligne, ou vous recevez le devis par écrit.'],
          ['Votre agent prend son poste', 'Nous vous écrivons pour préparer son entretien d’embauche et le mettre au travail.'],
        ]} />
      </Scene>

      <Final titre="Un renfort pour demain ?" texte="Choisissez le métier, choisissez la durée." visage={9}>
        <Bouton href={LIENS.catalogue} evenement="catalog_click">Choisir un agent</Bouton>
        <Bouton href="/contact" variante="contour-cyan">Nous écrire</Bouton>
      </Final>
      <Voisines ici="temp-agency" />
    </>
  );
}

/* ----------------------------------------------------------------- local-ai */

export function IALocale() {
  return (
    <>
      <Heros decor="orbite" surtitre="IA locale et hybride" titre={<>La puissance chez vous, <Eclat>quand vous en avez besoin.</Eclat></>}
        texte="iAgent fait tourner vos agents par l'API d'IA, sur une machine dans vos bureaux, ou entre les deux. Une infrastructure locale se dimensionne avec vous, sur devis."
        actions={<Bouton href="#dimensionner" evenement="local_ai_quote_start">Dimensionner mon infrastructure</Bouton>}
        preuves={[['cadenas', 'Confidentialité', 'vos documents chez vous'], ['eclair', 'Latence', 'sans aller-retour'], ['cle', 'Contrôle', 'vous savez où'], ['serveur', 'Continuité', 'même hors ligne']]}
        visuel={<Puissances />} />

      <Scene surtitre="Trois façons de travailler" titre={<>Cloud, local ou <Eclat>hybride</Eclat></>}>
        <Deploiements />
      </Scene>

      <Scene>
        <div className="sc-deux">
          <div>
            <p className="mq-surtitre">Cas d'usage</p>
            <h2 className="sc-h2">Quand la puissance locale se justifie</h2>
            <Liste items={['Beaucoup d’agents qui travaillent toute la journée.', 'Des agents image ou vidéo.', 'Des données sensibles ou réglementées.', 'Des tâches récurrentes à fort volume.', 'Des exigences de rapidité.']} />
          </div>
          <Preuves colonnes={2} items={[
            ['cadenas', 'Confidentialité', 'Les documents restent dans vos murs.'],
            ['eclair', 'Latence', 'Pas d’aller-retour par Internet pour chaque tâche.'],
            ['graphe', 'Coût à grande échelle', 'Au-delà d’un certain volume, la machine coûte moins que l’API.'],
            ['serveur', 'Continuité', 'Le travail continue même si un service en ligne s’arrête.'],
          ]} />
        </div>
      </Scene>

      <Scene id="dimensionner" surtitre="Dimensionner" titre="Parlez à un architecte iAgent" etroit>
        <Demande sujet="Dimensionner mon infrastructure" evenement="local_ai_contact" champs={[
          ["Nombre d'agents", "Nombre d'agents", ['1 à 5', '6 à 20', '21 à 50', 'Plus de 50']],
          ['Types de tâches', 'Types de tâches', ['Texte et documents', 'Images ou vidéo', 'Voix et téléphone', 'Un peu de tout']],
          ['Logiciels', 'Vos logiciels principaux'],
          ['Volume', 'Volume de travail', ['Quelques tâches par jour', 'Des dizaines par jour', 'Des centaines par jour']],
          ['Données', 'Exigences sur les données', ['Aucune particulière', 'Données sensibles', 'Données réglementées']],
          ['Sites', 'Sites', ['Un seul site', 'Plusieurs sites']],
        ]} />
      </Scene>
      <Voisines ici="local-ai" />
    </>
  );
}

/** The three ways to run, as in the security mockup: local, hybrid, cloud. */
function Deploiements() {
  const voies = [
    ['local', 'Local', 'Les modèles tournent chez vous ; rien ne sort pour être traité.', <Photo dossier="/accueil" src="box-commander" alt="" largeur={1122} hauteur={570} />, ['Vos fichiers', 'La Box', 'Vos dossiers']],
    ['hybride', 'Hybride', "Le quotidien en local, l'API pour ce que la machine ne porte pas. Vous êtes prévenu avant.", <Icone nom="hybride" taille={64} />, ['La Box', 'Vous êtes prévenu', "L'API d'IA"]],
    ['cloud', 'Cloud', "Sans machine de calcul : les agents passent par l'API d'IA que vous choisissez.", <Icone nom="nuage" taille={64} />, ['Desktop Commander', "L'API d'IA", 'Vos dossiers']],
  ];
  return (
    <div className="sc-deploiements">
      {voies.map(([cle, titre, texte, visuel, chemin]) => (
        <div key={cle} className={`sc-deploiement sc-verre ${cle}`}>
          <h3>{titre}</h3>
          <div className="sc-deploiement-visuel">{visuel}</div>
          <p>{texte}</p>
          <p className="sc-chemin">{chemin.map((c, i) => <span key={c}>{i > 0 && <i>→ </i>}<span>{c}</span></span>)}</p>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- security */

const FLUX = [
  ['bulle', 'Demande', 'Une tâche planifiée, ou ce que vous demandez à voix haute.'],
  ['cle', 'Vérification des permissions', "L'agent n'atteint que ce que son métier et vous lui ouvrez."],
  ['bouclier', 'Approbation si nécessaire', 'Un outil qui modifie, un envoi : votre clic, sur le texte exact.'],
  ['rouage', 'Exécution', 'Dans son dossier de travail, ou dans ceux que vous avez désignés.'],
  ['doc', 'Traçabilité', 'Chaque appel d’outil, abouti ou refusé, est consigné.'],
];

export function Securite() {
  return (
    <>
      <Heros decor="orbite" surtitre="Sécurité et déploiement" titre={<>Autonome ne signifie pas <Eclat>incontrôlé.</Eclat></>}
        texte="Un agent iAgent travaille seul, dans les limites que vous fixez. Ces limites sont tenues par l'application, pas par une consigne au modèle."
        actions={<>
          <Bouton href="/contact">Parler sécurité avec nous</Bouton>
          <Bouton href="/faq#donnees" variante="contour-cyan">Vos données, en questions</Bouton>
        </>}
        preuves={[['cle', 'Permissions', 'par métier'], ['bouclier', 'Validation', 'quand vous la voulez'], ['doc', 'Journal', 'de chaque action'], ['cadenas', 'Coffre', 'pour vos clés']]}
        visuel={<Exemple titre="Journal d'activité d'un agent" icone="doc">
          <ul className="sc-journal">
            <li><time>09:02</time><span><Icone nom="coche" taille={14} />Lecture du dossier « Devis à relancer »</span></li>
            <li><time>09:04</time><span><Icone nom="coche" taille={14} />Brouillon de relance écrit pour 3 clients</span></li>
            <li className="attente"><time>09:05</time><span><Icone nom="bouclier" taille={14} />Envoi en attente de votre relecture</span></li>
            <li><time>09:41</time><span><Icone nom="coche" taille={14} />Texte relu et validé, envoi consigné</span></li>
            <li><time>09:42</time><span><Icone nom="coche" taille={14} />Outil refusé : hors des permissions du poste</span></li>
          </ul>
        </Exemple>} />

      <Scene surtitre="Le parcours d'une action" titre={<>De la demande à la trace, <Eclat>rien n'échappe</Eclat></>}>
        <ol className="sc-flux">
          {FLUX.map(([icone, titre, texte]) => (
            <li key={titre}><span className="sc-flux-noeud"><Icone nom={icone} taille={28} /></span><b>{titre}</b><small>{texte}</small></li>
          ))}
        </ol>
        <p className="sc-legende">Schéma de fonctionnement : chaque étape est tenue par l'application.</p>
      </Scene>

      <Scene surtitre="Trois déploiements" titre="Là où vos données doivent rester">
        <Deploiements />
      </Scene>

      <Scene surtitre="Ce que tient l'application" titre="Huit garanties, écrites dans le code">
        <Preuves colonnes={4} items={[
          ['cle', 'Permissions par métier', 'Ce qu’un agent peut atteindre se déduit de sa fiche, jamais de l’écran.'],
          ['bouclier', 'Votre clic pour modifier', 'Un outil qui modifie quelque chose demande votre accord.'],
          ['doc', 'Un dossier à lui', 'Par défaut, l’agent ne lit et n’écrit que dans son propre dossier.'],
          ['email', 'Aucun envoi à l’aveugle', 'Aucun e-mail ne part sans que le texte exact ait été relu.'],
          ['cadenas', 'Vos clés au coffre', 'Vos clés d’API restent sur votre poste, dans le coffre du système.'],
          ['graphe', 'Tout est consigné', 'Chaque appel d’outil et chaque envoi laissent une trace.'],
          ['visage', 'Vos comptes, vos mains', 'Pas de connexion automatique : vous vous connectez vous-même.'],
          ['rouage', 'Réglages annulables', 'Un réglage du chef d’équipe s’annule en un geste.'],
        ]} />
      </Scene>

      <Scene>
        <div className="sc-deux">
          <div>
            <p className="mq-surtitre">Un environnement managé</p>
            <h2 className="sc-h2">iAgent tient la Box à jour</h2>
            <Liste items={['La Box est préparée et tenue à jour par iAgent.', 'Vous choisissez, tâche par tâche, ce qui passe par l’API et ce qui reste en local.', 'Les résultats s’écrivent dans vos dossiers.']} />
            <div className="sc-actions"><Bouton href="/local-ai" variante="contour-cyan">Infrastructure locale sur devis</Bouton></div>
          </div>
          <Ecran src="dc-travail" alt="Desktop Commander : le travail d'un agent et ce qui attend votre accord" legende="Desktop Commander : ce qui attend votre accord" />
        </div>
      </Scene>

      <Final titre="Des questions de sécurité précises ?" visage={9}>
        <Bouton href="/contact">Nous écrire</Bouton>
        <Bouton href="/faq" variante="contour-cyan">Questions fréquentes</Bouton>
      </Final>
      <Voisines ici="security" />
    </>
  );
}

/* ---------------------------------------------------------------------- faq */

const QUESTIONS = [
  ['produit', 'Le produit', 'equipe', [
    ["Faut-il savoir utiliser l'IA ?", "Non. Vous dites ce que vous voulez accomplir ; l'agent pose ses questions à l'oral pendant l'entretien d'embauche et règle le reste.", ['/how-it-works', 'Comment ça marche']],
    ['Un agent peut-il agir sans moi ?', "Oui, s'il est réglé ainsi : il travaille seul, sauf sur les tâches que vous mettez sous contrôle. Aucun e-mail ne part sans que vous ayez relu le texte exact.", ['/security', 'Sécurité et contrôle']],
  ]],
  ['donnees', 'Vos données', 'cadenas', [
    ['Mes données quittent-elles l’entreprise ?', "En local, rien ne sort pour être traité. Par l'API, seul ce que la tâche demande part au fournisseur d'IA. Vous choisissez la voie, et l'application vous prévient avant de basculer.", ['/local-ai', 'IA locale et hybride']],
  ]],
  ['tarifs', 'Les tarifs', 'pieces', [
    ['Que coûte un agent ?', () => `Son abonnement est ${prixAgentEnUneLigne()}, hors taxes. La Box et la consommation d'IA s'ajoutent, toujours affichées à part.`, ['/pricing', 'Voir les tarifs']],
  ]],
  ['contrat', 'Le contrat et la Box', 'doc', [
    ['Que se passe-t-il en fin de contrat ?', 'La Box est mise à disposition : elle se rend en fin de contrat. Vos fichiers, eux, sont dans vos dossiers.', ['/box', 'La Box']],
    ['Combien d’agents par Box ?', "Jusqu'à 20. Au-delà, une deuxième Box, ou une infrastructure sur devis.", ['/local-ai', 'Infrastructure sur devis']],
  ]],
  ['telephonie', 'Téléphone et WhatsApp', 'tel', [
    ['Les agents répondent-ils sur WhatsApp ou au téléphone ?', "Notre centre d'appels IA répond déjà sur WhatsApp et au téléphone pour iAgent Tech : prise de rendez-vous, qualification, transfert à un conseiller, consentement pour les appels sortants. Pour équiper votre propre entreprise (standard téléphonique, SAV, campagnes), un conseiller vous présente l'offre et sa mise en service.", ['/voice', 'iAgent Voice']],
  ]],
  ['technique', 'Technique', 'puce', [
    ['Sur quel système tourne l’application ?', 'Desktop Commander tourne sous Windows ; la Box est livrée avec, installée et prête.', ['/box', 'La Box']],
  ]],
];

export function Faq() {
  return (
    <>
      <Heros decor="lever" surtitre="Questions fréquentes" titre={<>Les réponses <Eclat>avant de recruter.</Eclat></>}
        texte="Le produit, vos données, les tarifs, le contrat, le téléphone et la technique : tout ce qu'on nous demande avant une première embauche." />
      <Scene etroit>
        <nav className="sc-faq-cats" aria-label="Catégories de questions">
          {QUESTIONS.map(([id, titre, icone]) => <a key={id} href={`#${id}`}><Icone nom={icone} taille={16} />{titre}</a>)}
        </nav>
        {QUESTIONS.map(([id, titre, icone, liste]) => (
          <section key={id} id={id} className="sc-faq-groupe">
            <h2><span><Icone nom={icone} taille={18} /></span>{titre}</h2>
            {liste.map(([q, r, [href, lien]]) => (
              <details key={q} className="sc-verre">
                <summary>{q}</summary>
                <p>{typeof r === 'function' ? r() : r} <a href={href}>{lien}</a></p>
              </details>
            ))}
          </section>
        ))}
      </Scene>
      <Final titre="Une autre question ?" visage={13}>
        <Bouton href="/contact">Nous écrire</Bouton>
      </Final>
      <Voisines ici="faq" />
    </>
  );
}

