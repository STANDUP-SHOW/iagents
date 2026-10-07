// Études et entreprises composées (MASTER §9, §15).
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Erreur, Lecture, Panneau, Resultat, RouteAbsente, lignesDe } from '../composants.jsx';
import { Apercu } from './commun.jsx';

export const lectures = [['opportunitesToutes', {}]];

function NouvelleEtude({ opportunites, onCreee }) {
  const [mode, setMode] = useState('idee');
  const [idee, setIdee] = useState('');
  const [opp, setOpp] = useState('');
  const [etat, lancer] = useAction();
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('creerEtude', { corps: mode === 'idee' ? { idee } : { opportunite_id: opp } }, (c) => c && c.id && onCreee(c.id)); }}>
      <div className="cases">
        <label><input type="radio" checked={mode === 'idee'} onChange={() => setMode('idee')} /> depuis une idée</label>
        <label><input type="radio" checked={mode === 'opportunite'} onChange={() => setMode('opportunite')} /> depuis une opportunité</label>
      </div>
      {mode === 'idee'
        ? <Champ libelle="Idée"><textarea rows={3} value={idee} onChange={(e) => setIdee(e.target.value)} required /></Champ>
        : <Champ libelle="Opportunité"><select value={opp} onChange={(e) => setOpp(e.target.value)} required>
            <option value="">Choisir…</option>
            {opportunites.map((o) => <option key={o.id} value={o.id}>{o.titre} ({o.statut})</option>)}
          </select></Champ>}
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Lancer l'étude</button></div>
      <Resultat etat={etat} succes={(c) => `étude ${c?.id ?? '?'} créée.`} />
    </form>
  );
}

export default function Etudes({ etudeInitiale = '' }) {
  const opps = useLecture('opportunitesToutes');
  const opportunites = lignesDe(opps.donnees, 'opportunites') ?? [];
  const [saisie, setSaisie] = useState(etudeInitiale);
  const [id, setId] = useState(etudeInitiale);
  const etude = useLecture('etude', { params: { id } }, Boolean(id));
  return (
    <>
      <div className="colonnes">
        <Panneau titre="Nouvelle étude" sousTitre="Étude à trois scénarios (POST /create/etudes).">
          {opps.erreur ? <Erreur message={opps.erreur} locale={opps.plateforme === false} /> : null}
          <NouvelleEtude opportunites={opportunites} onCreee={(n) => { setSaisie(n); setId(n); }} />
        </Panneau>
        <Panneau titre="Ouvrir une étude" sousTitre="Par son identifiant, non devinable (GET /create/etudes/:id).">
          <form className="formulaire" onSubmit={(e) => { e.preventDefault(); setId(saisie.trim()); }}>
            <Champ libelle="Identifiant"><input value={saisie} onChange={(e) => setSaisie(e.target.value)} required /></Champ>
            <div className="rangee"><button type="submit" className="bouton">Ouvrir</button></div>
          </form>
          {opportunites.filter((o) => o.etude_id).length ? (
            <ul className="liens">
              {opportunites.filter((o) => o.etude_id).map((o) => <li key={o.id}><Bouton onClick={() => { setSaisie(o.etude_id); setId(o.etude_id); }}>{o.titre}</Bouton></li>)}
            </ul>
          ) : null}
        </Panneau>
      </div>
      {id ? (
        <Panneau titre={`Étude ${id}`} actions={<Bouton onClick={() => etude.recharger()}>Relire</Bouton>}>
          <Lecture lecture={etude}>{(e) => <Apercu valeur={e} />}</Lecture>
        </Panneau>
      ) : null}
      <Panneau titre="Entreprises composées">
        <RouteAbsente
          titre="Les entreprises composées ne se lisent que depuis la Box du client"
          ceQuiManque="Le contrat ne sert les projets (5 phases, équipes du catalogue, budget, jalons) que par /create/box/projets, en accès box : le back-office ne signe pas de requête de Box et ne peut donc pas les voir."
          proposition={[
            { methode: 'GET', chemin: '/create/projets', acces: 'admin', role: '?tenant_id= projets composés, phases, équipes recommandées, budget, jalons' },
          ]}
        />
      </Panneau>
    </>
  );
}
