import { useMemo } from 'react';
import { FINANCEMENT } from '../../../dimensionnement/offre-box.ts';
import { conseilPour, euros, ficheDe, installationDe, LOCATION_BOX } from '../data/offres.js';

const PROVISOIRE = 'prix provisoire';

/**
 * The installation to advise for a team, read from conseillerBox: its monthly
 * total during and after the financing term, against the same team all by
 * API. Agents the machine cannot hold are named, they stay by API.
 */
export default function ConseilMachine({ ids, compact = false }) {
  const avis = useMemo(() => conseilPour(ids), [ids.join(',')]);
  if (!avis) return <p className="text-sm text-nuit-300">Cochez au moins un agent pour voir l'installation conseillée.</p>;
  const { conseil: c } = avis;
  const sansMachine = c.offre === 'aucune';
  const { cout } = installationDe(c.offre);
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
            Pour comparer : {euros(c.totalPendant)} par mois au total pendant les {FINANCEMENT.mois} mois de financement, puis {euros(c.totalApres)} par mois,
            contre <span className="text-rose-300">{euros(c.toutApi)}</span> tout par API.
          </p>
          {!compact && (
            <ul className="text-xs text-nuit-300 space-y-0.5">
              {cout.lignes.map((b) => (
                <li key={b.id}>{b.nom} : {b.id === LOCATION_BOX.id ? LOCATION_BOX.phrase : `${euros(b.mensualite)} HT par mois pendant ${FINANCEMENT.mois} mois, abonnement ${euros(b.abonnement)} par mois`}</li>
              ))}
              <li>Électricité : {euros(c.electricite)} par mois</li>
              <li>Part restée par API : {euros(c.api)} par mois</li>
              <li>Plus l'abonnement de chaque agent</li>
            </ul>
          )}
          {cout.mensualiteAConfirmer && <p className="text-xs text-braise-300">Taux du financement à confirmer</p>}
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
      <p className="text-xs text-nuit-400">Estimation calculée sur les tâches de chaque agent, prix hors taxes.</p>
    </div>
  );
}
