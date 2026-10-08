import donnees from 'virtual:accueil';
import { nombre, LIENS, IntentInput } from '../accueil/composants.jsx';
import { euros, montant, STATUTS, BOX_DES, VOICE, prixAgentEnUneLigne } from '../data/tarifs.js';
import { Tete, Bande, Cartes, Etapes, Coches, Voisines, Fin, Bouton, Demande } from './blocs.jsx';

// The Business pages of max's global document (07/10, §3, §9, §11, §12, §16).
// The telephone is not built yet: every voice offer says « bientôt », and the
// artisan's case is shown as a scenario, never as something a client runs today.

const { compteurs } = donnees;

const Statut = ({ s }) => <span className="pg-statut">{STATUTS[s] ?? s}</span>;

/** Voice offers as price cards, picked by id from tarifs.json. */
function OffresVoix({ ids }) {
  return (
    <ul className="pg-prix">
      {ids.map((id) => VOICE[id]).map((o) => (
        <li key={o.id}>
          <b>{o.nom}</b>
          <small>{o.contenu}</small>
          <strong>{montant(o)}{!o.surDevis && <em> HT / mois<span className="pg-plus">+ consommation</span></em>}</strong>
          <Statut s={o.statut} />
        </li>
      ))}
    </ul>
  );
}

const PAS_ENCORE = "Le téléphone n'est pas encore branché : ces offres ouvriront dès que vos agents sauront répondre à un vrai appel. Laissez-nous vos coordonnées, nous vous prévenons en premier.";

function Artisan() {
  return (
    <section className="mq-bande mq-deux pg-bande">
      <div>
        <p className="mq-surtitre">Un cas concret · scénario</p>
        <h2 className="mq-titre">L'artisan produit, l'agent prend les commandes</h2>
        <p className="mq-texte pg-texte">Le boulanger est au fournil, le restaurateur en cuisine. Le téléphone sonne : l'agent décroche, prend la commande, vérifie l'horaire de retrait et la note dans le planning. Ce qu'il ne sait pas trancher, il le garde pour un rappel.</p>
      </div>
      <div>
        <p className="mq-surtitre">Ce que l'agent fera</p>
        <Coches items={['Répondre à chaque appel, même en plein service.', 'Prendre la commande et la répéter pour confirmation.', 'Inscrire la commande là où vous la lisez déjà.', 'Vous passer l’appel, ou proposer un rappel, quand il le faut.']} />
        <p className="pg-note">Scénario : le téléphone arrive bientôt.</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ why-rent */

function PourquoiLouer() {
  return (
    <>
      <Tete surtitre="Pourquoi louer" titre={<>Ce qu'il faudrait reconstruire<br /><span className="mq-cyan">pour faire la même chose soi-même.</span></>}
        texte="Un agent qui travaille vraiment, ce n'est pas un modèle d'IA et une consigne. Voici ce qu'il y a derrière chaque agent iAgent, et que vous n'avez pas à construire.">
        <Bouton href="/pricing">Voir les tarifs</Bouton>
      </Tete>
      <Bande surtitre="Le coût réel de reconstruction" titre="Six chantiers, avant la première tâche">
        <Etapes items={[
          ['Décrire chaque métier', `${nombre(compteurs.fiches)} métiers écrits à ce jour, soit ${nombre(compteurs.taches)} tâches décrites une à une : ce qu'il faut lire, produire, et ce qui attend un accord.`],
          ['Connaître les logiciels', `${nombre(compteurs.logiciels)} logiciels du marché européen recensés, pour que l'agent sache où aller chez vous.`],
          ['Choisir et faire tourner les modèles', "Quel modèle pour quelle tâche, en local ou par l'API, et quoi faire quand la machine ne suffit pas."],
          ["Construire l'application", 'La voix, le navigateur où vous restez connecté, les documents Word, Excel et PDF, les permissions et le journal de chaque action.'],
          ['Préparer et tenir la machine', 'Dimensionner, installer, mettre à jour, réparer, remplacer.'],
          ['Faire évoluer le tout', 'Chaque nouveau logiciel, chaque nouvelle méthode, chaque correctif, sans interrompre le travail.'],
        ]} />
      </Bande>
      <Bande surtitre="Ce que vous payez à la place" titre="Un abonnement, et la consommation à part"
        texte={`La Box à partir de ${euros(BOX_DES.mensuel)} par mois, chaque agent ${prixAgentEnUneLigne()}, hors taxes. L'usage de l'IA se paie au réel, toujours affiché à part.`}>
        <Coches items={['Pas de développement à financer avant de voir un résultat.', 'Pas de machine à acheter : la Box est mise à disposition et maintenue.', 'Les évolutions arrivent avec les mises à jour, sans projet de votre côté.']} />
      </Bande>
      <Fin titre="Comparez sur votre cas">
        <Bouton href="/contact" evenement="plan_select">Demander un chiffrage</Bouton>
        <Bouton href="/workforce" variante="contour-cyan">iAgent Workforce</Bouton>
      </Fin>
      <Voisines ici="why-rent" />
    </>
  );
}

/* --------------------------------------------------------------------- voice */

function Voix() {
  return (
    <>
      <Tete surtitre="iAgent Voice" titre={<>Une voix pour vos agents.<br /><span className="mq-cyan">Bientôt, un vrai numéro.</span></>}
        texte="Aujourd'hui, vous parlez à vos agents à voix haute, sur la Box ou dans Desktop Commander, en les appelant par leur prénom. Demain, ils répondront au téléphone de votre entreprise.">
        <Bouton href="#prevenir" evenement="phone_number_request">Être prévenu</Bouton>
        <Bouton href="/contact" variante="contour-cyan" evenement="voice_demo">Demander une démo</Bouton>
      </Tete>
      <Bande surtitre="Aujourd'hui et demain" titre="Ce qui marche, ce qui arrive">
        <Cartes colonnes={3} items={[
          ['micro', 'La voix sur la Box', "Disponible : on appelle l'agent par son prénom, il répond à voix haute."],
          ['tel', 'Le standard', 'Bientôt : un numéro, un accueil qui comprend ce qu’on lui dit, sans touches à taper.', '/standard-telephonique'],
          ['equipe', 'Le centre de support', 'Bientôt : plusieurs appels à la fois, le SAV et l’escalade vers un humain.', '/support-center'],
          ['cible', 'Le centre commercial', 'Bientôt : des campagnes d’appels dans le respect du consentement.', '/sales-center'],
          ['voix', 'Une voix par agent', 'La même voix sur la Box et, demain, au téléphone.'],
          ['bouclier', 'Un humain quand il faut', "L'agent vous passe l'appel avec le motif et un résumé."],
        ]} />
      </Bande>
      <Artisan />
      <Bande surtitre="Tarifs" titre="Les offres Voice" texte="Abonnement de la ligne et du standard ; les minutes, la voix et l’IA se paient à part, au réel.">
        <OffresVoix ids={['reception', 'reception-pro', 'support-center', 'sales-center', 'voice-enterprise']} />
      </Bande>
      <Bande id="prevenir" surtitre="Être prévenu" titre="Réservez votre numéro" texte={PAS_ENCORE}>
        <Demande sujet="iAgent Voice : être prévenu" evenement="phone_number_request" champs={[
          ['Offre', "L'offre qui vous intéresse", ['Reception', 'Reception Pro', 'Support Center', 'Sales Center', 'Voice Enterprise']],
          ['Appels', "Appels par jour", ['Moins de 20', '20 à 100', '100 à 500', 'Plus de 500']],
        ]} />
      </Bande>
      <Voisines ici="voice" />
    </>
  );
}

/* ----------------------------------------------------- standard-telephonique */

function Standard() {
  return (
    <>
      <Tete surtitre="Standard téléphonique IA" titre={<>Un standard qui comprend<br /><span className="mq-cyan">ce qu'on lui dit.</span></>}
        texte="Plus de « tapez 1, tapez 2 » : l'appelant dit ce qu'il veut, l'agent d'accueil répond ou passe l'appel au bon agent, ou à vous. Arrive bientôt.">
        <Bouton href="#prevenir" evenement="phone_number_request">Réserver mon numéro</Bouton>
      </Tete>
      <Bande surtitre="Ce que fera le standard" titre="L'accueil, les transferts, la main à l'humain">
        <Cartes colonnes={3} items={[
          ['tel', 'Un vrai numéro', "Un ou plusieurs numéros pour l'entreprise, gardés si vous changez d'offre."],
          ['bulle', 'Un accueil en conversation', 'Vos horaires, vos scénarios, votre façon de répondre.'],
          ['reseau', 'Une extension par agent', 'Chaque agent a son poste et son service ; il transfère à un collègue.'],
          ['agenda', 'Attente, rappel, messagerie', 'Musique d’attente, rappel proposé, message laissé et résumé.'],
          ['visage', 'La main à l’humain', 'Qui appelle, pourquoi, un résumé : vous prenez, refusez, rappelez, ou laissez l’agent continuer.'],
          ['ecran', 'Partout où vous êtes', 'Le transfert vers la Box, votre ordinateur, votre mobile ou une ligne fixe.'],
        ]} />
      </Bande>
      <Artisan />
      <Bande surtitre="Tarifs" titre="Reception et Reception Pro">
        <OffresVoix ids={['reception', 'reception-pro']} />
      </Bande>
      <Bande id="prevenir" surtitre="Être prévenu" titre="Réservez votre numéro" texte={PAS_ENCORE}>
        <Demande sujet="Standard téléphonique : être prévenu" evenement="phone_number_request" champs={[
          ['Offre', "L'offre qui vous intéresse", ['Reception', 'Reception Pro']],
          ['Activité', 'Votre activité'],
        ]} />
      </Bande>
      <Voisines ici="standard-telephonique" />
    </>
  );
}

/* ------------------------------------------------------------ support-center */

function CentreSupport() {
  return (
    <>
      <Tete surtitre="iAgent Support Center" titre={<>Votre SAV au téléphone,<br /><span className="mq-cyan">plusieurs appels à la fois.</span></>}
        texte="Facturation, commandes, assistance, réclamations : des agents répondent en parallèle, ouvrent le ticket et passent la main à un humain quand il le faut. Arrive bientôt.">
        <Bouton href="#devis" evenement="call_center_quote">Dimensionner mon support</Bouton>
      </Tete>
      <Bande surtitre="Ce que fera le centre" titre="Des files, des tickets, une escalade claire">
        <Cartes colonnes={3} items={[
          ['equipe', 'Appels simultanés', 'Plusieurs agents décrochent en même temps, sans file d’attente qui s’allonge.'],
          ['rouage', 'Files et priorités', 'Débordement, rappel automatique, priorités par motif.'],
          ['doc', 'Un ticket par appel', 'Le résumé, le motif et la suite à donner, dans votre outil.'],
          ['visage', 'Escalade humaine', 'L’agent transmet avec le contexte : personne ne répète son histoire.'],
          ['graphe', 'Suivi', 'Appels, durée, motifs et coût, appel par appel.'],
          ['serveur', 'La bonne puissance', "Au-delà de quelques lignes, les appels passent par une plateforme vocale dédiée, pas par la seule Box."],
        ]} />
      </Bande>
      <Bande surtitre="Tarif" titre="Support Center">
        <OffresVoix ids={['support-center', 'voice-enterprise']} />
      </Bande>
      <Bande id="devis" surtitre="Votre support" titre="Décrivez-nous vos appels" texte={PAS_ENCORE}>
        <Demande sujet="Support Center" evenement="call_center_quote" champs={[
          ['Appels', 'Appels par jour', ['Moins de 50', '50 à 200', '200 à 1000', 'Plus de 1000']],
          ['Motifs', 'Motifs les plus fréquents'],
          ['Outil', 'Votre outil de tickets ou de CRM'],
        ]} />
      </Bande>
      <Voisines ici="support-center" />
    </>
  );
}

/* -------------------------------------------------------------- sales-center */

function CentreVentes() {
  return (
    <>
      <Tete surtitre="iAgent Sales Center" titre={<>Des campagnes d'appels,<br /><span className="mq-cyan">dans les règles.</span></>}
        texte="Relances, prises de rendez-vous, suivi de devis : des agents appellent pour vous, dans les plages autorisées et seulement les personnes qui peuvent l'être. Arrive bientôt.">
        <Bouton href="#devis" evenement="call_center_quote">Préparer une campagne</Bouton>
      </Tete>
      <Bande surtitre="Ce que fera le centre" titre="Appeler, noter, relancer">
        <Cartes colonnes={3} items={[
          ['cible', 'Des campagnes', 'Une liste, un objectif, un script que l’agent suit sans réciter.'],
          ['crm', 'Votre CRM', 'Chaque appel noté sur la fiche du contact, avec la suite à donner.'],
          ['agenda', 'Des relances', 'Le rappel au bon moment, le rendez-vous posé dans votre agenda.'],
        ]} />
      </Bande>
      <section className="mq-bande mq-deux pg-bande">
        <div>
          <p className="mq-surtitre">Les règles d'abord</p>
          <h2 className="mq-titre">Aucun appel hors des règles applicables</h2>
          <Coches items={['Le consentement est vérifié et conservé.', 'Les listes d’opposition au démarchage sont respectées.', 'Les appels ne partent que dans les plages horaires autorisées.', 'Chaque appel laisse une preuve consultable.']} />
        </div>
        <div>
          <p className="mq-surtitre">Tarif</p>
          <OffresVoix ids={['sales-center']} />
        </div>
      </section>
      <Bande id="devis" surtitre="Votre campagne" titre="Décrivez-nous votre besoin" texte={PAS_ENCORE}>
        <Demande sujet="Sales Center" evenement="call_center_quote" champs={[
          ['Objectif', 'Objectif des appels', ['Relances de devis', 'Prise de rendez-vous', 'Fidélisation', 'Autre']],
          ['Volume', 'Appels par mois', ['Moins de 500', '500 à 5000', 'Plus de 5000']],
          ['CRM', 'Votre CRM'],
        ]} />
      </Bande>
      <Voisines ici="sales-center" />
    </>
  );
}

/* -------------------------------------------------------------------- create */

const EXEMPLES_IDEES = [
  'Ouvrir une épicerie fine en ligne',
  'Lancer une agence de rénovation énergétique',
  'Créer un service de traiteur pour entreprises',
];

const PHASES = [
  ['Étudier', 'Marché, concurrence, faisabilité, business plan.'],
  ['Financer', 'Aides, banques, investisseurs, levée de fonds.'],
  ['Construire', 'Juridique, achats, infrastructure, produit, marque.'],
  ['Lancer', 'Marketing, commercial, communication.'],
  ['Exploiter', 'Finance, relation client, administratif, support.'],
];

function Creer() {
  return (
    <>
      <Tete surtitre="iAgent Create" titre={<>Une idée ?<br /><span className="mq-cyan">Composons l'entreprise.</span></>}
        texte="Décrivez votre projet en une phrase : iAgent propose l'équipe d'agents qui l'étudie, le finance, le construit, le lance et le fait tourner. Pas d'idée précise ? Partez des opportunités.">
        <Bouton href="/opportunities" variante="contour-cyan">Voir les opportunités</Bouton>
      </Tete>
      <Bande id="idee" surtitre="J'ai une idée" titre="Dites-la simplement">
        <IntentInput id="idee-create" exemples={EXEMPLES_IDEES} cta="Composer l'équipe" evenement="create_idea_submit" grand />
      </Bande>
      <Bande surtitre="L'entreprise composée" titre="L'équipe change à chaque phase"
        texte="Chaque phase a ses métiers. Vous voyez l'équipe proposée, son abonnement et la consommation estimée avant de recruter ; les responsabilités qui restent humaines sont dites.">
        <Etapes items={PHASES} />
      </Bande>
      <Bande surtitre="Sans idée précise" titre="Partir d'une opportunité"
        texte="Des projets repérés sur le marché, chacun avec ce qu'il demande, ses risques et l'équipe qu'il faudrait. Jamais de promesse de rentabilité : des scénarios et leurs hypothèses.">
        <Bouton href="/opportunities" variante="contour-cyan">Voir les opportunités</Bouton>
      </Bande>
      <Fin titre="Ou partez d'un métier">
        <Bouton href={LIENS.catalogue} evenement="catalog_click">Explorer les agents</Bouton>
        <Bouton href={LIENS.entreprise} variante="contour-cyan" evenement="create_company_click">Composer mon équipe</Bouton>
      </Fin>
      <Voisines ici="create" />
    </>
  );
}

/* ------------------------------------------------------------- opportunities */

function Opportunites() {
  return (
    <>
      <Tete surtitre="Opportunités" titre={<>Les projets repérés<br /><span className="mq-cyan">sur le marché.</span></>}
        texte="Chaque opportunité dira pourquoi maintenant, le marché, la demande, la concurrence, le capital estimé, la complexité, le délai, les risques et l'équipe recommandée.">
        <Bouton href="/create" variante="contour-cyan">J'ai déjà une idée</Bouton>
      </Tete>
      <Bande surtitre="Aujourd'hui" titre="Aucune opportunité n'est encore publiée"
        texte="Les premières seront publiées une fois leurs chiffres vérifiés. Nous préférons une page vide à une opportunité inventée.">
        <Bouton href="/create" evenement="opportunity_build_company">Composer mon entreprise à partir d'une idée</Bouton>
      </Bande>
      <Bande surtitre="Ce que contiendra chaque fiche" titre="Une étude, pas une promesse">
        <Cartes colonnes={3} items={[
          ['graphe', 'Trois scénarios', 'Prudent, central, ambitieux, avec leurs hypothèses écrites.'],
          ['pieces', 'Les coûts', 'Le capital de départ, les charges, les canaux d’acquisition.'],
          ['bouclier', 'Les règles', 'La réglementation à connaître avant de se lancer.'],
          ['fusee', "Le plan d'exécution", 'Les jalons, phase par phase.'],
          ['equipe', "L'équipe", 'Les agents à recruter à chaque phase.'],
          ['cible', 'Construire', 'Un bouton pour transformer l’opportunité en projet iAgent.'],
        ]} />
      </Bande>
      <Voisines ici="opportunities" />
    </>
  );
}

export const COMPOSANTS_BUSINESS = {
  'why-rent': PourquoiLouer,
  voice: Voix,
  'standard-telephonique': Standard,
  'support-center': CentreSupport,
  'sales-center': CentreVentes,
  create: Creer,
  opportunities: Opportunites,
};
