// Journal du noyau (ADMIN MASTER §7, §16) : l'audit de chaque geste, avec la
// décision des règles, et le fil des événements. Une corrélation suit une
// demande de bout en bout : le clic, la décision, l'approbation, la commande,
// le résultat rendu par la Box.
import { useState } from 'react';
import { useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Tableau, dateHeure } from '../composants.jsx';
import { Risque, elements } from './noyau.jsx';

export const lectures = [['v1Audit', {}], ['v1Evenements', {}]];

const RESULTAT = { SUCCESS: ['succes', 'réussi'], FAILURE: ['danger', 'échoué'], PENDING: ['alerte', 'en attente'], DENIED: ['danger', 'refusé'] };

export default function Journal() {
  const [correlation, setCorrelation] = useState('');
  const audit = useLecture('v1Audit', { query: { correlation_id: correlation } });
  const evenements = useLecture('v1Evenements', { query: { correlation_id: correlation } });
  const suivre = (c) => setCorrelation(c ?? '');
  return (
    <>
      <div className="filtres">
        <Champ libelle="Suivre une corrélation" aide="Cliquez une corrélation dans une ligne, ou collez-la ici.">
          <input value={correlation} onChange={(e) => setCorrelation(e.target.value.trim())} spellCheck={false} />
        </Champ>
        {correlation ? <Bouton onClick={() => setCorrelation('')}>Tout afficher</Bouton> : null}
      </div>
      <Panneau titre="Audit" sousTitre="Qui, quoi, sur quoi, avec quelle décision des règles. Aucun secret n’y est écrit." actions={<Bouton onClick={() => audit.recharger()}>Relire</Bouton>}>
        <Lecture lecture={audit}>
          {(d) => (
            <Tableau vide="Aucune trace pour ce filtre." lignes={elements(d).slice().reverse()} cle={(t) => t.id}
              colonnes={[
                { titre: 'Quand', rendu: (t) => dateHeure(t.quand) },
                { titre: 'Acteur', rendu: (t) => <code>{t.acteur}</code> },
                { titre: 'Action', rendu: (t) => <><code>{t.action}</code><br /><span className="petit">{t.detail}</span></> },
                { titre: 'Cible', rendu: (t) => <code>{t.cible}</code> },
                { titre: 'Règles', rendu: (t) => (t.politique ? <><span className="petit">{t.politique}</span> {t.risque ? <Risque r={t.risque} /> : null}</> : <span className="discret">—</span>) },
                { titre: 'Résultat', rendu: (t) => { const [ton, l] = RESULTAT[t.resultat] ?? ['neutre', t.resultat ?? '—']; return <Pastille ton={ton}>{l}</Pastille>; } },
                { titre: 'Corrélation', rendu: (t) => (t.correlation_id ? <button type="button" className="bouton petit" onClick={() => suivre(t.correlation_id)}>{t.correlation_id.slice(0, 8)}</button> : <span className="discret">—</span>) },
              ]} />
          )}
        </Lecture>
      </Panneau>
      <Panneau titre="Événements" sousTitre="Le fil que les automatismes écoutent : une Box muette ouvre un incident, une Box qui revient le met en surveillance." actions={<Bouton onClick={() => evenements.recharger()}>Relire</Bouton>}>
        <Lecture lecture={evenements}>
          {(d) => (
            <Tableau vide="Aucun événement pour ce filtre." lignes={elements(d).slice().reverse()} cle={(e) => e.id}
              colonnes={[
                { titre: 'N°', rendu: (e) => e.seq },
                { titre: 'Quand', rendu: (e) => dateHeure(e.quand) },
                { titre: 'Événement', rendu: (e) => <code>{e.type}</code> },
                { titre: 'Source', rendu: (e) => <code>{e.source}</code> },
                { titre: 'Données', rendu: (e) => <span className="petit">{Object.entries(e.donnees).map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}</span> },
                { titre: 'Corrélation', rendu: (e) => <button type="button" className="bouton petit" onClick={() => suivre(e.correlation_id)}>{e.correlation_id.slice(0, 8)}</button> },
              ]} />
          )}
        </Lecture>
      </Panneau>
    </>
  );
}
