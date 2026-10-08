import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import FicheDetail from './components/FicheDetail.jsx';
import PacksEntreprise from './components/PacksEntreprise.jsx';
import CreezEntreprise from './components/CreezEntreprise.jsx';
import IAgentBox from './components/IAgentBox.jsx';
import GlobalNav from './accueil/scenes/GlobalNav.jsx';
import Terre from './accueil/Terre.jsx';
import { CarteAgent, Apercu, Recherche, GroupeFiltre } from './bibliotheque/composants.jsx';
import { AGENTS_RESEAUX, PACKS_ENTREPRISE, INSTALLATIONS, ficheDe, installationDe, devisAgent } from './data/offres.js';
import agents from './data/loader.js';
import {
  filtrer, decompte, FILTRES_VIDES, libelleSecteur, libelleFamille, logicielsDe, portraitDe, COMPTEURS,
  activitesDeLaRecherche, urlActivite, ACTIVITES,
} from './data/recherche.js';
import { estTransversal, FAMILLES_ACTIVITE } from './data/activites-recherche.js';
import { LIENS } from './accueil/composants.jsx';
import { suivre } from './accueil/analytique.js';

// What the library offers when nothing matches: the jobs every business has.
const POUR_TOUS = agents.filter(estTransversal).slice(0, 12);

// The shop's three pages, and the ways to browse the catalogue.
export const PAGES = [
  { id: 'catalogue', libelle: 'Catalogue' },
  { id: 'entreprise', libelle: 'Créez votre entreprise' },
  { id: 'box', libelle: 'iAgent Box' },
];
export const VUES = [
  { id: 'metier', libelle: 'Tous les agents' },
  { id: 'activites', libelle: 'Par activité' },
  { id: 'secteurs', libelle: 'Par secteur' },
  { id: 'reseaux', libelle: 'Agents réseaux' },
  { id: 'packs', libelle: 'Packs entreprise' },
];

const TRIS = [
  ['pertinence', 'Pertinence'],
  ['reference', 'Référence'],
  ['missions', 'Nombre de missions'],
  ['charge', 'Volume de travail'],
];
const PAR_PAGE = 24;

// The chosen installation survives page changes and reloads; storage can be
// missing (private window, SSR bench), so every access is guarded.
const CLE_INSTALLATION = 'iagent-installation';
const lireInstallation = () => {
  try { return installationDe(globalThis.localStorage?.getItem(CLE_INSTALLATION))?.id ?? null; } catch { return null; }
};
const ecrireInstallation = (id) => {
  try { globalThis.localStorage?.setItem(CLE_INSTALLATION, id); } catch { /* per-visitor convenience only */ }
};

const nombre = (x) => x.toLocaleString('fr-FR');
const OU = { 'chez-vous': 'Chez vous', api: 'Par API' };

const ATOUTS = [
  ['M4 20V10 M10 20V4 M16 20v-7 M22 20H2', 'Des agents pour chaque métier', 'du terrain au stratégique'],
  ['M3 21h18 M5 21V8l7-4 7 4v13 M9 12h.01 M15 12h.01 M9 16h.01 M15 16h.01', 'Experts de votre secteur', 'banque, santé, industrie, services…'],
  ['M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z', 'Déjà formés à vos outils', 'CRM, ERP, comptabilité, bureautique…'],
  ['M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-4.1-1.1z', 'Recrutés par conversation', 'un entretien, pas un paramétrage'],
];

/** The catalogue's entry, as max's mockup: the planet, the promise, the search. */
function Entree({ requete, setRequete }) {
  return (
    <section className="bi-entree" aria-labelledby="titre-bibliotheque">
      <Terre className="bi-entree-terre" cx={0.62} cy={1.5} r={0.95} />
      <div className="bi-entree-fond" aria-hidden="true" />
      <div className="bi-cadre bi-entree-grille">
        <div>
          <p className="mq-surtitre">Un métier, votre secteur, votre activité : votre expert.</p>
          <h1 id="titre-bibliotheque" className="mq-display bi-h1">Le catalogue des <span className="mq-cyan">métiers</span></h1>
          <p className="bi-chapeau">Choisissez un métier, puis votre secteur et votre activité : iAgent en fait un expert taillé pour votre entreprise. Une assistante commerciale peut servir le commerce maritime, une imprimerie en Espagne ou une compagnie aérienne à Paris.</p>
          <dl className="bi-compteurs">
            <div><dt>métiers</dt><dd>{nombre(COMPTEURS.agents)}</dd></div>
            <div><dt>secteurs</dt><dd>{COMPTEURS.secteurs}</dd></div>
            <div><dt>activités</dt><dd>{COMPTEURS.activites}</dd></div>
            <div><dt>logiciels connus</dt><dd>{nombre(COMPTEURS.logiciels)}</dd></div>
          </dl>
          <div className="bi-entree-recherche"><Recherche valeur={requete} onChange={setRequete} /></div>
        </div>
        <ul className="bi-atouts" aria-label="Ce que vous trouvez ici">
          {ATOUTS.map(([d, t, s]) => (
            <li key={t}>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d={d} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <p><b>{t}</b><span>{s}</span></p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function App({ pageInitiale = 'catalogue', vueInitiale = 'metier', installationInitiale, rechercheInitiale = '', secteurInitial = '', ideeInitiale = '' }) {
  const [page, setPage] = useState(pageInitiale);
  const [installation, setInstallationEtat] = useState(() => installationInitiale ?? lireInstallation());
  const choisirInstallation = (id) => { setInstallationEtat(id); ecrireInstallation(id); };
  const [vue, setVue] = useState(VUES.some((v) => v.id === vueInitiale) ? vueInitiale : 'metier');
  const [packOuvert, setPackOuvert] = useState(null);
  const [requete, setRequete] = useState(rechercheInitiale);
  const [filtres, setFiltres] = useState(secteurInitial ? { ...FILTRES_VIDES, secteurs: [secteurInitial] } : FILTRES_VIDES);
  const [tri, setTri] = useState('pertinence');
  const [compact, setCompact] = useState(false);
  const [apercu, setApercu] = useState(null);
  const [ficheOuverte, setFicheOuverte] = useState(null);
  const [tiroir, setTiroir] = useState(false);
  const [combien, setCombien] = useState(PAR_PAGE);

  // The list the filters apply to: the whole catalogue, the network agents, or
  // the agents of the business pack that is open.
  const base = useMemo(() => {
    if (vue === 'reseaux') return AGENTS_RESEAUX.map(ficheDe).filter(Boolean);
    if (vue === 'packs' && packOuvert) return PACKS_ENTREPRISE.find((p) => p.id === packOuvert).agents.map(ficheDe);
    return agents;
  }, [vue, packOuvert]);

  // Where each agent works on the visitor's installation, from the same quote
  // the full fiche shows (dimensionnement/offre-box.ts).
  const ouParAgent = useMemo(() => {
    if (!installation) return null;
    return new Map(agents.map((a) => [a.id, devisAgent(a).find((l) => l.offre === installation)?.enLocal ? 'chez-vous' : 'api']));
  }, [installation]);
  const ouTravaille = useCallback((a) => ouParAgent?.get(a.id), [ouParAgent]);

  const resultats = useMemo(() => {
    const liste = filtrer(base, { requete, ...filtres, ou: ouParAgent ? filtres.ou : [] }, ouTravaille);
    const par = {
      reference: (x, y) => x.id.localeCompare(y.id),
      missions: (x, y) => (y.taches?.length ?? 0) - (x.taches?.length ?? 0),
      charge: (x, y) => (y.execution?.appelsParJourEstimes ?? 0) - (x.execution?.appelsParJourEstimes ?? 0),
    }[tri];
    return par ? [...liste].sort(par) : liste;
  }, [base, requete, filtres, tri, ouParAgent, ouTravaille]);

  // Someone who searched from the header came for the answer, not the hero:
  // take them to the results.
  useEffect(() => {
    if (rechercheInitiale || secteurInitial || vueInitiale !== 'metier') document.getElementById('resultats')?.scrollIntoView({ block: 'start' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The trade the visitor typed (« imprimerie »), told above the results.
  const activitesVues = useMemo(() => activitesDeLaRecherche(requete), [requete]);

  const options = useMemo(() => ({
    secteurs: decompte(base, (a) => [a.secteur]),
    familles: decompte(base, (a) => [a.famille]),
    logiciels: decompte(base, logicielsDe),
    ou: ouParAgent ? decompte(base, (a) => [ouParAgent.get(a.id)]) : [],
  }), [base, ouParAgent]);

  useEffect(() => { setCombien(PAR_PAGE); }, [requete, filtres, tri, vue, packOuvert]);

  // More profiles as the reader reaches the end of the list; the button stays
  // for keyboards and for browsers without IntersectionObserver.
  const fin = useRef(null);
  useEffect(() => {
    if (!fin.current || typeof IntersectionObserver === 'undefined') return undefined;
    const o = new IntersectionObserver((e) => { if (e[0].isIntersecting) setCombien((c) => c + PAR_PAGE); }, { rootMargin: '600px' });
    o.observe(fin.current);
    return () => o.disconnect();
  }, [resultats.length, combien]);

  const changer = (cle) => (valeurs) => setFiltres((f) => ({ ...f, [cle]: valeurs }));
  const choisis = [
    ...filtres.secteurs.map((v) => ['secteurs', v, libelleSecteur(v)]),
    ...filtres.familles.map((v) => ['familles', v, libelleFamille(v)]),
    ...filtres.logiciels.map((v) => ['logiciels', v, v]),
    ...(ouParAgent ? filtres.ou.map((v) => ['ou', v, OU[v]]) : []),
  ];
  const reinitialiser = () => { setFiltres(FILTRES_VIDES); setRequete(''); };
  const montrerListe = (vue !== 'packs' || packOuvert) && vue !== 'activites' && vue !== 'secteurs';
  // The two other ways in: pick your trade or your family of jobs, and the
  // list opens on it.
  const auxResultats = () => document.getElementById('resultats')?.scrollIntoView({ block: 'start' });
  const ouvrirActivite = (a) => { setVue('metier'); setFiltres(FILTRES_VIDES); setRequete(a.nom); suivre('catalog_click', { activite: a.nom }); auxResultats(); };
  const ouvrirSecteur = (id) => { setVue('metier'); setRequete(''); setFiltres({ ...FILTRES_VIDES, secteurs: [id] }); auxResultats(); };
  const fermerApercu = useCallback(() => setApercu(null), []);

  // On a wide screen the preview is always there, as on the mockup: the
  // first profile of the list until the visitor picks another.
  // On a wide screen the first profile opens beside the grid, as on the
  // mockup; once, so closing it is respected.
  const apercuOuvertSeul = useRef(false);
  useEffect(() => {
    if (apercuOuvertSeul.current || page !== 'catalogue' || !montrerListe || apercu || !resultats.length) return;
    apercuOuvertSeul.current = resultats[0].id;
    if (window.matchMedia?.('(min-width: 1280px)').matches) setApercu(resultats[0]);
  }, [page, montrerListe, resultats, apercu]);

  const panneauFiltres = (
    <div className="bi-filtres-contenu">
      {installation ? (
        <div className="bi-installation">
          <span>Votre installation</span>
          <strong>{installationDe(installation).nom}</strong>
          <button type="button" onClick={() => setPage('box')}>changer</button>
        </div>
      ) : (
        <div className="bi-installation bi-installation-choix">
          <h2>D'abord, votre installation</h2>
          <p>Elle décide de ce que chaque agent vous coûte, chez vous ou par API.</p>
          <div className="bi-installations">
            {INSTALLATIONS.map((o) => <button key={o.id} type="button" onClick={() => choisirInstallation(o.id)}>{o.nom}</button>)}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <p className="bi-filtres-titre">Filtres</p>
        {choisis.length > 0 && <button type="button" className="bi-reinit" onClick={() => setFiltres(FILTRES_VIDES)}>Réinitialiser</button>}
      </div>
      <GroupeFiltre titre="Secteur" options={options.secteurs} choisis={filtres.secteurs} onChange={changer('secteurs')} libelle={libelleSecteur} cherchable ouvertParDefaut />
      <GroupeFiltre titre="Type de profil" options={options.familles} choisis={filtres.familles} onChange={changer('familles')} libelle={libelleFamille} />
      <GroupeFiltre titre="Logiciels maîtrisés" options={options.logiciels} choisis={filtres.logiciels} onChange={changer('logiciels')} cherchable />
      {ouParAgent && (
        <GroupeFiltre titre={`Sur votre ${installationDe(installation).nom}`} options={options.ou} choisis={filtres.ou} onChange={changer('ou')} libelle={(v) => OU[v]} ouvertParDefaut />
      )}
    </div>
  );

  return (
    <div className="bi-page">
      <GlobalNav page="catalogue" seuil={40} />
      <main id="contenu" className="pt-[72px]">
        {page === 'catalogue' && <Entree requete={requete} setRequete={setRequete} />}

        {page !== 'catalogue' && (
          <nav className="bi-cadre bi-pages pt-6" aria-label="Sections de la bibliothèque">
            {PAGES.map((p) => (
              <button key={p.id} type="button" onClick={() => setPage(p.id)} aria-current={page === p.id ? 'page' : undefined}>{p.libelle}</button>
            ))}
          </nav>
        )}

        {page !== 'catalogue' && installation && (
          <div className="bi-cadre bi-installation">
            <span>Votre installation : <strong>{installationDe(installation).nom}</strong></span>
            <button type="button" onClick={() => setPage('box')}>changer</button>
          </div>
        )}

        {page === 'entreprise' && <div className="bi-cadre py-8"><CreezEntreprise ideeInitiale={ideeInitiale} /></div>}
        {page === 'box' && <div className="bi-cadre py-8"><IAgentBox installation={installation} onChoisir={(id) => { choisirInstallation(id); setPage('catalogue'); }} /></div>}

        {page === 'catalogue' && (
          <div className={`bi-cadre bi-catalogue ${apercu ? 'avec-apercu' : ''}`}>
            <aside className="bi-filtres" aria-label="Filtres">{panneauFiltres}</aside>

            <section id="resultats" className="bi-resultats" aria-label="Profils">
              <div className="bi-haut">
                <p className="bi-total">{vue === 'activites' ? <><strong>{nombre(ACTIVITES.length)}</strong> activités</> : vue === 'secteurs' ? <><strong>{COMPTEURS.secteurs}</strong> secteurs</> : montrerListe && !resultats.length
                  ? <><strong>{nombre(POUR_TOUS.length)}</strong> métiers proposés</>
                  : <><strong>{nombre(montrerListe ? resultats.length : PACKS_ENTREPRISE.length)}</strong> {montrerListe ? (resultats.length > 1 ? 'métiers' : 'métier') : 'packs'}</>}</p>
                <div className="bi-vues" role="tablist" aria-label="Parcourir le catalogue">
                  {VUES.map((v) => (
                    <button key={v.id} type="button" role="tab" aria-selected={vue === v.id} onClick={() => { setVue(v.id); setPackOuvert(null); setFiltres(FILTRES_VIDES); setApercu(null); }}>{v.libelle}</button>
                  ))}
                </div>
                <div className="bi-outils-liste" hidden={vue === 'activites' || vue === 'secteurs'}>
                  <button type="button" className="bi-bouton-filtres" onClick={() => setTiroir(true)}>Filtres{choisis.length > 0 && <span className="bi-nb">{choisis.length}</span>}</button>
                  <label className="bi-tri">
                    <span className="sr-only">Trier par</span>
                    <select value={tri} onChange={(e) => setTri(e.target.value)}>
                      {TRIS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                    </select>
                  </label>
                  <div className="bi-affichage" role="group" aria-label="Affichage">
                    <button type="button" aria-pressed={!compact} onClick={() => setCompact(false)} aria-label="Grandes cartes">
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" /></svg>
                    </button>
                    <button type="button" aria-pressed={compact} onClick={() => setCompact(true)} aria-label="Liste compacte">
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="2" width="14" height="3" rx="1.5" fill="currentColor" /><rect x="1" y="6.5" width="14" height="3" rx="1.5" fill="currentColor" /><rect x="1" y="11" width="14" height="3" rx="1.5" fill="currentColor" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              {(choisis.length > 0 || requete) && (
                <div className="bi-choisis">
                  {requete && <button type="button" onClick={() => setRequete('')}>« {requete} » <span aria-hidden="true">×</span><span className="sr-only">retirer</span></button>}
                  {choisis.map(([cle, v, l]) => (
                    <button key={cle + v} type="button" onClick={() => changer(cle)(filtres[cle].filter((x) => x !== v))}>{l} <span aria-hidden="true">×</span><span className="sr-only">retirer</span></button>
                  ))}
                  <button type="button" className="bi-reinit" onClick={reinitialiser}>Tout effacer</button>
                </div>
              )}

              {montrerListe && activitesVues.length > 0 && (
                <div className="bi-activite">
                  <p className="surtitre">Votre activité</p>
                  <p className="titre-display titre-petit">{activitesVues[0].nom}</p>
                  <p className="mt-2 text-[var(--texte-doux)]">
                    {activitesVues[0].trait} Chaque métier ci-dessous reçoit le savoir de votre activité en plus du sien
                    {activitesVues[0].pack?.vocabulaire?.length ? <> : {activitesVues[0].pack.vocabulaire.slice(0, 4).map((v) => (v.terme === v.terme.toUpperCase() ? v.terme : v.terme.toLowerCase())).join(', ')}, ses documents et ses logiciels.</> : '.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a href={urlActivite(activitesVues[0])} className="bouton bouton-contour">Tout sur votre activité</a>
                    {activitesVues.slice(1).map((a) => <a key={a.id} href={urlActivite(a)} className="bouton bouton-contour">{a.nom}</a>)}
                  </div>
                </div>
              )}

              {vue === 'activites' && (
                <div className="bi-index">
                  <p className="text-[var(--texte-doux)] mb-6">Choisissez votre activité : chaque métier que vous recrutez reçoit son vocabulaire, ses documents, ses règles et ses logiciels.</p>
                  {Object.entries(FAMILLES_ACTIVITE).map(([id, nom]) => (
                    <section key={id} className="mb-8">
                      <p className="surtitre mb-3">{nom}</p>
                      <ul className="bi-index-liste">
                        {ACTIVITES.filter((a) => a.famille === id).map((a) => (
                          <li key={a.id}><button type="button" onClick={() => ouvrirActivite(a)}>{a.nom}</button></li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
              {vue === 'secteurs' && (
                <div className="bi-index">
                  <p className="text-[var(--texte-doux)] mb-6">Les {nombre(COMPTEURS.agents)} métiers rangés en {COMPTEURS.secteurs} familles.</p>
                  <ul className="bi-index-liste bi-index-secteurs">
                    {options.secteurs.map(([id, n]) => (
                      <li key={id}><button type="button" onClick={() => ouvrirSecteur(id)}>{libelleSecteur(id)}<span>{n} métiers</span></button></li>
                    ))}
                  </ul>
                </div>
              )}

              {vue === 'packs' && <div className="mb-6"><PacksEntreprise packOuvert={packOuvert} onOuvrir={setPackOuvert} /></div>}

              {montrerListe && (resultats.length > 0 ? (
                <>
                  <div className={compact ? 'bi-liste-compacte' : 'bi-grille'}>
                    {resultats.slice(0, combien).map((a, i) => (
                      <CarteAgent key={a.id} agent={a} compact={compact} choisi={apercu?.id === a.id} onVoir={setApercu} prioritaire={i < 6} />
                    ))}
                  </div>
                  {combien < resultats.length && (
                    <div ref={fin} className="flex justify-center py-10">
                      <button type="button" className="bouton bouton-contour" onClick={() => setCombien((c) => c + PAR_PAGE)}>
                        Afficher plus de profils ({nombre(resultats.length - combien)} restants)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="bi-vide">
                    <p className="titre-display titre-petit">Pas encore de métier à ce nom : nous pouvons vous le composer.</p>
                    <p className="mt-2 text-[var(--texte-doux)]">Dites ce que vous voulez confier, et iAgent compose l'agent ou l'équipe sur mesure. Vous pouvez aussi chercher par activité, ou partir des métiers que toute entreprise emploie, juste en dessous.</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <a href={LIENS.idee(requete || 'Un agent pour mon entreprise')} className="bouton bouton-plein">Composer un agent sur mesure</a>
                      <a href="/activites" className="bouton bouton-contour">Chercher par activité</a>
                      {choisis.length > 0 && <button type="button" className="bouton bouton-contour" onClick={() => setFiltres(FILTRES_VIDES)}>Retirer les filtres</button>}
                    </div>
                  </div>
                  <p className="surtitre mt-10 mb-4">Les métiers que toute entreprise emploie</p>
                  <div className={compact ? 'bi-liste-compacte' : 'bi-grille'}>
                    {POUR_TOUS.map((a) => <CarteAgent key={a.id} agent={a} compact={compact} choisi={apercu?.id === a.id} onVoir={setApercu} />)}
                  </div>
                </>
              ))}
            </section>

            {apercu && (
              <>
                <div className="bi-voile" onClick={fermerApercu} aria-hidden="true" />
                <div className="bi-apercu-zone">
                  <Apercu agent={apercu} installation={installation} onFermer={fermerApercu} onFicheComplete={setFicheOuverte} focaliser={apercu.id !== apercuOuvertSeul.current} />
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {tiroir && (
        <div className="bi-tiroir" role="dialog" aria-modal="true" aria-label="Filtres">
          <div className="bi-voile !block" onClick={() => setTiroir(false)} aria-hidden="true" />
          <div className="bi-tiroir-panneau">
            {panneauFiltres}
            <button type="button" className="bouton bouton-plein w-full mt-6" onClick={() => setTiroir(false)}>Voir les {nombre(resultats.length)} profils</button>
          </div>
        </div>
      )}

      {ficheOuverte && (
        <FicheDetail agent={ficheOuverte} installation={installation} onClose={() => setFicheOuverte(null)} />
      )}
    </div>
  );
}
