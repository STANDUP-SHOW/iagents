// L'écran opérateur du Factory Installer (brief §1, §44, §45) : quatre
// moments, zéro Linux à connaître. Il lit /api/etat toutes les deux secondes
// et ne décide rien lui-même : l'enrôlement, les tests et le rapport sont faits
// par iagent-device, le verdict par la plateforme. `Ecran` est une fonction
// pure de l'état, pour que le banc (banc/rendu.jsx) la rende sans réseau.
import React, { useEffect, useState } from 'react';
import { qrSvg } from './qr.js';

const TON = { passe: 'ok', echec: 'ko', non_constate: 'nc' };
const MOT = { passe: 'PASS', echec: 'FAIL', non_constate: 'NON CONSTATÉ' };

function Pastille({ verdict }) {
  return <span className={`pastille ${TON[verdict] ?? 'nc'}`}>{MOT[verdict] ?? verdict}</span>;
}

function Inventaire({ inventaire }) {
  if (!inventaire) return <p className="discret">Relevé de la machine en cours…</p>;
  const lignes = [
    ['Processeur', `${inventaire.cpu} · ${inventaire.coeurs} cœurs`],
    ['Mémoire', `${inventaire.memoire_go} Go`],
    ['Disque', `${inventaire.disque?.modele ?? '?'} · ${inventaire.disque?.capacite_go ?? '?'} Go`],
    ['Réseau', [inventaire.mac?.eth0 && 'ETH0', inventaire.mac?.eth1 && 'ETH1', inventaire.mac?.wifi && 'Wi-Fi'].filter(Boolean).join(' · ') || 'aucune carte vue'],
    ['TPM', inventaire.tpm?.present ? `présent (${inventaire.tpm.version ?? '?'})` : 'absent'],
    ['UEFI / Secure Boot', `${inventaire.uefi ? 'UEFI' : 'hors UEFI'} · Secure Boot ${inventaire.secure_boot === true ? 'actif' : inventaire.secure_boot === false ? 'inactif' : 'non lu'}`],
    ['BIOS', `${inventaire.bios?.fournisseur ?? '?'} ${inventaire.bios?.version ?? ''}`],
  ];
  return <dl className="inventaire">{lignes.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>;
}

function Tests({ tests }) {
  if (!tests?.length) return <p className="discret">Aucun contrôle encore passé.</p>;
  return (
    <table className="tests">
      <tbody>
        {tests.map((t) => (
          <tr key={t.id}>
            <td>{t.libelle}</td>
            <td><Pastille verdict={t.verdict} /></td>
            <td className="detail">{t.detail ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Attente({ etat, operateur, setOperateur, profilMateriel, setProfilMateriel, installer }) {
  const profils = etat.profils_materiel ?? [];
  const pret = Boolean(operateur?.trim()) && Boolean(profilMateriel) && etat.jeton_present !== false;
  return (
    <section>
      <h1>IAGENT FACTORY</h1>
      <h2>Appareil détecté</h2>
      <Inventaire inventaire={etat.inventaire} />
      <h2>Profil</h2>
      <p className="grand">Posé à l'attribution <span className="discret">(Home, Business ou Enterprise : même image pour toutes les Stations)</span></p>
      <label className="champ">Machine
        <select value={profilMateriel} onChange={(e) => setProfilMateriel(e.target.value)}>
          <option value="">Choisir…</option>
          {profils.map((p) => <option key={p.id} value={p.id}>{p.nom}{p.a_confirmer ? ' (fiche à confirmer)' : ''}</option>)}
        </select>
      </label>
      <label className="champ">Opérateur
        <input value={operateur} onChange={(e) => setOperateur(e.target.value)} placeholder="Votre prénom" />
      </label>
      <p className="discret">Client : {etat.jeton_present ? 'fixé par le jeton d’usine (facultatif)' : 'aucun jeton d’usine sur cette clé — l’enrôlement sera refusé'}</p>
      {etat.erreur ? <p className="erreur">{etat.erreur}</p> : null}
      <button className="principal" disabled={!pret} onClick={installer}>INSTALLER</button>
    </section>
  );
}

export function EnCours({ etat }) {
  return (
    <section>
      <h1>IAGENT FACTORY</h1>
      <h2>{etat.etape === 'enrolement' ? 'Enrôlement de la Box…' : etat.etape === 'rapport' ? 'Dépôt du rapport…' : 'Contrôles en cours…'}</h2>
      <p className="discret">Ne débranchez pas. L'ordinateur travaille seul ; vous n'avez rien à faire.</p>
      <Tests tests={etat.tests} />
    </section>
  );
}

export function Termine({ etat, eteindre }) {
  const box = etat.reponse_plateforme?.box ?? etat.device ?? {};
  const rapport = etat.reponse_plateforme?.rapport;
  const reussi = etat.etape === 'qualifiee';
  const reference = box.reference ?? etat.device?.reference ?? '';
  return (
    <section className={reussi ? 'reussi' : 'echec'}>
      <h1>IAGENT FACTORY</h1>
      <p className="reference">BOX : {reference || '—'}</p>
      <Tests tests={rapport?.tests ?? etat.tests} />
      <h2 className="statut">{reussi ? 'PRÊTE À EXPÉDIER' : 'NON CONFORME — NE PAS EXPÉDIER'}</h2>
      {!reussi && etat.erreur ? <p className="erreur">{etat.erreur}</p> : null}
      {!reussi && (etat.verdict?.manquants?.length || etat.verdict?.echoues?.length) ? (
        <p className="erreur">Échoués : {(etat.verdict.echoues ?? []).join(', ') || '—'} · Obligatoires non passés : {(etat.verdict.manquants ?? []).join(', ') || '—'}</p>
      ) : null}
      {reussi && reference ? <div className="etiquette"><div dangerouslySetInnerHTML={{ __html: qrSvg(reference, 180) }} /><p>{reference}</p><p className="discret">{box.serial}</p></div> : null}
      <div className="boutons">
        <a className="bouton" href="/api/rapport" download={`${reference || 'rapport'}.json`}>EXPORTER LE RAPPORT</a>
        {!reussi ? <a className="bouton" href="/">RECOMMENCER</a> : null}
        <button className="bouton" onClick={eteindre}>ÉTEINDRE</button>
      </div>
    </section>
  );
}

/** Pure: the screen for a state. The bench renders it on the fixture reports. */
export function Ecran({ etat, operateur, setOperateur, profilMateriel, setProfilMateriel, installer, eteindre }) {
  if (!etat) return <section><h1>IAGENT FACTORY</h1><p className="discret">Connexion à l'agent de la Box…</p></section>;
  switch (etat.etape) {
    case 'enrolement':
    case 'tests':
    case 'rapport':
      return <EnCours etat={etat} />;
    case 'qualifiee':
    case 'echec':
      return <Termine etat={etat} eteindre={eteindre} />;
    default:
      return <Attente etat={etat} operateur={operateur} setOperateur={setOperateur} profilMateriel={profilMateriel} setProfilMateriel={setProfilMateriel} installer={installer} />;
  }
}

export default function App() {
  const [etat, setEtat] = useState(null);
  const [operateur, setOperateur] = useState('');
  const [profilMateriel, setProfilMateriel] = useState('');
  useEffect(() => {
    let vivant = true;
    const lire = async () => {
      try {
        const r = await fetch('/api/etat', { cache: 'no-store' });
        const e = await r.json();
        if (!vivant) return;
        setEtat(e);
        if (!operateur && e.operateur) setOperateur(e.operateur);
        if (!profilMateriel) {
          const candidats = (e.profils_materiel ?? []).filter((p) => p.id !== 'vm-qemu');
          if (candidats.length === 1) setProfilMateriel(candidats[0].id);
        }
      } catch {
        if (vivant) setEtat((x) => x ?? null);
      }
    };
    lire();
    const t = setInterval(lire, 2000);
    return () => { vivant = false; clearInterval(t); };
  }, []);
  const installer = () => fetch('/api/installer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operateur, profil_materiel: profilMateriel }) });
  const eteindre = () => { if (window.confirm('Éteindre la Box ?')) fetch('/api/eteindre', { method: 'POST' }); };
  return <main><Ecran etat={etat} operateur={operateur} setOperateur={setOperateur} profilMateriel={profilMateriel} setProfilMateriel={setProfilMateriel} installer={installer} eteindre={eteindre} /></main>;
}
