// Les trois profils logiciels d'une iAgent Station (max, 17/10/2026) : un par
// valeur de `gamme` dans plateforme/modele.ts, ni plus ni moins. Même image
// d'usine pour tous ; le profil se pose au provisioning et dit combien d'agents
// tournent et comment démarre la voix. Les services actifs et le kiosque, communs
// à toutes les Stations, sont dans box/os/systemd/SERVICES.json.
import business from './business.json' with { type: 'json' };
import home from './home.json' with { type: 'json' };
import enterprise from './enterprise.json' with { type: 'json' };

export type ProfilOs = {
  /** Le profil de la Station : `home`, `business` ou `enterprise`, les valeurs de `Box['gamme']`. */
  id: 'home' | 'business' | 'enterprise';
  libelle: string;
  description: string;
  /** Profils matériel (`box/materiel/<id>.json`) que ce profil accepte. */
  materiel: string[];
  agents_max: number;
  espaces_navigateur: number;
  pont_applications: 'active' | 'optionnel' | 'inactif';
  voix: { demarrage_auto: boolean; test_micro_hp_aec: boolean };
  source: string;
  releve_le: string;
};

export const PROFILS_OS: readonly ProfilOs[] = [business, enterprise, home] as ProfilOs[];

export function profilOs(id: string): ProfilOs | null {
  return PROFILS_OS.find((p) => p.id === id) ?? null;
}
