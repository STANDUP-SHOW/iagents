// Skill Packs (MASTER §7, §15) : revue (en-revue / valider / rejeter /
// retirer), compatibilités, version.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Resultat, Tableau, liste, lignesDe, lireJson } from '../composants.jsx';

export const lectures = [['skills', {}]];

const TON = { candidat: 'info', 'en-revue': 'alerte', valide: 'succes', rejete: 'danger', retire: 'neutre' };
/** Decisions offered for a status; the platform remains the judge and may refuse. */
export const DECISIONS = {
  candidat: [['en-revue', 'Mettre en revue'], ['rejete', 'Rejeter']],
  'en-revue': [['valide', 'Valider'], ['rejete', 'Rejeter']],
  valide: [['retire', 'Retirer']],
  rejete: [['en-revue', 'Remettre en revue']],
  retire: [],
};

function Revue({ pack, onFini }) {
  const [motif, setMotif] = useState('');
  const [etat, lancer] = useAction();
  const choix = DECISIONS[pack.validation_status] ?? [];
  if (!choix.length) return <span className="discret">—</span>;
  return (
    <div className="revue">
      <input aria-label={`Motif pour ${pack.skill_pack_id}`} placeholder="motif de la décision" value={motif} onChange={(e) => setMotif(e.target.value)} />
      <div className="rangee">
        {choix.map(([decision, libelle]) => (
          <button key={decision} type="button" className={decision === 'valide' ? 'bouton bouton-principal' : 'bouton'} disabled={etat.statut === 'en-cours'}
            onClick={() => lancer('revueSkill', () => {
              if (!motif.trim()) throw new Error('Écrivez le motif de la décision : il entre au journal d’audit.');
              return { params: { id: pack.skill_pack_id }, corps: { decision, motif: motif.trim() } };
            }, onFini)}>
            {libelle}
          </button>
        ))}
      </div>
      <Resultat etat={etat} succes={(c) => `${c?.skill_pack_id ?? pack.skill_pack_id} v${c?.version ?? pack.version} : ${c?.validation_status ?? '?'}.`} />
    </div>
  );
}

const MODELE = {
  skill_pack_id: '', version: '1.0.0', source_type: 'iagent', compatible_agents: ['AG-0001'], compatible_tools: [],
  sector_scope: ['administration'], locale: 'fr-FR', changelog: '', empreinte: null,
};

function Deposer({ onFini }) {
  const [texte, setTexte] = useState(() => JSON.stringify(MODELE, null, 2));
  const [etat, lancer] = useAction();
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('deposerSkill', () => ({ corps: lireJson(texte, 'Le Skill Pack') }), onFini); }}>
      <Champ libelle="Skill Pack (JSON)" aide="Il entre en statut « candidat » ; rien n'atteint une Box avant validation."><textarea className="code" rows={12} value={texte} onChange={(e) => setTexte(e.target.value)} spellCheck={false} /></Champ>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Déposer</button></div>
      <Resultat etat={etat} succes={(c) => `${c?.skill_pack_id ?? '?'} v${c?.version ?? '?'} : ${c?.validation_status ?? '?'}.`} />
    </form>
  );
}

export default function Skills() {
  const lecture = useLecture('skills');
  const [statut, setStatut] = useState('');
  const tous = lignesDe(lecture.donnees, 'skills', 'skill_packs') ?? [];
  const lignes = tous.filter((p) => !statut || p.validation_status === statut);
  return (
    <>
      <Panneau titre="Skill Packs" sousTitre="Registre versionné et signé, circuit de revue (GET /controle/skills)." actions={<Bouton onClick={() => lecture.recharger()}>Relire</Bouton>}>
        <div className="filtres">
          <Champ libelle="Statut"><select value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="">Tous</option>
            {Object.keys(TON).map((s) => <option key={s} value={s}>{s}</option>)}
          </select></Champ>
        </div>
        <Lecture lecture={lecture}>
          {() => (
            <Tableau vide="Aucun Skill Pack pour ce filtre." lignes={lignes} cle={(p) => `${p.skill_pack_id}@${p.version}`}
              colonnes={[
                { titre: 'Skill Pack', rendu: (p) => <><strong>{p.skill_pack_id}</strong><br /><span className="petit">v{p.version} · {p.source_type} · {p.locale}</span></> },
                { titre: 'Statut', rendu: (p) => <Pastille ton={TON[p.validation_status] ?? 'neutre'}>{p.validation_status}</Pastille> },
                { titre: 'Agents compatibles', rendu: (p) => <span className="petit">{liste(p.compatible_agents)}</span> },
                { titre: 'Outils', rendu: (p) => <span className="petit">{liste(p.compatible_tools)}</span> },
                { titre: 'Secteurs', rendu: (p) => <span className="petit">{liste(p.sector_scope)}</span> },
                { titre: 'Empreinte', rendu: (p) => (p.empreinte ? <code title={p.empreinte}>{String(p.empreinte).slice(0, 12)}…</code> : <Pastille ton="alerte">non signé</Pastille>) },
                { titre: 'Changements', rendu: (p) => <span className="petit">{p.changelog || '—'}</span> },
                { titre: 'Décision', rendu: (p) => <Revue pack={p} onFini={() => lecture.recharger()} /> },
              ]} />
          )}
        </Lecture>
      </Panneau>
      <Panneau titre="Déposer un Skill Pack"><Deposer onFini={() => lecture.recharger()} /></Panneau>
    </>
  );
}
