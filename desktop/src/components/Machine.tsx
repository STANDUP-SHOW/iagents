import type { Jauge } from '../agents/jauge'

/**
 * Votre machine : la jauge telle que Rust la calcule (`jauge_etat`), en
 * chiffres. Rien n'est recalculé ici ; la page ne fait que montrer ce que la
 * bannière résume en une phrase.
 */

const NIVEAUX: Record<string, string> = {
  confortable: 'Confortable',
  chargee: 'Chargée',
  saturee: 'Saturée',
  impossible: 'Mémoire insuffisante',
  'memoire-seule': 'Charge non jugée',
}

const go = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`

/** Un cadran circulaire : la part utilisée, bornée à 100 % pour le dessin. */
function Cadran({ part, libelle, valeur, ton }: { part: number | null; libelle: string; valeur: string; ton: string }) {
  const r = 52
  const tour = 2 * Math.PI * r
  const rempli = part == null ? 0 : Math.min(Math.max(part, 0), 1) * tour
  return (
    <figure className={`cadran ton-${ton}`}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="cadran-fond" cx="70" cy="70" r={r} />
        <circle
          className="cadran-plein"
          cx="70"
          cy="70"
          r={r}
          strokeDasharray={`${rempli} ${tour}`}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="cadran-texte">
        <span className="cadran-valeur">{valeur}</span>
        <span className="cadran-libelle">{libelle}</span>
      </div>
    </figure>
  )
}

export default function Machine({ jauge }: { jauge: Jauge | null }) {
  if (!jauge) {
    return (
      <div className="page machine">
        <h2 className="titre-neon">Votre machine</h2>
        <p className="vide">
          La jauge n'a pas pu être lue : aucun agent installé, ou l'application n'a pas encore identifié ce
          poste.
        </p>
      </div>
    )
  }

  const { machine } = jauge
  const partMemoire = machine.memoireModeles > 0 ? jauge.memoireModeles / machine.memoireModeles : null
  const ton =
    jauge.niveau === 'impossible' || jauge.niveau === 'saturee'
      ? 'danger'
      : jauge.niveau === 'confortable'
        ? 'succes'
        : 'alerte'

  return (
    <div className="page machine">
      <h2 className="titre-neon">Votre machine</h2>
      <p className="subtitle">
        {machine.nom} · {NIVEAUX[jauge.niveau] ?? jauge.niveau}
      </p>

      <div className="cadrans">
        <Cadran
          part={partMemoire}
          valeur={partMemoire == null ? '—' : `${Math.round(partMemoire * 100)} %`}
          libelle="Mémoire des modèles"
          ton={jauge.niveau === 'impossible' ? 'danger' : 'cyan'}
        />
        <Cadran
          part={jauge.charge}
          valeur={jauge.charge == null ? 'Non jugée' : `${Math.round(jauge.charge * 100)} %`}
          libelle="Charge de calcul"
          ton={jauge.charge == null ? 'alerte' : jauge.charge > 1 ? 'danger' : 'cyan'}
        />
      </div>

      <section className={`panneau verdict ton-${ton}`}>
        <h3>Ce qu'il faut savoir</h3>
        <p>{jauge.message}</p>
      </section>

      <section className="panneau">
        <h3>Les chiffres</h3>
        <dl className="chiffres">
          <dt>Mémoire demandée par vos agents</dt>
          <dd>{go(jauge.memoireModeles)}</dd>
          <dt>Mémoire laissée aux modèles</dt>
          <dd>{go(machine.memoireModeles)}</dd>
          <dt>Mémoire vive totale</dt>
          <dd>{go(machine.ram)}</dd>
          <dt>Mémoire unifiée</dt>
          <dd>{machine.memoireUnifiee ? 'oui' : 'non'}</dd>
          <dt>Carte graphique</dt>
          <dd>
            {machine.capaciteGpu == null
              ? 'non identifiée'
              : `${Math.round(machine.capaciteGpu * 100)} % d'une carte de référence`}
          </dd>
          <dt>D'où viennent ces chiffres</dt>
          <dd>{machine.origine}</dd>
        </dl>
      </section>
    </div>
  )
}
