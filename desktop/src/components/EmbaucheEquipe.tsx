import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Referentiels } from '../agents/composition'
import {
  PERSONNE_POUR_CA,
  choisirPour,
  competencesDuMembre,
  prenomsPourEquipe,
  relierEquipe,
  resumeEquipe,
  type FicheDeMembre,
  type LectureEquipe,
  type MembreEmbauche,
} from '../agents/equipe'
import { ficheComposee, type FicheMere } from '../agents/fiche-composee'
import { FICHE_TEAM_HOLDER } from '../agents/team-holder'
import { AGENTS_MAX_PAR_POSTE } from '../agents/fiche'

/**
 * L'équipe proposée pour une demande, et son embauche en une fois.
 *
 * Max, 04/10/2026 : « l'application devrait être capable de me générer un pack d'agents ». Le
 * client voit qui le moteur propose et pourquoi (ses propres mots, cités), retire qui il veut,
 * change les prénoms, tranche les postes qui se valent ; puis tous sont embauchés ensemble, avec
 * les réglages que leur fiche propose. L'entretien de chacun reste à faire agent par agent ;
 * ici, on évite au client de refaire sept fois le même parcours pour monter une équipe.
 */
export default function EmbaucheEquipe({
  lecture: lectureInitiale,
  refs,
  surUnSeul,
}: {
  lecture: LectureEquipe
  refs: Referentiels
  /** Le client voulait un seul agent : on repart sur le parcours d'un seul poste. */
  surUnSeul: () => void
}) {
  const [lecture, setLecture] = useState(lectureInitiale)
  const [retenus, setRetenus] = useState<Record<string, boolean>>({})
  const [prenoms, setPrenoms] = useState<Record<string, string>>({})
  const [dejaInstalles, setDejaInstalles] = useState<{ prenom: string; ficheId: string }[]>([])
  const [activiteId, setActiviteId] = useState(lectureInitiale.activite?.id ?? '')
  const [erreur, setErreur] = useState('')
  const [fait, setFait] = useState<string[]>([])
  const [enCours, setEnCours] = useState(false)

  useEffect(() => setLecture(lectureInitiale), [lectureInitiale])

  useEffect(() => {
    invoke<string>('lire_installation')
      .then((brut) => {
        const agents = (JSON.parse(brut).agents ?? []) as { prenom: string; ficheId: string }[]
        setDejaInstalles(agents)
      })
      .catch(() => setDejaInstalles([]))
  }, [])

  // Un Team Holder déjà embauché tient aussi cette équipe : on n'en embauche pas un second.
  const chefEnPlace = dejaInstalles.find((a) => a.ficheId === FICHE_TEAM_HOLDER)

  useEffect(() => {
    const proposes = prenomsPourEquipe(lecture.membres.length, dejaInstalles.map((a) => a.prenom))
    setPrenoms((p) => {
      const suite = { ...p }
      lecture.membres.forEach((m, i) => (suite[m.posteId] ??= proposes[i]))
      return suite
    })
    setRetenus((r) => {
      const suite = { ...r }
      for (const m of lecture.membres) suite[m.posteId] ??= true
      return suite
    })
  }, [lecture, dejaInstalles, chefEnPlace])

  const estChefDeja = (posteId: string) => Boolean(chefEnPlace) && posteId === FICHE_TEAM_HOLDER
  const choisis = useMemo(
    () => lecture.membres.filter((m) => retenus[m.posteId] && !estChefDeja(m.posteId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lecture, retenus, chefEnPlace]
  )
  const activite = refs.activites.activites.find((a) => a.id === activiteId) ?? null

  const prenomsValides = choisis.every((m) => {
    const p = (prenoms[m.posteId] ?? '').trim()
    return p.length > 0 && /^[\p{L}\p{N} -]+$/u.test(p)
  })
  const prenomsUniques =
    new Set([...choisis.map((m) => (prenoms[m.posteId] ?? '').trim().toLowerCase()), ...dejaInstalles.map((a) => a.prenom.toLowerCase())])
      .size === choisis.length + dejaInstalles.length

  // Au-delà de dix agents, l'application refuse l'installation entière au démarrage (constaté le
  // 06/10 sur le PC de max : trois agents déjà là, huit de plus, plus aucun ne se chargeait).
  const places = AGENTS_MAX_PAR_POSTE - dejaInstalles.length
  const tropNombreux = choisis.length > places

  const embaucher = async () => {
    setErreur('')
    setEnCours(true)
    try {
      const existant = JSON.parse(await invoke<string>('lire_installation').catch(() => '{}'))
      const agents = Array.isArray(existant.agents) ? existant.agents : []

      // Chaque membre devient sa propre fiche sur ce poste quand l'activité de la maison est
      // connue, comme une embauche seule. Le Team Holder vit au socle et garde la sienne.
      const membres: (MembreEmbauche & { ficheId: string })[] = []
      for (const m of choisis) {
        const fiche = JSON.parse(await invoke<string>('lire_fiche', { id: m.posteId })) as FicheDeMembre
        let ficheId = m.posteId
        if (m.posteId !== FICHE_TEAM_HOLDER && activite) {
          const fille = ficheComposee(fiche as unknown as FicheMere, { activite, logiciels: [] })
          if (fille) ficheId = await invoke<string>('enregistrer_fiche_composee', { contenu: JSON.stringify(fille) })
        }
        membres.push({ prenom: prenoms[m.posteId].trim(), posteId: m.posteId, fiche, ficheId })
      }

      const ecrire = (equipe: typeof membres, dossiers: Record<string, Record<string, string>>, passages: ReturnType<typeof relierEquipe>['passages']) =>
        invoke<string>('installation_ecrire', {
          contenu: JSON.stringify(
            {
              ...existant,
              agents: [
                ...agents,
                ...equipe.map((m) => ({
                  prenom: m.prenom,
                  ficheId: m.ficheId,
                  voix: '',
                  competences: competencesDuMembre(m, equipe, lecture, passages),
                  ...(dossiers[m.prenom] ? { dossiers: dossiers[m.prenom] } : {}),
                })),
              ],
            },
            null,
            2
          ),
        })

      // Première écriture : les agents existent, chacun a son dossier de travail.
      await ecrire(membres, {}, [])
      // Puis on relie : ce qu'un membre lit, il le lit là où un autre le dépose.
      for (const m of membres) {
        m.racine = await invoke<string>('dossier_de_travail', { prenom: m.prenom, ficheId: m.ficheId })
      }
      const { dossiers, passages } = relierEquipe(membres)
      const chemin = await ecrire(membres, dossiers, passages)

      setFait([
        `${membres.length} agents embauchés : ${membres.map((m) => `${m.prenom} (${m.fiche.nom})`).join(', ')}.`,
        ...passages.map((p) => `${p.vers} lit « ${p.dossier} » là où ${p.de} le dépose.`),
        `Configuration écrite dans ${chemin}. L'entretien de chacun se fait ensuite depuis sa fiche, à votre rythme.`,
      ])
    } catch (e) {
      setErreur(String(e))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="relecture equipe-proposee">
      {resumeEquipe(lecture).map((ligne, i) => (
        <p key={i} className="dit">
          {ligne}
        </p>
      ))}

      {lecture.aChoisir.map((q) => (
        <div key={q.besoin} className="question">
          <p className="dit">Pour « {q.besoin} », plusieurs postes se valent. Lequel ?</p>
          {q.candidats.map((c) => (
            <div key={c.poste.id} className="ligne">
              <button onClick={() => setLecture(choisirPour(lecture, q.besoin, c.poste.id, refs))}>{c.poste.nom}</button>
              <span className="precision">
                {c.poste.secteur.replace(/-/g, ' ')} : {c.poste.accroche}
              </span>
            </div>
          ))}
          <button className="lien" onClick={() => setLecture(choisirPour(lecture, q.besoin, PERSONNE_POUR_CA, refs))}>
            Personne pour ça
          </button>
        </div>
      ))}

      <ul className="membres">
        {lecture.membres.map((m) => {
          const chefDeja = estChefDeja(m.posteId)
          const retenu = Boolean(retenus[m.posteId]) && !chefDeja
          return (
            <li key={m.posteId} className={retenu ? '' : 'retire'}>
              <label className="ligne">
                <input
                  type="checkbox"
                  checked={retenu}
                  disabled={chefDeja}
                  onChange={(e) => setRetenus({ ...retenus, [m.posteId]: e.target.checked })}
                />
                <strong>{m.role}</strong>
                <span>
                  {m.posteNom} <span className="precision">({m.posteId})</span>
                </span>
              </label>
              {chefDeja ? (
                <p className="precision">{chefEnPlace!.prenom} tient déjà votre équipe : il tiendra aussi celle-ci.</p>
              ) : (
                <input
                  type="text"
                  placeholder="son prénom"
                  value={prenoms[m.posteId] ?? ''}
                  disabled={!retenu}
                  onChange={(e) => setPrenoms({ ...prenoms, [m.posteId]: e.target.value })}
                />
              )}
              <p className="precision">
                {m.entendu.length
                  ? `Vous avez dit : « ${m.entendu.join(' », « ')} ».`
                  : 'Vous ne l’avez pas nommé : l’équipe en a besoin.'}{' '}
                {m.pourquoi}
              </p>
            </li>
          )
        })}
      </ul>

      {lecture.activitesPossibles.length > 0 && (
        <div className="ligne">
          <span>Votre activité :</span>
          <select value={activiteId} onChange={(e) => setActiviteId(e.target.value)}>
            <option value="">aucune en particulier</option>
            {lecture.activitesPossibles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="precision">
        Rien n'est encore branché : chaque agent dira ce qu'il faut lui ouvrir, et vous l'ouvrirez
        vous-même.
      </p>
      {erreur && <div className="error-banner">{erreur}</div>}
      {fait.length > 0 ? (
        <div className="succes-banner">
          {fait.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      ) : (
        <div className="ligne">
          <button
            disabled={enCours || tropNombreux || choisis.length === 0 || lecture.aChoisir.length > 0 || !prenomsValides || !prenomsUniques}
            onClick={embaucher}
          >
            {enCours ? 'Embauche en cours…' : `Embaucher l'équipe (${choisis.length})`}
          </button>
          <button className="lien" onClick={surUnSeul}>
            Non, je cherche un seul agent
          </button>
        </div>
      )}
      {tropNombreux && (
        <p className="precision">
          Ce poste accepte {AGENTS_MAX_PAR_POSTE} agents. {dejaInstalles.length} y travaillent déjà (
          {dejaInstalles.map((a) => a.prenom).join(', ')}) : il reste {Math.max(0, places)} place(s). Décochez{' '}
          {choisis.length - Math.max(0, places)} agent(s) pour embaucher les autres.
        </p>
      )}
      {!prenomsUniques && <p className="precision">Deux agents ne peuvent pas porter le même prénom.</p>}
      {lecture.aChoisir.length > 0 && <p className="precision">Tranchez d'abord les postes ci-dessus.</p>}
    </div>
  )
}
