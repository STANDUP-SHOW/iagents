// Boxes (MASTER §4, §6, §15) : série, client, statut, version, garantie,
// remplacement, santé — plus les clients et les mises à jour qu'on leur pousse.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Resultat, Tableau, date, dateHeure, lignesDe, nombre } from '../composants.jsx';
import { Apercu, ChoixClient, useTenants } from './commun.jsx';

export const lectures = [['boxes', {}], ['tenants', {}]];

export const STATUTS_BOX = ['active', 'suspendue', 'restituee', 'remplacee'];
const TON_STATUT = { stock: 'neutre', provisionnee: 'info', active: 'succes', suspendue: 'alerte', restituee: 'neutre', remplacee: 'neutre' };

export function garantieDe(box, jour = new Date().toISOString().slice(0, 10)) {
  if (!box.garantie_jusqu_au) return { ton: 'neutre', libelle: 'non renseignée' };
  return String(box.garantie_jusqu_au).slice(0, 10) >= jour
    ? { ton: 'succes', libelle: `jusqu'au ${date(box.garantie_jusqu_au)}` }
    : { ton: 'alerte', libelle: `échue le ${date(box.garantie_jusqu_au)}` };
}

export function santeDe(sante) {
  if (!sante) return 'jamais remontée';
  const morceaux = [
    typeof sante.cpu === 'number' ? `CPU ${nombre(sante.cpu)} %` : null,
    typeof sante.memoire === 'number' ? `mém. ${nombre(sante.memoire)} %` : null,
    typeof sante.disque === 'number' ? `disque ${nombre(sante.disque)} %` : null,
    typeof sante.temperature === 'number' ? `${nombre(sante.temperature)} °C` : null,
  ].filter(Boolean);
  return `${morceaux.join(' · ') || 'aucune mesure'} — vue ${dateHeure(sante.vu_le)}`;
}

function Provisionner({ onFini }) {
  const [f, setF] = useState({ serial: '', gamme: 'business', os: 'ubuntu-core', version_desktop: '', identite_publique: '' });
  const [etat, lancer] = useAction();
  const poser = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('provisionnerBox', { corps: f }, onFini); }}>
      <div className="grille">
        <Champ libelle="Numéro de série"><input value={f.serial} onChange={poser('serial')} required /></Champ>
        <Champ libelle="Gamme"><select value={f.gamme} onChange={poser('gamme')}><option value="business">business</option><option value="home">home</option></select></Champ>
        <Champ libelle="Système"><input value={f.os} onChange={poser('os')} required /></Champ>
        <Champ libelle="Version du Desktop"><input value={f.version_desktop} onChange={poser('version_desktop')} required /></Champ>
      </div>
      <Champ libelle="Clé publique Ed25519 de la Box (PEM)" aide="La clé privée ne quitte jamais la Box."><textarea rows={4} value={f.identite_publique} onChange={poser('identite_publique')} required spellCheck={false} /></Champ>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Provisionner</button></div>
      <Resultat etat={etat} succes={(c) => `Box ${c?.device_id ?? '?'} (série ${c?.serial ?? '?'}) en statut « ${c?.statut ?? '?'} ».`} />
    </form>
  );
}

function Attribuer({ boxes, tenants, onFini }) {
  const [f, setF] = useState({ id: '', tenant_id: '', plan_id: '' });
  const [etat, lancer] = useAction();
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('attribuerBox', { params: { id: f.id }, corps: { tenant_id: f.tenant_id, plan_id: f.plan_id } }, onFini); }}>
      <div className="grille">
        <Champ libelle="Box"><select value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} required>
          <option value="">Choisir…</option>
          {boxes.map((b) => <option key={b.device_id} value={b.device_id}>{b.serial} ({b.statut})</option>)}
        </select></Champ>
        <Champ libelle="Client"><ChoixClient tenants={tenants} valeur={f.tenant_id} onChange={(v) => setF({ ...f, tenant_id: v })} tous="Choisir…" requis /></Champ>
        <Champ libelle="Plan"><input value={f.plan_id} onChange={(e) => setF({ ...f, plan_id: e.target.value })} placeholder="box-commander-36" required /></Champ>
      </div>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Attribuer</button></div>
      <Resultat etat={etat} succes={(c) => `Box ${c?.device_id ?? f.id} attribuée, statut « ${c?.statut ?? '?'} ».`} />
    </form>
  );
}

function ChangerStatut({ boxes, onFini }) {
  const [f, setF] = useState({ id: '', statut: 'active', motif: '' });
  const [etat, lancer] = useAction();
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('statutBox', { params: { id: f.id }, corps: { statut: f.statut, motif: f.motif } }, onFini); }}>
      <div className="grille">
        <Champ libelle="Box"><select value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} required>
          <option value="">Choisir…</option>
          {boxes.map((b) => <option key={b.device_id} value={b.device_id}>{b.serial} ({b.statut})</option>)}
        </select></Champ>
        <Champ libelle="Nouveau statut"><select value={f.statut} onChange={(e) => setF({ ...f, statut: e.target.value })}>
          {STATUTS_BOX.map((s) => <option key={s} value={s}>{s}</option>)}
        </select></Champ>
      </div>
      <Champ libelle="Motif" aide="Pour un remplacement : la série de la Box qui la remplace."><input value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} required /></Champ>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Changer le statut</button></div>
      <Resultat etat={etat} succes={(c) => `Box ${c?.device_id ?? f.id} : « ${c?.statut ?? '?'} ».`} />
    </form>
  );
}

function NouveauClient({ onFini }) {
  const [f, setF] = useState({ nom: '', segment: 'business', pays: 'FR', opt_in_skills: false });
  const [etat, lancer] = useAction();
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('creerTenant', { corps: f }, onFini); }}>
      <div className="grille">
        <Champ libelle="Nom"><input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} required /></Champ>
        <Champ libelle="Segment"><select value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}>
          <option value="business">business</option><option value="home">home</option><option value="enterprise">enterprise</option>
        </select></Champ>
        <Champ libelle="Pays (ISO)"><input value={f.pays} maxLength={2} onChange={(e) => setF({ ...f, pays: e.target.value })} required /></Champ>
      </div>
      <label className="case"><input type="checkbox" checked={f.opt_in_skills} onChange={(e) => setF({ ...f, opt_in_skills: e.target.checked })} /> participe à l'amélioration commune des Skill Packs (opt-in, faux par défaut)</label>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Créer le client</button></div>
      <Resultat etat={etat} succes={(c) => `Client ${c?.nom ?? f.nom} (${c?.tenant_id ?? '?'}).`} />
    </form>
  );
}

function MiseAJour() {
  const [f, setF] = useState({ composant: 'desktop', version: '', canal: 'stable', url: '', empreinte: '' });
  const [etat, lancer] = useAction();
  const poser = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('publierMiseAJour', { corps: f }); }}>
      <div className="grille">
        <Champ libelle="Composant"><input value={f.composant} onChange={poser('composant')} required /></Champ>
        <Champ libelle="Version"><input value={f.version} onChange={poser('version')} required /></Champ>
        <Champ libelle="Canal"><input value={f.canal} onChange={poser('canal')} required /></Champ>
      </div>
      <Champ libelle="Adresse du paquet (https)"><input value={f.url} onChange={poser('url')} required /></Champ>
      <Champ libelle="Empreinte SHA-256"><input value={f.empreinte} onChange={poser('empreinte')} required spellCheck={false} /></Champ>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Publier</button></div>
      <Resultat etat={etat} succes={(c) => `${c?.composant ?? f.composant} ${c?.version ?? f.version} sur le canal ${c?.canal ?? f.canal}.`} />
    </form>
  );
}

export default function Boxes({ boxInitiale = '' }) {
  const lecture = useLecture('boxes');
  const { lecture: lectureTenants, tenants, nomDe } = useTenants();
  const [choisie, setChoisie] = useState(boxInitiale);
  const fiche = useLecture('box', { params: { id: choisie } }, Boolean(choisie));
  const boxes = lignesDe(lecture.donnees, 'boxes') ?? [];
  const recharger = () => { lecture.recharger(); lectureTenants.recharger(); };
  return (
    <>
      <Panneau titre="Boxes" sousTitre="Inventaire du Control Plane (GET /controle/boxes)." actions={<Bouton onClick={recharger}>Relire</Bouton>}>
        <Lecture lecture={lecture}>
          {() => (
            <Tableau
              vide="Aucune Box provisionnée."
              lignes={boxes}
              cle={(b) => b.device_id}
              colonnes={[
                { titre: 'Série', rendu: (b) => <><strong>{b.serial}</strong><br /><code>{b.device_id}</code></> },
                { titre: 'Client', rendu: (b) => (b.tenant_id ? nomDe(b.tenant_id) : <span className="discret">en stock</span>) },
                { titre: 'Gamme', rendu: (b) => b.gamme },
                { titre: 'Statut', rendu: (b) => <Pastille ton={TON_STATUT[b.statut] ?? 'neutre'}>{b.statut}</Pastille> },
                { titre: 'Version', rendu: (b) => `${b.version_desktop ?? '—'} · ${b.os ?? '—'}` },
                { titre: 'Plan', rendu: (b) => b.plan_id ?? '—' },
                { titre: 'Garantie', rendu: (b) => { const g = garantieDe(b); return <Pastille ton={g.ton}>{g.libelle}</Pastille>; } },
                { titre: 'Santé', rendu: (b) => <span className="petit">{santeDe(b.sante)}</span> },
                { titre: '', rendu: (b) => <Bouton onClick={() => setChoisie(b.device_id)}>Fiche</Bouton> },
              ]}
            />
          )}
        </Lecture>
      </Panneau>
      {choisie ? (
        <Panneau titre={`Fiche de la Box ${choisie}`} sousTitre="GET /controle/boxes/:id" actions={<Bouton onClick={() => setChoisie('')}>Fermer</Bouton>}>
          <Lecture lecture={fiche}>{(b) => <Apercu valeur={{ ...b, identite_publique: b.identite_publique ? 'clé publique Ed25519 enregistrée' : 'absente' }} />}</Lecture>
        </Panneau>
      ) : null}
      <div className="colonnes">
        <Panneau titre="Provisionner une Box" sousTitre="Statut de départ : stock."><Provisionner onFini={recharger} /></Panneau>
        <Panneau titre="Attribuer à un client"><Attribuer boxes={boxes} tenants={tenants} onFini={recharger} /></Panneau>
        <Panneau titre="Suspendre, restituer, remplacer"><ChangerStatut boxes={boxes} onFini={recharger} /></Panneau>
        <Panneau titre="Nouveau client">
          <Lecture lecture={lectureTenants}>{() => <p className="discret">{nombre(tenants.length)} client(s) enregistré(s).</p>}</Lecture>
          <NouveauClient onFini={recharger} />
        </Panneau>
        <Panneau titre="Publier une mise à jour" sousTitre="Les Box la lisent sur /controle/box/mises-a-jour."><MiseAJour /></Panneau>
      </div>
    </>
  );
}
