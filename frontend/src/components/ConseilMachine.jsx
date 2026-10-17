import { useMemo } from 'react';
import { conseilPour, euros, LOCATION_BOX } from '../data/offres.js';

/**
 * The installation to advise for a team, read from conseillerBox: its monthly
 * total during and after the financing term, against the same team all by
 * API. Agents the machine cannot hold are named, they stay by API.
 */
export default function ConseilMachine({ ids, compact = false }) {
  const avis = useMemo(() => conseilPour(ids), [ids.join(',')]);
  if (!avis) return <p className="text-sm text-nuit-300">Cochez au moins un agent pour voir l'installation conseillée.</p>;
  const { conseil: c, loyer, total } = avis;
  const sansMachine = c.offre === 'aucune';
  const n = avis.fiches.length;
  const box = c.nombreBox > 1 ? `${c.nombreBox} ${c.nom}` : c.nom;
  return (
    <div className="text-sm text-nuit-200 space-y-1">
      <p>
        Installation conseillée : <span className="text-neon-300 font-semibold">{sansMachine ? c.nom : box}</span>
      </p>
      {sansMachine ? (
        <p>Pour {n === 1 ? 'un agent' : 'deux agents'}, votre ordinateur suffit : {n === 1 ? 'il travaille' : 'ils travaillent'} par API, environ {euros(c.toutApi)} de consommation par mois. Dès trois agents, la Box 64 Go prend le relais.</p>
      ) : (
        <>
          <p>
            {c.nombreBox > 1 ? `Une Box 64 Go par dizaine d'agents, ${c.nombreBox} pour ${n} agents. ` : ''}
            Location : {euros(loyer)} par mois ; consommation d'IA restée par API : {euros(c.api)} par mois, contre <span className="text-rose-300">{euros(c.toutApi)}</span> sans Box.
          </p>
          {!compact && (
            <ul className="text-xs text-nuit-300 space-y-0.5">
              <li>{c.nom} : {LOCATION_BOX.phrase}{c.nombreBox > 1 ? `, × ${c.nombreBox}` : ''}</li>
              <li>Total Box et consommation : {euros(total)} par mois, plus l'abonnement de chaque agent</li>
              <li>{c.enLocal.length} agent{c.enLocal.length > 1 ? 's' : ''} entièrement chez vous ; les autres y font leur travail courant et envoient le plus lourd par API</li>
            </ul>
          )}
        </>
      )}
      <p className="text-xs text-nuit-400">Estimation calculée sur les tâches de chaque agent, prix hors taxes.</p>
    </div>
  );
}
