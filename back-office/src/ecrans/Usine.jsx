// Usine (brief Factory Installer, 11/10/2026, §41-§46) : les jetons d'usine qui
// autorisent l'atelier à enrôler des Box, et le cycle de vie qu'une Box suit
// ensuite. Le jeton n'est montré qu'une fois, ici ; la plateforme n'en garde
// que l'empreinte. Les rapports et l'étiquette d'une Box sont sur sa fiche
// (écran Boxes).
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Resultat, Tableau, dateHeure, lignesDe, nombre } from '../composants.jsx';
import { ChoixClient, useTenants } from './commun.jsx';

export const lectures = [['jetonsUsine', {}], ['tenants', {}]];

export const CYCLE = ['usine', 'qualifiee', 'stock', 'provisionnee', 'expediee', 'active'];

function NouveauJeton({ tenants, onFini }) {
  const [f, setF] = useState({ operateur: '', lot: '', tenant_id: '', plan_id: '', duree_h: 24, utilisations_max: 10 });
  const [etat, lancer] = useAction();
  const poser = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const corps = () => ({
    operateur: f.operateur, lot: f.lot || undefined, tenant_id: f.tenant_id || undefined, plan_id: f.plan_id || undefined,
    duree_h: Number(f.duree_h), utilisations_max: Number(f.utilisations_max),
  });
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('creerJetonUsine', () => ({ corps: corps() }), onFini); }}>
      <div className="grille">
        <Champ libelle="Opérateur"><input value={f.operateur} onChange={poser('operateur')} required placeholder="Prénom de la personne à l'atelier" /></Champ>
        <Champ libelle="Lot" aide="Facultatif : la série de Box fabriquées ensemble."><input value={f.lot} onChange={poser('lot')} placeholder="L-2026-10-A" /></Champ>
        <Champ libelle="Durée (heures, 72 au plus)"><input type="number" min="1" max="72" value={f.duree_h} onChange={poser('duree_h')} /></Champ>
        <Champ libelle="Box au plus (100 au plus)"><input type="number" min="1" max="100" value={f.utilisations_max} onChange={poser('utilisations_max')} /></Champ>
      </div>
      <div className="grille">
        <Champ libelle="Client (facultatif)" aide="Posé sur chaque Box dès que son rapport passe : elle sort provisionnée."><ChoixClient tenants={tenants} valeur={f.tenant_id} onChange={(v) => setF({ ...f, tenant_id: v })} tous="Aucun : les Box restent en stock" /></Champ>
        <Champ libelle="Plan (avec le client)"><input value={f.plan_id} onChange={poser('plan_id')} placeholder="box-commander-36" /></Champ>
      </div>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Émettre le jeton</button></div>
      <Resultat etat={etat} succes={(c) => `Jeton émis pour ${c?.operateur ?? f.operateur}, valable jusqu'au ${c?.expire_le ? dateHeure(c.expire_le) : '?'}. À copier MAINTENANT dans construire-iso.sh (--jeton-fichier), il ne sera plus montré : ${c?.jeton ?? '?'}`} />
    </form>
  );
}

export default function Usine() {
  const lecture = useLecture('jetonsUsine');
  const { lecture: lectureTenants, tenants, nomDe } = useTenants();
  const jetons = lignesDe(lecture.donnees, 'jetons') ?? [];
  const recharger = () => { lecture.recharger(); lectureTenants.recharger(); };
  return (
    <>
      <Panneau titre="Usine" sousTitre="iAgent Box Factory Installer : jetons d'usine (GET /controle/usine/jetons)." actions={<Bouton onClick={recharger}>Relire</Bouton>}>
        <p className="discret">Cycle d'une Box : {CYCLE.map((s, i) => <span key={s}>{i ? ' → ' : ''}<Pastille ton={s === 'active' ? 'succes' : 'info'}>{s}</Pastille></span>)} ; puis suspendue, restituee ou remplacee. L'usine enrôle (<code>usine</code>), un rapport qui passe qualifie, le back-office met en stock et attribue, l'expédition puis la première télémétrie chez le client activent.</p>
        <Lecture lecture={lecture}>
          {() => (
            <Tableau
              vide="Aucun jeton d'usine émis."
              lignes={jetons}
              cle={(j) => j.id}
              colonnes={[
                { titre: 'Opérateur', rendu: (j) => <strong>{j.operateur}</strong> },
                { titre: 'Lot', rendu: (j) => j.lot ?? '—' },
                { titre: 'Client', rendu: (j) => (j.tenant_id ? `${nomDe(j.tenant_id)} · ${j.plan_id ?? '?'}` : <span className="discret">aucun (stock)</span>) },
                { titre: 'Box', rendu: (j) => `${nombre(j.utilisations)} / ${nombre(j.utilisations_max)}` },
                { titre: 'Émis', rendu: (j) => dateHeure(j.cree_le) },
                { titre: 'Expire', rendu: (j) => { const vivant = new Date(j.expire_le) > new Date(); return <Pastille ton={vivant ? 'succes' : 'neutre'}>{vivant ? `le ${dateHeure(j.expire_le)}` : `expiré le ${dateHeure(j.expire_le)}`}</Pastille>; } },
              ]}
            />
          )}
        </Lecture>
      </Panneau>
      <Panneau titre="Émettre un jeton d'usine" sousTitre="Il autorise POST /controle/usine/enroler depuis l'atelier, sans accès admin sur la machine.">
        <Lecture lecture={lectureTenants}>{() => <p className="discret">{nombre(tenants.length)} client(s) enregistré(s).</p>}</Lecture>
        <NouveauJeton tenants={tenants} onFini={recharger} />
      </Panneau>
    </>
  );
}
