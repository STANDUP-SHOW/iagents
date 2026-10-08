// The mount point of the back-office screens (MASTER §15).
//
// Used by the standalone app (App.jsx) and meant to be mounted as-is by the
// Desktop Commander in an « Administration iAgent » space:
//
//   import Administration from '<repo>/back-office/src/Administration.jsx';
//   import '<repo>/back-office/src/charte.css';
//   <Administration client={creerClientTauri(invoke)} />
//
// It depends on nothing but the `client` it is given (see api.js for the
// interface): no global, no storage, no Tauri import.
import { useEffect, useState } from 'react';
import { ContextePlateforme } from './donnees.jsx';
import Plans, { lectures as lPlans } from './ecrans/Plans.jsx';
import Boxes, { lectures as lBoxes } from './ecrans/Boxes.jsx';
import Licences, { lectures as lLicences } from './ecrans/Licences.jsx';
import Voix, { lectures as lVoix } from './ecrans/Voix.jsx';
import Catalogue, { lectures as lCatalogue } from './ecrans/Catalogue.jsx';
import Personas, { lectures as lPersonas } from './ecrans/Personas.jsx';
import Skills, { lectures as lSkills } from './ecrans/Skills.jsx';
import Opportunites, { lectures as lOpportunites } from './ecrans/Opportunites.jsx';
import Etudes, { lectures as lEtudes } from './ecrans/Etudes.jsx';
import Devis, { lectures as lDevis } from './ecrans/Devis.jsx';
import Audit, { lectures as lAudit } from './ecrans/Audit.jsx';

export const ECRANS = [
  { id: 'plans', titre: 'Plans et prix', Composant: Plans, lectures: lPlans },
  { id: 'boxes', titre: 'Boxes', Composant: Boxes, lectures: lBoxes },
  { id: 'licences', titre: 'Licences', Composant: Licences, lectures: lLicences },
  { id: 'voix', titre: 'Voice et téléphonie', Composant: Voix, lectures: lVoix },
  { id: 'catalogue', titre: 'Catalogue et compteur', Composant: Catalogue, lectures: lCatalogue },
  { id: 'personas', titre: 'Personas et voix', Composant: Personas, lectures: lPersonas },
  { id: 'skills', titre: 'Skill Packs', Composant: Skills, lectures: lSkills },
  { id: 'opportunites', titre: 'Opportunités du jour', Composant: Opportunites, lectures: lOpportunites },
  { id: 'etudes', titre: 'Études et entreprises', Composant: Etudes, lectures: lEtudes },
  { id: 'devis', titre: 'Demandes de devis', Composant: Devis, lectures: lDevis },
  { id: 'audit', titre: 'Audit et télémétrie', Composant: Audit, lectures: lAudit },
];

const ecranDuHash = () => {
  try {
    const id = String(globalThis.location?.hash ?? '').replace(/^#\/?/, '');
    return ECRANS.some((e) => e.id === id) ? id : null;
  } catch { return null; }
};

/**
 * @param client       the Client (api.js)
 * @param initial      answers already known, by path (bench and server render only)
 * @param ecranInitial id of the screen shown first
 * @param propsEcran   props passed to that screen (bench only)
 * @param entete       optional node shown at the top of the side bar (the host's own controls)
 */
export default function Administration({ client, initial = {}, ecranInitial = 'plans', propsEcran = {}, entete = null }) {
  const [ecran, setEcran] = useState(() => ecranDuHash() ?? ecranInitial);
  useEffect(() => {
    const suivre = () => { const id = ecranDuHash(); if (id) setEcran(id); };
    globalThis.addEventListener?.('hashchange', suivre);
    return () => globalThis.removeEventListener?.('hashchange', suivre);
  }, []);
  const actif = ECRANS.find((e) => e.id === ecran) ?? ECRANS[0];
  const { Composant } = actif;
  return (
    <ContextePlateforme.Provider value={{ client, initial }}>
      <div className="bo">
        <div className="bo-cadre">
          <nav className="bo-nav" aria-label="Écrans du back-office">
            <div className="bo-marque">
              <span className="bo-logo">iAgent</span>
              <span className="bo-sous-marque">Back-office</span>
            </div>
            {entete}
            <ul>
              {ECRANS.map((e) => (
                <li key={e.id}>
                  <a href={`#/${e.id}`} className={e.id === actif.id ? 'actif' : undefined} aria-current={e.id === actif.id ? 'page' : undefined}
                    onClick={() => setEcran(e.id)}>{e.titre}</a>
                </li>
              ))}
            </ul>
          </nav>
          <main className="bo-contenu" key={actif.id}>
            <h1 className="bo-titre">{actif.titre}</h1>
            <Composant {...(actif.id === ecranInitial ? propsEcran : {})} />
          </main>
        </div>
      </div>
    </ContextePlateforme.Provider>
  );
}
