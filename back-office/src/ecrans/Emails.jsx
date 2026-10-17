// Studio e-mail: max's ten pre-formatted templates (kit V4), filled with the
// real agents of the catalogue, previewed exactly, then sent one by one from
// iAgent's own mailbox (OVH) on an explicit click. Nothing is sent in bulk and
// nothing is sent from a browser: the desktop app holds the mailbox password in
// the system keyring (admin/src/courriel.rs).
//
// Needs no platform: it works before the platform is online.
import { useContext, useEffect, useMemo, useState } from 'react';
import { ContextePlateforme } from '../donnees.jsx';
import { Panneau, Champ, Bouton, Pastille } from '../composants.jsx';
import {
  MODELES, CATALOGUE, LIENS_INVESTISSEURS, brouillonDepuis, agentsProposes, postesDe, rendreHtml, rendreTexte,
  objetDe, manques, preparerEnvoi, sha256HexNavigateur, SITE,
} from '../emails/modeles.js';
import logo from '../emails/assets/iagent-logo-officiel.png';
import heroInvestor from '../emails/assets/hero-investor.jpg';
import heroWelcome from '../emails/assets/hero-welcome.jpg';
import heroMarketing from '../emails/assets/hero-marketing.jpg';

export const lectures = [];

const IMAGES_APERCU = {
  logo,
  hero: { investor: heroInvestor, client: heroWelcome, marketing: heroMarketing },
  portrait: (nom) => `${SITE}/portraits/agents/${nom}.webp`,
};
const MAX_AGENTS = 6;
const ONGLETS = [['message', 'Message'], ['destinataire', 'Destinataire'], ['agents', 'Agents'], ['signature', 'Signature et liens']];

function telecharger(nom, contenu, type) {
  try {
    const u = URL.createObjectURL(new Blob([contenu], { type }));
    const a = document.createElement('a');
    a.href = u; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  } catch { /* the browser refused: the button says nothing happened via the absence of a file */ }
}

const heure = (s) => new Date(s * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** The mailbox: OVH by default, password typed once and kept in the keyring. */
function Boite({ client, etat, relire }) {
  const [ouvert, setOuvert] = useState(false);
  const [r, setR] = useState(etat);
  const [mdp, setMdp] = useState('');
  const [retour, setRetour] = useState(null);
  useEffect(() => setR(etat), [etat]);
  if (!etat) return <p className="discret" aria-busy="true">Lecture des réglages de la boîte…</p>;
  const enregistrer = async (e) => {
    e.preventDefault();
    setRetour(null);
    try {
      const msg = await client.courriel.poserReglages({ hote: r.hote, port: Number(r.port), securite: r.securite, utilisateur: r.utilisateur, expediteur_nom: r.expediteur_nom, expediteur_adresse: r.expediteur_adresse });
      let msg2 = '';
      if (mdp) { msg2 = await client.courriel.poserMotDePasse(mdp); setMdp(''); }
      setRetour({ ok: true, texte: [msg, msg2].filter(Boolean).join(' ') });
      relire();
    } catch (err) { setRetour({ ok: false, texte: err && err.message ? err.message : String(err) }); }
  };
  return (
    <div className="em-boite">
      <div className="rangee">
        <span>Envoi depuis <strong>{etat.expediteur_adresse}</strong> par <code>{etat.hote}</code> ({etat.securite === 'ssl' ? 'SSL' : 'STARTTLS'}, port {etat.port})</span>
        {etat.mot_de_passe_present ? <Pastille ton="succes">mot de passe enregistré</Pastille> : <Pastille ton="alerte">mot de passe à saisir</Pastille>}
        <Bouton className="bouton petit" onClick={() => setOuvert(!ouvert)}>{ouvert ? 'Fermer' : 'Régler la boîte'}</Bouton>
      </div>
      {ouvert ? (
        <form className="formulaire em-reglages" onSubmit={enregistrer}>
          <div className="grille">
            <Champ libelle="Serveur d'envoi"><input value={r.hote} onChange={(e) => setR({ ...r, hote: e.target.value })} /></Champ>
            <Champ libelle="Port"><input value={r.port} inputMode="numeric" onChange={(e) => setR({ ...r, port: e.target.value })} /></Champ>
            <Champ libelle="Chiffrement">
              <select value={r.securite} onChange={(e) => setR({ ...r, securite: e.target.value })}><option value="ssl">SSL (465)</option><option value="starttls">STARTTLS (587)</option></select>
            </Champ>
            <Champ libelle="Identifiant de la boîte"><input value={r.utilisateur} onChange={(e) => setR({ ...r, utilisateur: e.target.value })} /></Champ>
            <Champ libelle="Nom d'expéditeur"><input value={r.expediteur_nom} onChange={(e) => setR({ ...r, expediteur_nom: e.target.value })} /></Champ>
            <Champ libelle="Adresse d'expédition"><input value={r.expediteur_adresse} onChange={(e) => setR({ ...r, expediteur_adresse: e.target.value })} /></Champ>
          </div>
          <Champ libelle="Mot de passe de la boîte" aide="Celui de la boîte OVH. Rangé dans le coffre de Windows, jamais réaffiché. Laissez vide pour garder celui qui est enregistré.">
            <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="off" spellCheck={false} />
          </Champ>
          <div className="rangee">
            <button type="submit" className="bouton bouton-principal">Enregistrer</button>
            {etat.mot_de_passe_present ? <Bouton onClick={async () => { setRetour({ ok: true, texte: await client.courriel.oublierMotDePasse() }); relire(); }}>Oublier le mot de passe</Bouton> : null}
          </div>
          {retour ? <div className={retour.ok ? 'succes' : 'erreur'} role="status">{retour.texte}</div> : null}
        </form>
      ) : null}
    </div>
  );
}

export default function Emails({ brouillonInitial = null, ongletInitial = 'message', smtpInitial = null, journalInitial = [] }) {
  const { client } = useContext(ContextePlateforme);
  const [b, setB] = useState(() => brouillonInitial ?? brouillonDepuis('prospection-metier'));
  const [onglet, setOnglet] = useState(ongletInitial);
  const [ecran, setEcran] = useState('bureau');
  const [filtre, setFiltre] = useState('');
  const [smtp, setSmtp] = useState(smtpInitial);
  const [journal, setJournal] = useState(journalInitial);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState({ statut: 'repos' });

  const relire = async () => {
    try { setSmtp(await client.courriel.reglages()); } catch (e) { setSmtp({ erreur: e && e.message ? e.message : String(e) }); }
    try { setJournal(await client.courriel.journal()); } catch { setJournal([]); }
  };
  useEffect(() => { relire(); }, []);

  const apercu = useMemo(() => rendreHtml(b, IMAGES_APERCU), [b]);
  const aFaire = manques(b);
  const modele = MODELES.find((m) => m.id === b.modele);
  const avecAgents = modele.sections.includes('agents');
  const champ = (k) => (e) => { setConfirmer(false); setB({ ...b, champs: { ...b.champs, [k]: e.target.value } }); };
  const postes = postesDe(b.activite);
  const activites = CATALOGUE.activites.filter((a) => !filtre || a[1].toLowerCase().includes(filtre.toLowerCase()));

  const choisirModele = (id) => { setConfirmer(false); setEnvoi({ statut: 'repos' }); setB(brouillonDepuis(id, b)); };
  const choisirActivite = (id) => { setConfirmer(false); setB({ ...b, activite: id, agents: agentsProposes(id) }); };
  const basculerAgent = (id) => {
    setConfirmer(false);
    const a = b.agents.includes(id) ? b.agents.filter((x) => x !== id) : [...b.agents, id].slice(0, MAX_AGENTS);
    setB({ ...b, agents: a });
  };

  const envoyer = async () => {
    setEnvoi({ statut: 'en-cours' });
    try {
      const pret = await preparerEnvoi(b, sha256HexNavigateur);
      const trace = await client.courriel.envoyer(pret);
      setEnvoi({ statut: 'ok', trace });
      setConfirmer(false);
      relire();
    } catch (e) {
      setEnvoi({ statut: 'erreur', erreur: e && e.message ? e.message : String(e) });
      setConfirmer(false);
    }
  };

  return (
    <div className="em">
      <Panneau titre="Boîte d'envoi" sousTitre="Chaque e-mail part seul, vers une seule adresse, après votre relecture et votre clic. Aucun envoi groupé.">
        {smtp && smtp.erreur ? <div className="erreur" role="alert">{smtp.erreur}</div> : <Boite client={client} etat={smtp} relire={relire} />}
      </Panneau>

      <div className="em-studio">
        <nav className="em-modeles" aria-label="Modèles d'e-mail">
          {MODELES.map((m) => (
            <button key={m.id} type="button" className={`em-modele${m.id === b.modele ? ' actif' : ''}`} onClick={() => choisirModele(m.id)} aria-pressed={m.id === b.modele}>
              <span className="em-num">{m.num}</span>
              <span><strong>{m.titre}</strong><small>{m.aide}</small></span>
            </button>
          ))}
        </nav>

        <section className="panneau em-edition">
          <div className="em-onglets" role="tablist">
            {ONGLETS.map(([id, t]) => <button key={id} type="button" role="tab" aria-selected={onglet === id} className={onglet === id ? 'actif' : undefined} onClick={() => setOnglet(id)}>{t}</button>)}
          </div>
          {onglet === 'message' ? (
            <div className="formulaire">
              <Champ libelle="Objet" aide="Champs possibles : {{prenom}}, {{entreprise}}, {{secteur}}, {{signature}}."><input value={b.champs.objet} onChange={champ('objet')} /></Champ>
              <Champ libelle="Pré-en-tête (la ligne grise sous l'objet dans la boîte de réception)"><input value={b.champs.preEntete} onChange={champ('preEntete')} /></Champ>
              <Champ libelle="Titre"><input value={b.champs.titre} onChange={champ('titre')} /></Champ>
              <Champ libelle="Introduction"><textarea rows={3} value={b.champs.intro} onChange={champ('intro')} /></Champ>
              <Champ libelle="Message personnel"><textarea rows={8} value={b.champs.message} onChange={champ('message')} /></Champ>
              <div className="grille">
                <Champ libelle="Texte du bouton"><input value={b.champs.bouton} onChange={champ('bouton')} /></Champ>
                <Champ libelle="Lien du bouton (https://)" aide="Vide : pas de bouton."><input value={b.champs.lien} onChange={champ('lien')} /></Champ>
              </div>
              <div className="rangee"><Bouton onClick={() => choisirModele(b.modele)}>Remettre le texte du modèle</Bouton></div>
            </div>
          ) : null}
          {onglet === 'destinataire' ? (
            <div className="formulaire">
              <Champ libelle="Adresse e-mail du destinataire" aide="Une seule adresse : un e-mail part vers une personne."><input type="email" value={b.champs.destinataire} onChange={champ('destinataire')} placeholder="prenom.nom@entreprise.fr" /></Champ>
              <div className="grille">
                <Champ libelle="Prénom"><input value={b.champs.prenom} onChange={champ('prenom')} /></Champ>
                <Champ libelle="Entreprise"><input value={b.champs.entreprise} onChange={champ('entreprise')} /></Champ>
              </div>
            </div>
          ) : null}
          {onglet === 'agents' ? (
            <div className="formulaire">
              {!avecAgents ? <p className="discret">Ce modèle ne montre pas d'agents ; choisissez l'activité quand même, elle remplit {'{{secteur}}'}.</p> : null}
              <div className="grille">
                <Champ libelle="Chercher une activité"><input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="imprimerie, boulangerie…" /></Champ>
                <Champ libelle={`Activité du destinataire (${CATALOGUE.activites.length})`}>
                  <select value={b.activite} onChange={(e) => choisirActivite(e.target.value)}>
                    {activites.some((a) => a[0] === b.activite) ? null : <option value={b.activite}>{CATALOGUE.activites.find((a) => a[0] === b.activite)?.[1]}</option>}
                    {activites.map((a) => <option key={a[0]} value={a[0]}>{a[1]}</option>)}
                  </select>
                </Champ>
              </div>
              <p className="discret petit">Les postes d'une entreprise de cette activité, chacun tenu par une fiche du catalogue. {b.agents.length} choisi(s) sur {MAX_AGENTS} au plus.</p>
              <ul className="em-postes">
                {postes.map(([service, poste, id]) => (
                  <li key={`${service}-${id}-${poste}`}>
                    <label className="case">
                      <input type="checkbox" checked={b.agents.includes(id)} onChange={() => basculerAgent(id)} disabled={!b.agents.includes(id) && b.agents.length >= MAX_AGENTS} />
                      <span><strong>{poste}</strong> <small>{service} · {CATALOGUE.agents[id][1]} ({id})</small></span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {onglet === 'signature' ? (
            <div className="formulaire">
              <div className="grille">
                <Champ libelle="Signature"><input value={b.champs.signature} onChange={champ('signature')} /></Champ>
                <Champ libelle="Adresse de réponse"><input value={b.champs.adresseReponse} onChange={champ('adresseReponse')} /></Champ>
              </div>
              <Champ libelle="Mentions légales (pied de l'e-mail)"><textarea rows={2} value={b.champs.mentions} onChange={champ('mentions')} /></Champ>
              <Champ libelle="Désinscription (https:// ou mailto:)" aide="Ajouté aussi en en-tête List-Unsubscribe, que Gmail et Outlook affichent."><input value={b.champs.desinscription} onChange={champ('desinscription')} /></Champ>
              {modele.sections.includes('resources') ? (
                <>
                  <h3>Documents investisseurs (https://)</h3>
                  <div className="grille">
                    {LIENS_INVESTISSEURS.map(([k, l]) => <Champ key={k} libelle={l}><input value={b.champs[k]} onChange={champ(k)} /></Champ>)}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="panneau em-apercu">
          <div className="em-boite-reception">
            <div className="em-de">{smtp && !smtp.erreur ? smtp.expediteur_nom || smtp.expediteur_adresse : 'iAgent'}</div>
            <div><strong>{objetDe(b) || '(sans objet)'}</strong></div>
            <div className="discret petit">{b.champs.preEntete}</div>
          </div>
          <div className="rangee em-appareils">
            <Bouton className={`bouton petit${ecran === 'bureau' ? ' actif' : ''}`} onClick={() => setEcran('bureau')}>Ordinateur</Bouton>
            <Bouton className={`bouton petit${ecran === 'mobile' ? ' actif' : ''}`} onClick={() => setEcran('mobile')}>Téléphone</Bouton>
          </div>
          <div className={`em-cadre ${ecran}`}>
            <iframe title="Aperçu de l'e-mail" sandbox="" srcDoc={apercu} />
          </div>

          <div className="em-envoi">
            {aFaire.length ? (
              <div className="route-absente"><h3>Avant d'envoyer, il manque :</h3><ul className="proposition">{aFaire.map((m) => <li key={m}>{m}</li>)}</ul></div>
            ) : confirmer ? (
              <div className="em-confirmer">
                <p>Envoyer <strong>« {objetDe(b)} »</strong> à <strong>{b.champs.destinataire.trim()}</strong>, tel que l'aperçu le montre ?</p>
                <div className="rangee">
                  <button type="button" className="bouton bouton-principal" onClick={envoyer} disabled={envoi.statut === 'en-cours'}>Oui, envoyer</button>
                  <Bouton onClick={() => setConfirmer(false)}>Non, revenir</Bouton>
                </div>
              </div>
            ) : (
              <button type="button" className="bouton bouton-principal" onClick={() => { setEnvoi({ statut: 'repos' }); setConfirmer(true); }}>Envoyer à {b.champs.destinataire.trim()}</button>
            )}
            {envoi.statut === 'en-cours' ? <p className="discret" aria-busy="true">Envoi par la boîte OVH…</p> : null}
            {envoi.statut === 'ok' ? <div className="succes" role="status"><strong>Parti</strong> à {envoi.trace.destinataire}, {heure(envoi.trace.quand)}. Le serveur a répondu : {envoi.trace.reponse_serveur}</div> : null}
            {envoi.statut === 'erreur' ? <div className="erreur" role="alert"><strong>Rien n'est parti :</strong> {envoi.erreur}</div> : null}
            <div className="rangee em-exports">
              <Bouton className="bouton petit" onClick={() => telecharger(`iAgent_${b.modele}.html`, apercu, 'text/html;charset=utf-8')}>Télécharger le HTML</Bouton>
              <Bouton className="bouton petit" onClick={() => telecharger(`iAgent_${b.modele}.txt`, `Objet : ${objetDe(b)}\n\n${rendreTexte(b)}`, 'text/plain;charset=utf-8')}>Télécharger le texte</Bouton>
            </div>
          </div>
        </section>
      </div>

      <Panneau titre="E-mails envoyés" sousTitre="Tenu sur cet ordinateur, un par ligne, avec la réponse du serveur OVH.">
        {journal.length ? (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead><tr><th>Quand</th><th>À</th><th>Objet</th><th>Modèle</th><th>Serveur</th></tr></thead>
              <tbody>{[...journal].reverse().map((t) => <tr key={t.empreinte}><td>{heure(t.quand)}</td><td>{t.destinataire}</td><td>{t.objet}</td><td>{t.modele}</td><td><code>{t.reponse_serveur}</code></td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="vide">Aucun e-mail envoyé depuis cet ordinateur.</p>}
      </Panneau>
    </div>
  );
}
