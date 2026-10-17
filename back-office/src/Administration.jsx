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
import Usine, { lectures as lUsine } from './ecrans/Usine.jsx';
import Emails, { lectures as lEmails } from './ecrans/Emails.jsx';
import Flotte, { lectures as lFlotte } from './ecrans/Flotte.jsx';
import Incidents, { lectures as lIncidents } from './ecrans/Incidents.jsx';
import Approbations, { lectures as lApprobations } from './ecrans/Approbations.jsx';
import Equipe, { lectures as lEquipe } from './ecrans/Equipe.jsx';
import Journal, { lectures as lJournal } from './ecrans/Journal.jsx';

// The three consoles of the ADMIN MASTER (Fleet, Platform, Team) and what they
// share (approvals, journal), in one app: one binary to sign and update.
export const GROUPES = ['Fleet Commander', 'Platform Commander', 'iAgent Team', 'Contrôle', 'Outils'];
export const ECRANS = [
  { id: 'flotte', groupe: 'Fleet Commander', titre: 'Vue de la flotte', Composant: Flotte, lectures: lFlotte },
  { id: 'incidents', groupe: 'Fleet Commander', titre: 'Incidents', Composant: Incidents, lectures: lIncidents },
  { id: 'boxes', groupe: 'Fleet Commander', titre: 'Boxes', Composant: Boxes, lectures: lBoxes },
  { id: 'usine', groupe: 'Fleet Commander', titre: 'Usine', Composant: Usine, lectures: lUsine },
  { id: 'plans', groupe: 'Platform Commander', titre: 'Plans et prix', Composant: Plans, lectures: lPlans },
  { id: 'licences', groupe: 'Platform Commander', titre: 'Licences', Composant: Licences, lectures: lLicences },
  { id: 'voix', groupe: 'Platform Commander', titre: 'Voice et téléphonie', Composant: Voix, lectures: lVoix },
  { id: 'catalogue', groupe: 'Platform Commander', titre: 'Catalogue et compteur', Composant: Catalogue, lectures: lCatalogue },
  { id: 'personas', groupe: 'Platform Commander', titre: 'Personas et voix', Composant: Personas, lectures: lPersonas },
  { id: 'skills', groupe: 'Platform Commander', titre: 'Skill Packs', Composant: Skills, lectures: lSkills },
  { id: 'opportunites', groupe: 'Platform Commander', titre: 'Opportunités du jour', Composant: Opportunites, lectures: lOpportunites },
  { id: 'etudes', groupe: 'Platform Commander', titre: 'Études et entreprises', Composant: Etudes, lectures: lEtudes },
  { id: 'devis', groupe: 'Platform Commander', titre: 'Demandes de devis', Composant: Devis, lectures: lDevis },
  { id: 'equipe', groupe: 'iAgent Team', titre: 'Équipe et rôles', Composant: Equipe, lectures: lEquipe },
  { id: 'approbations', groupe: 'Contrôle', titre: 'Approbations', Composant: Approbations, lectures: lApprobations },
  { id: 'journal', groupe: 'Contrôle', titre: 'Journal du noyau', Composant: Journal, lectures: lJournal },
  { id: 'audit', groupe: 'Contrôle', titre: 'Audit et télémétrie', Composant: Audit, lectures: lAudit },
  { id: 'emails', groupe: 'Outils', titre: 'Studio e-mail', Composant: Emails, lectures: lEmails, horsPlateforme: true },
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
export default function Administration({ client, initial = {}, ecranInitial = 'flotte', propsEcran = {}, entete = null }) {
  const [ecran, setEcran] = useState(() => ecranDuHash() ?? ecranInitial);
  useEffect(() => {
    const suivre = () => { const id = ecranDuHash(); if (id) setEcran(id); };
    globalThis.addEventListener?.('hashchange', suivre);
    return () => globalThis.removeEventListener?.('hashchange', suivre);
  }, []);
  // The studio needs the mailbox commands, which only the back-office app has.
  const ecrans = ECRANS.filter((e) => e.id !== 'emails' || client?.courriel);
  const actif = ecrans.find((e) => e.id === ecran) ?? ecrans[0];
  const { Composant } = actif;
  return (
    <ContextePlateforme.Provider value={{ client, initial }}>
      <div className="bo">
        <div className="bo-cadre">
          <nav className="bo-nav" aria-label="Écrans du back-office">
            <div className="bo-marque">
              <span className="bo-logo">iAgent</span>
              <span className="bo-sous-marque">Admin plateforme</span>
            </div>
            {entete}
            {GROUPES.map((g) => {
              const du = ecrans.filter((e) => e.groupe === g);
              return du.length ? (
                <div key={g} className="bo-groupe">
                  <p className="bo-groupe-titre">{g}</p>
                  <ul>
                    {du.map((e) => (
                      <li key={e.id}>
                        <a href={`#/${e.id}`} className={e.id === actif.id ? 'actif' : undefined} aria-current={e.id === actif.id ? 'page' : undefined}
                          onClick={() => setEcran(e.id)}>{e.titre}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })}
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
