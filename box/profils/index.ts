// Les trois profils d'iAgent OS (brief §3, gamme Pro ajoutée par max le 14/10/2026) : un par gamme de plateforme/modele.ts,
// ni plus ni moins. Le profil dit ce qui s'allume sur la Box ; il ne recopie
// aucun seuil matériel (ça, c'est box/materiel/) et aucune version (ça, c'est
// le manifeste de l'installeur).
import business from './business.json' with { type: 'json' };
import home from './home.json' with { type: 'json' };
import pro from './pro.json' with { type: 'json' };

export type ProfilOs = {
  /** La gamme de la Box : `home`, `pro` ou `business`, exactement `Box['gamme']`. */
  id: 'home' | 'pro' | 'business';
  libelle: string;
  description: string;
  /** Profils matériel (`box/materiel/<id>.json`) que ce profil accepte. */
  materiel: string[];
  agents_max: number;
  espaces_navigateur: number;
  pont_applications: 'active' | 'optionnel' | 'inactif';
  voix: { demarrage_auto: boolean; test_micro_hp_aec: boolean };
  /** Unités systemd `iagent-*` activées au premier démarrage ; chacune doit être « reelle » dans box/os/systemd/SERVICES.json. */
  services_actifs: string[];
  kiosque: { application: string; edition: 'box' };
  source: string;
  releve_le: string;
};

export const PROFILS_OS: readonly ProfilOs[] = [business, home, pro] as ProfilOs[];

export function profilOs(id: string): ProfilOs | null {
  return PROFILS_OS.find((p) => p.id === id) ?? null;
}
