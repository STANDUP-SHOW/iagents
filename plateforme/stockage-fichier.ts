// Le support du stockage sous Node : un fichier JSON réécrit en entier à chaque
// changement, en `.partiel` puis renommé, pour qu'un arrêt brutal ne laisse
// jamais un fichier à moitié écrit.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Stockage, type Donnees } from './stockage.ts';

export function stockageSurFichier(fichier: string | null): Stockage {
  if (!fichier) return new Stockage(null);
  const initial: Donnees = existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : {};
  const ecrire = () => {
    mkdirSync(dirname(fichier), { recursive: true });
    const partiel = `${fichier}.partiel`;
    writeFileSync(partiel, JSON.stringify(initial));
    renameSync(partiel, fichier);
  };
  // `initial` is the very object the Stockage mutates: writing it writes the current state.
  return new Stockage({ initial, changer: ecrire });
}
