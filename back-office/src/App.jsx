// The standalone back-office (« Admin plateforme »): mounts the screens at once.
// The e-mail studio works without the platform; the platform screens ask for
// its address and the admin token, typed once. The token is handed to the Client
// (Rust keyring on desktop, page memory on the web) and never rendered again:
// after it is set, the screen only knows whether one is present.
import { useEffect, useState } from 'react';
import Administration from './Administration.jsx';

export function Connexion({ client, adresseDepart, onConnecte, onRetour, modeInitial = 'secours' }) {
  const [adresse, setAdresse] = useState(adresseDepart ?? '');
  const [mode, setMode] = useState(modeInitial);
  const [jeton, setJeton] = useState('');
  const [acteur, setActeur] = useState('');
  const [cle, setCle] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const personnel = mode === 'personnel' && client.session;
  const valider = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await client.adresse.poser(adresse);
      if (personnel) await client.session.ouvrir({ acteur_id: acteur, cle, code });
      else await client.jeton.poser(jeton);
      // the fields forget what was typed as soon as the Client holds it
      setJeton(''); setCle(''); setCode('');
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
        <div className="bo-marque grande"><span className="bo-logo">iAgent</span><span className="bo-sous-marque">Admin plateforme</span></div>
        <p className="discret">Application interne. Elle ne parle qu'aux routes d'administration et publiques de la plateforme ; sans jeton ni compte, elle ne montre rien.</p>
        <label className="champ"><span className="champ-libelle">Adresse de la plateforme</span>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="https://plateforme…" required autoComplete="url" /></label>
        {client.session ? (
          <div className="rangee" role="radiogroup" aria-label="Façon de se connecter">
            <label><input type="radio" name="mode" checked={!personnel} onChange={() => setMode('secours')} /> Clé du fondateur (jeton du back-office)</label>
            <label><input type="radio" name="mode" checked={Boolean(personnel)} onChange={() => setMode('personnel')} /> Compte personnel</label>
          </div>
        ) : null}
        {personnel ? (
          <>
            <label className="champ"><span className="champ-libelle">Identifiant</span>
              <input value={acteur} onChange={(e) => setActeur(e.target.value)} placeholder="HUM-…" required autoComplete="username" spellCheck={false} /></label>
            <label className="champ"><span className="champ-libelle">Clé personnelle</span>
              <input type="password" value={cle} onChange={(e) => setCle(e.target.value)} placeholder="iak_…" required autoComplete="off" spellCheck={false} /></label>
            <label className="champ"><span className="champ-libelle">Code à 6 chiffres</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" />
              <span className="champ-aide">Celui de votre application d'authentification, une fois le second facteur activé. Sans lui, les actions sensibles sont refusées.</span></label>
          </>
        ) : (
          <label className="champ"><span className="champ-libelle">Jeton du back-office</span>
            <input type="password" value={jeton} onChange={(e) => setJeton(e.target.value)} required autoComplete="off" spellCheck={false} />
            <span className="champ-aide">Saisi une fois : il est rangé hors de l'écran et n'est plus jamais affiché. Il vaut le compte du fondateur.</span></label>
        )}
        {erreur ? <div className="erreur" role="alert"><strong>Rien n'est enregistré :</strong> <span className="erreur-texte">{erreur}</span></div> : null}
        <div className="rangee">
          <button type="submit" className="bouton bouton-principal" disabled={enCours}>{personnel ? 'Ouvrir ma session' : 'Brancher la plateforme'}</button>
          {onRetour ? <button type="button" className="bouton" onClick={onRetour}>Revenir au studio e-mail</button> : null}
        </div>
      </form>
    </div>
  );
}

function Reglages({ client, adresse, onDeconnecte }) {
  return (
    <div className="bo-reglages">
      <p className="petit">Plateforme : <code>{adresse}</code></p>
      <p className="petit">Jeton ou session posé (jamais affiché).</p>
      <button type="button" className="bouton petit" onClick={async () => { await client.jeton.oublier(); onDeconnecte(); }}>Se déconnecter</button>
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
  const [brancher, setBrancher] = useState(false);
  if (!etat) return <div className="bo bo-connexion"><p className="discret" aria-busy="true">Ouverture…</p></div>;
  if (!etat.connecte && brancher) {
    return (
      <>
        {etat.erreur ? <div className="bo"><div className="erreur" role="alert">{etat.erreur}</div></div> : null}
        <Connexion client={client} adresseDepart={etat.adresse} onConnecte={() => { setBrancher(false); relire(); }} onRetour={() => setBrancher(false)} />
      </>
    );
  }
  const entete = etat.connecte
    ? <Reglages client={client} adresse={etat.adresse} onDeconnecte={relire} />
    : (
      <div className="bo-reglages">
        <p className="petit">Plateforme non branchée : le studio e-mail marche sans elle, les autres écrans la lisent.</p>
        <button type="button" className="bouton petit" onClick={() => setBrancher(true)}>Brancher la plateforme</button>
      </div>
    );
  return (
    <Administration
      client={client} initial={initial} propsEcran={propsEcran}
      ecranInitial={ecranInitial ?? (etat.connecte ? 'flotte' : 'emails')}
      entete={entete}
    />
  );
}
