// Ce que la plateforme lit du dépôt à l'exécution : les fiches d'agents
// (`agents/`, `socle/`). Seul endroit qui sait OÙ elles sont. Sous Node, elles
// sont sur le disque, à côté du code ; chez Cloudflare, il n'y a pas de disque :
// elles sont servies comme fichiers statiques et `cloudflare/worker.ts` pose son
// propre dépôt avant la première requête. Les petits catalogues (catalogue,
// logiciels, tarifs) ne passent pas par ici : ils sont importés en JSON et
// partent dans le code.
//
// La lecture d'une fiche est asynchrone parce qu'elle l'est chez Cloudflare ;
// la liste des fiches est synchrone parce qu'elle est connue d'avance des deux
// côtés (lue sur le disque, ou relevée à la construction).

export type Depot = {
  /** AG-XXXX -> chemin de sa fiche depuis la racine du dépôt (`agents/AG-0001-….json`). `agents/` l'emporte sur `socle/`. */
  fiches(): Map<string, string>;
  /** Les octets exacts d'un fichier du dépôt : une empreinte se calcule sur eux, pas sur un JSON relu. */
  lire(chemin: string): Promise<Uint8Array>;
};

export const DOSSIERS_FICHES = ['agents', 'socle'] as const;
export const FICHE = /^(AG-\d{4})-.*\.json$/;

/** Les fiches d'une liste de noms par dossier, avec la même règle des deux côtés. */
export function indexer(parDossier: Record<string, string[]>): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of DOSSIERS_FICHES) {
    for (const f of [...(parDossier[d] ?? [])].sort()) {
      const r = FICHE.exec(f);
      if (r && !m.has(r[1])) m.set(r[1], `${d}/${f}`);
    }
  }
  return m;
}

function depotDisque(): Depot {
  // No static `node:fs` import: this file is bundled for Cloudflare too, where it is never called.
  const fs = process.getBuiltinModule('node:fs');
  const racine = new URL('../', import.meta.url);
  let index: Map<string, string> | null = null;
  return {
    fiches: () => (index ??= indexer(Object.fromEntries(DOSSIERS_FICHES.map((d) => {
      const u = new URL(`${d}/`, racine);
      return [d, fs.existsSync(u) ? fs.readdirSync(u) : []];
    })))),
    lire: async (chemin) => new Uint8Array(fs.readFileSync(new URL(chemin, racine))),
  };
}

let actuel: Depot | null = null;
export const depot = (): Depot => (actuel ??= depotDisque());
export function poserDepot(d: Depot): void { actuel = d; }

export async function lireFiche(agentId: string): Promise<{ chemin: string; octets: Uint8Array; fiche: Record<string, unknown> }> {
  const chemin = depot().fiches().get(agentId);
  if (!chemin) throw new Error(`L'agent ${agentId} n'existe pas dans agents/.`);
  const octets = await depot().lire(chemin);
  return { chemin, octets, fiche: JSON.parse(new TextDecoder().decode(octets)) };
}
