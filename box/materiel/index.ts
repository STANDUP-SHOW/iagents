// Le référentiel des machines que l'usine sait qualifier (brief §7) : un fichier
// JSON par modèle, lus ici une fois. La plateforme l'importe pour recalculer le
// verdict d'un rapport d'usine (tests obligatoires), l'usine (Python) lit les
// mêmes fichiers pour comparer l'inventaire ; aucun des deux ne recopie un seuil.
// JSON plutôt que YAML, exprès : la plateforme tourne aussi chez Cloudflare,
// où rien ne se lit sur disque et où seul un import JSON passe au build.
import station32 from './station-32-v1.json' with { type: 'json' };
import station64 from './station-64-v1.json' with { type: 'json' };
import station64Plus from './station-64-plus-v1.json' with { type: 'json' };
import vmQemu from './vm-qemu.json' with { type: 'json' };

export type ProfilMateriel = {
  id: string;
  nom: string;
  /** Gammes que cette machine peut servir. */
  gammes: ('home' | 'business' | 'enterprise')[];
  cpu: { modele_regex: string; coeurs_min: number };
  /** Tailles de mémoire acceptées, en Go (une machine est vendue en plusieurs configurations). */
  memoire_go: number[];
  disque_go_min: number;
  reseau: { ethernet: number; wifi: boolean; bluetooth: boolean };
  tpm: '2.0';
  uefi: boolean;
  secure_boot: boolean;
  audio: { sortie: boolean; micro: boolean };
  /** Identifiants des tests d'usine (`box/usine/tests/NN_<id>.py`) qui doivent passer pour qualifier la machine. */
  tests_obligatoires: string[];
  source: string;
  releve_le: string;
  /** Vrai tant que la fiche n'a pas été relevée sur une machine réelle. */
  a_confirmer: boolean;
};

export const PROFILS_MATERIEL: readonly ProfilMateriel[] = [station32, station64, station64Plus, vmQemu] as ProfilMateriel[];

export function profilMateriel(id: string): ProfilMateriel | null {
  return PROFILS_MATERIEL.find((p) => p.id === id) ?? null;
}
