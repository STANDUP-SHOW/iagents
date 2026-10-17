// Boîte des approbations (ADMIN MASTER §10) : ce qu'un agent, un service ou un
// collègue a demandé et que les règles ont retenu. Le demandeur ne tranche pas
// sa propre demande ; une action critique (R4) attend deux personnes ; une
// demande non tranchée expire avec son action.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Tableau, dateHeure } from '../composants.jsx';
import { IssueAction, Risque, TYPE_ACTEUR, elements } from './noyau.jsx';

export const lectures = [['v1Approbations', { query: { statut: 'en_attente' } }]];

const STATUT = { en_attente: ['alerte', 'en attente'], approuvee: ['succes', 'approuvée'], refusee: ['danger', 'refusée'], expiree: ['neutre', 'expirée'] };

function Trancher({ ap, apres }) {
  const [note, setNote] = useState('');
  const [etat, lancer] = useAction();
  const envoyer = (decision) => lancer('v1Decision', () => {
    if (decision !== 'approuve' && note.trim().length < 3) throw new Error('Dites en quelques mots pourquoi : la note part au demandeur et à l’audit.');
    return { params: { id: ap.id }, corps: { decision, note: note.trim() || 'Approuvé depuis la console.' } };
  }, apres);
  return (
    <div className="formulaire">
      <Champ libelle="Note" aide="Obligatoire pour refuser ou demander une précision.">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Champ>
      <div className="rangee">
        <Bouton principal onClick={() => envoyer('approuve')} disabled={etat.statut === 'en-cours'}>Approuver</Bouton>
        <Bouton onClick={() => envoyer('refuse')} disabled={etat.statut === 'en-cours'}>Refuser</Bouton>
        <Bouton onClick={() => envoyer('clarification')} disabled={etat.statut === 'en-cours'}>Demander une précision</Bouton>
      </div>
      {etat.statut === 'fait'
        ? <p className="succes" role="status">{etat.corps?.approbation?.statut === 'en_attente' ? `Votre accord est compté ; il en faut encore ${etat.corps.approbation.requises - etat.corps.approbation.decisions.filter((d) => d.decision === 'approuve').length}.` : `Demande ${STATUT[etat.corps?.approbation?.statut]?.[1] ?? 'traitée'}${etat.corps?.action?.statut === 'executee' ? ' : l’action est exécutée.' : '.'}`}</p>
        : <IssueAction etat={etat.statut === 'fait' ? null : etat} />}
    </div>
  );
}

export default function Approbations() {
  const [statut, setStatut] = useState('en_attente');
  const lecture = useLecture('v1Approbations', { query: { statut } });
  return (
    <Panneau titre="À trancher" sousTitre="Chaque demande dit qui la fait, pourquoi, son risque et ce qu’elle change."
      actions={<Bouton onClick={() => lecture.recharger()}>Relire</Bouton>}>
      <div className="filtres">
        <Champ libelle="Afficher">
          <select value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="en_attente">En attente</option><option value="approuvee">Approuvées</option><option value="refusee">Refusées</option><option value="expiree">Expirées</option><option value="toutes">Toutes</option>
          </select>
        </Champ>
      </div>
      <Lecture lecture={lecture}>
        {(d) => (
          <Tableau vide="Rien à trancher." lignes={elements(d)} cle={(a) => a.id}
            colonnes={[
              { titre: 'Demande', rendu: (a) => <><strong>{a.libelle}</strong><br /><span className="petit">{a.impact}</span></> },
              { titre: 'Risque', rendu: (a) => <><Risque r={a.risque} />{a.requises > 1 || a.risque === 'R4' ? <><br /><span className="petit">{`${a.requises} accord${a.requises > 1 ? 's' : ''} distinct${a.requises > 1 ? 's' : ''} du demandeur`}</span></> : null}</> },
              { titre: 'Demandée par', rendu: (a) => <><code>{a.demandeur}</code> <span className="petit">({TYPE_ACTEUR[a.demandeur_type] ?? a.demandeur_type})</span><br /><span className="petit">« {a.motif} »</span></> },
              { titre: 'Échéance', rendu: (a) => <span className="petit">{`demandée ${dateHeure(a.cree_le)}, expire ${dateHeure(a.expire_le)}`}</span> },
              { titre: 'Décisions', rendu: (a) => (a.decisions.length ? a.decisions.map((x) => <div key={`${x.par}${x.quand}`} className="petit">{`${x.nom} : ${x.decision}${x.note ? ` (${x.note})` : ''}`}</div>) : <span className="discret">aucune</span>) },
              { titre: '', rendu: (a) => (a.statut === 'en_attente' ? <Trancher ap={a} apres={() => lecture.recharger()} /> : <Pastille ton={STATUT[a.statut]?.[0]}>{STATUT[a.statut]?.[1] ?? a.statut}</Pastille>) },
            ]} />
        )}
      </Lecture>
    </Panneau>
  );
}
