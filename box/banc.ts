// Banc du dossier box/ (iAgent Box Factory Installer) : lance chaque contrôle et
// sort en 1 à la première faute. Chaîné dans `npm run controle` ; seul :
//   npm run controle-box
// Aucun de ces contrôles ne touche une machine : ils lisent ce que le dépôt dit
// de la Box (profils, unités, autoinstall, rapports témoins, manifeste) et
// refusent qu'il se contredise. Ce qu'ils ne peuvent pas voir est écrit dans
// box/README.md sous « non constaté ».
import { estMain } from './commun.ts';

const CONTROLES = ['check-materiel', 'check-profils', 'check-systemd', 'check-rapport-usine', 'check-autoinstall', 'check-manifeste'];

export async function lancer(): Promise<number> {
  let fautes = 0;
  for (const nom of CONTROLES) {
    console.log(`\nBox — ${nom}`);
    const { lancer: l } = await import(new URL(`./${nom}.ts`, import.meta.url).href);
    fautes += await l();
  }
  return fautes;
}

if (estMain(import.meta.url)) {
  const f = await lancer();
  if (f > 0) { console.log(`\nBox : ${f} faute(s).`); process.exit(1); }
  console.log('\nBox : tout passe.');
}
