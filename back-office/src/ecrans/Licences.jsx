// Licences / entitlements (MASTER §6, §15) : attribuer, révoquer.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Erreur, Lecture, Panneau, Pastille, Resultat, Tableau, date, lignesDe } from '../composants.jsx';
import { ChoixClient, useTenants } from './commun.jsx';

export const lectures = [['entitlements', {}], ['tenants', {}], ['boxes', {}]];
export const LICENCES = ['essential', 'professional', 'expert', 'commander', 'home'];
const TON = { active: 'succes', suspendue: 'alerte', revoquee: 'danger', expiree: 'neutre' };

function Revoquer({ id, onFini }) {
  const [motif, setMotif] = useState('');
  const [etat, lancer] = useAction();
  return (
    <form className="en-ligne" onSubmit={(e) => { e.preventDefault(); lancer('revoquerEntitlement', { params: { id }, corps: { motif } }, onFini); }}>
      <input aria-label="Motif de révocation" placeholder="motif" value={motif} onChange={(e) => setMotif(e.target.value)} required />
      <button type="submit" className="bouton" disabled={etat.statut === 'en-cours'}>Révoquer</button>
      <Resultat etat={etat} succes={(c) => `licence ${c?.id ?? id} : ${c?.statut ?? '?'}.`} />
    </form>
  );
}

function Attribuer({ tenants, boxes, onFini }) {
  const [f, setF] = useState({ tenant_id: '', device_id: '', agent_template_id: '', specialisation_id: '', licence: 'professional', debut: new Date().toISOString().slice(0, 10), fin: '' });
  const [etat, lancer] = useAction();
  const poser = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const corps = () => ({ ...f, specialisation_id: f.specialisation_id || null, fin: f.fin || null });
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('creerEntitlement', () => ({ corps: corps() }), onFini); }}>
      <div className="grille">
        <Champ libelle="Client"><ChoixClient tenants={tenants} valeur={f.tenant_id} onChange={(v) => setF({ ...f, tenant_id: v, device_id: '' })} tous="Choisir…" requis /></Champ>
        <Champ libelle="Box"><select value={f.device_id} onChange={poser('device_id')} required>
          <option value="">Choisir…</option>
          {boxes.filter((b) => !f.tenant_id || b.tenant_id === f.tenant_id).map((b) => <option key={b.device_id} value={b.device_id}>{b.serial} ({b.device_id})</option>)}
        </select></Champ>
        <Champ libelle="Agent (AG-XXXX)"><input value={f.agent_template_id} onChange={poser('agent_template_id')} pattern="AG-\d{4}" required /></Champ>
        <Champ libelle="Spécialisation"><input value={f.specialisation_id} onChange={poser('specialisation_id')} /></Champ>
        <Champ libelle="Licence"><select value={f.licence} onChange={poser('licence')}>{LICENCES.map((l) => <option key={l} value={l}>{l}</option>)}</select></Champ>
        <Champ libelle="Début"><input type="date" value={f.debut} onChange={poser('debut')} required /></Champ>
        <Champ libelle="Fin (vide = sans fin)"><input type="date" value={f.fin} onChange={poser('fin')} /></Champ>
      </div>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Attribuer la licence</button></div>
      <Resultat etat={etat} succes={(c) => `licence ${c?.id ?? '?'} (${c?.agent_template_id ?? f.agent_template_id}, ${c?.licence ?? f.licence}) : ${c?.statut ?? '?'}.`} />
    </form>
  );
}

export default function Licences() {
  const { lecture: lectureTenants, tenants, nomDe } = useTenants();
  const [tenant, setTenant] = useState('');
  const lecture = useLecture('entitlements', { query: { tenant_id: tenant } });
  const lectureBoxes = useLecture('boxes');
  const boxes = lignesDe(lectureBoxes.donnees, 'boxes') ?? [];
  const lignes = lignesDe(lecture.donnees, 'entitlements');
  return (
    <>
      <Panneau titre="Licences des agents" sousTitre="Client + Box + agent + spécialisation + licence (GET /controle/entitlements)." actions={<Bouton onClick={() => lecture.recharger()}>Relire</Bouton>}>
        <div className="filtres"><Champ libelle="Client"><ChoixClient tenants={tenants} valeur={tenant} onChange={setTenant} /></Champ></div>
        {lectureTenants.erreur ? <Erreur message={lectureTenants.erreur} locale={lectureTenants.plateforme === false} /> : null}
        <Lecture lecture={lecture}>
          {() => (
            <Tableau
              vide="Aucune licence pour ce filtre."
              lignes={lignes ?? []}
              cle={(l) => l.id}
              colonnes={[
                { titre: 'Licence', rendu: (l) => <><strong>{l.licence}</strong><br /><code>{l.id}</code></> },
                { titre: 'Client', rendu: (l) => nomDe(l.tenant_id) },
                { titre: 'Box', rendu: (l) => <code>{l.device_id}</code> },
                { titre: 'Agent', rendu: (l) => `${l.agent_template_id}${l.specialisation_id ? ` · ${l.specialisation_id}` : ''}` },
                { titre: 'Statut', rendu: (l) => <Pastille ton={TON[l.statut] ?? 'neutre'}>{l.statut}</Pastille> },
                { titre: 'Période', rendu: (l) => `${date(l.debut)} → ${l.fin ? date(l.fin) : '…'}` },
                { titre: '', rendu: (l) => (l.statut === 'active' || l.statut === 'suspendue' ? <Revoquer id={l.id} onFini={() => lecture.recharger()} /> : null) },
              ]}
            />
          )}
        </Lecture>
      </Panneau>
      <Panneau titre="Attribuer une licence">
        {lectureBoxes.erreur ? <Erreur message={lectureBoxes.erreur} locale={lectureBoxes.plateforme === false} /> : null}
        <Attribuer tenants={tenants} boxes={boxes} onFini={() => lecture.recharger()} />
      </Panneau>
    </>
  );
}
