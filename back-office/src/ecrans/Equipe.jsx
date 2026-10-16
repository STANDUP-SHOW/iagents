// iAgent Team (ADMIN MASTER §3, §5) : les acteurs qui administrent la
// plateforme, humains, agents et services, chacun avec ses rôles sur un
// périmètre, son autonomie et ses plafonds. Une clé personnelle n'est montrée
// qu'une fois, au moment où l'acteur est créé ; un second facteur s'enrôle ici.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Resultat, Tableau, dateHeure, euros } from '../composants.jsx';
import { BoutonAction, Risque, StatutAction, TYPE_ACTEUR, elements } from './noyau.jsx';

export const lectures = [['v1Moi', {}], ['v1Acteurs', {}], ['v1Registre', {}], ['v1Actions', {}]];

const SCOPES = { GLOBAL: 'toute la plateforme', TENANT: 'un client', DEVICE: 'une Box', DEPARTMENT: 'un département', REGION: 'une région', SITE: 'un site', AGENT_INSTANCE: 'une instance d’agent' };
const AUTONOMIE = ['0 · observe seulement', '1 · suggère, un humain valide', '2 · agit en risque faible', '3 · agit jusqu’au risque modéré', '4 · agit jusqu’au risque élevé', '5 · autonomie maximale (R4 reste à deux personnes)'];

/** The body of POST /v1/acteurs, from the form; throws a French sentence before sending. */
export function corpsActeur(f) {
  const nom = f.nom_affiche.trim();
  if (nom.length < 2) throw new Error('Donnez un nom à l’acteur.');
  if (!f.role) throw new Error('Choisissez un rôle.');
  if (f.scope !== 'GLOBAL' && !f.scope_id.trim()) throw new Error(`Le périmètre « ${SCOPES[f.scope]} » demande son identifiant.`);
  const budgets = {};
  for (const [k, v] of [['remise_max_pct', f.remise], ['credit_max_eur', f.credit], ['remboursement_max_eur', f.remboursement]]) {
    if (String(v).trim() !== '') {
      const n = Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) throw new Error('Un plafond est un nombre positif.');
      budgets[k] = n;
    }
  }
  return {
    type: f.type, nom_affiche: nom, departement: f.departement.trim() || null,
    roles: [{ role: f.role, scope: { type: f.scope, id: f.scope === 'GLOBAL' ? null : f.scope_id.trim() } }],
    ...(f.type === 'AGENT' ? { autonomie: Number(f.autonomie) } : {}),
    budgets,
  };
}

function Creer({ registre, apres }) {
  const vide = { type: 'HUMAN', nom_affiche: '', role: '', scope: 'GLOBAL', scope_id: '', autonomie: 1, departement: '', remise: '', credit: '', remboursement: '' };
  const [f, setF] = useState(vide);
  const [etat, lancer] = useAction();
  const roles = (registre?.roles ?? []).filter((r) => r.id !== 'FONDATEUR');
  const m = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('v1CreerActeur', () => ({ corps: corpsActeur(f) }), () => { setF(vide); apres(); }); }}>
      <div className="grille">
        <Champ libelle="Nature"><select value={f.type} onChange={m('type')}><option value="HUMAN">Humain</option><option value="AGENT">Agent</option><option value="SERVICE">Service</option></select></Champ>
        <Champ libelle="Nom affiché"><input value={f.nom_affiche} onChange={m('nom_affiche')} required /></Champ>
        <Champ libelle="Rôle"><select value={f.role} onChange={m('role')} required><option value="">Choisir…</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}</select></Champ>
        <Champ libelle="Périmètre"><select value={f.scope} onChange={m('scope')}>{Object.entries(SCOPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Champ>
        {f.scope !== 'GLOBAL' ? <Champ libelle="Identifiant du périmètre"><input value={f.scope_id} onChange={m('scope_id')} placeholder="T-…, BOX-…, support…" required /></Champ> : null}
        {f.type === 'AGENT' ? <Champ libelle="Autonomie"><select value={f.autonomie} onChange={m('autonomie')}>{AUTONOMIE.map((l, i) => <option key={i} value={i}>{l}</option>)}</select></Champ> : null}
        <Champ libelle="Département"><input value={f.departement} onChange={m('departement')} placeholder="support, ventes, flotte…" /></Champ>
        <Champ libelle="Remise max (%)" aide="Vide : 10 %"><input value={f.remise} onChange={m('remise')} inputMode="decimal" /></Champ>
        <Champ libelle="Avoir max (€)" aide="Vide : 50 €"><input value={f.credit} onChange={m('credit')} inputMode="decimal" /></Champ>
        <Champ libelle="Remboursement max (€)" aide="Vide : 0 €, toujours approuvé"><input value={f.remboursement} onChange={m('remboursement')} inputMode="decimal" /></Champ>
      </div>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Créer l’acteur</button></div>
      {etat.statut === 'fait' ? (
        <div className="succes" role="status">
          <strong>{`${etat.corps.acteur.nom_affiche} est créé : identifiant ${etat.corps.acteur.id}.`}</strong>
          <p>Clé personnelle, affichée cette fois seulement : <code>{etat.corps.cle}</code></p>
          <p className="petit">{etat.corps.avertissement}</p>
        </div>
      ) : <Resultat etat={etat} />}
    </form>
  );
}

function MonCompte({ moi }) {
  const [enrolement, commencer] = useAction();
  const [confirmation, confirmer] = useAction();
  const [code, setCode] = useState('');
  return (
    <Panneau titre="Mon compte" sousTitre={moi.cle_de_secours ? 'Vous êtes connecté avec la clé du fondateur : elle vaut tous les droits et n’a pas de second facteur. Créez-vous un compte humain pour le travail de tous les jours.' : 'Votre compte personnel.'}>
      <p>{`${moi.nom_affiche} (${moi.id}) · ${moi.roles.map((r) => `${r.role} sur ${SCOPES[r.scope.type] ?? r.scope.type}${r.scope.id ? ` ${r.scope.id}` : ''}`).join(', ')}`}</p>
      <p className="petit">{moi.cle_de_secours ? 'Session : clé de secours, sans second facteur.' : `Second facteur : ${moi.mfa_actif ? 'activé' : 'non activé'} · session ${moi.session_mfa ? 'ouverte avec le code' : 'ouverte sans code : les actions sensibles sont refusées'}.`}</p>
      {!moi.cle_de_secours && !moi.mfa_actif ? (
        <div className="formulaire">
          <Bouton principal onClick={() => commencer('v1MfaCommencer', {})}>Activer mon second facteur</Bouton>
          {enrolement.statut === 'fait' ? (
            <>
              <p>{enrolement.corps.consigne}</p>
              <p>Clé à saisir dans l’application : <code>{enrolement.corps.secret}</code></p>
              <p className="petit">Ou ce lien d’ajout : <code>{enrolement.corps.uri}</code></p>
              <div className="en-ligne">
                <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" />
                <Bouton onClick={() => confirmer('v1MfaConfirmer', { corps: { code: code.trim() } })}>Confirmer</Bouton>
              </div>
              <Resultat etat={confirmation} succes={(c) => c.consigne} />
            </>
          ) : <Resultat etat={enrolement} />}
        </div>
      ) : null}
    </Panneau>
  );
}

export default function Equipe() {
  const moi = useLecture('v1Moi');
  const acteurs = useLecture('v1Acteurs');
  const registre = useLecture('v1Registre');
  const actions = useLecture('v1Actions');
  return (
    <>
      <Lecture lecture={moi}>{(m) => <MonCompte moi={m} />}</Lecture>
      <Panneau titre="Les acteurs" sousTitre="Humains, agents et services : qui peut faire quoi, sur quel périmètre." actions={<Bouton onClick={() => acteurs.recharger()}>Relire</Bouton>}>
        <Lecture lecture={acteurs}>
          {(d) => (
            <Tableau vide="Aucun acteur n’est encore créé." lignes={elements(d)} cle={(a) => a.id}
              colonnes={[
                { titre: 'Acteur', rendu: (a) => <><strong>{a.nom_affiche}</strong> <code>{a.id}</code></> },
                { titre: 'Nature', rendu: (a) => `${TYPE_ACTEUR[a.type] ?? a.type}${a.departement ? ` · ${a.departement}` : ''}` },
                { titre: 'Rôles', rendu: (a) => a.roles.map((r) => <div key={`${r.role}${r.scope.type}${r.scope.id}`} className="petit">{`${r.role} · ${SCOPES[r.scope.type] ?? r.scope.type}${r.scope.id ? ` ${r.scope.id}` : ''}`}</div>) },
                { titre: 'Autonomie', rendu: (a) => (a.type === 'AGENT' ? AUTONOMIE[a.autonomie] ?? String(a.autonomie) : '—') },
                { titre: 'Plafonds', rendu: (a) => (a.type === 'HUMAN' ? <span className="discret">—</span> : <span className="petit">{`remise ${a.budgets.remise_max_pct ?? 10} %, avoir ${euros(a.budgets.credit_max_eur ?? 50)}, remboursement ${euros(a.budgets.remboursement_max_eur ?? 0)}`}</span>) },
                { titre: 'Second facteur', rendu: (a) => (a.type !== 'HUMAN' ? <span className="discret">jeton court</span> : a.mfa_actif ? <Pastille ton="succes">activé</Pastille> : <Pastille ton="alerte">non activé</Pastille>) },
                { titre: 'Statut', rendu: (a) => <Pastille ton={a.statut === 'actif' ? 'succes' : 'danger'}>{a.statut}</Pastille> },
                { titre: '', rendu: (a) => (
                  <BoutonAction libelle={a.statut === 'actif' ? 'Suspendre' : 'Réactiver'} route="v1StatutActeur"
                    options={(motif) => ({ params: { id: a.id }, corps: { statut: a.statut === 'actif' ? 'suspendu' : 'actif', motif } })} apres={() => acteurs.recharger()} />
                ) },
              ]} />
          )}
        </Lecture>
      </Panneau>
      <Panneau titre="Créer un acteur" sousTitre="Le rôle fondateur ne se donne pas. Un agent reçoit un jeton de 15 minutes, un service d’une heure.">
        <Creer registre={registre.donnees} apres={() => acteurs.recharger()} />
      </Panneau>
      <Panneau titre="Ce que l’équipe a fait" sousTitre="Chaque action passée par la passerelle, avec la décision des règles." actions={<Bouton onClick={() => actions.recharger()}>Relire</Bouton>}>
        <Lecture lecture={actions}>
          {(d) => (
            <Tableau vide="Aucune action pour l’instant." lignes={elements(d).slice().reverse()} cle={(a) => a.id}
              colonnes={[
                { titre: 'Quand', rendu: (a) => dateHeure(a.cree_le) },
                { titre: 'Qui', rendu: (a) => <><code>{a.acteur_id}</code> <span className="petit">({TYPE_ACTEUR[a.acteur_type] ?? a.acteur_type})</span></> },
                { titre: 'Action', rendu: (a) => <><code>{a.verbe}</code><br /><span className="petit">« {a.motif} »</span></> },
                { titre: 'Risque', rendu: (a) => <Risque r={a.decision.risque} /> },
                { titre: 'Décision des règles', rendu: (a) => <span className="petit">{a.decision.motif}</span> },
                { titre: 'Issue', rendu: (a) => <><StatutAction s={a.statut} />{a.erreur ? <><br /><span className="petit">{a.erreur}</span></> : null}</> },
              ]} />
          )}
        </Lecture>
      </Panneau>
    </>
  );
}
