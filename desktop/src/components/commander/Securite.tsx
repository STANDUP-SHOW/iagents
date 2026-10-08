import type { AgentInstalle } from '../../agents/fiche'
import type { Changement } from '../../agents/team-holder'
import { dateFr, useCommande, useEtatPlateforme } from '../../agents/plateforme'
import { Lu, Rubrique, SansSource, type Ouvrir } from './Commun'

/**
 * Sécurité (Security, §14, §18): permissions, secrets, sessions, device, audit.
 *
 * Secrets are NEVER shown: every command read here answers « posé ou non »
 * (a boolean), none returns a value. The device is described by its public
 * identity only.
 */

type Site = { nom: string; hote: string; declare_le: number }

function Present({ lecture, nom }: { lecture: { donnee: boolean | null; erreur: string | null }; nom: string }) {
  const v = lecture.donnee
  return (
    <li className="ligne-commander">
      <span>{nom}</span>
      <span className={`pastille${v ? ' ton-succes' : ''}`}>
        {lecture.erreur ? 'illisible' : v == null ? '…' : v ? 'posé' : 'absent'}
      </span>
    </li>
  )
}

export default function Securite({ installes, onOuvrir }: { installes: readonly AgentInstalle[]; onOuvrir: Ouvrir }) {
  const etat = useEtatPlateforme()
  const cle = useCommande<boolean>('cle_api_presente')
  const whatsapp = useCommande<boolean>('whatsapp_branche')
  const telegram = useCommande<boolean>('telegram_branche')
  const admin = useCommande<boolean>('admin_present')
  const sites = useCommande<Site[]>('navigateur_sites')
  const changements = useCommande<Changement[]>('equipe_changements')
  const e = etat.donnee

  return (
    <div className="page commander">
      <h2 className="titre-neon">Sécurité</h2>
      <p className="subtitle">Permissions, secrets, sessions, appareil, audit.</p>

      <Rubrique titre="Permissions des agents">
        {installes.length === 0 ? (
          <p className="vide">Aucun agent embauché.</p>
        ) : (
          <ul className="lignes-commander">
            {installes.map((a) => (
              <li key={a.prenom} className="ligne-commander">
                <div>
                  <strong>{a.prenom}</strong> · {a.fiche.nom}
                  <p className="precision">
                    Canaux déclarés par la fiche : {a.fiche.connecteurs.length ? a.fiche.connecteurs.join(', ') : 'aucun'}.
                    Un outil extérieur ne s'ouvre que par la liste blanche dérivée de cette fiche.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Rubrique>

      <Rubrique
        titre="Secrets (jamais affichés)"
        action={
          <button className="commander-action" onClick={() => onOuvrir('connectors')}>
            Vos connexions
          </button>
        }
      >
        <ul className="lignes-commander">
          <Present lecture={cle} nom="Clé d'API du modèle" />
          <Present lecture={whatsapp} nom="WhatsApp" />
          <Present lecture={telegram} nom="Telegram" />
          <Present lecture={admin} nom="Clé d'administration iAgent" />
          <li className="ligne-commander">
            <span>Identité de la Box (clé privée)</span>
            <span className={`pastille${e?.cle_publique_box ? ' ton-succes' : ''}`}>
              {e ? (e.cle_publique_box ? 'au trousseau' : 'pas encore créée') : '…'}
            </span>
          </li>
        </ul>
        <p className="precision">Tous vivent au coffre du système. Cet écran sait seulement s'ils sont posés.</p>
      </Rubrique>

      <Rubrique
        titre="Sessions"
        action={
          <button className="commander-action" onClick={() => onOuvrir('navigateur')}>
            Vos comptes
          </button>
        }
      >
        <Lu lecture={sites}>
          {(l) =>
            l.length === 0 ? (
              <p className="vide">Aucun compte connecté dans le navigateur intégré.</p>
            ) : (
              <ul className="lignes-commander">
                {l.map((s) => (
                  <li key={s.hote} className="ligne-commander">
                    <span>
                      <strong>{s.nom}</strong> <span className="precision">{s.hote}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </Lu>
      </Rubrique>

      <Rubrique titre="Appareil">
        {!e ? (
          <p className="vide">Lecture…</p>
        ) : (
          <dl className="donnees">
            <div className="donnees-ligne">
              <dt>Liaison</dt>
              <dd>{e.relie ? `reliée à ${e.adresse}` : 'poste non relié'}</dd>
            </div>
            <div className="donnees-ligne">
              <dt>Identifiant de Box</dt>
              <dd>{e.device_id ?? '—'}</dd>
            </div>
            <div className="donnees-ligne">
              <dt>Clé de la plateforme</dt>
              <dd>{e.cle_plateforme_posee ? 'épinglée' : 'non posée'}</dd>
            </div>
            <div className="donnees-ligne">
              <dt>Licence</dt>
              <dd>{e.licence.motif}</dd>
            </div>
          </dl>
        )}
      </Rubrique>

      <Rubrique
        titre="Audit"
        action={
          <button className="commander-action" onClick={() => onOuvrir('equipe')}>
            L'équipe
          </button>
        }
      >
        <Lu lecture={changements}>
          {(l) =>
            l.length === 0 ? (
              <p className="vide">Aucun réglage changé par le Team Holder.</p>
            ) : (
              <ul className="lignes-commander">
                {l.slice(-20).reverse().map((c) => (
                  <li key={c.id} className="ligne-commander">
                    <div>
                      <strong>{c.par}</strong> · {c.reglage} de « {c.tache_nom} » ({c.agent})
                      <span className="precision"> · {dateFr(c.date)}</span>
                    </div>
                    {c.annule_le && <span className="pastille">annulé</span>}
                  </li>
                ))}
              </ul>
            )
          }
        </Lu>
        <SansSource>
          Le journal d'audit de la plateforme est réservé au back-office (route d'administration) : la Box ne le lit
          pas.
        </SansSource>
      </Rubrique>
    </div>
  )
}
