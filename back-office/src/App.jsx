// The standalone back-office: asks for the platform address and the admin
// token once, then mounts the screens. The token is handed to the Client
// (Rust keyring on desktop, page memory on the web) and never rendered again:
// after it is set, the screen only knows whether one is present.
import { useEffect, useState } from 'react';
import Administration from './Administration.jsx';

export function Connexion({ client, adresseDepart, onConnecte }) {
  const [adresse, setAdresse] = useState(adresseDepart ?? '');
  const [jeton, setJeton] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const valider = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await client.adresse.poser(adresse);
      await client.jeton.poser(jeton);
      setJeton(''); // the field forgets it as soon as the Client holds it
      onConnecte();
    } catch (err) {
      setErreur(err && err.message ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  };
  return (
    <div className="bo bo-connexion">
      <form className="panneau connexion" onSubmit={valider}>
        <div className="bo-marque grande"><span className="bo-logo">iAgent</span><span className="bo-sous-marque">Back-office</span></div>
        <p className="discret">Application interne. Elle ne parle qu'aux routes d'administration et publiques de la plateforme ; sans le jeton du back-office, elle ne montre rien.</p>
        <label className="champ"><span className="champ-libelle">Adresse de la plateforme</span>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="https://plateforme…" required autoComplete="url" /></label>
        <label className="champ"><span className="champ-libelle">Jeton du back-office</span>
          <input type="password" value={jeton} onChange={(e) => setJeton(e.target.value)} required autoComplete="off" spellCheck={false} />
          <span className="champ-aide">Saisi une fois : il est rangé hors de l'écran et n'est plus jamais affiché.</span></label>
        {erreur ? <div className="erreur" role="alert"><strong>Rien n'est enregistré :</strong> <span className="erreur-texte">{erreur}</span></div> : null}
        <button type="submit" className="bouton bouton-principal" disabled={enCours}>Ouvrir le back-office</button>
      </form>
    </div>
  );
}

function Reglages({ client, adresse, onDeconnecte }) {
  return (
    <div className="bo-reglages">
      <p className="petit">Plateforme : <code>{adresse}</code></p>
      <p className="petit">Jeton posé (jamais affiché).</p>
      <button type="button" className="bouton petit" onClick={async () => { await client.jeton.oublier(); onDeconnecte(); }}>Oublier le jeton</button>
    </div>
  );
}

/**
 * @param client  the Client (api.js)
 * @param etatInitial  { adresse, connecte } known up front (bench only); otherwise asked to the Client
 */
export default function App({ client, etatInitial = null, initial, ecranInitial, propsEcran }) {
  const [etat, setEtat] = useState(etatInitial);
  const relire = async () => {
    try {
      const [adresse, connecte] = await Promise.all([client.adresse.lire(), client.jeton.present()]);
      setEtat({ adresse, connecte, erreur: '' });
    } catch (e) {
      setEtat({ adresse: '', connecte: false, erreur: e && e.message ? e.message : String(e) });
    }
  };
  useEffect(() => { if (!etatInitial) relire(); }, []);
  if (!etat) return <div className="bo bo-connexion"><p className="discret" aria-busy="true">Ouverture…</p></div>;
  if (!etat.connecte) {
    return (
      <>
        {etat.erreur ? <div className="bo"><div className="erreur" role="alert">{etat.erreur}</div></div> : null}
        <Connexion client={client} adresseDepart={etat.adresse} onConnecte={relire} />
      </>
    );
  }
  return (
    <Administration
      client={client} initial={initial} ecranInitial={ecranInitial} propsEcran={propsEcran}
      entete={<Reglages client={client} adresse={etat.adresse} onDeconnecte={relire} />}
    />
  );
}
