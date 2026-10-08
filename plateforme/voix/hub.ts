// Voice Hub (MASTER §12): simultaneous sessions per tenant under a ceiling,
// queues with priority, overflow and callback. Pure functions over plain data;
// `routes.ts` keeps the data in the store.
import type { EnFile, FileAttente } from './types.ts';

export type Admission = { admis: true } | { admis: false; motif: string };

export function admettre(actives: number, plafond: number): Admission {
  return actives < plafond
    ? { admis: true }
    : { admis: false, motif: `${actives} appel(s) en cours pour un plafond de ${plafond} : l’appel ne peut pas ouvrir de session.` };
}

export type ResultatFile =
  | { resultat: 'en-file'; position: number }
  | { resultat: 'debordement'; vers: FileAttente['debordement']; motif: string };

/** Puts a call in a queue, or says where it overflows when the queue is full. */
export function enfiler(file: FileAttente, contenu: EnFile[], appel: EnFile): ResultatFile {
  const deLaFile = contenu.filter((c) => c.file_id === file.id);
  if (deLaFile.length >= file.capacite) {
    return { resultat: 'debordement', vers: file.debordement, motif: `La file « ${file.nom} » est pleine (${file.capacite}).` };
  }
  const ordre = trier([...deLaFile, appel]);
  return { resultat: 'en-file', position: ordre.findIndex((c) => c.appel_id === appel.appel_id) + 1 };
}

/** Highest priority first, then the one who waits longest. */
export function trier(contenu: EnFile[]): EnFile[] {
  return [...contenu].sort((a, b) => b.priorite - a.priorite || Date.parse(a.depuis) - Date.parse(b.depuis));
}

/** The next call to serve across the tenant's queues: queue priority, then call priority, then age. */
export function suivant(files: FileAttente[], contenu: EnFile[]): EnFile | null {
  const prio = new Map(files.map((f) => [f.id, f.priorite]));
  const tous = [...contenu].sort((a, b) =>
    (prio.get(b.file_id) ?? 0) - (prio.get(a.file_id) ?? 0) || b.priorite - a.priorite || Date.parse(a.depuis) - Date.parse(b.depuis));
  return tous[0] ?? null;
}

/** Calls that waited more than their queue allows. */
export function depasses(files: FileAttente[], contenu: EnFile[], maintenant: Date): { appel: EnFile; file: FileAttente }[] {
  const parId = new Map(files.map((f) => [f.id, f]));
  return contenu.flatMap((c) => {
    const f = parId.get(c.file_id);
    return f && maintenant.getTime() - Date.parse(c.depuis) > f.attente_max_s * 1000 ? [{ appel: c, file: f }] : [];
  });
}

export function fileInvalide(f: FileAttente): string | null {
  if (!f || !f.tenant_id || !f.nom) return 'Une file a un client (tenant_id) et un nom.';
  if (!Number.isFinite(f.priorite)) return 'La priorité est un nombre.';
  if (!Number.isInteger(f.capacite) || f.capacite < 1) return 'La capacité est un entier positif.';
  if (!Number.isInteger(f.attente_max_s) || f.attente_max_s < 1) return 'L’attente maximale est un nombre de secondes positif.';
  const d = f.debordement;
  if (!d || !['file', 'messagerie', 'rappel'].includes(d.type)) return 'Le débordement va vers une file, la messagerie ou le rappel.';
  if (d.type === 'file' && (!d.file_id || d.file_id === f.id)) return 'Le débordement vers une file doit nommer une AUTRE file.';
  if (typeof f.rappel !== 'boolean') return 'rappel est vrai ou faux.';
  return null;
}
