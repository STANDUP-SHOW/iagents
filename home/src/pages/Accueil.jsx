import { PROMESSE } from '../contenu.js';
import { GrilleFonctions, TablePolitique, GrilleOffres } from '../composants/Blocs.jsx';
import BoxHome from '../composants/BoxHome.jsx';

// Illustrative cards: what a day looks like, one per policy level. Labelled as
// an example on the page — not a customer's account, not a testimonial.
const EXEMPLES = [
  { quoi: 'Facture d’énergie lue et classée', etat: 'Fait, rien à faire', niveau: 'autonome' },
  { quoi: 'Réponse à l’école préparée', etat: 'À relire quand vous voulez', niveau: 'confirmation' },
  { quoi: 'Échéance d’assurance à régler', etat: 'Attend votre confirmation forte', niveau: 'forte' },
];

export default function Accueil() {
  return (
    <>
      <section className="heros">
        <div className="enveloppe heros-grille">
          <div>
            <p className="surtitre">iAgent Home</p>
            <h1>Du temps rendu, et l’esprit tranquille.</h1>
            <p className="promesse">{PROMESSE}</p>
            <p className="chapeau">Courriers, factures, rendez-vous, école, assurances, démarches : votre Home Agent lit, range, prépare et vous rappelle. Ce qui compte, c’est vous qui le décidez.</p>
            <div className="actions">
              <a className="bouton" href="/ce-qu-il-fait">Ce qu’il fait</a>
              <a className="bouton bouton-clair" href="/tarifs">Voir les offres</a>
            </div>
          </div>
          <div className="heros-visuel">
            <BoxHome taille={420} />
            <ul className="exemples" aria-label="Exemple de journée">
              {EXEMPLES.map((e) => (
                <li key={e.quoi} className="exemple">
                  <span className={`pastille pastille-${e.niveau}`} aria-hidden="true" />
                  <span><strong>{e.quoi}</strong><br />{e.etat}</span>
                </li>
              ))}
            </ul>
            <p className="note-exemple">Exemple d’une journée, à titre d’illustration.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="enveloppe">
          <h2>Ce qu’il prend en charge</h2>
          <p className="intro">Tout ce qui encombre la semaine sans la remplir.</p>
          <GrilleFonctions limite={8} />
          <p className="suite"><a href="/ce-qu-il-fait">Les onze domaines de votre Home Agent</a></p>
        </div>
      </section>

      <section className="section section-perle">
        <div className="enveloppe deux-colonnes">
          <div>
            <h2>Il fait seul ce qui est simple. Il vous demande ce qui compte.</h2>
            <p>Lire une facture, préparer une réponse : il s’en charge. Envoyer un courrier important, payer, résilier : rien ne se fait sans votre accord.</p>
            <p className="suite"><a href="/securite">Comment vous gardez la main</a></p>
          </div>
          <TablePolitique />
        </div>
      </section>

      <section className="section">
        <div className="enveloppe deux-colonnes">
          <BoxHome titre="La Box Home, posée à la maison" taille={320} />
          <div>
            <h2>La Box Home, si vous la voulez</h2>
            <p>Une Box blanche, discrète, installée chez vous. Branchez le courant et le réseau, connectez-la : votre agent est là. Elle est louée, entretenue et mise à jour par iAgent.</p>
            <p className="suite"><a href="/box-home">Découvrir la Box Home</a></p>
          </div>
        </div>
      </section>

      <section className="section section-perle">
        <div className="enveloppe">
          <h2>Les offres</h2>
          <GrilleOffres />
          <p className="suite"><a href="/tarifs">Le détail des offres</a></p>
        </div>
      </section>
    </>
  );
}
