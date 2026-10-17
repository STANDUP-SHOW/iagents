import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import moteurs from '../../../plateforme/voix/moteurs.json'
import VoiceTraining from '../components/VoiceTraining'
import type { AgentInstalle } from '../agents/fiche'
import { estTeamHolder } from '../agents/team-holder'
import Avatar from '../shell/Avatar'
import { portraitDe } from '../shell/portraits'
import { EntetePage, Onde, type EtatVoix } from '../shell/Shell'
import { publier } from '../shell/evenements'
import type { Cible } from '../shell/intentions'

/**
 * Votre voix, the Voice Hub (brief §6): the voice in the room, the engines,
 * each agent's voice, the switchboard, outbound calls and support.
 *
 * The engine list is the platform's (plateforme/voix/moteurs.json), behind the
 * provider-agnostic `VoiceProvider` of plateforme/voix/fournisseurs-voix.ts
 * (startSession, sendAudio/receiveAudio, interrupt, setVoice, sendContext,
 * executeTool, closeSession). From this workstation only the local voice
 * (Piper + whisper) runs; Gemini, ElevenLabs and Mistral work from the
 * platform once their keys are posed there, and the telephone is not wired
 * yet: those blocks say so and show no figure.
 */

type Moteur = { libelle: string; qualite: number; temps_reel: boolean; local: boolean; langues: string[]; canaux: string[] }

const DESCRIPTIONS: Record<string, string> = {
  gemini: 'Conversation en temps réel, multilingue',
  elevenlabs: 'Voix très naturelles et expressives',
  mistral: 'Voxtral, éditeur européen',
  local: 'Sur ce poste, sans connexion',
}

export default function VotreVoix({
  voix,
  installes,
  statuts,
  aller,
}: {
  voix: EtatVoix
  installes: readonly AgentInstalle[]
  statuts: Record<string, boolean>
  aller: (c: Cible) => void
}) {
  const [sousVue, setSousVue] = useState<'hub' | 'empreinte'>('hub')
  const [test, setTest] = useState<Record<string, string>>({})
  // Which voice keys are in the system vault, read where they are kept
  // (`voix_api_etat`). The cards used to say « Non branché » for every engine
  // but the local one, whatever was stored: max had stored his Gemini key and
  // still read « Gemini Live : non branché » (12/10/2026).
  const [cles, setCles] = useState<{ gemini: boolean; elevenlabs: boolean; mistral: boolean; parle: string } | null>(null)
  useEffect(() => {
    invoke<{ gemini: boolean; elevenlabs: boolean; mistral: boolean; parle: string }>('voix_api_etat')
      .then(setCles)
      .catch(() => setCles(null))
  }, [])
  const chef = installes.find((a) => estTeamHolder(a)) ?? installes[0] ?? null
  const liste = Object.entries((moteurs as { moteurs: Record<string, Moteur> }).moteurs).sort((a, b) => a[1].qualite - b[1].qualite)

  const tester = async (a: AgentInstalle) => {
    setTest((t) => ({ ...t, [a.prenom]: 'Lecture…' }))
    try {
      await invoke('text_to_speech', { text: `Bonjour, je suis ${a.prenom}. ${a.fiche.nom}, à votre service.` })
      setTest((t) => ({ ...t, [a.prenom]: 'Entendu ?' }))
      publier({ type: 'voix', agent: a.prenom, texte: `Essai de la voix de ${a.prenom}`, gravite: 'info' })
    } catch (e) {
      setTest((t) => ({ ...t, [a.prenom]: String(e) }))
    }
  }

  const etat = voix.motif ? 'indisponible' : voix.reflexion ? 'reflexion' : voix.active ? 'ecoute' : 'repos'

  return (
    <div className="page-dc page-voix">
      <EntetePage
        onglet="voice"
        titre="Votre voix"
        sousTitre="Une nouvelle façon de travailler. Parlez, vos agents exécutent."
        actions={
          <div className="sous-onglets compact" role="tablist">
            <button className={sousVue === 'hub' ? 'actif' : ''} onClick={() => setSousVue('hub')}>
              Voice Hub
            </button>
            <button className={sousVue === 'empreinte' ? 'actif' : ''} onClick={() => setSousVue('empreinte')}>
              Empreinte vocale
            </button>
          </div>
        }
      />

      {sousVue === 'empreinte' ? (
        <div className="carte-verre">
          <VoiceTraining />
        </div>
      ) : (
        <>
          <section className={`scene-voix etat-${etat}`}>
            <div className="scene-terre" aria-hidden="true" />
            <div className="scene-portrait">
              {chef ? <Avatar prenom={chef.prenom} photo={portraitDe(chef)} taille="xl" /> : <span className="scene-vide">iAgent</span>}
            </div>
            <div className="scene-onde">
              <Onde vivante={voix.active && !voix.motif} barres={48} />
            </div>
            <button className="scene-statut" onClick={voix.onBasculer} disabled={!!voix.motif}>
              <span className="point" />
              {voix.motif ? 'Écoute indisponible' : voix.reflexion ? 'Je réfléchis…' : voix.avec ? `En conversation avec ${voix.avec}` : voix.active ? 'Je vous écoute…' : 'Touchez pour m’allumer'}
            </button>
            <blockquote>« Une conversation suffit pour passer de l’idée à l’action. »</blockquote>
          </section>
          {voix.motif && <p className="lecture-refus">{voix.motif}</p>}

          <div className="voix-reglages">
            <div className="reglage-carte">
              <span className="etiquette">Pour appeler un agent</span>
              <strong>Son prénom</strong>
              <span className="precision">Dites son prénom au début de la phrase : « Victor, où en es-tu ? ». Il vous écoute ensuite sans qu’on le rappelle, jusqu’à « merci, c’est tout » ou une minute de silence après sa réponse. Un prénom cité au milieu d’une phrase n’appelle personne.</span>
            </div>
            <div className="reglage-carte">
              <span className="etiquette">Langue d’écoute</span>
              <strong>Français (FR)</strong>
              <span className="precision">Seule langue installée sur ce poste.</span>
            </div>
            <div className="reglage-carte">
              <span className="etiquette">Ce qui comprend vos phrases</span>
              <strong>Google Gemini, sinon ce poste</strong>
              <span className="precision">Avec la clé Google AI Studio rangée dans « Vos connexions », la phrase que vous adressez à un agent est transcrite par Gemini, bien plus fidèle. Seule cette phrase part chez Google, jamais ce qui se dit dans la pièce. Sans clé ou sans réseau, ce poste transcrit seul.</span>
            </div>
            <button className="reglage-carte" onClick={() => setSousVue('empreinte')}>
              <span className="etiquette">Empreinte vocale</span>
              <strong>Reconnaître votre voix</strong>
              <span className="precision">Une indication affichée : elle reconnaît, elle n’autorise rien.</span>
            </button>
          </div>

          <h2 className="titre-section">Fournisseurs voix et IA</h2>
          <div className="grille-fournisseurs">
            {liste.map(([id, m]) => {
              const cleRangee = !m.local && Boolean(cles?.[id as 'gemini' | 'elevenlabs' | 'mistral'])
              const branche = m.local ? !voix.motif : cleRangee
              return (
                <div key={id} className={`fournisseur ${branche ? 'fournisseur-branche' : ''}`}>
                  <div className="fournisseur-tete">
                    <Onde vivante={false} barres={5} />
                    {/* « Gemini Live » is Google's real-time conversation, which this
                        workstation does not use: the key gives the agents their voice. */}
                    <strong>{id === 'gemini' ? 'Google Gemini' : m.libelle}</strong>
                  </div>
                  <span className="precision">{DESCRIPTIONS[id] ?? ''}</span>
                  <span className="precision">
                    {m.temps_reel ? 'temps réel' : 'tour par tour'} · {m.langues.length} langue{m.langues.length > 1 ? 's' : ''}
                  </span>
                  <span className={`statut-ligne ${branche ? 'statut-actif' : 'statut-pause'}`}>
                    <span className="point" />
                    {m.local ? (branche ? 'Disponible sur ce poste' : 'Pièces manquantes') : cleRangee ? 'Clé rangée' : 'Aucune clé'}
                  </span>
                  {!m.local && (
                    <span className="precision">
                      {cleRangee
                        ? `Donne leur voix à vos agents quand ils vous répondent. ${cles?.parle ?? ''} Votre voix à vous est écoutée sur ce poste.`
                        : 'Rangez sa clé dans « Vos connexions » pour que vos agents parlent avec elle.'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="titre-section-ligne">
            <h2 className="titre-section">Vos agents et leurs voix</h2>
            <button className="lien-dc" onClick={() => aller({ onglet: 'agents' })}>
              Gérer les agents ›
            </button>
          </div>
          {installes.length === 0 ? (
            <p className="vide">Aucun agent embauché : chaque agent recevra sa voix à l’embauche.</p>
          ) : (
            <div className="grille-voix-agents">
              {installes.map((a) => (
                <div key={a.prenom} className="voix-agent">
                  <Avatar prenom={a.prenom} photo={portraitDe(a)} taille="l" statut={statuts[a.fiche.id] ? 'actif' : 'pause'} />
                  <div>
                    <strong>{a.prenom}</strong>
                    <span className="precision">{estTeamHolder(a) ? 'Task Commander' : a.fiche.nom}</span>
                    <span className="precision">Français (FR) · voix du poste</span>
                  </div>
                  <button className="bouton-contour petit" onClick={() => tester(a)} disabled={test[a.prenom] === 'Lecture…'}>
                    ▶ Tester la voix
                  </button>
                  {test[a.prenom] && test[a.prenom] !== 'Entendu ?' && test[a.prenom] !== 'Lecture…' && (
                    <span className="lecture-refus petit">{test[a.prenom]}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grille-telephonie">
            <section className="carte-verre">
              <h3 className="carte-titre">Standard téléphonique</h3>
              <div className="mini-kpis">
                <span>
                  <strong>—</strong>appels entrants
                </span>
                <span>
                  <strong>—</strong>en attente
                </span>
                <span>
                  <strong>—</strong>temps moyen
                </span>
              </div>
              <p className="precision">Aucun numéro n’est relié : le téléphone n’est pas encore branché.</p>
              <button className="bouton-contour" onClick={() => aller({ onglet: 'standard' })}>
                Standard et appels
              </button>
            </section>
            <section className="carte-verre">
              <h3 className="carte-titre">Call center sortant</h3>
              <div className="mini-kpis">
                <span>
                  <strong>—</strong>planifiés
                </span>
                <span>
                  <strong>—</strong>émis
                </span>
                <span>
                  <strong>—</strong>rendez-vous
                </span>
              </div>
              <p className="precision">Appels sortants seulement avec le consentement de la personne appelée.</p>
            </section>
            <section className="carte-verre">
              <h3 className="carte-titre">Support / SAV</h3>
              <div className="mini-kpis">
                <span>
                  <strong>—</strong>en cours
                </span>
                <span>
                  <strong>—</strong>en attente
                </span>
                <span>
                  <strong>—</strong>résolus
                </span>
              </div>
              <p className="precision">S’allume avec le téléphone. La prise en main humaine (Prendre, Refuser, Rappeler, Laisser l’agent continuer) est prête dans le standard.</p>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
