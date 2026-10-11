import donnees from 'virtual:accueil';
import { nombre, LIENS, RECRUTER, Fleche } from '../accueil/composants.jsx';
import tarifs, { euros, montant, STATUTS, BOX_PUBLIQUES, BOX_DES, prixAgentEnUneLigne } from '../data/tarifs.js';
import { Tete, Bande, Cartes, Etapes, Coches, Voisines, Fin, Bouton, Demande } from './blocs.jsx';
import { COMPOSANTS_BUSINESS } from './PagesBusiness.jsx';
import { Workforce, Box, Tarifs, CommentCaMarche, IALocale, Securite, Faq } from './PagesOffre.jsx';
import { useEffect, useState } from 'react';
import { lireListe, ecouterListe, totaux, lignesPourPaiement, listeEnTexte, changerAgent, retirerAgent, choisirBox, viderListe, nombreDAgents, PALIERS, BOX_EN_VENTE } from '../data/liste.js';
import { ENTREPRISE, HEBERGEUR, adresseEnUneLigne, dirigeantEnClair } from '../data/entreprise.js';

// The offer pages of max's site plan (07/10). Every claim here is one the
// product keeps today, or is said as a plan; every price comes from tarifs.json.

const { compteurs } = donnees;
const metiers = nombre(compteurs.fiches);
const logiciels = nombre(compteurs.logiciels);

const Statut = ({ s }) => <span className="pg-statut">{STATUTS[s] ?? s}</span>;

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
      <Bande surtitre="Les fiches" titre="Ce que chaque fiche montre"
        texte={`Les ${metiers} fiches décrivent les missions de chaque métier, ce qui attend votre accord et les logiciels qu'il sait tenir, parmi ${logiciels} logiciels du référentiel.`}>
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
      <Bande surtitre="Les chiffres" titre="Mesurés, jamais inventés"
        texte={`Chaque chiffre publié sur ce site est compté dans le catalogue au moment de sa publication : ${nombre(compteurs.fiches)} métiers, ${nombre(compteurs.activites)} activités, ${nombre(compteurs.logiciels)} logiciels. Nous ne publions aucun chiffre d'usage que nous n'avons pas mesuré.`} />
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

/* -------------------------------------------------------------- recrutement */

// The recruitment list (max, 10/10): the agents recruited from their fiches,
// the Box Commander, each price on its own line. Validating pays online when
// the payment is open (/api/paiement, PR « Paiement Stripe »), and sends the
// list as a quote request otherwise. Nothing is downloaded.
function ListeRecrutement() {
  const [l, setL] = useState(null);
  const [paiement, setPaiement] = useState(false);
  const [retour, setRetour] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    setL(lireListe());
    const q = new URLSearchParams(window.location.search);
    // Back from Stripe: the list is emptied only once the server says the
    // session is paid; a return address alone proves nothing.
    if (q.get('paiement') === 'reussi' && q.get('session')) {
      setRetour('verification');
      fetch(`/api/paiement/session?id=${encodeURIComponent(q.get('session'))}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => { if (s?.paye) { viderListe(); setRetour('reussi'); } else setRetour('en-attente'); })
        .catch(() => setRetour('en-attente'));
    } else if (q.get('paiement') === 'annule') setRetour('annule');
    fetch('/api/paiement/etat').then((r) => (r.ok ? r.json() : null)).then((e) => setPaiement(e?.paiement === true)).catch(() => setPaiement(false));
    return ecouterListe(setL);
  }, []);
  const t = l ? totaux(l) : null;
  const vide = l && !l.agents.length && !l.box;
  const payer = async () => {
    setErreur(null); setEnvoi(true);
    try {
      const r = await fetch('/api/paiement/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lignesPourPaiement(l)) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      setErreur(d.erreur ?? "Le paiement en ligne n'a pas pu s'ouvrir. Envoyez la liste en demande de devis ci-dessous.");
      if (d.devis) setPaiement(false);
    } catch {
      setErreur("Le paiement en ligne n'a pas pu s'ouvrir. Envoyez la liste en demande de devis ci-dessous.");
    }
    setEnvoi(false);
  };
  return (
    <>
      <Tete surtitre="Recrutement" titre={<>Votre liste<br /><span className="mq-cyan">de recrutement.</span></>}
        texte="Les agents que vous recrutez, votre Box Commander, chaque prix sur sa ligne. Validez, et nous préparons votre équipe." />
      {retour === 'reussi' && <Bande><p className="pg-note" role="status">Paiement reçu. Nous vous écrivons pour préparer votre Box et l'entretien d'embauche de vos agents.</p></Bande>}
      {retour === 'verification' && <Bande><p className="pg-note" role="status">Vérification de votre paiement…</p></Bande>}
      {retour === 'en-attente' && <Bande><p className="pg-note" role="status">Votre paiement n'est pas encore confirmé. Votre liste reste ici ; nous vous écrivons dès qu'il l'est.</p></Bande>}
      {retour === 'annule' &&<Bande><p className="pg-note" role="status">Paiement annulé : rien n'a été prélevé, votre liste est toujours là.</p></Bande>}
      {l && (vide ? (
        <Bande titre="Votre liste est vide">
          <p className="pg-texte">Ouvrez la fiche d'un métier et choisissez « Recruter cet agent » : il s'ajoute ici.</p>
          <div className="mt-6"><Bouton href={LIENS.catalogue} evenement="catalog_click">Choisir dans le catalogue</Bouton></div>
        </Bande>
      ) : (
        <>
          <Bande titre={`Vos agents (${nombreDAgents(l)})`}>
            <ul className="pg-liste">
              {l.agents.map((a, i) => (
                <li key={`${a.fiche}-${i}`} className="pg-ligne">
                  <div className="pg-ligne-nom">
                    <a href={a.slug ? `/catalogue?fiche=${encodeURIComponent(a.slug)}` : '/catalogue'}><b>{a.nom}</b></a>
                    <span>{a.secteur}</span>
                    <label className="pg-ligne-activite"><span>Votre activité</span>
                      <input list={`activites-${i}`} value={a.activite ?? ''} placeholder="Par exemple : imprimerie offset" onChange={(e) => changerAgent(i, { activite: e.target.value.slice(0, 160) || null })} />
                      <datalist id={`activites-${i}`}>{(a.suggestions ?? []).map((s) => <option key={s} value={s} />)}</datalist>
                    </label>
                  </div>
                  {PALIERS.length > 0 && (
                    <label className="pg-ligne-champ"><span>Formule</span>
                      <select value={a.palier ?? ''} onChange={(e) => changerAgent(i, { palier: e.target.value })}>
                        {PALIERS.map((p) => <option key={p.id} value={p.id}>{p.nom} · {euros(p.mensuel)} HT/mois</option>)}
                      </select>
                    </label>
                  )}
                  <label className="pg-ligne-champ pg-ligne-n"><span>Nombre</span>
                    <input type="number" min="1" max="20" value={a.quantite ?? 1} onChange={(e) => changerAgent(i, { quantite: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} />
                  </label>
                  <button type="button" className="pg-ligne-retirer" onClick={() => retirerAgent(i)} aria-label={`Retirer ${a.nom}`}>Retirer</button>
                </li>
              ))}
            </ul>
            <p className="pg-texte mt-4"><a href={LIENS.catalogue} className="mq-cyan">+ Recruter un autre agent</a></p>
          </Bande>
          <Bande titre="Votre Box Commander" texte="Le poste posé dans vos bureaux, qui porte vos agents, leur voix et votre Desktop Commander.">
            <div className="pg-box-choix">
              {BOX_EN_VENTE.map((b) => (
                <label key={b.id} className={`pg-box-option ${l.box === b.id ? 'choisie' : ''}`}>
                  <input type="radio" name="box" checked={l.box === b.id} onChange={() => choisirBox(b.id)} />
                  <b>{euros(b.mensuel)} HT/mois</b><span>sur {b.engagementMois} mois</span>
                </label>
              ))}
              <label className={`pg-box-option ${!l.box ? 'choisie' : ''}`}>
                <input type="radio" name="box" checked={!l.box} onChange={() => choisirBox(null)} />
                <b>Sans Box</b><span>vos agents passent par l'API</span>
              </label>
            </div>
          </Bande>
          <Bande titre="Le total">
            <dl className="pg-mentions">
              <div><dt>Agents</dt><dd>{euros(t.agents)} HT par mois</dd></div>
              <div><dt>Box Commander</dt><dd>{t.boxOffre ? `${euros(t.box)} HT par mois sur ${t.boxOffre.engagementMois} mois` : 'aucune'}</dd></div>
              <div><dt>Consommation d'IA</dt><dd>à part, selon l'usage, estimée avec vous avant tout engagement</dd></div>
              <div><dt>Total</dt><dd><b>{euros(t.total)} HT par mois</b></dd></div>
            </dl>
            {paiement && (
              <div className="mt-6">
                <button type="button" className="bouton bouton-plein" disabled={envoi} onClick={payer}>{envoi ? 'Ouverture du paiement…' : 'Valider et payer'} <Fleche /></button>
                {t.boxOffre && <p className="pg-note mt-2">Engagement de la Box : {t.boxOffre.engagementMois} mois. TVA de 20 % ajoutée au paiement.</p>}
              </div>
            )}
            {erreur && <p className="pg-note mt-3" role="alert">{erreur}</p>}
          </Bande>
          <Bande id="demande" surtitre={paiement ? 'Ou bien' : 'Valider'} titre={paiement ? 'Recevoir un devis' : 'Valider votre liste'}
            texte="Votre liste part avec votre demande : nous revenons vers vous avec le devis, puis préparons votre Box et l'entretien d'embauche de chaque agent.">
            <pre className="pg-liste-texte">{listeEnTexte(l)}</pre>
            <Demande sujet={`Liste de recrutement (${nombreDAgents(l)} agent${nombreDAgents(l) > 1 ? 's' : ''})`} evenement="recruit_list"
              annexe={() => `Liste de recrutement :\n${listeEnTexte(lireListe())}`} libelleEnvoi="Valider ma liste" />
          </Bande>
        </>
      ))}
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
  recrutement: ListeRecrutement,
  'mentions-legales': MentionsLegales,
  ...COMPOSANTS_BUSINESS,
};
