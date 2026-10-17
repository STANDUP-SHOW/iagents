// Fleet Commander (ADMIN MASTER §4, §17) : la flotte vue par le noyau. Chaque
// Box dit si elle bat, si elle a rejoint son état voulu, ce qu'elle a exécuté ;
// chaque geste part par la passerelle d'actions, avec un motif, et peut rester
// en attente d'une approbation humaine.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Tableau, dateHeure, nombre } from '../composants.jsx';
import { BoutonAction, Connexion, IssueAction, elements, nouvelleIdempotence } from './noyau.jsx';

export const lectures = [['v1VueEnsemble', {}], ['v1Devices', {}], ['v1Registre', {}]];

const COMMANDES = {
  diagnostic: 'Lancer un diagnostic',
  restart_service: 'Redémarrer un service',
  update: 'Mettre à jour',
  rollback: 'Revenir à une version',
  restart_box: 'Redémarrer la Box',
  shutdown: 'Éteindre la Box',
  rotate_certificate: 'Renouveler le certificat',
  remote_screen: 'Ouvrir l’écran à distance',
  controlled_shell: 'Ouvrir un terminal contrôlé',
  factory_reset: 'Remettre en sortie d’usine',
};
const ETAT_COMMANDE = { en_file: ['neutre', 'en file'], remise: ['info', 'remise à la Box'], reussie: ['succes', 'réussie'], echouee: ['danger', 'échouée'], expiree: ['alerte', 'expirée sans réponse'] };

/** The body of a command, from the form: only what this type needs. */
export function corpsCommande(type, f, motif, idempotence) {
  const parametres = { motif };
  if (type === 'restart_service') parametres.service = f.service;
  if (type === 'update' || type === 'rollback') { parametres.composant = f.composant; parametres.version = f.version.trim(); }
  if (type === 'remote_screen' || type === 'controlled_shell') parametres.duree_min = Number(f.duree_min);
  return { type, parametres, motif, idempotence };
}

function Commande({ box, registre, apres }) {
  const [type, setType] = useState('diagnostic');
  const [f, setF] = useState({ service: registre?.services?.[0] ?? '', composant: 'desktop', version: '', duree_min: 15 });
  const [motif, setMotif] = useState('');
  const [etat, lancer] = useAction();
  const types = (registre?.commandes ?? Object.keys(COMMANDES)).filter((t) => COMMANDES[t]);
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('v1Commande', () => ({ params: { id: box }, corps: corpsCommande(type, f, motif.trim(), nouvelleIdempotence()) }), apres); }}>
      <div className="grille">
        <Champ libelle="Commande">
          <select value={type} onChange={(e) => setType(e.target.value)}>{types.map((t) => <option key={t} value={t}>{COMMANDES[t]}</option>)}</select>
        </Champ>
        {type === 'restart_service' ? (
          <Champ libelle="Service" aide="Seuls les services livrés sur iAgent OS se redémarrent.">
            <select value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>{(registre?.services ?? []).map((s) => <option key={s}>{s}</option>)}</select>
          </Champ>
        ) : null}
        {type === 'update' || type === 'rollback' ? (
          <>
            <Champ libelle="Composant"><select value={f.composant} onChange={(e) => setF({ ...f, composant: e.target.value })}>{['desktop', 'os', 'device', 'skills'].map((c) => <option key={c}>{c}</option>)}</select></Champ>
            <Champ libelle="Version" aide="Une version publiée et signée, sinon la plateforme refuse."><input value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} required placeholder="0.2.2" /></Champ>
          </>
        ) : null}
        {type === 'remote_screen' || type === 'controlled_shell' ? (
          <Champ libelle="Durée (minutes)"><input type="number" min="1" max="60" value={f.duree_min} onChange={(e) => setF({ ...f, duree_min: e.target.value })} /></Champ>
        ) : null}
      </div>
      <Champ libelle="Motif" aide="Obligatoire : il part à l’audit avec votre nom et la corrélation de la commande.">
        <input value={motif} onChange={(e) => setMotif(e.target.value)} required minLength={3} />
      </Champ>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Envoyer la commande</button></div>
      <IssueAction etat={etat} />
    </form>
  );
}

const AGENT = { pause: ['v1AgentPause', 'Mettre en pause'], reprise: ['v1AgentReprise', 'Reprendre'], suspension: ['v1AgentSuspension', 'Suspendre'], fin: ['v1AgentFin', 'Mettre fin au contrat'] };
/** The gestures that make sense from an agent's lifecycle state (plateforme/noyau/etat.ts); the core refuses the others anyway. */
export const GESTES_AGENT = {
  ACTIVE: ['pause', 'suspension', 'fin'], PAUSED: ['reprise', 'suspension', 'fin'], PAYMENT_GRACE: ['reprise', 'suspension'],
  RESTRICTED: ['reprise', 'suspension'], SUSPENDED: ['reprise', 'fin'], PROVISIONING: ['suspension'],
};
const ETAT_REEL = (ligne) => (ligne.connexion === 'jamais_vue' ? <Pastille ton="neutre">aucun rapport</Pastille> : ligne.convergee ? <Pastille ton="succes">rejoint</Pastille> : <Pastille ton="alerte">écart</Pastille>);

export function FicheBox({ id, registre, onFermer }) {
  const lecture = useLecture('v1Device', { params: { id } });
  return (
    <Panneau titre={`Fiche de la Box ${id}`} actions={<><Bouton onClick={() => lecture.recharger()}>Relire</Bouton><Bouton onClick={onFermer}>Fermer</Bouton></>}>
      <Lecture lecture={lecture}>
        {(d) => (
          <>
            <dl className="chiffres">
              <div><dt>Connexion</dt><dd><Connexion etat={d.ligne.connexion} /></dd></div>
              <div><dt>Santé</dt><dd>{nombre(d.ligne.score_sante)}</dd></div>
              <div><dt>Dernier battement</dt><dd className="petit">{dateHeure(d.battement?.vu_le)}</dd></div>
              <div><dt>État voulu</dt><dd className="petit">{d.ligne.connexion === 'jamais_vue' ? <Pastille ton="neutre">aucun rapport de la Box</Pastille> : d.convergence.convergee ? <Pastille ton="succes">{`rejoint (v${d.convergence.version_voulue ?? 0})`}</Pastille> : <Pastille ton="alerte">{`écart : v${d.convergence.version_appliquee ?? 'aucune'} appliquée sur v${d.convergence.version_voulue ?? 0}`}</Pastille>}</dd></div>
            </dl>
            <p className="petit">{d.box.reference} · {d.box.gamme ?? 'profil à poser'} · client <code>{d.box.tenant_id ?? 'aucun'}</code> · profil {d.box.profil_materiel ?? 'non qualifié'} · versions {Object.entries(d.ligne.versions).map(([k, v]) => `${k} ${v}`).join(', ')}</p>
            {d.convergence.ecarts.length ? (
              <Tableau lignes={d.convergence.ecarts} cle={(e) => `${e.domaine}:${e.cle}`} vide=""
                colonnes={[{ titre: 'Écart', rendu: (e) => <code>{e.domaine} · {e.cle}</code> }, { titre: 'Voulu', rendu: (e) => <code>{JSON.stringify(e.voulu)}</code> }, { titre: 'Constaté', rendu: (e) => <code>{JSON.stringify(e.reel)}</code> }]} />
            ) : null}
            <h3>Agents de la Box</h3>
            <Tableau vide="Aucun agent sur cette Box." lignes={d.agents} cle={(a) => a.entitlement_id}
              colonnes={[
                { titre: 'Agent', rendu: (a) => <><strong>{a.agent_template_id}</strong> <code>{a.entitlement_id}</code></> },
                { titre: 'Licence', rendu: (a) => a.licence },
                { titre: 'Cycle', rendu: (a) => <Pastille ton={a.etat === 'ACTIVE' ? 'succes' : a.etat === 'PAUSED' ? 'alerte' : 'danger'}>{a.etat}</Pastille> },
                { titre: 'Gestes', rendu: (a) => (
                  <div className="en-ligne">
                    {(GESTES_AGENT[a.etat] ?? []).map((k) => [k, AGENT[k]]).map(([k, [route, libelle]]) => (
                      <BoutonAction key={k} libelle={libelle} route={route}
                        options={(motif, idempotence) => ({ params: { id: a.entitlement_id }, corps: { motif, idempotence } })} apres={() => lecture.recharger()} />
                    ))}
                  </div>
                ) },
              ]} />
            <h3>Envoyer une commande</h3>
            <Commande box={id} registre={registre} apres={() => lecture.recharger()} />
            <h3>Commandes</h3>
            <Tableau vide="Aucune commande pour cette Box." lignes={d.commandes} cle={(c) => c.id}
              colonnes={[
                { titre: 'Quand', rendu: (c) => dateHeure(c.cree_le) },
                { titre: 'Commande', rendu: (c) => COMMANDES[c.type] ?? c.type },
                { titre: 'État', rendu: (c) => { const [t, l] = ETAT_COMMANDE[c.statut] ?? ['neutre', c.statut]; return <Pastille ton={t}>{l}</Pastille>; } },
                { titre: 'Demandée par', rendu: (c) => <code>{c.demandeur}</code> },
                { titre: 'Sortie', rendu: (c) => <span className="petit">{c.resultat?.sortie ?? (c.statut === 'en_file' ? `expire ${dateHeure(c.expire_le)}` : '—')}</span> },
              ]} />
            <h3>Incidents</h3>
            <Tableau vide="Aucun incident sur cette Box." lignes={d.incidents} cle={(i) => i.id}
              colonnes={[{ titre: 'Ouvert le', rendu: (i) => dateHeure(i.ouvert_le) }, { titre: 'Incident', rendu: (i) => i.titre }, { titre: 'État', rendu: (i) => i.etat }]} />
          </>
        )}
      </Lecture>
    </Panneau>
  );
}

export default function Flotte({ boxInitiale = null }) {
  const vue = useLecture('v1VueEnsemble');
  const [filtre, setFiltre] = useState({ connexion: '', q: '' });
  const liste = useLecture('v1Devices', { query: filtre });
  const registre = useLecture('v1Registre');
  const [ouverte, setOuverte] = useState(boxInitiale);
  const [balayage, balayer] = useAction();
  return (
    <>
      <Panneau titre="Vue d’ensemble" sousTitre="Calculée par la plateforme à partir des battements et des états reçus."
        actions={<><Bouton onClick={() => { vue.recharger(); liste.recharger(); }}>Relire</Bouton>
          <Bouton onClick={() => balayer('v1Balayage', {}, () => { vue.recharger(); liste.recharger(); })}>Chercher les Box muettes</Bouton></>}>
        <Lecture lecture={vue}>
          {(v) => (
            <dl className="chiffres">
              <div><dt>Box</dt><dd>{nombre(v.total)}</dd></div>
              <div><dt>En ligne</dt><dd>{nombre(v.par_connexion.en_ligne ?? 0)}</dd></div>
              <div><dt>Hors ligne</dt><dd>{nombre(v.par_connexion.hors_ligne ?? 0)}</dd></div>
              <div><dt>Jamais vues</dt><dd>{nombre(v.par_connexion.jamais_vue ?? 0)}</dd></div>
              <div><dt>Hors état voulu</dt><dd>{nombre(v.non_convergees)}</dd></div>
              <div><dt>Incidents ouverts</dt><dd>{nombre(v.incidents_ouverts)}</dd></div>
              <div><dt>Approbations</dt><dd>{nombre(v.approbations_en_attente)}</dd></div>
              <div><dt>Commandes en file</dt><dd>{nombre(v.commandes_en_file)}</dd></div>
            </dl>
          )}
        </Lecture>
        {balayage.statut === 'fait' ? <p className="succes" role="status">{`Balayage fait : ${balayage.corps.changements_connexion} changement(s) de connexion, ${balayage.corps.commandes_expirees} commande(s) expirée(s), ${balayage.corps.approbations_expirees} approbation(s) expirée(s).`}</p> : <IssueAction etat={balayage.statut === 'erreur' || balayage.statut === 'en-cours' ? balayage : null} />}
      </Panneau>
      {ouverte ? <FicheBox id={ouverte} registre={registre.donnees} onFermer={() => setOuverte(null)} /> : null}
      <Panneau titre="Les Box" sousTitre="Limitées à votre périmètre : un rôle sur un client ne voit que ses Box.">
        <div className="filtres">
          <Champ libelle="Connexion">
            <select value={filtre.connexion} onChange={(e) => setFiltre({ ...filtre, connexion: e.target.value })}>
              <option value="">Toutes</option><option value="en_ligne">En ligne</option><option value="degradee">En retard</option><option value="hors_ligne">Hors ligne</option><option value="jamais_vue">Jamais vues</option>
            </select>
          </Champ>
          <Champ libelle="Chercher"><input value={filtre.q} onChange={(e) => setFiltre({ ...filtre, q: e.target.value })} placeholder="référence, Box, client" /></Champ>
        </div>
        <Lecture lecture={liste}>
          {(d) => (
            <Tableau vide="Aucune Box pour ce filtre." lignes={elements(d)} cle={(b) => b.device_id}
              colonnes={[
                { titre: 'Box', rendu: (b) => <><strong>{b.reference}</strong> <code>{b.device_id}</code></> },
                { titre: 'Client', rendu: (b) => <code>{b.tenant_id ?? 'en stock'}</code> },
                { titre: 'Connexion', rendu: (b) => <Connexion etat={b.connexion} /> },
                { titre: 'Santé', rendu: (b) => nombre(b.score_sante) },
                { titre: 'État voulu', rendu: ETAT_REEL },
                { titre: 'Alertes', rendu: (b) => (b.alertes.length ? b.alertes.map((a) => <Pastille key={a.id} ton="danger">{a.titre}</Pastille>) : <span className="discret">aucune</span>) },
                { titre: '', rendu: (b) => <Bouton onClick={() => setOuverte(b.device_id)}>Ouvrir</Bouton> },
              ]} />
          )}
        </Lecture>
      </Panneau>
    </>
  );
}
