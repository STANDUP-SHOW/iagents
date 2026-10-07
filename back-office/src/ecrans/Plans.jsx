// Plans et prix (MASTER §5, §15) : every version of every plan, by country,
// hidden and legacy included, and a new version that never overwrites.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, Resultat, RouteAbsente, Tableau, date, euros, lignesDe, nombre } from '../composants.jsx';

export const lectures = [['plansTous', {}]];

const aujourdHui = () => new Date().toISOString().slice(0, 10);

/** Where a version stands on a given day. */
export function etatVersion(plan, jour = aujourdHui()) {
  const debut = String(plan.effective_from ?? '').slice(0, 10);
  const fin = plan.effective_to ? String(plan.effective_to).slice(0, 10) : null;
  if (debut && debut > jour) return { ton: 'info', libelle: 'à venir' };
  if (fin && fin <= jour) return { ton: 'neutre', libelle: 'ancienne' };
  return { ton: 'succes', libelle: 'en vigueur' };
}

export function prixDe(p) {
  if (p.base_price === null || p.base_price === undefined) return 'sur devis';
  const bas = euros(p.base_price, p.currency);
  const texte = p.base_price_max ? `${bas} – ${euros(p.base_price_max, p.currency)}` : bas;
  return `${p.a_partir_de ? 'à partir de ' : ''}${texte} ${p.tax_mode ?? ''} / ${p.billing_period ?? 'mois'}`.trim();
}

const MODELE_VIDE = {
  plan_id: '', nom: '', description: '', segment: 'business', currency: 'EUR', billing_period: 'mois',
  commitment_months: 0, base_price: null, base_price_max: null, a_partir_de: false, included_agents: 0,
  included_commander: false, included_box: false, included_voice_minutes: 0, usage_rate_llm: null,
  usage_rate_voice: null, usage_rate_telephony: null, overage_rules: null, effective_from: '', effective_to: null,
  public_visibility: true, region: 'FR', tax_mode: 'HT', legacy_flag: false,
};

const enNombre = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')));

/** The body sent for a new version: the source version, the edits, and no end date. */
export function corpsNouvelleVersion(source, edition) {
  const corps = { ...MODELE_VIDE, ...source, ...edition, effective_to: null };
  for (const k of ['base_price', 'base_price_max', 'usage_rate_llm', 'usage_rate_voice', 'usage_rate_telephony']) corps[k] = enNombre(corps[k]);
  for (const k of ['commitment_months', 'included_agents', 'included_voice_minutes']) corps[k] = enNombre(corps[k]) ?? 0;
  if (!String(corps.plan_id).trim()) throw new Error('Indiquez l’identifiant du plan.');
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(corps.effective_from))) throw new Error("Indiquez la date d'effet de la nouvelle version (AAAA-MM-JJ).");
  for (const [k, v] of Object.entries(corps)) {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`« ${k} » n'est pas un nombre.`);
  }
  return corps;
}

function FormulaireVersion({ source, onFini }) {
  const [edition, setEdition] = useState(() => ({
    plan_id: source.plan_id, nom: source.nom, description: source.description,
    base_price: source.base_price ?? '', base_price_max: source.base_price_max ?? '',
    a_partir_de: Boolean(source.a_partir_de), commitment_months: source.commitment_months ?? 0,
    included_agents: source.included_agents ?? 0, included_voice_minutes: source.included_voice_minutes ?? 0,
    region: source.region ?? 'FR', public_visibility: source.public_visibility !== false,
    legacy_flag: Boolean(source.legacy_flag), effective_from: aujourdHui(),
  }));
  const [etat, lancer] = useAction();
  const poser = (k) => (e) => setEdition({ ...edition, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('nouvelleVersionPlan', () => ({ corps: corpsNouvelleVersion(source, edition) }), onFini); }}>
      <p className="discret">
        {source.plan_id
          ? `Nouvelle version de ${source.plan_id} : la plateforme ferme la version en cours à la date d'effet et garde l'ancienne, rien n'est écrasé.`
          : 'Nouveau plan : sa première version.'}
      </p>
      <div className="grille">
        <Champ libelle="Identifiant"><input value={edition.plan_id} onChange={poser('plan_id')} readOnly={Boolean(source.plan_id)} required /></Champ>
        <Champ libelle="Nom"><input value={edition.nom} onChange={poser('nom')} required /></Champ>
        <Champ libelle="Prix de base (vide = sur devis)"><input inputMode="decimal" value={edition.base_price} onChange={poser('base_price')} /></Champ>
        <Champ libelle="Haut de fourchette"><input inputMode="decimal" value={edition.base_price_max} onChange={poser('base_price_max')} /></Champ>
        <Champ libelle="Engagement (mois)"><input inputMode="numeric" value={edition.commitment_months} onChange={poser('commitment_months')} /></Champ>
        <Champ libelle="Agents inclus"><input inputMode="numeric" value={edition.included_agents} onChange={poser('included_agents')} /></Champ>
        <Champ libelle="Minutes de voix incluses"><input inputMode="numeric" value={edition.included_voice_minutes} onChange={poser('included_voice_minutes')} /></Champ>
        <Champ libelle="Pays (ISO)"><input value={edition.region} onChange={poser('region')} maxLength={2} required /></Champ>
        <Champ libelle="Date d'effet"><input type="date" value={edition.effective_from} onChange={poser('effective_from')} required /></Champ>
      </div>
      <Champ libelle="Description"><textarea rows={2} value={edition.description} onChange={poser('description')} /></Champ>
      <div className="cases">
        <label><input type="checkbox" checked={edition.a_partir_de} onChange={poser('a_partir_de')} /> « à partir de »</label>
        <label><input type="checkbox" checked={edition.public_visibility} onChange={poser('public_visibility')} /> visible sur le site</label>
        <label><input type="checkbox" checked={edition.legacy_flag} onChange={poser('legacy_flag')} /> ancien plan (legacy)</label>
      </div>
      <div className="rangee">
        <button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Enregistrer la version</button>
      </div>
      <Resultat etat={etat} succes={(c) => {
        const p = c && (c.plan ?? c);
        return p && p.plan_id ? `${p.plan_id}, version en vigueur au ${date(p.effective_from)}.` : JSON.stringify(c);
      }} />
    </form>
  );
}

export default function Plans({ versionInitiale = null }) {
  const lecture = useLecture('plansTous');
  const [pays, setPays] = useState('');
  const [montrerAnciens, setMontrerAnciens] = useState(true);
  const [montrerMasques, setMontrerMasques] = useState(true);
  const tous = lignesDe(lecture.donnees, 'plans');
  // versionInitiale (a plan_id, or '' for a new plan) opens the form at first render: the bench renders it.
  const [source, setSource] = useState(() => (versionInitiale === null ? null
    : versionInitiale === '' ? { ...MODELE_VIDE } : (tous ?? []).find((p) => p.plan_id === versionInitiale) ?? null));
  return (
    <>
      <Panneau
        titre="Plans et prix"
        sousTitre="Toutes les versions de chaque plan, par pays, y compris masquées et anciennes (GET /tarifs/plans/tous)."
        actions={<Bouton onClick={() => setSource({ ...MODELE_VIDE })}>Nouveau plan</Bouton>}
      >
        <div className="filtres">
          <Champ libelle="Pays">
            <select value={pays} onChange={(e) => setPays(e.target.value)}>
              <option value="">Tous</option>
              {[...new Set((tous ?? []).map((p) => p.region))].sort().map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Champ>
          <label className="case"><input type="checkbox" checked={montrerAnciens} onChange={(e) => setMontrerAnciens(e.target.checked)} /> versions anciennes</label>
          <label className="case"><input type="checkbox" checked={montrerMasques} onChange={(e) => setMontrerMasques(e.target.checked)} /> plans masqués</label>
        </div>
        <Lecture lecture={lecture}>
          {() => {
            if (!tous) return <p className="erreur" role="alert">La plateforme a répondu sans liste de plans.</p>;
            const lignes = tous
              .filter((p) => !pays || p.region === pays)
              .filter((p) => montrerAnciens || etatVersion(p).libelle !== 'ancienne')
              .filter((p) => montrerMasques || (p.public_visibility && !p.legacy_flag))
              .sort((a, b) => String(a.plan_id).localeCompare(String(b.plan_id)) || String(b.effective_from).localeCompare(String(a.effective_from)));
            return (
              <>
                <p className="discret">{nombre(lignes.length)} version(s) affichée(s) sur {nombre(tous.length)}.</p>
                <Tableau
                  vide="Aucun plan pour ce filtre."
                  lignes={lignes}
                  cle={(p) => `${p.plan_id}@${p.region}@${p.effective_from}`}
                  colonnes={[
                    { titre: 'Plan', rendu: (p) => <><strong>{p.nom}</strong><br /><code>{p.plan_id}</code></> },
                    { titre: 'Segment', rendu: (p) => p.segment },
                    { titre: 'Pays', rendu: (p) => p.region },
                    { titre: 'Prix', rendu: (p) => prixDe(p) },
                    { titre: 'Engagement', rendu: (p) => (p.commitment_months ? `${p.commitment_months} mois` : 'sans') },
                    { titre: 'Inclus', rendu: (p) => [`${p.included_agents ?? 0} agent(s)`, p.included_box ? 'Box' : null, p.included_commander ? 'Commander' : null, p.included_voice_minutes ? `${p.included_voice_minutes} min voix` : null].filter(Boolean).join(' · ') },
                    { titre: 'Effet', rendu: (p) => `${date(p.effective_from)} → ${p.effective_to ? date(p.effective_to) : '…'}` },
                    { titre: 'État', rendu: (p) => { const e = etatVersion(p); return <><Pastille ton={e.ton}>{e.libelle}</Pastille>{!p.public_visibility ? <Pastille ton="alerte">masqué</Pastille> : null}{p.legacy_flag ? <Pastille ton="alerte">legacy</Pastille> : null}</>; } },
                    { titre: '', rendu: (p) => <Bouton onClick={() => setSource(p)}>Nouvelle version</Bouton> },
                  ]}
                />
              </>
            );
          }}
        </Lecture>
      </Panneau>
      {source ? (
        <Panneau titre={source.plan_id ? `Nouvelle version : ${source.nom}` : 'Nouveau plan'} actions={<Bouton onClick={() => setSource(null)}>Fermer</Bouton>}>
          <FormulaireVersion key={`${source.plan_id}@${source.effective_from}`} source={source} onFini={() => lecture.recharger()} />
        </Panneau>
      ) : null}
      <Panneau titre="Remises">
        <RouteAbsente
          titre="Aucune route de remise au contrat"
          ceQuiManque="Le MASTER §15 cite les remises, mais docs/master/routes.md n'en porte aucune : une remise ne peut être ni lue ni posée depuis le back-office. Les engagements, eux, sont la durée d'engagement de chaque version."
          proposition={[
            { methode: 'GET', chemin: '/tarifs/remises', acces: 'admin', role: 'remises en cours et passées' },
            { methode: 'POST', chemin: '/tarifs/remises', acces: 'admin', role: '{plan_id?, segment?, region, taux|montant, debut, fin, motif}, versionnée comme un plan' },
          ]}
        />
      </Panneau>
    </>
  );
}
