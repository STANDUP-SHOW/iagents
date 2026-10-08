// The library's pieces: the profile card, the preview panel, the search field
// and the filters. They only present what the fiches already say.
import { useEffect, useId, useRef, useState } from 'react';
import { libelleSecteur, libelleFamille, logicielsDe, nomDuLogiciel, portraitDe, suggestions } from '../data/recherche.js';
import { PRIX_AGENT_MOIS, NOTE_ACHAT } from '../data/prix.js';
import { passes3xTest, ratio3x } from '../data/loader.js';
import { devisAgent, euros, installationDe } from '../data/offres.js';
import { RECRUTER } from '../accueil/composants.jsx';

const Fleche = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="flex-none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Loupe = ({ taille = 18 }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" className="flex-none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" fill="none" />
    <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** The badge some profiles carry: the economy rule of docs/economie.md, met. */
function Badge({ agent }) {
  if (!passes3xTest(agent)) return null;
  return (
    <span className="bi-badge" title="Sur une machine partagée, cet agent coûte au moins trois fois moins cher que par API seule (docs/economie.md).">
      {ratio3x(agent).toFixed(1).replace('.', ',')}× moins cher chez vous
    </span>
  );
}

/**
 * A collaborator's profile, not a product: portrait, reference, job, sector,
 * what it does, the software it knows, its price.
 */
export function CarteAgent({ agent, choisi, onVoir, compact = false, prioritaire = false }) {
  const logiciels = logicielsDe(agent).slice(0, 3);
  const ouvrir = () => onVoir(agent);
  return (
    <article className={`bi-carte ${compact ? 'bi-carte-compacte' : ''} ${choisi ? 'bi-carte-choisie' : ''}`}>
      <div className="bi-portrait">
        <img src={portraitDe(agent)} alt="" width="206" height="256" loading={prioritaire ? 'eager' : 'lazy'} decoding="async" />
        <Badge agent={agent} />
      </div>
      <div className="bi-corps">
        <p className="bi-ref">{agent.id}</p>
        <h3 className="bi-poste">
          <button type="button" onClick={ouvrir} className="text-left" aria-label={`Aperçu du profil ${agent.nom}`}>{agent.nom}</button>
        </h3>
        <p className="bi-secteur">{libelleSecteur(agent.secteur)} · {libelleFamille(agent.famille)}</p>
        {!compact && <p className="bi-accroche">{agent.accroche}</p>}
        {logiciels.length > 0 && (
          <ul className="bi-puces" aria-label="Logiciels qu'il connaît">
            {logiciels.map((l) => <li key={l}>{l}</li>)}
          </ul>
        )}
        <div className="bi-pied">
          <div>
            <p className="bi-prix">{PRIX_AGENT_MOIS ?? 'Sur devis'}{PRIX_AGENT_MOIS && <span> / mois</span>}</p>
            <p className="bi-prix-note">{NOTE_ACHAT ? `${NOTE_ACHAT} · ` : ''}{agent.taches?.length ?? 0} missions</p>
          </div>
          <button type="button" className="bi-voir" onClick={ouvrir}>Voir le profil <Fleche /></button>
        </div>
      </div>
    </article>
  );
}

const ONGLETS_APERCU = [
  ['competences', 'Compétences'],
  ['missions', 'Missions'],
  ['integrations', 'Logiciels'],
  ['details', 'Détails'],
];

/**
 * The preview beside the grid (a sheet from the bottom on a phone): enough to
 * decide whether to open the full fiche.
 */
export function Apercu({ agent, installation, onFermer, onFicheComplete, focaliser = true }) {
  const [onglet, setOnglet] = useState('competences');
  const fermer = useRef(null);
  useEffect(() => { setOnglet('competences'); if (focaliser) fermer.current?.focus({ preventScroll: true }); }, [agent?.id]);
  useEffect(() => {
    const echap = (e) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onFermer]);
  if (!agent) return null;

  const qualifs = agent.qualifications?.logiciels ?? [];
  const ligne = installation ? devisAgent(agent).find((l) => l.offre === installation) : null;

  return (
    <aside className="bi-apercu" aria-label={`Profil : ${agent.nom}`}>
      <div className="bi-apercu-tete">
        <img src={portraitDe(agent)} alt="" width="206" height="256" decoding="async" />
        <div className="bi-apercu-voile" />
        <button ref={fermer} type="button" className="bi-fermer" onClick={onFermer} aria-label="Fermer l'aperçu">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <div className="bi-apercu-titre">
          <p className="bi-ref">{agent.id}</p>
          <h2 className="font-[Montserrat] text-2xl font-semibold leading-tight text-white">{agent.nom}</h2>
          <p className="bi-secteur">{libelleSecteur(agent.secteur)} · {libelleFamille(agent.famille)}</p>
          <p className="bi-dispo"><span aria-hidden="true" /> Disponible</p>
        </div>
      </div>

      <div className="bi-apercu-corps">
        <p className="text-[0.95rem] leading-relaxed text-[var(--texte)]">{agent.accroche}</p>
        {agent.expert?.persona && <p className="mt-3 text-[0.85rem] leading-relaxed text-[var(--texte-doux)] line-clamp-4">{agent.expert.persona}</p>}

        <div className="bi-apercu-prix">
          <div>
            <p className="bi-prix text-2xl">{PRIX_AGENT_MOIS ?? 'Sur devis'}{PRIX_AGENT_MOIS && <span> / mois</span>}</p>
            <p className="bi-prix-note">{NOTE_ACHAT ? `${NOTE_ACHAT}, ` : ''}la Box et la consommation à part</p>
          </div>
          <div className="text-right">
            <p className="text-white font-semibold">{agent.taches?.length ?? 0}</p>
            <p className="bi-prix-note">missions décrites</p>
          </div>
        </div>

        <div className="bi-onglets" role="tablist" aria-label="Le profil en détail">
          {ONGLETS_APERCU.map(([id, libelle]) => (
            <button key={id} type="button" role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)}>{libelle}</button>
          ))}
        </div>

        <div className="bi-onglet" role="tabpanel">
          {onglet === 'competences' && (
            <ul className="bi-liste-coche">
              {(agent.expert?.connaissances ?? []).slice(0, 8).map((k) => <li key={k.titre}>{k.titre}</li>)}
            </ul>
          )}
          {onglet === 'missions' && (
            <ul className="bi-liste-coche">
              {(agent.taches ?? []).slice(0, 10).map((t) => <li key={t.id}>{t.nom}</li>)}
              {(agent.taches?.length ?? 0) > 10 && <li className="!text-[var(--texte-pale)] before:!hidden">et {agent.taches.length - 10} autres dans la fiche complète</li>}
            </ul>
          )}
          {onglet === 'integrations' && (
            <ul className="flex flex-col gap-3">
              {qualifs.filter((q) => nomDuLogiciel(q.logiciel)).map((q) => (
                <li key={q.logiciel}>
                  <p className="text-white text-[0.9rem]">{nomDuLogiciel(q.logiciel)}{q.principal && <span className="bi-principal">principal</span>}</p>
                  {q.usage && <p className="text-[0.8rem] text-[var(--texte-doux)]">{q.usage}</p>}
                </li>
              ))}
              <li className="text-[0.75rem] text-[var(--texte-pale)]">L'agent sait se servir de ces logiciels ; il les rejoint avec les accès que vous lui confiez à l'embauche.</li>
            </ul>
          )}
          {onglet === 'details' && (
            <dl className="bi-details">
              <div><dt>Où il travaille</dt><dd>{agent.execution?.defaut === 'local' ? 'Chez vous par défaut, par API si vous le choisissez' : 'Par API'}</dd></div>
              {agent.materiel?.gpu?.libelle && <div><dt>Machine conseillée</dt><dd>{agent.materiel.gpu.libelle}</dd></div>}
              {ligne && <div><dt>Sur votre {installationDe(installation).nom}</dt><dd>{ligne.enLocal ? 'il travaille chez vous' : 'il passe par l\'API'}, environ {euros(ligne.coutAgent)} / mois de fonctionnement</dd></div>}
              <div><dt>Autonomie</dt><dd>Il travaille seul ; vous choisissez à l'entretien ce qui attend votre accord.</dd></div>
            </dl>
          )}
        </div>
      </div>

      <div className="bi-apercu-actions">
        <a href={RECRUTER} className="bouton bouton-plein w-full">Recruter cet agent <Fleche /></a>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="bouton bouton-contour !text-sm" onClick={() => onFicheComplete(agent)}>Fiche complète</button>
          <a href={`/agents/${agent.slug}`} className="bouton bouton-contour !text-sm">Page du métier</a>
        </div>
        <p className="text-[0.72rem] text-[var(--texte-pale)] text-center">L'embauche se fait par un entretien dans l'application iAgent : vous y choisissez son prénom, sa voix et ses missions.</p>
      </div>
    </aside>
  );
}

const EXEMPLES = ['commercial immobilier', 'Salesforce', 'assistant comptable', 'prospection', 'conformité bancaire'];

/** The library's main field, with suggestions from the jobs, sectors and software. */
export function Recherche({ valeur, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const id = useId();
  const liste = ouvert ? suggestions(valeur) : [];
  const choisir = (texte) => { onChange(texte); setOuvert(false); setActif(-1); };
  const clavier = (e) => {
    if (!liste.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif((a) => (a + 1) % liste.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((a) => (a <= 0 ? liste.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && actif >= 0) { e.preventDefault(); choisir(liste[actif].texte); }
    else if (e.key === 'Escape') setOuvert(false);
  };
  return (
    <div className="bi-recherche-zone">
      <div className="bi-recherche" role="search">
        <span className="text-[var(--cyan)]"><Loupe taille={20} /></span>
        <label htmlFor={`${id}-q`} className="sr-only">Rechercher un agent, un métier, une compétence, un logiciel</label>
        <input
          id={`${id}-q`}
          type="search"
          value={valeur}
          placeholder="Rechercher un agent, un métier, une compétence, un logiciel…"
          autoComplete="off"
          role="combobox"
          aria-expanded={liste.length > 0}
          aria-controls={`${id}-s`}
          aria-activedescendant={actif >= 0 ? `${id}-s-${actif}` : undefined}
          onChange={(e) => { onChange(e.target.value); setOuvert(true); setActif(-1); }}
          onFocus={() => setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 120)}
          onKeyDown={clavier}
        />
        {valeur && <button type="button" className="bi-effacer" onClick={() => choisir('')} aria-label="Effacer la recherche">×</button>}
        {liste.length > 0 && (
          <ul id={`${id}-s`} role="listbox" className="bi-suggestions">
            {liste.map((s, i) => (
              <li key={s.type + s.texte} id={`${id}-s-${i}`} role="option" aria-selected={i === actif} onMouseDown={(e) => { e.preventDefault(); choisir(s.texte); }}>
                <span>{s.texte}</span><span className="bi-type">{s.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="bi-exemples">
        <span>Essayez :</span>
        {EXEMPLES.map((x) => <button key={x} type="button" onClick={() => choisir(x)}>{x}</button>)}
      </p>
    </div>
  );
}

/** One filter section: a title, an optional inner search, and checkboxes with counts. */
export function GroupeFiltre({ titre, options, choisis, onChange, libelle = (v) => v, cherchable = false, ouvertParDefaut = false, visibles = 8 }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut || choisis.length > 0);
  const [q, setQ] = useState('');
  const [tout, setTout] = useState(false);
  const id = useId();
  const filtrees = q ? options.filter(([v]) => String(libelle(v)).toLowerCase().includes(q.toLowerCase())) : options;
  const montrees = tout || q ? filtrees : filtrees.slice(0, visibles);
  const basculer = (v) => onChange(choisis.includes(v) ? choisis.filter((x) => x !== v) : [...choisis, v]);
  return (
    <section className="bi-groupe">
      <h3>
        <button type="button" aria-expanded={ouvert} aria-controls={id} onClick={() => setOuvert(!ouvert)}>
          <span>{titre}{choisis.length > 0 && <span className="bi-nb">{choisis.length}</span>}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={ouvert ? 'rotate-180' : ''}><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
        </button>
      </h3>
      {ouvert && (
        <div id={id}>
          {cherchable && (
            <input type="search" className="bi-filtre-q" placeholder={`Chercher dans ${titre.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Chercher dans ${titre}`} />
          )}
          <ul>
            {montrees.map(([v, n]) => (
              <li key={v}>
                <label className="bi-case">
                  <input type="checkbox" checked={choisis.includes(v)} onChange={() => basculer(v)} />
                  <span className="bi-case-texte">{libelle(v)}</span>
                  <span className="bi-case-nb">{n}</span>
                </label>
              </li>
            ))}
          </ul>
          {!q && filtrees.length > visibles && (
            <button type="button" className="bi-plus" onClick={() => setTout(!tout)}>{tout ? 'Voir moins' : `Voir les ${filtrees.length}`}</button>
          )}
        </div>
      )}
    </section>
  );
}
