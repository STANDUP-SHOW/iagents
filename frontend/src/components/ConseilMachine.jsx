import { useMemo } from 'react';
import { conseilPour, euros, ficheDe } from '../data/offres.js';

const PROVISOIRE = 'prix provisoire';

/**
 * The installation to advise for a team, read from conseillerBox: its monthly
 * total during and after the 24-month financing, against the same team all by
 * API. Agents the machine cannot hold are named, they stay by API.
 */
export default function ConseilMachine({ ids, compact = false }) {
  const avis = useMemo(() => conseilPour(ids), [ids.join(',')]);
  if (!avis) return <p className="text-sm text-nuit-300">Cochez au moins un agent pour voir l'installation conseillée.</p>;
  const { conseil: c } = avis;
  const sansMachine = c.offre === 'aucune';
  return (
    <div className="text-sm text-nuit-200 space-y-1">
      <p>
        Installation conseillée : <span className="text-neon-300 font-semibold">{c.nom}</span>
        {c.aConfirmer && <span className="text-xs text-braise-300"> ({PROVISOIRE})</span>}
      </p>
      {sansMachine ? (
        <p>Tout par API : {euros(c.toutApi)} par mois. Pour cette équipe, aucune machine ne se rembourse.</p>
      ) : (
        <>
          <p>
            {euros(c.totalPendant)} par mois pendant les 24 mois de financement, puis {euros(c.totalApres)} par mois,
            contre <span className="text-rose-300">{euros(c.toutApi)}</span> tout par API.
          </p>
          {!compact && (
            <p className="text-xs text-nuit-400">
              {c.enLocal.length} agent{c.enLocal.length > 1 ? 's' : ''} en local
              {Number.isFinite(c.moisPourRembourser) && c.moisPourRembourser > 0 && <>, machine remboursée en {c.moisPourRembourser} mois si achetée comptant</>}.
            </p>
          )}
          {c.enApi.length > 0 && (
            <p className="text-xs text-braise-300">
              Restent par API, la machine ne les tient pas :{' '}
              {compact ? `${c.enApi.length} agent${c.enApi.length > 1 ? 's' : ''}` : c.enApi.map((id) => ficheDe(id)?.nom ?? id).join(', ')}.
            </p>
          )}
        </>
      )}
      <p className="text-xs text-nuit-400">Estimation calculée sur les tâches de chaque agent. Prix des machines provisoires, en attente de l'offre définitive.</p>
    </div>
  );
}
