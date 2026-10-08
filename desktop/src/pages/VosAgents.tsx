import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AgentInstalle, Planification } from '../agents/fiche'
import { estTeamHolder } from '../agents/team-holder'
import { travailDuJour } from '../agents/travail'
import Avatar from '../shell/Avatar'
import { portraitDe } from '../shell/portraits'
import { EntetePage } from '../shell/Shell'
import type { Cible } from '../shell/intentions'

/**
 * Vos agents (brief §4): the agent is a person, and its work stays entirely
 * inspectable. A gallery of the agents hired on this workstation, the large
 * card of the one selected, and six tabs: Profil, Tâches, Courrier,
 * Navigateur, Rapports, Connexions.
 *
 * Nothing secret is shown (no key, no token, no system prompt): the profile
 * shows the métier, the rules the agent follows and what the employer taught
 * it, never the instructions sent to the model.
 */

type Onglet = 'profil' | 'taches' | 'courrier' | 'navigateur' | 'rapports' | 'connexions'

const ONGLETS: { id: Onglet; titre: string }[] = [
  { id: 'profil', titre: 'Profil' },
  { id: 'taches', titre: 'Tâches' },
  { id: 'courrier', titre: 'Courrier' },
  { id: 'navigateur', titre: 'Navigateur' },
  { id: 'rapports', titre: 'Rapports' },
  { id: 'connexions', titre: 'Connexions' },
]

const CONNECTEURS: Record<string, { libelle: string; ou: string }> = {
  email: { libelle: 'Courriel', ou: 'Courrier' },
  whatsapp: { libelle: 'WhatsApp', ou: 'Vos connexions' },
  voix: { libelle: 'Voix', ou: 'tenue par l’application' },
  conversation: { libelle: 'Conversation', ou: 'Vos connexions' },
  navigateur: { libelle: 'Navigateur', ou: 'tenu par l’application' },
  calendrier: { libelle: 'Calendrier', ou: 'Vos connexions' },
  fichiers: { libelle: 'Fichiers', ou: 'Vos connexions' },
  telephone: { libelle: 'Téléphone', ou: 'pas encore branché' },
}

export function planificationEnMots(p: Planification): string {
  switch (p.type) {
    case 'quotidienne':
      return `chaque jour à ${p.heure}`
    case 'hebdomadaire':
      return `chaque ${p.jour} à ${p.heure}`
    case 'mensuelle':
      return `le ${p.jour} du mois à ${p.heure}`
    case 'intervalle':
      return `toutes les ${p.minutes} min`
    case 'declencheur':
      return {
        'email.recu': 'à chaque courriel reçu',
        'whatsapp.recu': 'à chaque message WhatsApp',
        'fichier.depose': 'à chaque fichier déposé',
        'calendrier.evenement': 'à chaque rendez-vous',
        'appel.recu': 'à chaque appel reçu',
      }[p.evenement]
    default:
      return 'à la demande'
  }
}

type Envoi = { date: number; de: string; destinataires: string[]; objet: string }
type Site = { nom: string; hote: string; declare_le: number }

export default function VosAgents({
  installes,
  statuts,
  onBasculer,
  onParler,
  aller,
  selection,
}: {
  installes: readonly AgentInstalle[]
  statuts: Record<string, boolean>
  onBasculer: (ficheId: string) => void
  onParler: (agent: AgentInstalle) => void
  aller: (c: Cible) => void
  selection?: string
}) {
  const [choisi, setChoisi] = useState<string | null>(selection ?? null)
  const [onglet, setOnglet] = useState<Onglet>('profil')
  const [filtre, setFiltre] = useState('')
  const [vue, setVue] = useState<'tous' | 'actifs' | 'pause'>('tous')
  const [plus, setPlus] = useState(false)

  useEffect(() => {
    if (selection) setChoisi(selection)
  }, [selection])

  const liste = useMemo(
    () =>
      installes.filter((a) => {
        const t = filtre.trim().toLowerCase()
        if (t && !`${a.prenom} ${a.fiche.nom}`.toLowerCase().includes(t)) return false
        if (vue === 'actifs') return !!statuts[a.fiche.id]
        if (vue === 'pause') return !statuts[a.fiche.id]
        return true
      }),
    [installes, filtre, vue, statuts]
  )
  const agent = installes.find((a) => a.prenom === choisi) ?? installes[0] ?? null

  return (
    <div className="page-dc">
      <EntetePage
        onglet="agents"
        titre="Vos agents"
        sousTitre="Une équipe d’agents spécialisés, au service de vos objectifs. Ce qu’ils font reste toujours visible."
        actions={
          <>
            <label className="champ-recherche">
              <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4.5 4.5" />
              </svg>
              <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher un agent…" />
            </label>
            <select className="choix-dc" value={vue} onChange={(e) => setVue(e.target.value as typeof vue)} aria-label="Statut">
              <option value="tous">Tous les statuts</option>
              <option value="actifs">Actifs</option>
              <option value="pause">En pause</option>
            </select>
            <button className="bouton-charte" onClick={() => aller({ onglet: 'embauche' })}>
              + Embaucher un agent
            </button>
          </>
        }
      />

      {installes.length === 0 ? (
        <div className="etat-vide-dc">
          <strong>Aucun agent n’est encore embauché sur ce poste.</strong>
          <p>Choisissez un métier parmi le catalogue : l’agent vous pose ses questions, puis rejoint votre équipe.</p>
          <button className="bouton-charte" onClick={() => aller({ onglet: 'embauche' })}>
            Embaucher un agent
          </button>
        </div>
      ) : (
        <>
          <div className="galerie-agents">
            {liste.map((a) => (
              <button
                key={a.prenom}
                className={`carte-agent${agent?.prenom === a.prenom ? ' carte-choisie' : ''}`}
                onClick={() => {
                  setChoisi(a.prenom)
                  setPlus(false)
                }}
              >
                <Avatar prenom={a.prenom} photo={portraitDe(a)} taille="l" />
                <span className="carte-agent-nom">{a.prenom}</span>
                <span className="carte-agent-role">{estTeamHolder(a) ? 'Task Commander' : a.fiche.nom}</span>
                <span className={`statut-ligne ${statuts[a.fiche.id] ? 'statut-actif' : 'statut-pause'}`}>
                  <span className="point" />
                  {statuts[a.fiche.id] ? 'Actif' : 'En pause'}
                </span>
              </button>
            ))}
            <button className="carte-agent carte-plus" onClick={() => aller({ onglet: 'embauche' })}>
              <span className="plus-rond">+</span>
              <span>Embaucher</span>
            </button>
          </div>

          {agent && (
            <>
              <FicheAgent
                agent={agent}
                actif={!!statuts[agent.fiche.id]}
                plus={plus}
                onPlus={() => setPlus((p) => !p)}
                onParler={() => onParler(agent)}
                onBasculer={() => onBasculer(agent.fiche.id)}
                onConnexions={() => setOnglet('connexions')}
                onFormer={() => setOnglet('profil')}
                aller={aller}
              />
              <div className="onglets-agent" role="tablist">
                {ONGLETS.map((o) => (
                  <button key={o.id} role="tab" aria-selected={onglet === o.id} className={onglet === o.id ? 'actif' : ''} onClick={() => setOnglet(o.id)}>
                    {o.titre}
                  </button>
                ))}
              </div>
              <div className="contenu-onglet carte-verre">
                {onglet === 'profil' && <Profil agent={agent} />}
                {onglet === 'taches' && <Taches agent={agent} aller={aller} />}
                {onglet === 'courrier' && <Courrier agent={agent} aller={aller} />}
                {onglet === 'navigateur' && <Navigateur agent={agent} aller={aller} />}
                {onglet === 'rapports' && <Rapports agent={agent} aller={aller} />}
                {onglet === 'connexions' && <Connexions agent={agent} aller={aller} />}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function FicheAgent({
  agent,
  actif,
  plus,
  onPlus,
  onParler,
  onBasculer,
  onConnexions,
  onFormer,
  aller,
}: {
  agent: AgentInstalle
  actif: boolean
  plus: boolean
  onPlus: () => void
  onParler: () => void
  onBasculer: () => void
  onConnexions: () => void
  onFormer: () => void
  aller: (c: Cible) => void
}) {
  const taches = travailDuJour(agent)
  const pretes = taches.filter((t) => !t.empechement).length
  const sousControle = agent.planning.filter((t) => t.active && t.validationHumaine).length
  const formats = [...new Set(agent.planning.filter((t) => t.active).flatMap((t) => t.sorties.map((s) => s.format)))]
  const [dossier, setDossier] = useState<string | null>(null)
  useEffect(() => {
    setDossier(null)
    invoke<string>('dossier_de_travail', { prenom: agent.prenom, ficheId: agent.fiche.id })
      .then(setDossier)
      .catch(() => setDossier(null))
  }, [agent.prenom, agent.fiche.id])

  return (
    <section className="fiche-agent carte-verre">
      <div className="fiche-portrait">
        <Avatar prenom={agent.prenom} photo={portraitDe(agent)} taille="xl" />
      </div>
      <div className="fiche-identite">
        <div className="fiche-nom">
          <h2>{agent.prenom}</h2>
          <span className={`statut-ligne ${actif ? 'statut-actif' : 'statut-pause'}`}>
            <span className="point" />
            {actif ? 'Actif' : 'En pause'}
          </span>
        </div>
        <p className="fiche-role">{estTeamHolder(agent) ? `Task Commander · ${agent.fiche.nom}` : agent.fiche.nom}</p>
        <p className="fiche-resume">{agent.fiche.description}</p>
        <div className="etiquettes">
          <span className="etiquette-dc">{agent.fiche.secteur.replace(/-/g, ' ')}</span>
          {formats.slice(0, 5).map((f) => (
            <span key={f} className="etiquette-dc">
              {f}
            </span>
          ))}
        </div>
      </div>
      <div className="fiche-kpis">
        <div className="kpi-mini">
          <strong>
            {pretes}/{taches.length}
          </strong>
          <span>tâches prêtes</span>
        </div>
        <div className="kpi-mini">
          <strong>{sousControle}</strong>
          <span>sous votre contrôle</span>
        </div>
        <div className="kpi-mini">
          <strong>{agent.competences.length}</strong>
          <span>appris de vous</span>
        </div>
      </div>
      <div className="fiche-outils">
        <span className="etiquette">Outils déclarés par sa fiche</span>
        <div className="outils-liste">
          {agent.fiche.connecteurs.map((c) => (
            <span key={c} className="outil-pastille" title={CONNECTEURS[c]?.ou}>
              {CONNECTEURS[c]?.libelle ?? c}
            </span>
          ))}
        </div>
      </div>
      <div className="fiche-actions">
        <button className="bouton-cyan" onClick={onParler}>
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
          Parler à {agent.prenom}
        </button>
        <button className="bouton-contour bouton-magenta" onClick={onFormer}>
          Former / Corriger
        </button>
        <button className="bouton-contour" onClick={onConnexions}>
          Voir ses connexions
        </button>
        <button className="bouton-contour" onClick={onBasculer}>
          {actif ? 'Mettre en pause' : 'Activer'}
        </button>
        <div className="plus-zone">
          <button className="bouton-rond" onClick={onPlus} aria-expanded={plus} title="Plus">
            ⋯
          </button>
          {plus && (
            <div className="menu-flottant">
              <button
                onClick={() =>
                  invoke('montrer_resultat', { prenom: agent.prenom, ficheId: agent.fiche.id, fichier: null }).catch((e) => setDossier(String(e)))
                }
              >
                Ouvrir son dossier de travail
              </button>
              {dossier && <p className="precision">{dossier}</p>}
              <button onClick={() => aller({ onglet: 'travail', agent: agent.prenom })}>Voir son travail du jour</button>
              <button onClick={() => aller({ onglet: 'equipe' })}>Voir l’équipe</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Profil({ agent }: { agent: AgentInstalle }) {
  const horaires = agent.planning.filter((t) => t.active && t.planification.type !== 'a-la-demande')
  return (
    <div className="grille-profil">
      <div>
        <h4>Identité</h4>
        <dl className="donnees-dc">
          <dt>Prénom</dt>
          <dd>{agent.prenom}</dd>
          <dt>Métier</dt>
          <dd>{agent.fiche.nom}</dd>
          <dt>Secteur</dt>
          <dd>{agent.fiche.secteur.replace(/-/g, ' ')}</dd>
          <dt>Voix</dt>
          <dd>{agent.voix ? 'choisie à l’embauche' : 'voix du poste'} · français</dd>
          <dt>Autonomie</dt>
          <dd>
            {agent.planning.some((t) => t.active && t.validationHumaine)
              ? 'va seul, sauf les tâches que vous avez mises sous contrôle'
              : 'va seul sur toutes ses tâches'}
          </dd>
        </dl>
      </div>
      <div>
        <h4>Ses horaires</h4>
        {horaires.length === 0 ? (
          <p className="vide">Il travaille à la demande.</p>
        ) : (
          <ul className="liste-simple">
            {horaires.slice(0, 8).map((t) => (
              <li key={t.id}>
                <strong>{t.nom}</strong> · {planificationEnMots(t.planification)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4>Les règles qu’il suit</h4>
        {agent.fiche.expert.regles.length === 0 ? (
          <p className="vide">Aucune règle particulière.</p>
        ) : (
          <ul className="liste-simple">
            {agent.fiche.expert.regles.slice(0, 6).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4>Ce que vous lui avez appris</h4>
        {agent.competences.length === 0 ? (
          <p className="vide">Rien encore. Ce que vous lui dites à l’entretien, ou en le corrigeant, s’ajoute ici sans remplacer son métier.</p>
        ) : (
          <ul className="liste-simple">
            {agent.competences.map((c) => (
              <li key={c.titre}>
                <strong>{c.titre}</strong> · {c.resume}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Taches({ agent, aller }: { agent: AgentInstalle; aller: (c: Cible) => void }) {
  const taches = travailDuJour(agent)
  return (
    <div>
      <div className="onglet-entete">
        <h4>Tâches du jour</h4>
        <button className="lien-dc" onClick={() => aller({ onglet: 'travail', agent: agent.prenom })}>
          Ouvrir dans le travail du jour ›
        </button>
      </div>
      {taches.length === 0 && <p className="vide">Aucune tâche allumée.</p>}
      <ul className="liste-taches-mini">
        {taches.map((t) => (
          <li key={t.tache.id}>
            <span className={`coche ${t.empechement ? 'coche-attente' : 'coche-prete'}`} />
            <span className="tm-nom">{t.tache.nom}</span>
            <span className="tm-quand">{planificationEnMots(t.tache.planification)}</span>
            <span className={`tm-etat ${t.empechement ? 'ton-alerte' : 'ton-ok'}`}>{t.empechement ? 'attend' : 'prête'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Courrier({ agent, aller }: { agent: AgentInstalle; aller: (c: Cible) => void }) {
  const [envois, setEnvois] = useState<Envoi[] | null>(null)
  const [motif, setMotif] = useState<string | null>(null)
  useEffect(() => {
    invoke<Envoi[]>('courriel_envois').then(setEnvois).catch((e) => setMotif(String(e)))
  }, [])
  const prend = agent.fiche.connecteurs.includes('email')
  return (
    <div>
      <div className="onglet-entete">
        <h4>Courrier</h4>
        <button className="lien-dc" onClick={() => aller({ onglet: 'courriel' })}>
          Ouvrir le courrier ›
        </button>
      </div>
      {!prend && <p className="precision">Sa fiche ne déclare pas le courriel : {agent.prenom} n’écrit pas de messages.</p>}
      <p className="precision">
        Le journal des envois ne dit pas encore quel agent a préparé chaque message : voici tous les envois de ce poste, chacun relu et
        validé par vous avant de partir.
      </p>
      {motif && <p className="lecture-refus">{motif}</p>}
      {envois && envois.length === 0 && <p className="vide">Aucun message envoyé depuis ce poste.</p>}
      {envois && envois.length > 0 && (
        <ul className="liste-courrier">
          {[...envois]
            .sort((a, b) => b.date - a.date)
            .slice(0, 8)
            .map((e) => (
              <li key={`${e.date}-${e.objet}`}>
                <strong>{e.destinataires.join(', ')}</strong>
                <span>{e.objet}</span>
                <span className="precision">{new Date(e.date * 1000).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function Navigateur({ agent, aller }: { agent: AgentInstalle; aller: (c: Cible) => void }) {
  const [sites, setSites] = useState<Site[] | null>(null)
  const [motif, setMotif] = useState<string | null>(null)
  useEffect(() => {
    invoke<Site[]>('navigateur_sites').then(setSites).catch((e) => setMotif(String(e)))
  }, [])
  return (
    <div>
      <div className="onglet-entete">
        <h4>Navigateur</h4>
        <button className="lien-dc" onClick={() => aller({ onglet: 'navigateur' })}>
          Gérer les comptes ›
        </button>
      </div>
      <p className="precision">
        {agent.prenom} travaille dans les sessions que vous avez ouvertes vous-même. Aucun mot de passe ni jeton n’apparaît ici, seulement le
        site et le jour où vous l’avez connecté.
      </p>
      {motif && <p className="lecture-refus">{motif}</p>}
      {sites && sites.length === 0 && <p className="vide">Aucun compte connecté dans le navigateur des agents.</p>}
      {sites && sites.length > 0 && (
        <ul className="liste-sessions">
          {sites.map((s) => (
            <li key={s.hote}>
              <strong>{s.nom}</strong>
              <span className="precision">{s.hote}</span>
              <span className="pastille-session">connecté le {new Date(s.declare_le * 1000).toLocaleDateString('fr-FR')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Rapports({ agent, aller }: { agent: AgentInstalle; aller: (c: Cible) => void }) {
  const rapports = agent.planning.filter((t) => t.active && /rapport|compte rendu|synth|bilan/i.test(t.nom))
  return (
    <div>
      <h4>Rapports</h4>
      <p className="vide">
        Aucun rapport n’a encore été produit depuis l’ouverture. {agent.prenom} écrit ses résultats dans son dossier ; ils apparaîtront ici à
        mesure qu’il travaille.
      </p>
      {rapports.length > 0 && (
        <>
          <p className="precision">Les tâches de sa fiche qui produisent un rapport :</p>
          <ul className="liste-simple">
            {rapports.map((t) => (
              <li key={t.id}>
                <strong>{t.nom}</strong> · {planificationEnMots(t.planification)}
              </li>
            ))}
          </ul>
          <button className="bouton-contour" onClick={() => aller({ onglet: 'travail', agent: agent.prenom })}>
            Les lancer depuis le travail du jour
          </button>
        </>
      )}
    </div>
  )
}

function Connexions({ agent, aller }: { agent: AgentInstalle; aller: (c: Cible) => void }) {
  const logiciels = [...new Set(agent.planning.filter((t) => t.active).flatMap((t) => t.logiciels))]
  return (
    <div>
      <div className="onglet-entete">
        <h4>Connexions</h4>
        <button className="lien-dc" onClick={() => aller({ onglet: 'connectors' })}>
          Ouvrir vos connexions ›
        </button>
      </div>
      <div className="grille-connexions">
        {agent.fiche.connecteurs.map((c) => (
          <div key={c} className="connexion-carte">
            <strong>{CONNECTEURS[c]?.libelle ?? c}</strong>
            <span className="precision">{CONNECTEURS[c]?.ou}</span>
          </div>
        ))}
      </div>
      {logiciels.length > 0 && (
        <>
          <h4>Logiciels qu’ouvrent ses tâches</h4>
          <div className="etiquettes">
            {logiciels.map((l) => (
              <span key={l} className="etiquette-dc">
                {l.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
