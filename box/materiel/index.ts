// Le référentiel des machines que l'usine sait qualifier (brief §7) : un fichier
// JSON par modèle, lus ici une fois. La plateforme l'importe pour recalculer le
// verdict d'un rapport d'usine (tests obligatoires), l'usine (Python) lit les
// mêmes fichiers pour comparer l'inventaire ; aucun des deux ne recopie un seuil.
// JSON plutôt que YAML, exprès : la plateforme tourne aussi chez Cloudflare,
// où rien ne se lit sur disque et où seul un import JSON passe au build.
import bosgameM4Neo from './bosgame-m4-neo-v1.json' with { type: 'json' };
import bosgameM4NeoPro from './bosgame-m4-neo-pro-v1.json' with { type: 'json' };
import exr1HomeV1 from './exr1-home-v1.json' with { type: 'json' };
import vmQemu from './vm-qemu.json' with { type: 'json' };

export type ProfilMateriel = {
  id: string;
  nom: string;
  /** Gammes que cette machine peut servir. */
  gammes: ('home' | 'pro' | 'business')[];
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

export const PROFILS_MATERIEL: readonly ProfilMateriel[] = [bosgameM4Neo, bosgameM4NeoPro, exr1HomeV1, vmQemu] as ProfilMateriel[];

export function profilMateriel(id: string): ProfilMateriel | null {
  return PROFILS_MATERIEL.find((p) => p.id === id) ?? null;
}
