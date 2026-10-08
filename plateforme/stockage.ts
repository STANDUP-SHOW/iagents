// Le stockage de la plateforme : des collections de documents gardées en
// mémoire, et chaque changement remis à un `Support` qui le rend durable. Deux
// supports : un fichier JSON sous Node (`stockage-fichier.ts`, écriture en
// `.partiel` puis renommage, comme `telechargement.rs`) et le stockage d'un
// Durable Object chez Cloudflare (`cloudflare/worker.ts`, une clé par
// document). Sans support (`new Stockage(null)`), tout reste en mémoire : les bancs.
//
// Volontairement sans base de données ni dépendance. Le jour où le volume
// l'exige, c'est un support de plus, pas un changement des modules.
//
// Isolation par tenant (§18) : `pourTenant()` rend une vue qui ne lit et
// n'écrit que les documents de CE tenant, et refuse d'en écrire un qui en
// porte un autre.

export type Doc = Record<string, unknown>;
export type Donnees = Record<string, Record<string, Doc>>;

/** Ce qui rend un changement durable. `doc` null : le document est retiré. Appelé après chaque changement, dans l'ordre. */
export type Support = { initial: Donnees; changer(collection: string, id: string, doc: Doc | null): void };

export class Stockage {
  private donnees: Donnees = {};
  private readonly support: Support | null;
  constructor(support: Support | null) {
    this.support = support;
    if (support) this.donnees = support.initial;
  }

  /** Tout, tel qu'en mémoire : pour le support fichier, qui réécrit le fichier entier. */
  toutes(): Donnees {
    return this.donnees;
  }

  lire<T>(collection: string, id: string): T | null {
    return (this.donnees[collection]?.[id] as T | undefined) ?? null;
  }

  lister<T>(collection: string, filtre?: (d: T) => boolean): T[] {
    const tous = Object.values(this.donnees[collection] ?? {}) as T[];
    return filtre ? tous.filter(filtre) : tous;
  }

  poser<T extends object>(collection: string, id: string, doc: T): T {
    (this.donnees[collection] ??= {})[id] = doc as Doc;
    this.support?.changer(collection, id, doc as Doc);
    return doc;
  }

  retirer(collection: string, id: string): boolean {
    const c = this.donnees[collection];
    if (!c || !(id in c)) return false;
    delete c[id];
    this.support?.changer(collection, id, null);
    return true;
  }

  pourTenant(tenant: string): VueTenant {
    if (!tenant) throw new Error('Aucun tenant : lecture refusée.');
    return new VueTenant(this, tenant);
  }
}

export class VueTenant {
  private readonly s: Stockage;
  readonly tenant: string;
  constructor(s: Stockage, tenant: string) {
    this.s = s;
    this.tenant = tenant;
  }
  lire<T extends { tenant_id: string | null }>(collection: string, id: string): T | null {
    const d = this.s.lire<T>(collection, id);
    return d && d.tenant_id === this.tenant ? d : null;
  }
  lister<T extends { tenant_id: string | null }>(collection: string, filtre?: (d: T) => boolean): T[] {
    return this.s.lister<T>(collection, (d) => d.tenant_id === this.tenant && (!filtre || filtre(d)));
  }
  poser<T extends { tenant_id: string | null }>(collection: string, id: string, doc: T): T {
    if (doc.tenant_id !== this.tenant) {
      throw new Error(`Écriture refusée : le document appartient à un autre tenant que ${this.tenant}.`);
    }
    return this.s.poser(collection, id, doc);
  }
}
