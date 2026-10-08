import { Bandeau } from '../composants/Cadre.jsx';
import { GrilleFonctions, TablePolitique, LegendeNiveaux, GrilleOffres } from '../composants/Blocs.jsx';
import BoxHome from '../composants/BoxHome.jsx';
import { PROMESSE, QUESTIONS, BUSINESS } from '../contenu.js';
import { planDe } from '../tarifs.js';

export function CeQuIlFait() {
  return (
    <>
      <Bandeau surtitre="Ce qu’il fait" titre="Tout l’administratif du foyer, au même endroit">
        <p className="chapeau">{PROMESSE}</p>
      </Bandeau>
      <section className="section">
        <div className="enveloppe">
          <h2>Onze domaines pris en charge</h2>
          <GrilleFonctions />
        </div>
      </section>
      <section className="section section-perle">
        <div className="enveloppe deux-colonnes">
          <div>
            <h2>Ce qu’il fait seul, ce qu’il vous demande</h2>
            <p>Chaque action a sa règle. Plus elle engage le foyer, plus votre accord est explicite.</p>
            <LegendeNiveaux />
          </div>
          <TablePolitique />
        </div>
      </section>
    </>
  );
}

export function PageBoxHome() {
  const box = planDe('home-box');
  return (
    <>
      <Bandeau surtitre="Box Home" titre="Une Box blanche, louée, entretenue pour vous">
        <p className="chapeau">Courant, réseau, connexion : votre agent est là.</p>
      </Bandeau>
      <section className="section">
        <div className="enveloppe deux-colonnes">
          <BoxHome taille={380} />
          <div>
            <h2>Chez vous, sans y penser</h2>
            <p>La Box Home est un petit appareil blanc et aluminium clair, fait pour vivre dans une maison. Elle porte votre Home Agent et sa voix : vous lui parlez, il vous répond.</p>
            <p>Elle arrive préparée. Vous la branchez, vous la connectez à votre réseau, et votre agent est prêt.</p>
          </div>
        </div>
      </section>
      <section className="section section-perle">
        <div className="enveloppe">
          <h2>Louée, jamais vendue</h2>
          <ul className="fonctions">
            <li className="carte"><h3>Elle reste à iAgent</h3><p>La Box Home est louée : elle reste la propriété d’iAgent pendant toute la durée de votre offre.</p></li>
            <li className="carte"><h3>Entretenue</h3><p>Maintenance et mises à jour sont comprises. Vous n’avez rien à installer ni à réparer.</p></li>
            <li className="carte"><h3>Remplacée si besoin</h3><p>En cas de panne, elle est remplacée selon les conditions de votre offre.</p></li>
            <li className="carte"><h3>Restituée en fin de contrat</h3><p>À la fin, vous la rendez, ou vous renouvelez votre offre.</p></li>
          </ul>
        </div>
      </section>
      <section className="section">
        <div className="enveloppe etroite centre">
          <h2>Avec quelle offre ?</h2>
          <p>La Box Home est comprise dans l’offre {box.nom}. Les offres Home Digital et Home Agent fonctionnent sans Box.</p>
          <p className="suite"><a href="/tarifs">Comparer les offres</a></p>
        </div>
      </section>
    </>
  );
}

export function Tarifs() {
  return (
    <>
      <Bandeau surtitre="Tarifs" titre="Une offre pour chaque foyer">
        <p className="chapeau">Prix toutes taxes comprises, par mois. Avec ou sans Box.</p>
      </Bandeau>
      <section className="section">
        <div className="enveloppe">
          <h2 className="visuellement-cache">Les quatre offres</h2>
          <GrilleOffres />
        </div>
      </section>
      <section className="section section-perle">
        <div className="enveloppe etroite centre">
          <h2>Pour une entreprise ?</h2>
          <p>iAgent Home est pensé pour le foyer. Les équipes et les entreprises ont leur propre offre.</p>
          <p className="suite"><a href={BUSINESS}>iAgent Business</a></p>
        </div>
      </section>
    </>
  );
}

export function Securite() {
  return (
    <>
      <Bandeau surtitre="Sécurité" titre="Vous gardez la main sur ce qui compte">
        <p className="chapeau">Votre Home Agent vous montre ce qu’il fait. Il ne paie, n’envoie et ne résilie rien d’important sans vous.</p>
      </Bandeau>
      <section className="section">
        <div className="enveloppe deux-colonnes">
          <div>
            <h2>Une règle pour chaque action</h2>
            <p>Plus une action engage le foyer, plus votre accord est explicite. Payer une facture ou toucher à un contrat demande toujours une confirmation forte.</p>
            <LegendeNiveaux />
          </div>
          <TablePolitique />
        </div>
      </section>
      <section className="section section-perle">
        <div className="enveloppe">
          <h2>Nos principes</h2>
          <ul className="fonctions">
            <li className="carte"><h3>Vous voyez le travail</h3><p>Ce que l’agent a lu, classé ou préparé vous est montré. Rien ne se passe dans votre dos.</p></li>
            <li className="carte"><h3>Rien ne part sans vous</h3><p>Un courrier important n’est envoyé qu’après votre accord, et un paiement qu’après votre confirmation forte.</p></li>
            <li className="carte"><h3>Vos règles d’abord</h3><p>Pour les rendez-vous, c’est vous qui fixez ce qu’il peut faire seul et ce qu’il doit vous demander.</p></li>
            <li className="carte"><h3>Pas de connexion à votre insu</h3><p>L’agent ne se connecte pas à vos comptes sans que vous l’ayez autorisé.</p></li>
          </ul>
        </div>
      </section>
    </>
  );
}

export function Aide() {
  return (
    <>
      <Bandeau surtitre="Aide" titre="Questions fréquentes">
        <p className="chapeau">Les réponses aux questions qu’on nous pose le plus souvent sur iAgent Home.</p>
      </Bandeau>
      <section className="section">
        <div className="enveloppe etroite">
          <div className="faq">
            {QUESTIONS.map((x) => (
              <details key={x.q}>
                <summary>{x.q}</summary>
                <p>{x.r}</p>
              </details>
            ))}
          </div>
          <div className="encart">
            <h2>Une autre question ?</h2>
            <p>Le service d’aide d’iAgent Home ouvrira avec les premières offres. D’ici là, vous pouvez joindre iAgent depuis <a href={BUSINESS}>iagent.agency</a>.</p>
          </div>
        </div>
      </section>
    </>
  );
}

export function Introuvable() {
  return (
    <Bandeau surtitre="Page introuvable" titre="Cette page n’existe pas, ou plus">
      <p className="chapeau"><a href="/">Revenir à l’accueil</a></p>
    </Bandeau>
  );
}
