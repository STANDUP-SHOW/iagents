// What the three consoles share about the admin core (/v1, plateforme/noyau/):
// how a connection state, a risk or an action outcome reads in French, and
// the one way an action is sent (motif + idempotency key, never a success the
// core did not give). See docs/admin/noyau.md.
import { useState } from 'react';
import { useAction } from '../donnees.jsx';
import { Bouton, Champ, Erreur, Pastille } from '../composants.jsx';

export const CONNEXION = {
  en_ligne: ['succes', 'en ligne'],
  degradee: ['alerte', 'en retard'],
  hors_ligne: ['danger', 'hors ligne'],
  jamais_vue: ['neutre', 'jamais vue'],
};
export function Connexion({ etat }) {
  const [ton, libelle] = CONNEXION[etat] ?? ['neutre', String(etat ?? '—')];
  return <Pastille ton={ton}>{libelle}</Pastille>;
}

export const RISQUE = { R0: ['neutre', 'R0 lecture'], R1: ['info', 'R1 faible'], R2: ['alerte', 'R2 modéré'], R3: ['danger', 'R3 élevé'], R4: ['danger', 'R4 critique'] };
export function Risque({ r }) {
  const [ton, libelle] = RISQUE[r] ?? ['neutre', String(r ?? '—')];
  return <Pastille ton={ton}>{libelle}</Pastille>;
}

export const STATUT_ACTION = {
  executee: ['succes', 'exécutée'], en_attente: ['alerte', 'en attente d’approbation'], refusee: ['danger', 'refusée'],
  echouee: ['danger', 'échouée'], expiree: ['neutre', 'expirée'],
};
export function StatutAction({ s }) {
  const [ton, libelle] = STATUT_ACTION[s] ?? ['neutre', String(s ?? '—')];
  return <Pastille ton={ton}>{libelle}</Pastille>;
}

export const TYPE_ACTEUR = { HUMAN: 'humain', AGENT: 'agent', SERVICE: 'service', DEVICE: 'Box' };

/** A fresh idempotency key per click: a double click or a retry after a cut cannot run an action twice. */
export const nouvelleIdempotence = () => {
  try { return globalThis.crypto.randomUUID(); } catch { return `console-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};

/** What the core said about an action, in one sentence; « exécutée » only when it says so. */
export function issueAction(corps) {
  const a = corps?.action;
  if (!a) return 'réponse sans action';
  if (a.statut === 'en_attente') {
    const n = corps.approbation?.requises ?? a.decision?.approbations_requises ?? 1;
    return `en attente : ${n} approbation${n > 1 ? 's' : ''} humaine${n > 1 ? 's' : ''} (${a.decision?.motif ?? ''}).`;
  }
  if (a.statut === 'executee') return `exécutée${corps.deja ? ' (déjà faite, rien n’a été refait)' : ''}. ${a.decision?.motif ?? ''}`;
  return `${STATUT_ACTION[a.statut]?.[1] ?? a.statut}. ${a.erreur ?? a.decision?.motif ?? ''}`;
}

/** The core's own outcome: never « enregistré » for an action left waiting. */
export function IssueAction({ etat }) {
  if (!etat || etat.statut === 'repos') return null;
  if (etat.statut === 'en-cours') return <p className="discret" aria-busy="true">Envoi à la plateforme…</p>;
  if (etat.statut === 'erreur') return <Erreur message={etat.erreur} locale={etat.plateforme === false} />;
  const attente = etat.corps?.action?.statut === 'en_attente';
  return (
    <div className={attente ? 'erreur' : 'succes'} role="status">
      <strong>{attente ? 'Pas encore faite :' : 'La plateforme a répondu :'}</strong> {issueAction(etat.corps)}
    </div>
  );
}

/**
 * A button that asks for a reason, then sends one gateway action.
 * `options(motif, idempotence)` returns the call's options.
 */
export function BoutonAction({ libelle, route, options, apres }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState('');
  const [etat, lancer, effacer] = useAction();
  if (!ouvert) return <><Bouton onClick={() => { effacer(); setOuvert(true); }}>{libelle}</Bouton><IssueAction etat={etat} /></>;
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer(route, () => options(motif.trim(), nouvelleIdempotence()), (c) => { setOuvert(false); setMotif(''); apres?.(c); }); }}>
      <Champ libelle={`Motif : ${libelle.toLowerCase()}`} aide="Obligatoire : il part à l’audit avec votre nom.">
        <input value={motif} onChange={(e) => setMotif(e.target.value)} required minLength={3} />
      </Champ>
      <div className="rangee">
        <button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Envoyer</button>
        <Bouton onClick={() => setOuvert(false)}>Annuler</Bouton>
      </div>
      <IssueAction etat={etat} />
    </form>
  );
}

/** A list answer of the core is `{ elements, suivant }`. */
export const elements = (d) => (d && Array.isArray(d.elements) ? d.elements : []);
