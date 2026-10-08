import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { dateFr, enListe, useCommande, type EtatPlateforme, type Sante } from '../../agents/plateforme'
import { Donnees, Lu, Rubrique, SansSource } from './Commun'

/**
 * Box (§4, §6, §14): health of the machine, licences, updates, support — and
 * the link to the platform itself, since this is where a Box gets provisioned.
 *
 * The identity shown is the PUBLIC key only. The private key never leaves the
 * system keyring (plateforme.rs); no command returns it.
 */

const part = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)} %`)

export default function BoxPage() {
  const [etat, setEtat] = useState<EtatPlateforme | null>(null)
  const lu = useCommande<EtatPlateforme>('plateforme_etat')
  const courant = etat ?? lu.donnee
  const relie = courant?.relie ?? false
  const sante = useCommande<Sante>('plateforme_sante', true, undefined, 15000)
  const majs = useCommande<unknown>('plateforme_mises_a_jour', relie)

  const [adresse, setAdresse] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [clePlateforme, setClePlateforme] = useState('')
  const [dit, setDit] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const agir = async (quoi: () => Promise<void>) => {
    setOccupe(true)
    setDit(null)
    try {
      await quoi()
    } catch (e) {
      setDit(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const creerIdentite = () =>
    agir(async () => {
      await invoke<string>('plateforme_identite')
      setEtat(await invoke<EtatPlateforme>('plateforme_etat'))
      setDit('Identité prête : la clé publique ci-dessous se recopie dans le formulaire de provisioning.')
    })

  const relier = () =>
    agir(async () => {
      setEtat(
        await invoke<EtatPlateforme>('plateforme_regler', {
          adresse: adresse.trim() || null,
          deviceId: deviceId.trim() || null,
          clePlateforme: clePlateforme.trim() || null,
        })
      )
      setDit('Réglages enregistrés.')
    })

  const relireDroits = () => agir(async () => setEtat(await invoke<EtatPlateforme>('plateforme_droits')))

  const envoyerTelemetrie = () =>
    agir(async () => {
      await invoke('plateforme_telemetrie_envoyer')
      setDit('Santé transmise à la plateforme.')
    })

  const l = courant?.licence

  return (
    <div className="page commander">
      <h2 className="titre-neon">Box</h2>
      <p className="subtitle">
        {relie ? `Reliée à ${courant?.adresse ?? '—'} · ${courant?.device_id ?? 'sans identifiant'}` : 'Poste non relié'}
      </p>
      {dit && <p className="precision commander-dit">{dit}</p>}

      <Rubrique
        titre="Santé de la machine"
        action={
          relie ? (
            <button className="commander-action" onClick={envoyerTelemetrie} disabled={occupe}>
              Envoyer à la plateforme
            </button>
          ) : undefined
        }
      >
        <Lu lecture={sante}>
          {(s) => (
            <div className="bandeau-chiffres">
              <div className="chiffre">
                <span className="chiffre-valeur">{part(s.cpu)}</span>
                <span className="chiffre-libelle">charge du processeur</span>
              </div>
              <div className="chiffre">
                <span className="chiffre-valeur">{part(s.memoire)}</span>
                <span className="chiffre-libelle">mémoire utilisée</span>
              </div>
              <div className="chiffre">
                <span className="chiffre-valeur">
                  {s.temperature == null ? '—' : `${s.temperature.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} °C`}
                </span>
                <span className="chiffre-libelle">température</span>
              </div>
              <div className="chiffre">
                <span className="chiffre-valeur">{part(s.disque)}</span>
                <span className="chiffre-libelle">disque (non mesuré)</span>
              </div>
              <div className="chiffre">
                <span className="chiffre-valeur">{s.version_desktop}</span>
                <span className="chiffre-libelle">version de l'application</span>
              </div>
            </div>
          )}
        </Lu>
        <p className="precision">Un tiret : ce système ne donne rien à lire pour cette mesure, et rien n'est supposé.</p>
      </Rubrique>

      <Rubrique
        titre="Licences"
        action={
          relie ? (
            <button className="commander-action" onClick={relireDroits} disabled={occupe}>
              Relire les droits
            </button>
          ) : undefined
        }
      >
        {!l ? (
          <p className="vide">Lecture…</p>
        ) : (
          <>
            <p className={l.valide ? 'succes-banner' : relie ? 'error-banner' : 'avertissement-banner'}>{l.motif}</p>
            {l.droits.length > 0 && (
              <ul className="lignes-commander">
                {l.droits.map((d) => (
                  <li key={d.id} className="ligne-commander">
                    <div>
                      <strong>{d.agent_template_id}</strong>
                      <span className="precision"> · licence {d.licence}</span>
                    </div>
                    <span className="pastille">{d.fin ? `jusqu'au ${dateFr(d.fin)}` : 'sans date de fin'}</span>
                  </li>
                ))}
              </ul>
            )}
            {l.recu_le && <p className="precision">Dernier jeton reçu le {dateFr(l.recu_le)}.</p>}
          </>
        )}
      </Rubrique>

      <Rubrique titre="Mises à jour">
        {!relie ? (
          <SansSource>Poste non relié : les versions visées par la plateforme ne peuvent pas être lues.</SansSource>
        ) : (
          <Lu lecture={majs}>
            {(d) => {
              const liste = enListe(d, ['mises_a_jour', 'versions'])
              return liste && liste.length === 0 ? (
                <p className="vide">Aucune version visée pour cette Box.</p>
              ) : (
                <Donnees valeur={liste ?? d} />
              )
            }}
          </Lu>
        )}
      </Rubrique>

      <Rubrique titre="Support">
        <SansSource>
          Le contrat de la plateforme ne porte encore aucune route de support à distance pour la Box : rien ne
          s'ouvre d'ici.
        </SansSource>
      </Rubrique>

      <Rubrique titre="Relier cette Box à la plateforme">
        <div className="identite">
          <p>
            <strong>Identité de la Box</strong> — clé publique Ed25519, à recopier au provisioning. La clé privée reste
            au trousseau du système et ne s'affiche jamais.
          </p>
          {courant?.cle_publique_box && courant.cle_chiffrement_publique ? (
            <>
              <pre className="cle-publique">{courant.cle_publique_box}</pre>
              <p>
                <strong>Clé de chiffrement</strong> (X25519, champ « cle_chiffrement_publique ») — la plateforme s'en sert
                pour chiffrer les Skill Packs pour cette Box seule.
              </p>
              <pre className="cle-publique">{courant.cle_chiffrement_publique}</pre>
            </>
          ) : (
            <button className="commander-action principal" onClick={creerIdentite} disabled={occupe}>
              {courant?.cle_publique_box ? 'Créer la clé de chiffrement de la Box' : "Créer l'identité de la Box"}
            </button>
          )}
        </div>
        <div className="formulaire">
          <label>
            Adresse de la plateforme
            <input
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder={courant?.adresse ?? 'https://…'}
            />
          </label>
          <label>
            Identifiant de Box (donné au provisioning)
            <input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder={courant?.device_id ?? 'BOX-…'}
              disabled={!!courant?.device_id}
            />
          </label>
          <label>
            Clé publique de la plateforme (facultatif)
            <textarea
              value={clePlateforme}
              onChange={(e) => setClePlateforme(e.target.value)}
              placeholder={
                courant?.cle_plateforme_posee
                  ? 'Déjà posée : elle ne se remplace pas depuis cet écran.'
                  : 'Vide : elle sera lue une fois sur la plateforme, puis gardée.'
              }
              disabled={!!courant?.cle_plateforme_posee}
              rows={3}
            />
          </label>
          <button className="commander-action principal" onClick={relier} disabled={occupe || (!adresse.trim() && !deviceId.trim() && !clePlateforme.trim())}>
            Enregistrer
          </button>
        </div>
        {courant && courant.manque.length > 0 && <p className="precision">Il manque encore : {courant.manque.join(', ')}.</p>}
      </Rubrique>
    </div>
  )
}
