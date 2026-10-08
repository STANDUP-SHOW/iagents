import { useCommande, useEtatPlateforme } from '../../agents/plateforme'
import { Donnees, Lu, NonRelie, Rubrique, SansSource, type Ouvrir } from './Commun'

/**
 * Consommation (Consumption, §14): LLM, voice, telephony, video, third-party
 * services. Only what is measured somewhere is shown. Voice and telephony come
 * from `GET /voix/box/consommation`; the rest has no source yet, and says so.
 */

type Conso = {
  mois?: string
  appels?: number
  minutes_entrantes?: number
  minutes_sortantes?: number
  cout?: { telephonie?: number; voix?: number; llm?: number; outils?: number; total?: number; devise?: string }
  appels_sans_cout?: number
  manquants?: string[]
}

const montant = (n: number | undefined, devise?: string) =>
  n == null ? '—' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${devise ?? ''}`.trim()

export default function Consommation({ onOuvrir }: { onOuvrir: Ouvrir }) {
  const etat = useEtatPlateforme()
  const relie = etat.donnee?.relie ?? false
  const conso = useCommande<Conso>('plateforme_consommation', relie)

  return (
    <div className="page commander">
      <h2 className="titre-neon">Consommation</h2>
      <p className="subtitle">Ce que vos agents ont consommé, là où c'est mesuré.</p>

      <Rubrique titre="Voix et téléphonie">
        {!relie ? (
          <NonRelie etat={etat.donnee} onOuvrir={onOuvrir} quoi="La consommation du standard" />
        ) : (
          <Lu lecture={conso}>
            {(c) =>
              c.cout ? (
                <>
                  <p className="precision">Mois {c.mois ?? '—'}</p>
                  <div className="bandeau-chiffres">
                    <div className="chiffre">
                      <span className="chiffre-valeur">{c.appels ?? '—'}</span>
                      <span className="chiffre-libelle">appels</span>
                    </div>
                    <div className="chiffre">
                      <span className="chiffre-valeur">
                        {((c.minutes_entrantes ?? 0) + (c.minutes_sortantes ?? 0)).toLocaleString('fr-FR')}
                      </span>
                      <span className="chiffre-libelle">minutes</span>
                    </div>
                    <div className="chiffre">
                      <span className="chiffre-valeur">{montant(c.cout.telephonie, c.cout.devise)}</span>
                      <span className="chiffre-libelle">téléphonie</span>
                    </div>
                    <div className="chiffre">
                      <span className="chiffre-valeur">{montant(c.cout.voix, c.cout.devise)}</span>
                      <span className="chiffre-libelle">voix</span>
                    </div>
                    <div className="chiffre">
                      <span className="chiffre-valeur">{montant(c.cout.llm, c.cout.devise)}</span>
                      <span className="chiffre-libelle">modèle pendant les appels</span>
                    </div>
                    <div className="chiffre">
                      <span className="chiffre-valeur">{montant(c.cout.total, c.cout.devise)}</span>
                      <span className="chiffre-libelle">total</span>
                    </div>
                  </div>
                  {(c.appels_sans_cout ?? 0) > 0 && (
                    <p className="avertissement-banner">
                      {c.appels_sans_cout} appel(s) sans coût chiffré : le total ci-dessus ne les compte pas.
                      {c.manquants && c.manquants.length > 0 && <> Manque : {c.manquants.join(' ; ')}.</>}
                    </p>
                  )}
                </>
              ) : (
                <Donnees valeur={c} />
              )
            }
          </Lu>
        )}
      </Rubrique>

      <Rubrique titre="Modèles de langage (hors appels)">
        <SansSource>
          Non mesuré : l'application ne consigne pas encore les jetons consommés par les tâches et les conversations.
          Chaque réponse dit seulement par où elle est passée (local ou API).
        </SansSource>
      </Rubrique>

      <Rubrique titre="Vidéo">
        <SansSource>Non mesuré : aucun agent de ce poste ne produit de vidéo, et aucune route ne la compte.</SansSource>
      </Rubrique>

      <Rubrique titre="Services tiers">
        <SansSource>
          Non mesuré : les appels aux outils sont journalisés un à un, mais aucun coût ne leur est associé tant que le
          prix du connecteur n'est pas relevé chez l'éditeur.
        </SansSource>
      </Rubrique>
    </div>
  )
}
