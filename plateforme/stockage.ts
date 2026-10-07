// Le stockage de la plateforme : des collections de documents gardées en
// mémoire et écrites sur disque à chaque changement (écriture en `.partiel`
// puis renommage, comme `telechargement.rs`, pour qu'un arrêt brutal ne laisse
// jamais un fichier à moitié écrit).
//
// Volontairement sans base de données ni dépendance : la plateforme démarre
// avec `node --experimental-strip-types plateforme/serveur.ts`, comme le relais.
// Le jour où le volume l'exige, c'est ce fichier seul qui change.
//
// Isolation par tenant (§18) : `pourTenant()` rend une vue qui ne lit et
// n'écrit que les documents de CE tenant, et refuse d'en écrire un qui en
// porte un autre.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

type Doc = Record<string, unknown>;

export class Stockage {
  private donnees: Record<string, Record<string, Doc>> = {};
  private readonly fichier: string | null;
  constructor(fichier: string | null) {
    this.fichier = fichier;
    if (fichier && existsSync(fichier)) {
      this.donnees = JSON.parse(readFileSync(fichier, 'utf8'));
    }
  }

  private ecrire(): void {
    if (!this.fichier) return;
    mkdirSync(dirname(this.fichier), { recursive: true });
    const partiel = `${this.fichier}.partiel`;
    writeFileSync(partiel, JSON.stringify(this.donnees));
    renameSync(partiel, this.fichier);
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
    this.ecrire();
    return doc;
  }

  retirer(collection: string, id: string): boolean {
    const c = this.donnees[collection];
    if (!c || !(id in c)) return false;
    delete c[id];
    this.ecrire();
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
