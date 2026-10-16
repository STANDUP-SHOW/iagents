import { useState } from 'react';
import donnees from 'virtual:accueil';
import { nombre, LIENS, IntentInput, Icone } from '../accueil/composants.jsx';
import { euros, montant, STATUTS, BOX_DES, VOICE, prixAgentEnUneLigne } from '../data/tarifs.js';
import { Voisines, Bouton, Demande } from './blocs.jsx';
import { Eclat, Heros, Scene, Ecran, Photo, Visage, Collaborateur, Preuves, Liste, Onde, Exemple, Champs, Final } from './scenes.jsx';

// The Business pages of max's global document (07/10, §3, §9, §11, §12, §16),
// redrawn on his mockups of 11/10. Every page says what the offer does, in the
// present (max, 10/10): the voice offers carry the pilot status of the grid,
// every mock screen is labelled as an example and carries made-up data only.

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

const OUVRIR_LIGNE = "Dites-nous vos volumes, vos horaires et vos outils : un conseiller vous présente l'offre, son prix et sa mise en service.";

// What the call centre does today, for iAgent Tech itself; the client offers run on the same engine.
const MOTEUR = "Le centre d'appels IA d'iAgent Tech répond sur WhatsApp et au téléphone. L'assistante se présente comme une intelligence artificielle, répond à partir de nos tarifs réels, qualifie le besoin, réserve un rendez-vous avec un conseiller et passe la main à un humain quand on le demande. Les appels sortants ne partent qu'avec un consentement prouvé et dans les horaires légaux, et « STOP » arrête tout contact. Toutes les conversations sont journalisées dans une console. Ce module sert d'abord à nos propres opérations ; l'offre pour les entreprises clientes (iAgent Reception, Support Center, Sales Center) repose sur le même moteur.";

/* ------------------------------------------------------- shared voice scenes */

/** An incoming call, as the phone shows it (example, made-up caller). */
function Appel({ titre = 'Appel entrant', qui = 'Un client', motif, phrase }) {
  return (
    <Exemple titre={titre} icone="tel" className="sc-appel">
      <div className="sc-appel-portrait"><Visage n={18} /></div>
      <b>{qui}</b>
      <small>{motif}</small>
      <Onde className="sc-onde-vivante" />
      <p className="sc-bulle">{phrase}</p>
      <div className="sc-appel-boutons" aria-hidden="true">
        <span className="sc-rond"><Icone nom="micro" taille={18} /></span>
        <span className="sc-rond rouge"><Icone nom="tel" taille={20} /></span>
        <span className="sc-rond"><Icone nom="voix" taille={18} /></span>
      </div>
    </Exemple>
  );
}

/** The four places a call can go. */
const ROUTES = [
  ['cyan', 'tel', 'Standard', "L'accueil, les horaires, le bon service.", '/standard-telephonique'],
  ['violet', 'outils', 'Support', 'Le SAV, le ticket, le suivi.', '/support-center'],
  ['rose', 'cible', 'Sales', 'Les relances, les rendez-vous.', '/sales-center'],
  ['orange', 'visage', 'Transfert humain', 'Vous, avec le motif et un résumé.', '#main-humaine'],
];

function Routes({ className = '' }) {
  return (
    <div className={`sc-routes ${className}`}>
      {ROUTES.map(([teinte, icone, titre, texte, href]) => (
        <a key={titre} href={href} className={`sc-route ${teinte}`}>
          <span className="sc-route-icone"><Icone nom={icone} taille={22} /></span>
          <span><b>{titre}</b><small>{texte}</small></span>
        </a>
      ))}
    </div>
  );
}

/** The hand-off to a human: who calls, why, a summary, and four choices. */
function MainHumaine() {
  return (
    <Exemple titre="Transfert vers un humain" icone="visage">
      <Champs lignes={[['Appelant', 'Un client existant'], ['Motif', 'Contestation d’une facture'], ['Résumé', 'Facture de mars reçue deux fois, souhaite un avoir.'], ['Urgence', 'Moyenne', 'ambre']]} />
      <div className="sc-boutons-ligne" aria-hidden="true">
        <span className="sc-mini-bouton vert">Prendre l'appel</span>
        <span className="sc-mini-bouton">Rappeler</span>
        <span className="sc-mini-bouton">Laisser l'agent continuer</span>
        <span className="sc-mini-bouton">Refuser</span>
      </div>
    </Exemple>
  );
}

function Ticket() {
  return (
    <Exemple titre="Ticket ouvert par l'agent" icone="doc">
      <Champs lignes={[['Ticket', 'N° 0000 (exemple)'], ['Motif', 'Commande non reçue'], ['Priorité', 'Haute', 'rouge'], ['Statut', 'En cours', 'bleu'], ['Suite', 'Relance du transporteur, rappel du client demain']]} />
    </Exemple>
  );
}

function FicheCrm() {
  return (
    <Exemple titre="Fiche contact mise à jour" icone="crm">
      <Champs lignes={[['Contact', 'Une entreprise cliente'], ['Appel', 'Relance du devis envoyé'], ['Résultat', 'Rendez-vous posé', 'vert'], ['Prochaine étape', 'Rendez-vous avec le commercial'], ['Consentement', 'Vérifié et conservé', 'vert']]} />
    </Exemple>
  );
}

function Campagne() {
  return (
    <Exemple titre="Campagne de relance des devis" icone="cible">
      <div className="sc-progression"><span style={{ width: '64%' }} /></div>
      <div className="sc-chiffres">
        <div><b>64 %</b><small>de la liste appelée</small></div>
        <div><b>Plage</b><small>horaire autorisée</small></div>
        <div><b>STOP</b><small>respecté à chaque appel</small></div>
      </div>
      <Champs lignes={[['Liste d’opposition', 'Consultée', 'vert'], ['Consentement', 'Vérifié et conservé', 'vert'], ['Preuve', 'Consultable, appel par appel']]} />
    </Exemple>
  );
}

function Artisan() {
  return (
    <Scene>
      <div className="sc-deux">
        <div>
          <p className="mq-surtitre">Un cas concret</p>
          <h2 className="sc-h2">L'artisan produit, <Eclat>l'agent prend les commandes</Eclat></h2>
          <p className="sc-texte">Le boulanger est au fournil, le restaurateur en cuisine. Le téléphone sonne : l'agent décroche, prend la commande, vérifie l'horaire de retrait et la note dans le planning. Ce qu'il ne sait pas trancher, il le garde pour un rappel.</p>
          <Liste items={['Répondre à chaque appel, même en plein service.', 'Prendre la commande et la répéter pour confirmation.', 'Inscrire la commande là où vous la lisez déjà.', 'Vous passer l’appel, ou proposer un rappel, quand il le faut.']} />
        </div>
        <Photo src="voice-telephone" alt="Un téléphone posé sur un comptoir, un appel en cours" largeur={650} hauteur={300} />
      </div>
    </Scene>
  );
}

/* ------------------------------------------------------------------ why-rent */

const CHANTIERS = [
  ['doc', 'Décrire chaque métier', () => `${nombre(compteurs.fiches)} métiers écrits à ce jour, soit ${nombre(compteurs.taches)} tâches décrites une à une.`],
  ['outils', 'Connaître les logiciels', () => `${nombre(compteurs.logiciels)} logiciels du marché européen recensés, pour que l'agent sache où aller chez vous.`],
  ['puce', 'Choisir et faire tourner les modèles', () => "Quel modèle pour quelle tâche, en local ou par l'API, et quoi faire quand la machine ne suffit pas."],
  ['ecran', "Construire l'application", () => 'La voix, le navigateur, les documents Word, Excel et PDF, les permissions et le journal.'],
  ['serveur', 'Préparer et tenir la machine', () => 'Dimensionner, installer, mettre à jour, réparer, remplacer.'],
  ['rouage', 'Faire évoluer le tout', () => 'Chaque nouveau logiciel, chaque méthode, chaque correctif, sans interrompre le travail.'],
];

function PourquoiLouer() {
  return (
    <>
      <Heros surtitre="Pourquoi louer" titre={<>Ce qu'il faudrait reconstruire <Eclat>pour faire la même chose soi-même.</Eclat></>}
        texte="Un agent qui travaille vraiment, ce n'est pas un modèle d'IA et une consigne. Voici ce qu'il y a derrière chaque agent iAgent, et que vous n'avez pas à construire."
        actions={<>
          <Bouton href="/pricing">Voir les tarifs</Bouton>
          <Bouton href="/contact" variante="contour-cyan" evenement="plan_select">Demander un chiffrage</Bouton>
        </>}
        visuel={<div className="sc-tuiles sc-tuiles-heros">
          <a href={LIENS.catalogue}><Icone nom="equipe" taille={22} /><b>{nombre(compteurs.fiches)}</b><small>métiers</small></a>
          <div><Icone nom="doc" taille={22} /><b>{nombre(compteurs.taches)}</b><small>tâches décrites</small></div>
          <div><Icone nom="outils" taille={22} /><b>{nombre(compteurs.logiciels)}</b><small>logiciels</small></div>
          <div><Icone nom="cible" taille={22} /><b>{nombre(compteurs.activites)}</b><small>activités</small></div>
        </div>} />

      <Scene surtitre="Le coût réel de reconstruction" titre={<>Six chantiers, <Eclat>avant la première tâche</Eclat></>}>
        <div className="sc-comparer">
          <ol className="sc-chantiers">
            {CHANTIERS.map(([icone, titre, texte], i) => (
              <li key={titre} className="sc-verre"><span className="n">{i + 1}</span><Icone nom={icone} taille={24} /><span><b>{titre}</b><small>{texte()}</small></span></li>
            ))}
          </ol>
          <div className="sc-iceberg" aria-hidden="true"><Photo src="iceberg" alt="" largeur={466} hauteur={990} /></div>
          <div className="sc-integre sc-verre">
            <p className="mq-surtitre">Avec iAgent</p>
            <h3 className="sc-h2">Tout est déjà intégré</h3>
            <div className="sc-integre-corps">
              <Photo dossier="/accueil" src="box-commander" alt="La Box iAgent Commander" largeur={1122} hauteur={570} />
              <div className="sc-integre-lignes">
                <div><Icone nom="equipe" taille={20} /><span><b>Des métiers prêts</b><small>Décrits, maintenus, enrichis.</small></span></div>
                <div><Icone nom="ecran" taille={20} /><span><b>La Box et Desktop Commander</b><small>Préparés et tenus à jour.</small></span></div>
                <div><Icone nom="hybride" taille={20} /><span><b>Local, cloud ou hybride</b><small>L'application choisit et vous prévient.</small></span></div>
              </div>
            </div>
            <Ecran src="dc-centre" alt="Desktop Commander, l'écran d'accueil" largeur={1280} hauteur={720} />
          </div>
        </div>
      </Scene>

      <Scene surtitre="Ce que vous payez à la place" titre="Un abonnement, et la consommation à part"
        texte={`La Box à partir de ${euros(BOX_DES.mensuel)} par mois, chaque agent ${prixAgentEnUneLigne()}, hors taxes. L'usage de l'IA se paie au réel, toujours affiché à part.`}>
        <Preuves colonnes={3} items={[
          ['pieces', 'Rien à financer avant', 'Pas de développement à payer avant de voir un résultat.'],
          ['ecran', 'Pas de machine à acheter', 'La Box est mise à disposition et maintenue.'],
          ['fusee', 'Les évolutions comprises', 'Elles arrivent avec les mises à jour, sans projet de votre côté.'],
        ]} />
      </Scene>

      <Final titre="Comparez sur votre cas" visage={1}>
        <Bouton href="/contact" evenement="plan_select">Demander un chiffrage</Bouton>
        <Bouton href="/workforce" variante="contour-cyan">iAgent Workforce</Bouton>
      </Final>
      <Voisines ici="why-rent" />
    </>
  );
}

/* --------------------------------------------------------------------- voice */

const FAMILLE = [
  ['cyan', 'tel', 'Standard téléphonique', 'Un numéro, un accueil qui comprend ce qu’on lui dit, sans touches à taper.', '/standard-telephonique', 20],
  ['violet', 'outils', 'Support Center', 'Plusieurs appels à la fois, le SAV et l’escalade vers un humain.', '/support-center', 10],
  ['rose', 'cible', 'Sales Center', 'Des campagnes d’appels, dans le respect du consentement.', '/sales-center', 6],
  ['orange', 'micro', 'La voix sur la Box', "On appelle l'agent par son prénom, il répond à voix haute.", '/box', 25],
];

function Voix() {
  return (
    <>
      <Heros surtitre="iAgent Voice" titre={<>Une voix pour vos agents. <Eclat>Et un vrai numéro.</Eclat></>}
        texte="Vous parlez à vos agents à voix haute, sur la Box ou dans Desktop Commander, en les appelant par leur prénom. Au téléphone et sur WhatsApp, le centre d'appels IA d'iAgent répond, prend les rendez-vous et passe la main à un humain ; un conseiller le met en service pour votre entreprise."
        actions={<>
          <Bouton href="#numero" evenement="phone_number_request">Ouvrir mon numéro</Bouton>
          <Bouton href="/contact" variante="contour-cyan" evenement="voice_demo">Demander une démo</Bouton>
        </>}
        preuves={[['bulle', 'Il comprend', 'sans touches à taper'], ['agenda', 'Il agit', 'rendez-vous, tickets'], ['visage', 'Il transmet', 'à un humain'], ['bouclier', 'Il respecte', 'le consentement']]}
        visuel={<div className="sc-voix-scene">
          <Appel motif="Déplacer un rendez-vous" phrase="« Bonjour, je voudrais déplacer mon rendez-vous de jeudi. »" />
          <div className="sc-voix-photo">
            <Photo src="voice-casque" alt="Une conseillère au casque, devant son poste" largeur={700} hauteur={546} charger="eager" />
            <div className="sc-reponse"><b><Icone nom="voix" taille={16} />Réponse de l'agent</b>« Bien sûr. Je vous propose vendredi à 10 h ou lundi à 14 h. Lequel vous convient ? »</div>
          </div>
        </div>} />

      <Scene surtitre="Où va l'appel" titre={<>L'agent comprend, puis <Eclat>oriente</Eclat></>}
        texte="Chaque appel finit au bon endroit : l'accueil, le support, le commercial, ou vous.">
        <Routes className="sc-routes-4" />
      </Scene>

      <Scene surtitre="La famille Voice" titre="La voix, le standard, le support, les campagnes">
        <ul className="sc-famille">
          {FAMILLE.map(([teinte, icone, titre, texte, href, n]) => (
            <li key={titre} className={`sc-verre ${teinte}`}>
              <div className="sc-famille-photo"><Visage n={n} /><span className="sc-route-icone"><Icone nom={icone} taille={22} /></span></div>
              <div className="sc-famille-corps">
                <h3>{titre}</h3>
                <p>{texte}</p>
                <a className="sc-lien" href={href}>En savoir plus</a>
              </div>
            </li>
          ))}
        </ul>
      </Scene>

      <Scene id="main-humaine" surtitre="Ce que vous voyez" titre={<>Un ticket, une fiche, <Eclat>un humain quand il faut</Eclat></>}
        texte="Après chaque appel, l'agent laisse une trace là où vous travaillez déjà. Les écrans ci-dessous sont des exemples, avec des données fictives.">
        <div className="sc-trois"><Ticket /><FicheCrm /><MainHumaine /></div>
      </Scene>

      <Artisan />

      <Scene surtitre="Le moteur" titre="Le centre d'appels IA, chez nous d'abord" etroit>
        <p className="sc-texte">{MOTEUR}</p>
      </Scene>

      <Scene surtitre="Tarifs" titre="Les offres Voice" texte="Abonnement de la ligne et du standard ; les minutes, la voix et l’IA se paient à part, au réel.">
        <OffresVoix ids={['reception', 'reception-pro', 'support-center', 'sales-center', 'voice-enterprise']} />
      </Scene>

      <Scene id="numero" surtitre="Votre numéro" titre="Ouvrez votre numéro" texte={OUVRIR_LIGNE} etroit>
        <Demande sujet="iAgent Voice : ouvrir un numéro" evenement="phone_number_request" champs={[
          ['Offre', "L'offre qui vous intéresse", ['Reception', 'Reception Pro', 'Support Center', 'Sales Center', 'Voice Enterprise']],
          ['Appels', 'Appels par jour', ['Moins de 20', '20 à 100', '100 à 500', 'Plus de 500']],
        ]} />
      </Scene>
      <Voisines ici="voice" />
    </>
  );
}

/* ----------------------------------------------------- standard-telephonique */

function Standard() {
  return (
    <>
      <Heros photo={{ src: 'decor-call-center', alt: 'Des conseillers au casque, alignés à leur poste, en bleu nuit et violet', position: '70% 35%' }}
        surtitre="Standard téléphonique IA" titre={<>Un standard qui comprend <Eclat>ce qu'on lui dit.</Eclat></>}
        texte="Plus de « tapez 1, tapez 2 » : l'appelant dit ce qu'il veut, l'agent d'accueil répond ou passe l'appel au bon agent, ou à vous."
        actions={<Bouton href="#numero" evenement="phone_number_request">Ouvrir mon numéro</Bouton>}
        preuves={[['tel', 'Un vrai numéro', 'gardé si vous changez'], ['bulle', 'En conversation', 'sans touches'], ['reseau', 'Une extension', 'par agent'], ['visage', 'La main', "à l'humain"]]}
        visuel={<div className="sc-pile">
          <Appel titre="Accueil téléphonique" motif="Demande d'horaires et de devis" phrase="« Bonjour, vous êtes ouverts samedi ? Et je voudrais un devis. »" />
          <Routes />
        </div>} />

      <Scene surtitre="Ce que fait le standard" titre="L'accueil, les transferts, la main à l'humain">
        <Preuves colonnes={3} items={[
          ['tel', 'Un vrai numéro', "Un ou plusieurs numéros pour l'entreprise, gardés si vous changez d'offre."],
          ['bulle', 'Un accueil en conversation', 'Vos horaires, vos scénarios, votre façon de répondre.'],
          ['reseau', 'Une extension par agent', 'Chaque agent a son poste et son service ; il transfère à un collègue.'],
          ['agenda', 'Attente, rappel, messagerie', 'Musique d’attente, rappel proposé, message laissé et résumé.'],
          ['visage', 'La main à l’humain', 'Qui appelle, pourquoi, un résumé : vous prenez, refusez, rappelez, ou laissez l’agent continuer.'],
          ['ecran', 'Partout où vous êtes', 'Le transfert vers la Box, votre ordinateur, votre mobile ou une ligne fixe.'],
        ]} />
      </Scene>

      <Scene id="main-humaine">
        <div className="sc-deux">
          <div>
            <p className="mq-surtitre">La main à l'humain</p>
            <h2 className="sc-h2">Vous savez qui appelle, <Eclat>avant de décrocher</Eclat></h2>
            <p className="sc-texte">L'agent vous passe l'appel avec le motif et un résumé. Vous choisissez : prendre, rappeler, laisser l'agent continuer, ou refuser.</p>
          </div>
          <MainHumaine />
        </div>
      </Scene>

      <Artisan />

      <Scene surtitre="Tarifs" titre="Reception et Reception Pro">
        <OffresVoix ids={['reception', 'reception-pro']} />
      </Scene>
      <Scene id="numero" surtitre="Votre numéro" titre="Ouvrez votre numéro" texte={OUVRIR_LIGNE} etroit>
        <Demande sujet="Standard téléphonique : ouvrir un numéro" evenement="phone_number_request" champs={[
          ['Offre', "L'offre qui vous intéresse", ['Reception', 'Reception Pro']],
          ['Activité', 'Votre activité'],
        ]} />
      </Scene>
      <Voisines ici="standard-telephonique" />
    </>
  );
}

/* ------------------------------------------------------------ support-center */

function CentreSupport() {
  return (
    <>
      <Heros photo={{ src: 'decor-call-center', alt: 'Des conseillers au casque, alignés à leur poste, en bleu nuit et violet', position: '60% 40%' }}
        surtitre="iAgent Support Center" titre={<>Votre SAV au téléphone, <Eclat>plusieurs appels à la fois.</Eclat></>}
        texte="Facturation, commandes, assistance, réclamations : des agents répondent en parallèle, ouvrent le ticket et passent la main à un humain quand il le faut."
        actions={<Bouton href="#devis" evenement="call_center_quote">Dimensionner mon support</Bouton>}
        preuves={[['equipe', 'En parallèle', 'plusieurs appels'], ['doc', 'Un ticket', 'par appel'], ['visage', 'Escalade', 'avec le contexte'], ['graphe', 'Suivi', 'appel par appel']]}
        visuel={<div className="sc-pile">
          <div className="sc-equipe-ligne">{[[19, 'Facturation'], [11, 'Commandes'], [16, 'Assistance']].map(([n, role]) => <Collaborateur key={n} n={n} role={role} statut="En ligne" />)}</div>
          <Ticket />
        </div>} />

      <Scene surtitre="Ce que fait le centre" titre="Des files, des tickets, une escalade claire">
        <Preuves colonnes={3} items={[
          ['equipe', 'Appels simultanés', 'Plusieurs agents décrochent en même temps, sans file d’attente qui s’allonge.'],
          ['rouage', 'Files et priorités', 'Débordement, rappel automatique, priorités par motif.'],
          ['doc', 'Un ticket par appel', 'Le résumé, le motif et la suite à donner, dans votre outil.'],
          ['visage', 'Escalade humaine', 'L’agent transmet avec le contexte : personne ne répète son histoire.'],
          ['graphe', 'Suivi', 'Appels, durée, motifs et coût, appel par appel.'],
          ['serveur', 'La bonne puissance', 'Au-delà de quelques lignes, les appels passent par une plateforme vocale dédiée, pas par la seule Box.'],
        ]} />
      </Scene>

      <Scene id="main-humaine">
        <div className="sc-deux">
          <div>
            <p className="mq-surtitre">Escalade</p>
            <h2 className="sc-h2">Personne ne répète <Eclat>son histoire</Eclat></h2>
            <p className="sc-texte">Quand un humain doit reprendre, l'agent lui transmet le motif, le résumé et le ticket. Exemple ci-contre, avec des données fictives.</p>
          </div>
          <MainHumaine />
        </div>
      </Scene>

      <Scene surtitre="Tarif" titre="Support Center">
        <OffresVoix ids={['support-center', 'voice-enterprise']} />
      </Scene>
      <Scene id="devis" surtitre="Votre support" titre="Décrivez-nous vos appels" texte={OUVRIR_LIGNE} etroit>
        <Demande sujet="Support Center" evenement="call_center_quote" champs={[
          ['Appels', 'Appels par jour', ['Moins de 50', '50 à 200', '200 à 1000', 'Plus de 1000']],
          ['Motifs', 'Motifs les plus fréquents'],
          ['Outil', 'Votre outil de tickets ou de CRM'],
        ]} />
      </Scene>
      <Voisines ici="support-center" />
    </>
  );
}

/* -------------------------------------------------------------- sales-center */

function CentreVentes() {
  return (
    <>
      <Heros photo={{ src: 'decor-sales-center', alt: 'Un plateau commercial : des conseillers au casque passent leurs appels, en bleu nuit et violet', position: '50% 65%' }}
        surtitre="iAgent Sales Center" titre={<>Des campagnes d'appels, <Eclat>dans les règles.</Eclat></>}
        texte="Relances, prises de rendez-vous, suivi de devis : des agents appellent pour vous, dans les plages autorisées et seulement les personnes qui peuvent l'être."
        actions={<Bouton href="#devis" evenement="call_center_quote">Préparer une campagne</Bouton>}
        preuves={[['cible', 'Des campagnes', 'un objectif, un script'], ['crm', 'Votre CRM', 'chaque appel noté'], ['agenda', 'Des relances', 'au bon moment'], ['bouclier', 'Consentement', 'vérifié']]}
        visuel={<div className="sc-pile"><Campagne /><FicheCrm /></div>} />

      <Scene surtitre="Ce que fait le centre" titre="Appeler, noter, relancer">
        <Preuves colonnes={3} items={[
          ['cible', 'Des campagnes', 'Une liste, un objectif, un script que l’agent suit sans réciter.'],
          ['crm', 'Votre CRM', 'Chaque appel noté sur la fiche du contact, avec la suite à donner.'],
          ['agenda', 'Des relances', 'Le rappel au bon moment, le rendez-vous posé dans votre agenda.'],
        ]} />
      </Scene>

      <Scene>
        <div className="sc-deux">
          <div>
            <p className="mq-surtitre">Les règles d'abord</p>
            <h2 className="sc-h2">Aucun appel <Eclat>hors des règles applicables</Eclat></h2>
            <Liste items={['Le consentement est vérifié et conservé.', 'Les listes d’opposition au démarchage sont respectées.', 'Les appels ne partent que dans les plages horaires autorisées.', 'Chaque appel laisse une preuve consultable.']} />
          </div>
          <div>
            <p className="mq-surtitre">Tarif</p>
            <OffresVoix ids={['sales-center']} />
          </div>
        </div>
      </Scene>

      <Scene id="devis" surtitre="Votre campagne" titre="Décrivez-nous votre besoin" texte={OUVRIR_LIGNE} etroit>
        <Demande sujet="Sales Center" evenement="call_center_quote" champs={[
          ['Objectif', 'Objectif des appels', ['Relances de devis', 'Prise de rendez-vous', 'Fidélisation', 'Autre']],
          ['Volume', 'Appels par mois', ['Moins de 500', '500 à 5000', 'Plus de 5000']],
          ['CRM', 'Votre CRM'],
        ]} />
      </Scene>
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

// Each phase: name, scope, portrait, deliverables, roles, the decision that stays human.
const PHASES = [
  ['Étudier', 'Marché, concurrence, faisabilité.', 10, ['Étude de marché', 'Analyse de la concurrence', 'Business plan'], ['Analyste marché', 'Analyste financier'], 'Vous choisissez le projet à poursuivre.'],
  ['Financer', 'Aides, banques, investisseurs.', 15, ['Plan de financement', "Dossiers d'aides", 'Présentation aux investisseurs'], ['Expert financement', 'Juriste'], 'Vous signez avec la banque et les investisseurs.'],
  ['Construire', 'Juridique, achats, produit, marque.', 12, ['Statuts et formalités', 'Achats et fournisseurs', 'Marque et site'], ['Juriste', 'Acheteur', 'Designer'], 'Vous validez les contrats et les dépenses.'],
  ['Lancer', 'Marketing, commercial, communication.', 20, ['Plan marketing', 'Prospection', 'Communication'], ['Responsable marketing', 'Commercial', 'Community manager'], 'Vous approuvez les campagnes avant leur diffusion.'],
  ['Exploiter', 'Finance, relation client, administratif.', 23, ['Comptabilité', 'Relation client', 'Administratif'], ['Assistant comptable', 'Chargé de clientèle', 'Assistant administratif'], 'Vous gardez la direction et les décisions qui engagent.'],
];

// Where the five stage labels sit on the horizon picture (percent of its width and height).
const ETAPES_HORIZON = [['Étudier', 36, 78], ['Financer', 47, 70], ['Construire', 66, 76], ['Lancer', 63, 54], ['Exploiter', 80, 62]];

function Horizon() {
  return (
    <figure className="sc-horizon">
      <img src="/pages/create-horizon.webp" alt="Un entrepreneur regarde la ville au lever du jour ; une courbe lumineuse monte d'étape en étape" width="912" height="520" fetchpriority="high" decoding="async" />
      <ol aria-label="Les cinq phases">
        {ETAPES_HORIZON.map(([nom, x, y], i) => <li key={nom} style={{ left: `${x}%`, top: `${y}%` }}><span>{i + 1}</span>{nom}</li>)}
      </ol>
    </figure>
  );
}

function Creer() {
  return (
    <>
      <Heros decor="lever" surtitre="iAgent Create" titre={<>De l'idée <Eclat>à l'entreprise.</Eclat></>}
        texte="Décrivez votre projet en une phrase : iAgent propose l'équipe d'agents qui l'étudie, le finance, le construit, le lance et le fait tourner."
        actions={<div className="sc-intention-grande sc-plein">
          <IntentInput id="idee-create" exemples={EXEMPLES_IDEES} cta="Composer l'équipe" evenement="create_idea_submit" grand />
          <p className="sc-exemples">Pas d'idée précise ? <a href="/opportunities">Partir d'une opportunité</a></p>
        </div>}
        visuel={<Horizon />} />

      <Scene surtitre="L'entreprise composée" titre={<>L'équipe change <Eclat>à chaque phase</Eclat></>}
        texte="Chaque phase a ses métiers et ses livrables. Vous voyez l'équipe proposée, son abonnement et la consommation estimée avant de recruter ; les décisions qui restent humaines sont dites.">
        <ol className="sc-phases">
          {PHASES.map(([nom, portee, n, livrables, roles, humain], i) => (
            <li key={nom} className="sc-verre">
              <div className="sc-phase-tete"><span className="sc-phase-n">{i + 1}</span><span><b>{nom}</b><small>{portee}</small></span></div>
              <div className="sc-phase-photo"><Visage n={n} alt={`Portrait d'un collaborateur iAgent : ${roles[0]}`} /></div>
              <div className="sc-phase-corps">
                <h4>Livrables</h4>
                <ul>{livrables.map((l) => <li key={l}><Icone nom="doc" taille={14} />{l}</li>)}</ul>
                <h4>L'équipe</h4>
                <ul>{roles.map((r) => <li key={r}><Icone nom="equipe" taille={14} />{r}</li>)}</ul>
                <p className="sc-phase-humain"><b>Décision humaine.</b> {humain}</p>
              </div>
            </li>
          ))}
        </ol>
      </Scene>

      <Scene>
        <div className="sc-deux">
          <div>
            <p className="mq-surtitre">Sans idée précise</p>
            <h2 className="sc-h2">Partir d'une <Eclat>opportunité</Eclat></h2>
            <p className="sc-texte">Nommez un marché qui vous intéresse : l'équipe d'agents l'étudie et rend ce qu'il demande, ses risques et l'équipe qu'il faudrait. Jamais de promesse de rentabilité : des scénarios et leurs hypothèses.</p>
            <div className="sc-actions"><Bouton href="/opportunities" variante="contour-cyan">Voir les opportunités</Bouton></div>
          </div>
          <Radar />
        </div>
      </Scene>

      <Final titre="Ou partez d'un métier" visage={7}>
        <Bouton href={LIENS.catalogue} evenement="catalog_click">Explorer les agents</Bouton>
        <Bouton href={LIENS.entreprise} variante="contour-cyan" evenement="create_company_click">Composer mon équipe</Bouton>
      </Final>
      <Voisines ici="create" />
    </>
  );
}

/* ------------------------------------------------------------- opportunities */

const AXES = ['Marché', 'Demande', 'Concurrence', 'Capital', 'Complexité', 'Délai'];

/** The six axes every study scores; drawn empty, since the study fills them. */
function Radar() {
  const c = 150;
  const point = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
    return [Math.round(c + r * Math.cos(a)), Math.round(c + r * Math.sin(a))];
  };
  return (
    <Exemple titre="Les six axes d'une étude" icone="graphe" mention="Gabarit, sans chiffres">
      <svg className="sc-radar" viewBox="-50 0 400 300" role="img" aria-label={`Les axes notés par chaque étude : ${AXES.join(', ')}`}>
        {[40, 75, 110].map((r) => <polygon key={r} points={AXES.map((_, i) => point(i, r).join(',')).join(' ')} fill="none" stroke="rgba(140,190,255,0.22)" />)}
        {AXES.map((nom, i) => {
          const [x, y] = point(i, 110);
          const [tx, ty] = point(i, 128);
          return (
            <g key={nom}>
              <line x1={c} y1={c} x2={x} y2={y} stroke="rgba(3,243,255,0.35)" />
              <circle cx={x} cy={y} r="3" fill="#03f3ff" />
              <text x={tx} y={ty + 4} textAnchor={Math.abs(tx - c) < 8 ? 'middle' : tx > c ? 'start' : 'end'}>{nom}</text>
            </g>
          );
        })}
      </svg>
    </Exemple>
  );
}

const ONGLETS = [
  ['Synthèse', "Pourquoi maintenant, en une page : ce qui change sur le marché, pour qui, et ce qu'il faudrait réunir."],
  ['Marché', 'La taille du marché, la demande et son évolution, chaque chiffre avec sa source.'],
  ['Concurrence', 'Qui est déjà là, à quel prix, et ce qui reste à prendre.'],
  ['Coûts', 'Le capital de départ, les charges, les canaux d’acquisition.'],
  ['Risques', 'La réglementation à connaître et ce qui peut faire échouer le projet.'],
  ['Équipe', 'Les agents à recruter à chaque phase, et les décisions qui restent humaines.'],
];

function Etude() {
  const [onglet, setOnglet] = useState(0);
  return (
    <Exemple titre="Modèle d'étude d'opportunité" icone="doc" mention="Gabarit, sans chiffres" className="sc-etude">
      <div className="sc-etude-onglets" role="tablist">
        {ONGLETS.map(([nom], i) => <button key={nom} type="button" role="tab" aria-selected={i === onglet} onClick={() => setOnglet(i)}>{nom}</button>)}
      </div>
      <div className="sc-etude-corps" role="tabpanel">
        <div>
          <h3 className="sc-h3">{ONGLETS[onglet][0]}</h3>
          <p className="sc-texte">{ONGLETS[onglet][1]}</p>
        </div>
        <div>
          <h3 className="sc-h3">Trois scénarios</h3>
          <div className="sc-scenarios">
            {['Prudent', 'Central', 'Ambitieux'].map((s) => <div key={s}><b>{s}</b><small>Chiffré par l'étude, hypothèses écrites.</small></div>)}
          </div>
        </div>
        <div>
          <h3 className="sc-h3">L'équipe recommandée</h3>
          <div className="sc-mini-visages">{[10, 15, 12, 20, 23].map((n) => <Visage key={n} n={n} />)}</div>
          <p className="sc-texte sc-petit">Composée selon le projet, phase par phase.</p>
        </div>
      </div>
    </Exemple>
  );
}

function Opportunites() {
  return (
    <>
      <Heros decor="orbite" surtitre="Opportunités" titre={<>Les projets repérés <Eclat>sur le marché.</Eclat></>}
        texte="Une opportunité est une étude : pourquoi maintenant, le marché, la demande, la concurrence, le capital estimé, la complexité, le délai, les risques et l'équipe recommandée. Elle se mène à partir du marché qui vous intéresse."
        actions={<>
          <Bouton href="/create" evenement="opportunity_build_company">Composer mon entreprise à partir d'une idée</Bouton>
          <Bouton href="/create" variante="contour-cyan">J'ai déjà une idée</Bouton>
        </>}
        visuel={<Radar />} />

      <Scene surtitre="Ce que contient chaque étude" titre={<>Une étude, <Eclat>pas une promesse</Eclat></>}
        texte="Nommez un marché ou une idée : l'équipe d'agents composée pour l'étudier en rend les chiffres avec leurs sources et leurs hypothèses. Nous ne publions aucune opportunité dont les chiffres ne sont pas vérifiés.">
        <Etude />
      </Scene>

      <Scene surtitre="Les chapitres" titre="Ce que l'étude vous rend">
        <Preuves colonnes={3} items={[
          ['graphe', 'Trois scénarios', 'Prudent, central, ambitieux, avec leurs hypothèses écrites.'],
          ['pieces', 'Les coûts', 'Le capital de départ, les charges, les canaux d’acquisition.'],
          ['bouclier', 'Les règles', 'La réglementation à connaître avant de se lancer.'],
          ['fusee', "Le plan d'exécution", 'Les jalons, phase par phase.'],
          ['equipe', "L'équipe", 'Les agents à recruter à chaque phase.'],
          ['cible', 'Construire', 'Un bouton pour transformer l’opportunité en projet iAgent.', '/create'],
        ]} />
      </Scene>

      <Final titre="Un marché en tête ?" texte="Dites-le en une phrase, l'équipe se compose." visage={2}>
        <Bouton href="/create" evenement="opportunity_build_company">Composer mon entreprise</Bouton>
      </Final>
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
