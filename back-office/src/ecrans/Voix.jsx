// Voice et téléphonie (MASTER §10-12, §15) : numéros, fournisseurs,
// standards, files, campagnes, coûts.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Champ, Lecture, Panneau, Pastille, Resultat, RouteAbsente, Tableau, dateHeure, euros, lignesDe, lireJson, nombre } from '../composants.jsx';
import { Apercu, ChoixClient, useTenants } from './commun.jsx';

export const lectures = [['numeros', {}], ['appels', {}], ['tenants', {}]];
export const FOURNISSEURS_TELEPHONIE = ['telnyx', 'twilio', 'sip'];

const MODELE_STANDARD = {
  tenant_id: '',
  accueil: 'Bonjour, vous êtes bien chez …, je suis l’assistante. Que puis-je pour vous ?',
  horaires: { lundi: ['09:00-12:00', '14:00-18:00'], samedi: [] },
  extensions: [{ touche: '1', libelle: 'Commandes', agent_instance_id: '' }],
  humains: [{ nom: '', e164: '', disponible: true }],
  regles: [{ si: 'hors-horaires', alors: 'messagerie' }],
};
const MODELE_CAMPAGNE = {
  tenant_id: '',
  pays: 'FR',
  source_consentement: 'formulaire du site, case cochée, 2026-09',
  fenetres: [{ jours: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'], de: '10:00', a: '12:00' }],
  contacts: [{ nom: '', e164: '+33', consentement: true }],
};

function DemanderNumero({ tenants, onFini }) {
  const [f, setF] = useState({ tenant_id: '', provider: 'telnyx', e164: '' });
  const [etat, lancer] = useAction();
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('demanderNumero', { corps: { tenant_id: f.tenant_id, provider: f.provider, ...(f.e164 ? { e164: f.e164 } : {}) } }, onFini); }}>
      <div className="grille">
        <Champ libelle="Client"><ChoixClient tenants={tenants} valeur={f.tenant_id} onChange={(v) => setF({ ...f, tenant_id: v })} tous="Choisir…" requis /></Champ>
        <Champ libelle="Fournisseur"><select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>{FOURNISSEURS_TELEPHONIE.map((p) => <option key={p} value={p}>{p}</option>)}</select></Champ>
        <Champ libelle="Numéro voulu (E.164, facultatif)"><input value={f.e164} onChange={(e) => setF({ ...f, e164: e.target.value })} placeholder="+33…" /></Champ>
      </div>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Demander le numéro</button></div>
      <Resultat etat={etat} succes={(c) => `${c?.e164 ?? 'numéro'} chez ${c?.provider ?? f.provider} : ${c?.statut ?? '?'}.`} />
    </form>
  );
}

function EditeurJson({ nomRoute, titreId, modele, bouton, avecId = true, succes, apres }) {
  const [id, setId] = useState('');
  const [texte, setTexte] = useState(() => JSON.stringify(modele, null, 2));
  const [etat, lancer] = useAction();
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer(nomRoute, () => ({ ...(avecId ? { params: { id } } : {}), corps: lireJson(texte, 'Le contenu') }), apres); }}>
      {avecId ? <Champ libelle={titreId}><input value={id} onChange={(e) => setId(e.target.value)} required /></Champ> : null}
      <Champ libelle="Contenu (JSON)"><textarea className="code" rows={12} value={texte} onChange={(e) => setTexte(e.target.value)} spellCheck={false} /></Champ>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>{bouton}</button></div>
      <Resultat etat={etat} succes={succes} />
    </form>
  );
}

function File() {
  const [f, setF] = useState({ id: '', tenant_id: '', priorite: 1, debordement: 'messagerie', rappel: true, attente_max_s: 90 });
  const [etat, lancer] = useAction();
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); const { id, ...corps } = f; lancer('file', { params: { id }, corps: { ...corps, priorite: Number(corps.priorite), attente_max_s: Number(corps.attente_max_s) } }); }}>
      <div className="grille">
        <Champ libelle="Identifiant de la file"><input value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} required /></Champ>
        <Champ libelle="Client (tenant)"><input value={f.tenant_id} onChange={(e) => setF({ ...f, tenant_id: e.target.value })} required /></Champ>
        <Champ libelle="Priorité"><input inputMode="numeric" value={f.priorite} onChange={(e) => setF({ ...f, priorite: e.target.value })} /></Champ>
        <Champ libelle="Attente maximale (s)"><input inputMode="numeric" value={f.attente_max_s} onChange={(e) => setF({ ...f, attente_max_s: e.target.value })} /></Champ>
        <Champ libelle="Débordement"><select value={f.debordement} onChange={(e) => setF({ ...f, debordement: e.target.value })}>
          <option value="messagerie">messagerie</option><option value="humain">humain</option><option value="autre-agent">autre agent</option><option value="rappel">rappel</option>
        </select></Champ>
      </div>
      <label className="case"><input type="checkbox" checked={f.rappel} onChange={(e) => setF({ ...f, rappel: e.target.checked })} /> proposer un rappel</label>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Enregistrer la file</button></div>
      <Resultat etat={etat} succes={(c) => `file ${c?.id ?? f.id} enregistrée.`} />
    </form>
  );
}

function Campagnes() {
  const [creee, setCreee] = useState(null);
  const [etatLancer, lancer] = useAction();
  return (
    <>
      <EditeurJson
        nomRoute="creerCampagne" avecId={false} modele={MODELE_CAMPAGNE} bouton="Créer la campagne"
        succes={(c) => `campagne ${c?.id ?? '?'} créée (${nombre(Array.isArray(c?.contacts) ? c.contacts.length : NaN)} contact(s)), pas encore lancée.`}
        apres={(c) => setCreee(c)}
      />
      {creee && creee.id ? (
        <div className="rangee">
          <button type="button" className="bouton bouton-principal" disabled={etatLancer.statut === 'en-cours'} onClick={() => lancer('lancerCampagne', { params: { id: creee.id } })}>Lancer la campagne {creee.id}</button>
        </div>
      ) : null}
      <p className="discret">Au lancement, la plateforme refuse tout contact sans consentement, sur liste d'opposition ou hors horaires.</p>
      <Resultat etat={etatLancer} succes={(c) => <Apercu valeur={c} />} />
    </>
  );
}

function CoutAppel() {
  const [f, setF] = useState({ duree_s: 180, provider_tel: 'telnyx', provider_voix: 'gemini-live', jetons_llm: 4000, outils: 0 });
  const [etat, lancer] = useAction();
  const poser = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('coutAppel', { corps: { ...f, duree_s: Number(f.duree_s), jetons_llm: Number(f.jetons_llm), outils: Number(f.outils) } }); }}>
      <div className="grille">
        <Champ libelle="Durée (s)"><input inputMode="numeric" value={f.duree_s} onChange={poser('duree_s')} /></Champ>
        <Champ libelle="Téléphonie"><select value={f.provider_tel} onChange={poser('provider_tel')}>{FOURNISSEURS_TELEPHONIE.map((p) => <option key={p} value={p}>{p}</option>)}</select></Champ>
        <Champ libelle="Moteur de voix"><select value={f.provider_voix} onChange={poser('provider_voix')}>
          <option value="gemini-live">gemini-live</option><option value="elevenlabs">elevenlabs</option><option value="local">local</option>
        </select></Champ>
        <Champ libelle="Jetons LLM"><input inputMode="numeric" value={f.jetons_llm} onChange={poser('jetons_llm')} /></Champ>
        <Champ libelle="Appels d'outils"><input inputMode="numeric" value={f.outils} onChange={poser('outils')} /></Champ>
      </div>
      <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Calculer</button></div>
      <Resultat etat={etat} succes={(c) => <Apercu valeur={c} />} />
    </form>
  );
}

export default function Voix() {
  const { tenants, nomDe } = useTenants();
  const [tenant, setTenant] = useState('');
  const numeros = useLecture('numeros', { query: { tenant_id: tenant } });
  const appels = useLecture('appels', { query: { tenant_id: tenant } });
  const lignesNumeros = lignesDe(numeros.donnees, 'numeros') ?? [];
  const lignesAppels = lignesDe(appels.donnees, 'appels') ?? [];
  return (
    <>
      <Panneau titre="Voice et téléphonie" sousTitre="Numéros, appels et leurs coûts, par client.">
        <div className="filtres"><Champ libelle="Client"><ChoixClient tenants={tenants} valeur={tenant} onChange={setTenant} /></Champ></div>
        <h3>Numéros</h3>
        <Lecture lecture={numeros}>
          {() => (
            <Tableau vide="Aucun numéro." lignes={lignesNumeros} cle={(n) => n.e164}
              colonnes={[
                { titre: 'Numéro', rendu: (n) => <code>{n.e164}</code> },
                { titre: 'Client', rendu: (n) => nomDe(n.tenant_id) },
                { titre: 'Fournisseur', rendu: (n) => n.provider },
                { titre: 'Statut', rendu: (n) => <Pastille ton={n.statut === 'actif' ? 'succes' : n.statut === 'demande' ? 'info' : 'neutre'}>{n.statut}</Pastille> },
                { titre: 'Standard', rendu: (n) => n.routage_id ?? '—' },
              ]} />
          )}
        </Lecture>
        <h3>Appels</h3>
        <Lecture lecture={appels}>
          {() => (
            <Tableau vide="Aucun appel." lignes={lignesAppels} cle={(a) => a.id}
              colonnes={[
                { titre: 'Quand', rendu: (a) => dateHeure(a.debut) },
                { titre: 'Client', rendu: (a) => nomDe(a.tenant_id) },
                { titre: 'Sens', rendu: (a) => `${a.direction} · ${a.appelant} → ${a.appele}` },
                { titre: 'Durée', rendu: (a) => `${nombre(a.duree_s)} s` },
                { titre: 'Issue', rendu: (a) => a.issue },
                { titre: 'Coût', rendu: (a) => (a.cout ? `${euros(a.cout.total, a.cout.devise)} (tél. ${euros(a.cout.telephonie, a.cout.devise)}, voix ${euros(a.cout.voix, a.cout.devise)}, LLM ${euros(a.cout.llm, a.cout.devise)})` : '—') },
                { titre: 'Résumé', rendu: (a) => <span className="petit">{a.resume ?? '—'}</span> },
              ]} />
          )}
        </Lecture>
      </Panneau>
      <div className="colonnes">
        <Panneau titre="Demander un numéro" sousTitre="Sans clé de l'opérateur posée sur la plateforme, elle refuse et dit laquelle manque."><DemanderNumero tenants={tenants} onFini={() => numeros.recharger()} /></Panneau>
        <Panneau titre="Coût d'un appel" sousTitre="Téléphonie + voix + LLM + outils + marge (POST /tarifs/cout-appel)."><CoutAppel /></Panneau>
        <Panneau titre="Standard téléphonique" sousTitre="Accueil, horaires, extensions, humains, règles (PUT /voix/standards/:id).">
          <EditeurJson nomRoute="standard" titreId="Identifiant du standard" modele={MODELE_STANDARD} bouton="Enregistrer le standard" succes={(c) => `standard ${c?.id ?? ''} enregistré.`} />
        </Panneau>
        <Panneau titre="File d'attente" sousTitre="Priorité, débordement, rappel (PUT /voix/files/:id)."><File /></Panneau>
        <Panneau titre="Campagne d'appels sortants"><Campagnes /></Panneau>
      </div>
      <Panneau titre="Ce que le contrat ne permet pas encore de lire">
        <RouteAbsente
          titre="Fournisseurs, standards, files et campagnes : écriture seule"
          ceQuiManque="docs/master/routes.md permet d'écrire un standard, une file et une campagne, mais n'a aucune route pour les relire, ni pour savoir quels fournisseurs de voix et de téléphonie ont leur clé posée. L'écran ne peut donc pas les lister."
          proposition={[
            { methode: 'GET', chemin: '/voix/fournisseurs', acces: 'admin', role: '[{provider, type: telephonie|voix, cle_posee: bool, manque?: "NOM_DE_VARIABLE"}] — jamais la clé' },
            { methode: 'GET', chemin: '/voix/standards', acces: 'admin', role: '?tenant_id=' },
            { methode: 'GET', chemin: '/voix/files', acces: 'admin', role: '?tenant_id=' },
            { methode: 'GET', chemin: '/voix/campagnes', acces: 'admin', role: '?tenant_id= avec statut et refus par contact' },
          ]}
        />
      </Panneau>
    </>
  );
}
