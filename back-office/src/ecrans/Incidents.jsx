// Incidents (ADMIN MASTER §11) : ouverts par les événements (une Box muette, une
// mise à jour qui échoue), suivis d'état en état. Seules les transitions
// possibles depuis l'état courant sont proposées ; la plateforme refuse le reste.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Tableau, dateHeure } from '../composants.jsx';
import { IssueAction, elements } from './noyau.jsx';

export const lectures = [['v1Incidents', { query: { ouverts: '1' } }], ['v1Registre', {}]];

export const ETAT_INCIDENT = {
  DETECTED: 'détecté', TRIAGED: 'trié', INVESTIGATING: 'en recherche', MITIGATING: 'en atténuation', MONITORING: 'en surveillance', RESOLVED: 'résolu', POSTMORTEM: 'retour d’expérience',
};
const SEVERITE = { critique: 'danger', majeure: 'danger', mineure: 'alerte' };

function Avancer({ incident, possibles, apres }) {
  const [vers, setVers] = useState(possibles[0] ?? '');
  const [note, setNote] = useState('');
  const [etat, lancer] = useAction();
  if (!possibles.length) return <span className="discret">clos</span>;
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('v1EtatIncident', { params: { id: incident.id }, corps: { etat: vers, note: note.trim() } }, apres); }}>
      <div className="en-ligne">
        <select value={vers} onChange={(e) => setVers(e.target.value)}>{possibles.map((p) => <option key={p} value={p}>{ETAT_INCIDENT[p] ?? p}</option>)}</select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ce qui a été fait" required minLength={3} />
        <button type="submit" className="bouton" disabled={etat.statut === 'en-cours'}>Passer</button>
      </div>
      {etat.statut === 'fait' ? null : <IssueAction etat={etat} />}
    </form>
  );
}

export default function Incidents() {
  const [ouverts, setOuverts] = useState(true);
  const lecture = useLecture('v1Incidents', { query: { ouverts: ouverts ? '1' : '' } });
  const registre = useLecture('v1Registre');
  const transitions = registre.donnees?.transitions_incident ?? {};
  return (
    <Panneau titre="Incidents" sousTitre="Ouverts par les événements de la flotte ; une Box qui revient met le sien en surveillance."
      actions={<Bouton onClick={() => lecture.recharger()}>Relire</Bouton>}>
      <div className="filtres">
        <label className="case"><input type="checkbox" checked={ouverts} onChange={(e) => setOuverts(e.target.checked)} /> seulement les ouverts</label>
      </div>
      <Lecture lecture={lecture}>
        {(d) => (
          <Tableau vide="Aucun incident." lignes={elements(d)} cle={(i) => i.id}
            colonnes={[
              { titre: 'Ouvert le', rendu: (i) => dateHeure(i.ouvert_le) },
              { titre: 'Incident', rendu: (i) => <><strong>{i.titre}</strong><br /><span className="petit">{i.domaine} · <code>{i.ressource}</code>{i.tenant_id ? <> · client <code>{i.tenant_id}</code></> : null}</span></> },
              { titre: 'Gravité', rendu: (i) => <Pastille ton={SEVERITE[i.severite] ?? 'neutre'}>{i.severite}</Pastille> },
              { titre: 'État', rendu: (i) => <Pastille ton={i.etat === 'RESOLVED' || i.etat === 'POSTMORTEM' ? 'succes' : 'alerte'}>{ETAT_INCIDENT[i.etat] ?? i.etat}</Pastille> },
              { titre: 'Historique', rendu: (i) => i.historique.map((h) => <div key={`${h.quand}${h.etat}`} className="petit">{`${dateHeure(h.quand)} · ${ETAT_INCIDENT[h.etat] ?? h.etat} · ${h.note}`}</div>) },
              { titre: 'Faire avancer', rendu: (i) => <Avancer incident={i} possibles={transitions[i.etat] ?? []} apres={() => lecture.recharger()} /> },
            ]} />
        )}
      </Lecture>
    </Panneau>
  );
}
