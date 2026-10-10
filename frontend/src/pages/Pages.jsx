import donnees from 'virtual:accueil';
import { nombre, LIENS, RECRUTER } from '../accueil/composants.jsx';
import tarifs, { euros, montant, STATUTS, BOX_PUBLIQUES, BOX_DES, prixAgentEnUneLigne } from '../data/tarifs.js';
import { Tete, Bande, Cartes, Etapes, Coches, Voisines, Fin, Bouton, Demande } from './blocs.jsx';
import { COMPOSANTS_BUSINESS } from './PagesBusiness.jsx';
import { ENTREPRISE, HEBERGEUR, adresseEnUneLigne, dirigeantEnClair } from '../data/entreprise.js';

// The offer pages of max's site plan (07/10). Every claim here is one the
// product keeps today, or is said as a plan; every price comes from tarifs.json.

const { compteurs } = donnees;
const metiers = nombre(compteurs.fiches);
const logiciels = nombre(compteurs.logiciels);

const Statut = ({ s }) => <span className="pg-statut">{STATUTS[s] ?? s}</span>;

/* ---------------------------------------------------------------- workforce */

function Workforce() {
  return (
    <>
      <Tete surtitre="iAgent Workforce" titre={<>Un collaborateur numérique managé.<br /><span className="mq-cyan">Pas un agent à programmer.</span></>}
        texte="iAgent réunit quatre pièces : des agents par métier, la Box installée dans votre entreprise, Desktop Commander pour les diriger, et la consommation d'IA, toujours facturée à part.">
        <Bouton href={LIENS.entreprise} evenement="create_company_click">Composer mon équipe</Bouton>
        <Bouton href="/contact" variante="contour-cyan">Demander une démo</Bouton>
      </Tete>
      <Bande surtitre="La formule" titre="Box + agents + Commander + consommation">
        <Cartes colonnes={4} items={[
          ['ecran', 'La Box', 'Le poste de travail de vos agents, chez vous : écran tactile, voix, micro.', '/box'],
          ['equipe', 'Les agents', `${metiers} métiers, chacun réglé sur votre secteur et votre activité.`, LIENS.catalogue],
          ['graphe', 'Desktop Commander', "L'interface où vous dirigez l'équipe, suivez son travail et validez.", '/#desktop-commander'],
          ['eclair', 'La consommation', "Les appels d'IA, la voix, les services tiers : au réel, à part de l'abonnement.", '/pricing'],
        ]} />
      </Bande>
      <section className="mq-bande mq-deux pg-bande">
        <div>
          <p className="mq-surtitre">Pourquoi la Box</p>
          <h2 className="mq-titre">Une présence physique dans vos bureaux</h2>
          <Coches items={['On parle aux agents à voix haute, on les appelle par leur prénom.', "L'écran tactile se commande au doigt, sans formation.", 'Le travail peut tourner sur place, avec vos données.', 'Elle est préparée, maintenue et mise à jour par iAgent.']} />
        </div>
        <div>
          <p className="mq-surtitre">Pourquoi les agents</p>
          <h2 className="mq-titre">Un métier, pas un outil générique</h2>
          <Coches items={[`${metiers} métiers décrits tâche par tâche.`, `${logiciels} logiciels du marché européen dans le référentiel.`, "Un entretien d'embauche à l'oral : l'agent apprend votre entreprise.", 'Maintenus et enrichis au fil des versions.']} />
        </div>
      </section>
      <section className="mq-bande mq-deux pg-bande">
        <div>
          <p className="mq-surtitre">Pourquoi Commander</p>
          <h2 className="mq-titre">Superviser, autoriser, coordonner</h2>
          <Coches items={['Chaque agent n’ouvre que ce que vous lui confiez.', 'Vous décidez des tâches qui attendent votre accord.', 'Le chef d’équipe coordonne les autres agents pour vous.', 'Chaque action et chaque envoi sont consignés.']} />
        </div>
        <div>
          <p className="mq-surtitre">Pourquoi louer</p>
          <h2 className="mq-titre">Ce qu'il faudrait reconstruire soi-même</h2>
          <Coches items={['Choisir et faire tourner les modèles d’IA.', 'Écrire les consignes de chaque métier, tâche par tâche.', 'Brancher vos logiciels, un par un.', 'Dimensionner une machine, la tenir à jour, la réparer.']} />
          <p className="mq-texte pg-texte">Avec iAgent, c'est compris dans l'abonnement.</p>
        </div>
      </section>
      <Bande surtitre="Local, cloud ou hybride" titre="Là où vos données doivent rester"
        texte="Vos agents passent par l'API d'IA, travaillent sur une machine chez vous, ou les deux selon la tâche. Pour une forte puissance locale, l'infrastructure se conçoit sur devis.">
        <Bouton href="/local-ai" variante="contour-cyan">IA locale et hybride</Bouton>
      </Bande>
      <Bande surtitre="Les packs" titre="De la première embauche au service entier">
        <Packs />
      </Bande>
      <Fin titre="Composez votre équipe">
        <Bouton href={LIENS.entreprise} evenement="create_company_click">Composer mon équipe</Bouton>
        <Bouton href="/contact" variante="contour-cyan">Demander une démo</Bouton>
      </Fin>
      <Voisines ici="workforce" />
    </>
  );
}

function Packs() {
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

/* ---------------------------------------------------------------------- box */

function Box() {
  return (
    <>
      <Tete surtitre="iAgent Box" titre={<>Votre équipe IA,<br /><span className="mq-cyan">installée dans votre entreprise.</span></>}
        texte={`Un poste préparé pour vos agents, que vous branchez et qui travaille. Le matériel est mis à disposition sous abonnement, à partir de ${euros(BOX_DES.mensuel)} par mois.`}>
        <Bouton href="/pricing" evenement="box_click">Voir les tarifs</Bouton>
        <Bouton href="/contact" variante="contour-cyan" evenement="box_quote">Demander un devis Box</Bouton>
      </Tete>
      <Bande surtitre="L'expérience" titre="Brancher, et travailler">
        <Etapes items={[
          ['Brancher', 'La Box arrive préparée : on la relie au réseau de l’entreprise.'],
          ['Se connecter', 'Vous ouvrez vos comptes vous-même, une fois, dans le navigateur de la Box.'],
          ['Appeler les agents', 'Par leur prénom, à la voix ou au doigt sur l’écran.'],
          ['Travailler', 'Les agents font leurs tâches et déposent les résultats dans vos dossiers.'],
        ]} />
      </Bande>
      <section className="mq-bande mq-deux pg-bande">
        <div>
          <p className="mq-surtitre">Dans la Box</p>
          <h2 className="mq-titre">Tout ce qu'il faut pour parler à son équipe</h2>
          <Coches items={['Un mini-PC préparé en usine pour vos agents.', 'Un écran tactile, pensé pour le doigt.', 'Une enceinte et un micro de conférence.', 'Un clavier et une souris de secours.', 'Desktop Commander, installé et prêt.']} />
        </div>
        <div>
          <p className="mq-surtitre">Le service</p>
          <h2 className="mq-titre">Mise à disposition, pas achat</h2>
          <Coches items={['La Box reste à iAgent et se rend en fin de contrat.', 'Mises à jour automatiques des agents et de l’application.', 'Diagnostic et maintenance selon votre contrat.', 'Jusqu’à 20 agents par Box ; au-delà, une deuxième Box.']} />
        </div>
      </section>
      <Bande surtitre="Tarif" titre="L'abonnement de la Box" texte="Il s'ajoute à l'abonnement de vos agents et à la consommation, toujours affichés à part.">
        <ul className="pg-prix">
          {BOX_PUBLIQUES.map((b) => (
            <li key={b.id}>
              <b>{b.nom}</b>
              <small>Engagement {b.engagementMois} mois, matériel compris</small>
              <strong>{euros(b.mensuel)}<em> HT / mois</em></strong>
              <Statut s={b.statut} />
            </li>
          ))}
        </ul>
      </Bande>
      <Bande surtitre="Plus de puissance" titre="Des agents nombreux, des images, des données sensibles ?"
        texte="La Box fait travailler vos agents surtout par l'API d'IA. Pour faire tourner les modèles chez vous à grande échelle, nous concevons l'infrastructure sur devis.">
        <Bouton href="/local-ai" variante="contour-cyan">IA locale et hybride</Bouton>
      </Bande>
      <Fin titre="Installez votre équipe">
        <Bouton href="/pricing" evenement="box_click">Voir les tarifs</Bouton>
        <Bouton href={LIENS.catalogue} variante="contour-cyan" evenement="catalog_click">Explorer les agents</Bouton>
      </Fin>
      <Voisines ici="box" />
    </>
  );
}

/* ------------------------------------------------------------------ pricing */

function Tarifs() {
  const a = tarifs.agents;
  const c = tarifs.commander;
  return (
    <>
      <Tete surtitre="Tarifs" titre={<>Un abonnement fixe.<br /><span className="mq-cyan">Une consommation à part.</span></>}
        texte={`Vous payez la Box, vos agents et, au-delà de quelques agents, le Task Commander. L'usage de l'IA se paie au réel, à part. Prix hors taxes, ${STATUTS[tarifs.statut]?.toLowerCase() ?? tarifs.statut}.`} />
      <Bande surtitre="La Box" titre="Le poste de vos agents">
        <ul className="pg-prix">
          {BOX_PUBLIQUES.map((b) => (
            <li key={b.id}><b>{b.nom}</b><small>Engagement {b.engagementMois} mois, matériel compris</small><strong>{euros(b.mensuel)}<em> / mois</em></strong><Statut s={b.statut} /></li>
          ))}
        </ul>
      </Bande>
      <Bande surtitre="Les agents" titre="L'abonnement de chaque agent">
        {a.affichage === 'paliers' && (
          <ul className="pg-prix">
            {a.paliers.map((p) => <li key={p.id}><b>Agent {p.nom}</b><small>Par agent</small><strong>{euros(p.mensuel)}<em> / mois</em></strong><Statut s={p.statut} /></li>)}
          </ul>
        )}
        {a.affichage === 'unique' && (
          <ul className="pg-prix">
            <li><b>Un agent</b><small>Par agent</small><strong>{euros(a.unique.mensuel)}<em> / mois</em></strong><Statut s={a.unique.statut} /></li>
          </ul>
        )}
        {a.affichage === 'devis' && <p className="mq-texte pg-texte">Le prix des agents se fixe sur devis.</p>}
      </Bande>
      <Bande surtitre="Task Commander" titre="Le chef d'équipe de vos agents">
        <ul className="pg-prix">
          <li><b>{c.nom}</b><small>Inclus à partir de {c.inclusAPartirDe} agents</small><strong>{montant(c)}<em> / mois</em></strong><Statut s={c.statut} /></li>
        </ul>
      </Bande>
      <Bande surtitre="Les packs" titre="Box, agents et Commander ensemble">
        <Packs />
      </Bande>
      <Bande surtitre="La consommation" titre="Ce qui se paie à l'usage" texte={tarifs.consommation.phrase}>
        <Coches items={["Vous voyez l'estimation avant de vous engager : chaque fiche d'agent l'annonce.", 'L’application vous prévient avant de passer une tâche du local à l’API.']} />
      </Bande>
      <Fin titre="Choisir une formule">
        <Bouton href="/contact" evenement="plan_select">Choisir ma formule</Bouton>
        <Bouton href="/enterprise" variante="contour-cyan" evenement="enterprise_click">iAgent Enterprise</Bouton>
        <Bouton href={LIENS.catalogue} variante="contour-cyan" evenement="catalog_click">Explorer les agents</Bouton>
      </Fin>
      <Voisines ici="pricing" />
    </>
  );
}

/* ------------------------------------------------------------- how-it-works */

function CommentCaMarche() {
  return (
    <>
      <Tete surtitre="Comment ça marche" titre={<>Du recrutement<br /><span className="mq-cyan">au travail.</span></>}
        texte="Vous n'avez rien à paramétrer : vous dites ce que vous voulez accomplir, vous recrutez, et l'agent apprend votre entreprise en conversation.">
        <Bouton href={LIENS.catalogue} evenement="catalog_click">Explorer les agents</Bouton>
        <Bouton href="/contact" variante="contour-cyan">Parler à un conseiller</Bouton>
      </Tete>
      <Bande surtitre="Le parcours" titre="Sept étapes, dont une seule technique : brancher">
        <Etapes items={[
          ['Votre besoin', 'Vous cherchez un métier, ou vous décrivez un objectif : iAgent propose les agents.'],
          ['Votre équipe', 'Vous choisissez un agent ou une équipe entière.'],
          ['Votre installation', 'Sans Box, avec une Box, ou une infrastructure locale sur devis.'],
          ["L'entretien d'embauche", "À l'oral : vos logiciels, vos horaires, ce qui doit attendre votre accord."],
          ['Le prix', "Abonnement des agents, de la Box et estimation de consommation, avant tout engagement."],
          ['La préparation', 'Le contrat signé, la Box est préparée et vos agents y sont installés.'],
          ['La mise en service', 'Vous branchez, vous vous connectez à vos comptes, l’équipe se met au travail.'],
        ]} />
      </Bande>
      <Fin titre="Commencez par le besoin">
        <Bouton href="/#commencer" evenement="hero_start">Que voulez-vous accomplir ?</Bouton>
        <Bouton href="/pricing" variante="contour-cyan">Voir les tarifs</Bouton>
      </Fin>
      <Voisines ici="how-it-works" />
    </>
  );
}

/* ----------------------------------------------------------------- local-ai */

function IALocale() {
  return (
    <>
      <Tete surtitre="IA locale et hybride" titre={<>La puissance chez vous,<br /><span className="mq-cyan">quand vous en avez besoin.</span></>}
        texte="iAgent fait tourner vos agents par l'API d'IA, sur une machine dans vos bureaux, ou entre les deux. Une infrastructure locale se dimensionne avec vous, sur devis.">
        <Bouton href="#dimensionner" evenement="local_ai_quote_start">Dimensionner mon infrastructure</Bouton>
      </Tete>
      <Bande surtitre="Pourquoi exécuter localement" titre="Cinq bonnes raisons">
        <Cartes colonnes={3} items={[
          ['cadenas', 'Confidentialité', 'Les documents restent dans vos murs.'],
          ['eclair', 'Latence', 'Pas d’aller-retour par Internet pour chaque tâche.'],
          ['cle', 'Contrôle', 'Vous savez où tourne chaque modèle.'],
          ['graphe', 'Coût à grande échelle', 'Au-delà d’un certain volume, la machine coûte moins que l’API.'],
          ['serveur', 'Continuité', 'Le travail continue même si un service en ligne s’arrête.'],
        ]} />
      </Bande>
      <Bande surtitre="Trois façons de travailler" titre="Cloud, local ou hybride">
        <Cartes colonnes={3} items={[
          ['nuage', 'Cloud', "Sans machine de calcul : les agents passent par l'API d'IA."],
          ['serveur', 'Local', 'Les modèles tournent chez vous ; rien ne sort pour être traité.'],
          ['hybride', 'Hybride', "Le quotidien en local, l'API pour ce que la machine ne porte pas. Vous êtes prévenu avant."],
        ]} />
      </Bande>
      <Bande surtitre="Cas d'usage" titre="Quand la puissance locale se justifie">
        <Coches items={['Beaucoup d’agents qui travaillent toute la journée.', 'Des agents image ou vidéo.', 'Des données sensibles ou réglementées.', 'Des tâches récurrentes à fort volume.', 'Des exigences de rapidité.']} />
      </Bande>
      <Bande surtitre="Les familles de puissance" titre="Du poste de commande au serveur"
        texte="Chaque infrastructure se compose à partir de ces familles, dimensionnée sur vos agents et vos volumes.">
        <Cartes colonnes={4} items={[
          ['ecran', 'Poste de commande', 'La Box : vos agents par API.'],
          ['puce', 'Mémoire unifiée', 'Un boîtier compact pour les modèles de texte.'],
          ['eclair', 'Carte graphique dédiée', 'Pour les agents nombreux et les images.'],
          ['serveur', 'Serveur', 'Plusieurs cartes, pour une entreprise entière.'],
        ]} />
      </Bande>
      <Bande id="dimensionner" surtitre="Dimensionner" titre="Parlez à un architecte iAgent">
        <Demande sujet="Dimensionner mon infrastructure" evenement="local_ai_contact" champs={[
          ["Nombre d'agents", "Nombre d'agents", ['1 à 5', '6 à 20', '21 à 50', 'Plus de 50']],
          ['Types de tâches', 'Types de tâches', ['Texte et documents', 'Images ou vidéo', 'Voix et téléphone', 'Un peu de tout']],
          ['Logiciels', 'Vos logiciels principaux'],
          ['Volume', 'Volume de travail', ['Quelques tâches par jour', 'Des dizaines par jour', 'Des centaines par jour']],
          ['Données', 'Exigences sur les données', ['Aucune particulière', 'Données sensibles', 'Données réglementées']],
          ['Sites', 'Sites', ['Un seul site', 'Plusieurs sites']],
        ]} />
      </Bande>
      <Voisines ici="local-ai" />
    </>
  );
}

/* ----------------------------------------------------------------- security */

function Securite() {
  return (
    <>
      <Tete surtitre="Sécurité et contrôle" titre={<>Autonome ne signifie pas<br /><span className="mq-cyan">incontrôlé.</span></>}
        texte="Un agent iAgent travaille seul, dans les limites que vous fixez. Ces limites sont tenues par l'application, pas par une consigne au modèle." />
      <section className="mq-bande mq-deux pg-bande">
        <div>
          <p className="mq-surtitre">Des permissions</p>
          <h2 className="mq-titre">Chaque agent n'ouvre que ce qu'on lui confie</h2>
          <Coches items={['Ce qu’un agent peut atteindre se déduit de son métier, jamais de l’écran.', 'Un outil qui modifie quelque chose demande votre clic.', 'Par défaut, l’agent ne lit et n’écrit que dans son propre dossier.', 'Aucun envoi d’e-mail sans que le texte exact ait été relu.']} />
        </div>
        <div>
          <p className="mq-surtitre">Le client contrôle le travail</p>
          <h2 className="mq-titre">Vous voyez tout, vous reprenez la main</h2>
          <Coches items={['Vous mettez sous contrôle les tâches de votre choix.', 'Chaque appel d’outil, abouti ou refusé, est consigné.', 'Chaque e-mail envoyé est consigné.', 'Un réglage du chef d’équipe s’annule en un geste.']} />
        </div>
      </section>
      <section className="mq-bande mq-deux pg-bande">
        <div>
          <p className="mq-surtitre">Vos données restent les vôtres</p>
          <h2 className="mq-titre">Ce que l'agent apprend de vous reste chez vous</h2>
          <Coches items={['Vos clés d’API restent sur votre poste, dans le coffre du système.', 'Les résultats s’écrivent dans vos dossiers.', 'Vous choisissez, tâche par tâche, ce qui passe par l’API et ce qui reste en local.']} />
        </div>
        <div>
          <p className="mq-surtitre">Un environnement managé</p>
          <h2 className="mq-titre">iAgent protège le savoir-faire</h2>
          <Coches items={['La Box est préparée et tenue à jour par iAgent.', 'Pas de connexion automatique à vos comptes : vous vous connectez vous-même.']} />
        </div>
      </section>
      <Fin titre="Des questions de sécurité précises ?">
        <Bouton href="/contact">Nous écrire</Bouton>
        <Bouton href="/faq" variante="contour-cyan">Questions fréquentes</Bouton>
      </Fin>
      <Voisines ici="security" />
    </>
  );
}

/* ------------------------------------------------------------------- skills */

function Evolution() {
  return (
    <>
      <Tete surtitre="Des agents qui évoluent" titre={<>Vous ne louez pas un logiciel figé.<br /><span className="mq-cyan">Vous employez une compétence qui continue d'évoluer.</span></>}
        texte="L'abonnement comprend la maintenance et l'évolution de chaque agent : de nouvelles méthodes, de nouveaux logiciels, de nouveaux connecteurs, installés sans que vous ayez rien à faire." />
      <Bande surtitre="Skill Packs" titre="Ce qu'un agent apprend en route">
        <Cartes colonnes={4} items={[
          ['doc', 'Compétences métier', 'Le savoir de son poste, tâche par tâche.'],
          ['rouage', 'Procédures', 'Les façons de faire validées dans le métier.'],
          ['reseau', 'Connecteurs', 'Les logiciels qu’il sait rejoindre.'],
          ['coche', 'Méthodes validées', 'Ce qui a marché chez d’autres, sans leurs données.'],
        ]} />
      </Bande>
      <Bande surtitre="Aujourd'hui" titre="Ce que chaque fiche montre déjà"
        texte={`Les ${metiers} fiches décrivent les missions de chaque métier et les logiciels qu'il sait tenir, parmi ${logiciels} logiciels du référentiel. La version, les nouveautés et les logiciels certifiés s'y ajouteront à mesure qu'ils seront mesurés.`}>
        <Bouton href={LIENS.catalogue} variante="contour-cyan" evenement="catalog_click">Explorer les métiers</Bouton>
      </Bande>
      <Bande surtitre="Mises à jour" titre="Sans rien faire de votre côté"
        texte="L'application et les agents se mettent à jour d'eux-mêmes. Un agent qui demanderait une version plus récente de l'application le dit en clair au lieu de s'arrêter sans explication." />
      <Voisines ici="skills" />
    </>
  );
}

/* ----------------------------------------------------- iagent-inside-iagent */

const POLES = ['Tech', 'Growth', 'Sales', 'Customer Success', 'Finance', 'Communication', 'Research'];

function InsideIAgent() {
  return (
    <>
      <Tete surtitre="iAgent inside iAgent" titre={<>La première entreprise que nous faisons fonctionner avec iAgent<br /><span className="mq-cyan">est la nôtre.</span></>}
        texte="Nous organisons notre propre entreprise autour d'une équipe d'agents, sous une direction humaine. Ce que nous vendons, nous l'employons d'abord." />
      <Bande surtitre="L'organisation" titre="Une direction humaine, un chef d'équipe, sept pôles">
        <div className="pg-organigramme" role="img" aria-label={`Direction humaine, puis Task Commander, puis les pôles ${POLES.join(', ')}`}>
          <p className="pg-noeud pg-humain">Direction humaine</p>
          <p className="pg-noeud pg-commander">Task Commander</p>
          <ul>{POLES.map((p) => <li key={p} className="pg-noeud">{p}</li>)}</ul>
        </div>
      </Bande>
      <Bande surtitre="Les chiffres" titre="Mesurés, ou absents"
        texte="Agents actifs, missions menées, opérations supervisées : ces chiffres s'afficheront ici quand ils seront mesurés. Aucun n'est inventé en attendant." />
      <Fin titre="Construisez la vôtre">
        <Bouton href={LIENS.entreprise} evenement="create_company_click">Construire mon équipe</Bouton>
        <Bouton href="/workforce" variante="contour-cyan">iAgent Workforce</Bouton>
      </Fin>
      <Voisines ici="iagent-inside-iagent" />
    </>
  );
}

/* --------------------------------------------------------------- enterprise */

function Enterprise() {
  return (
    <>
      <Tete surtitre="iAgent Enterprise" titre={<>Un déploiement<br /><span className="mq-cyan">conçu avec vous.</span></>}
        texte="Pour les entreprises qui veulent plusieurs équipes, plusieurs sites, ou leur propre puissance de calcul : nous concevons l'installation, les intégrations et le contrat sur mesure.">
        <Bouton href="#demande" evenement="enterprise_quote_start">Parler à iAgent Enterprise</Bouton>
      </Tete>
      <Bande surtitre="Ce que nous concevons ensemble" titre="Au-delà d'une Box">
        <Cartes colonnes={4} items={[
          ['equipe', 'Plusieurs Box', 'Une équipe par service, par site ou par personne.'],
          ['serveur', 'Puissance locale', 'Vos modèles chez vous, dimensionnés sur vos volumes.', '/local-ai'],
          ['erp', 'Intégrations', 'Vos logiciels métier, ERP et CRM, branchés à vos agents.'],
          ['doc', 'Contrat sur mesure', 'Prix, niveau de service et accompagnement propres à votre entreprise.'],
        ]} />
      </Bande>
      <Bande id="demande" surtitre="Votre projet" titre="Décrivez-nous votre déploiement">
        <Demande sujet="iAgent Enterprise" evenement="enterprise_contact" champs={[
          ['Taille', "Taille de l'entreprise", ['Moins de 10 personnes', '10 à 50', '50 à 250', 'Plus de 250']],
          ["Nombre d'agents", "Nombre d'agents envisagé", ['Moins de 10', '10 à 50', 'Plus de 50']],
          ['Sites', 'Sites', ['Un seul site', 'Plusieurs sites']],
          ['Logiciels', 'Vos logiciels principaux'],
        ]} />
      </Bande>
      <Voisines ici="enterprise" />
    </>
  );
}

/* ---------------------------------------------------------------------- faq */

const QUESTIONS = [
  ["Faut-il savoir utiliser l'IA ?", "Non. Vous dites ce que vous voulez accomplir ; l'agent pose ses questions à l'oral pendant l'entretien d'embauche et règle le reste."],
  ['Que coûte un agent ?', () => `Son abonnement est ${prixAgentEnUneLigne()}, hors taxes. La Box et la consommation d'IA s'ajoutent, toujours affichées à part.`],
  ['Que se passe-t-il en fin de contrat ?', 'La Box est mise à disposition : elle se rend en fin de contrat. Vos fichiers, eux, sont dans vos dossiers.'],
  ['Mes données quittent-elles l’entreprise ?', "En local, rien ne sort pour être traité. Par l'API, seul ce que la tâche demande part au fournisseur d'IA. Vous choisissez la voie, et l'application vous prévient avant de basculer."],
  ['Un agent peut-il agir sans moi ?', "Oui, s'il est réglé ainsi : il travaille seul, sauf sur les tâches que vous mettez sous contrôle. Aucun e-mail ne part sans que vous ayez relu le texte exact."],
  ['Combien d’agents par Box ?', "Jusqu'à 20. Au-delà, une deuxième Box, ou une infrastructure sur devis."],
  ['Les agents répondent-ils sur WhatsApp ou au téléphone ?', "Pas encore : la voix et l'e-mail fonctionnent, WhatsApp et le téléphone arrivent bientôt."],
  ['Sur quel système tourne l’application ?', 'Desktop Commander tourne sous Windows ; la Box est livrée avec.'],
];

function Faq() {
  return (
    <>
      <Tete surtitre="Questions fréquentes" titre={<>Les réponses<br /><span className="mq-cyan">avant de recruter.</span></>} />
      <Bande>
        <div className="pg-faq">
          {QUESTIONS.map(([q, r]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{typeof r === 'function' ? r() : r}</p>
            </details>
          ))}
        </div>
      </Bande>
      <Fin titre="Une autre question ?">
        <Bouton href="/contact">Nous écrire</Bouton>
      </Fin>
      <Voisines ici="faq" />
    </>
  );
}

/* ------------------------------------------------------------------ contact */

function Contact() {
  return (
    <>
      <Tete surtitre="Contact et démonstration" titre={<>Dites-nous ce que vous<br /><span className="mq-cyan">voulez accomplir.</span></>}
        texte="Une démonstration, une équipe à composer, une infrastructure à dimensionner : nous revenons vers vous." />
      <Bande>
        <Demande sujet="Demande de contact" champs={[['Objet', 'Votre demande', ['Une démonstration', 'Composer une équipe', 'Une infrastructure locale', 'iAgent Enterprise', 'Autre chose']]]} />
      </Bande>
      <Fin titre="Ou découvrez d'abord comment on recrute">
        <a href={RECRUTER} className="bouton bouton-contour">Comment recruter un agent</a>
      </Fin>
    </>
  );
}

/* --------------------------------------------------------- mentions légales */

function MentionsLegales() {
  const e = ENTREPRISE;
  const editeur = [
    ['Raison sociale', e.nom],
    ['Forme juridique', e.formeJuridique && (e.capital ? `${e.formeJuridique} au capital de ${e.capital}` : e.formeJuridique)],
    ['Siège', adresseEnUneLigne()],
    ['SIRET', e.siret ?? (e.immatriculation && `Immatriculation ${e.immatriculation}`)],
    ['RCS', e.rcs],
    ['TVA intracommunautaire', e.tva],
    ['Téléphone', <a href={`tel:${e.telephoneInternational}`}>{e.telephone}</a>],
    ['E-mail', e.email && <a href={`mailto:${e.email}`}>{e.email}</a>],
  ].filter(([, v]) => v);
  const Liste = ({ lignes }) => (
    <dl className="pg-mentions">
      {lignes.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
  return (
    <>
      <Tete surtitre="Mentions légales" titre={<>Qui édite<br /><span className="mq-cyan">iagent.agency.</span></>} />
      <Bande titre="Éditeur du site">
        <Liste lignes={editeur} />
      </Bande>
      <Bande titre="Directeur de la publication">
        <Liste lignes={[['Nom', dirigeantEnClair()], ['Fonction', `${e.dirigeant.fonction} de ${e.nom}`]]} />
      </Bande>
      <Bande titre="Hébergeur">
        <Liste lignes={[['Société', HEBERGEUR.nom], ['Adresse', HEBERGEUR.adresse], ['Site', <a href={HEBERGEUR.site}>{HEBERGEUR.site.replace('https://', '')}</a>]]} />
      </Bande>
      <Bande titre="Vos données">
        <p className="pg-texte">Ce que vous écrivez dans un formulaire du site sert uniquement à vous répondre. Rien n'est vendu ni cédé. Vous pouvez demander à consulter, corriger ou effacer ces informations en écrivant à {e.nom}, {adresseEnUneLigne()}{e.email ? `, ou à ${e.email}` : ''}, et saisir la CNIL si la réponse ne vous convient pas.</p>
      </Bande>
      <Bande titre="Propriété intellectuelle">
        <p className="pg-texte">Les textes, images, fiches métier et la marque {e.marque} appartiennent à {e.nom}. Toute reproduction demande notre accord écrit.</p>
      </Bande>
    </>
  );
}

export const COMPOSANTS = {
  workforce: Workforce,
  box: Box,
  pricing: Tarifs,
  'how-it-works': CommentCaMarche,
  'local-ai': IALocale,
  security: Securite,
  skills: Evolution,
  'iagent-inside-iagent': InsideIAgent,
  enterprise: Enterprise,
  faq: Faq,
  contact: Contact,
  'mentions-legales': MentionsLegales,
  ...COMPOSANTS_BUSINESS,
};
