// Simulateur de Box (ADMIN MASTER §20 « device simulator », backlog DEV-006) :
// des Box qui ont chacune leur vraie clé Ed25519 et parlent à la plateforme par
// les mêmes routes signées qu'une Box réelle — battement, état voulu, état réel,
// commandes. Il sert au banc du noyau et à l'essai de charge :
//   node --experimental-strip-types plateforme/noyau/simulateur.ts --boxes 10000
//
// In-process on purpose: requests go through `traiterRequete`, the very function
// both doors (Node and Cloudflare) use, so the load test measures the core and
// not the loopback network.

import { Buffer } from 'node:buffer';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { messageASigner, traiterRequete, type Reponse, type Socle } from '../http.ts';
import type { Box } from '../modele.ts';
import type { ContenuEtat, EtatVoulu } from './etat.ts';

export class BoxSimulee {
  readonly box: Box;
  private readonly cle: KeyObject;
  reel: ContenuEtat = { versions: {}, agents: {}, politiques: {} };
  versionAppliquee = 0;
  executees: string[] = [];
  /** A Box told to fail its commands, to exercise the failure paths. */
  enPanne = false;

  constructor(box: Box, cle: KeyObject) { this.box = box; this.cle = cle; }

  static nouvelle(numero: number, tenant_id: string | null, gamme: Box['gamme'] = 'business'): BoxSimulee {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const n = String(numero).padStart(8, '0');
    const box: Box = {
      device_id: `BOX-SIM${n}`, tenant_id, serial: `SIM-${n}`, reference: `IA-FR-STN-${n}`,
      identite_publique: publicKey.export({ type: 'spki', format: 'pem' }).toString(), cle_chiffrement_publique: null, gamme, os: 'iagent-os-0.1.0',
      version_desktop: '0.2.1', statut: 'active', plan_id: null, sante: null, garantie_jusqu_au: null, profil_materiel: 'vm-qemu', inventaire: null,
      versions: { device: '0.1.0', os: '0.1.0' }, usine: null,
    };
    return new BoxSimulee(box, privateKey);
  }

  async appeler(socle: Socle, methode: string, chemin: string, corps: unknown = null): Promise<Reponse> {
    const brut = corps === null ? '' : JSON.stringify(corps);
    const h = socle.maintenant().toISOString();
    const signature = sign(null, Buffer.from(messageASigner(methode, chemin.split('?')[0], h, brut), 'utf8'), this.cle).toString('base64');
    return traiterRequete(socle, { methode, url: chemin, brut, entetes: { 'x-box-id': this.box.device_id, 'x-horodatage': h, 'x-signature': signature, 'content-type': 'application/json' } });
  }

  /** One full reconciliation turn, as the device agent does it: heartbeat, desired state, actual state, commands. */
  async tour(socle: Socle): Promise<{ battement: number; convergee: boolean; commandes: number }> {
    const b = await this.appeler(socle, 'POST', '/v1/box/battement', { uptime_s: 3600 });
    const v = await this.appeler(socle, 'GET', '/v1/box/etat-voulu');
    const voulu = v.corps as EtatVoulu;
    // A real Box applies, then reports what it actually runs: here it applies everything it is told.
    this.reel = JSON.parse(JSON.stringify(voulu.voulu));
    this.versionAppliquee = voulu.version;
    const r = await this.appeler(socle, 'POST', '/v1/box/etat-reel', { version_appliquee: this.versionAppliquee, reel: this.reel });
    const c = await this.appeler(socle, 'GET', '/v1/box/commandes');
    const commandes = (c.corps as { commandes: { id: string; type: string }[] }).commandes;
    for (const cmd of commandes) {
      if (this.executees.includes(cmd.id)) continue;
      this.executees.push(cmd.id);
      await this.appeler(socle, 'POST', `/v1/box/commandes/${cmd.id}/resultat`, {
        reussie: !this.enPanne, code: this.enPanne ? 1 : 0, duree_ms: 120, sortie: this.enPanne ? `échec simulé de ${cmd.type}` : `${cmd.type} simulé : ok`,
      });
    }
    return { battement: b.statut, convergee: (r.corps as { convergee?: boolean }).convergee === true, commandes: commandes.length };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { Stockage } = await import('../stockage.ts');
  const { toutesLesRoutes } = await import('../assemblage.ts');
  const i = process.argv.indexOf('--boxes');
  const n = i > 0 ? Number(process.argv[i + 1]) : 1000;
  const stockage = new Stockage(null);
  const socle: Socle = { reglages: { secretAdmin: 'x'.repeat(32), fichierDonnees: null }, stockage, maintenant: () => new Date(), routes: toutesLesRoutes };
  stockage.poser('tenants', 'T-CHARGE', { tenant_id: 'T-CHARGE', nom: 'Charge', segment: 'business', pays: 'FR', opt_in_skills: false, cree_le: new Date().toISOString() });
  let t = Date.now();
  const flotte = Array.from({ length: n }, (_, k) => BoxSimulee.nouvelle(k + 1, 'T-CHARGE'));
  for (const s of flotte) stockage.poser('boxes', s.box.device_id, s.box);
  console.log(`${n} Box créées en ${Date.now() - t} ms`);
  t = Date.now();
  let convergees = 0;
  for (const s of flotte) if ((await s.tour(socle)).convergee) convergees++;
  const d = Date.now() - t;
  console.log(`Un tour complet (5 requêtes signées par Box) : ${d} ms, soit ${Math.round((n * 5 * 1000) / d)} requêtes/s ; ${convergees}/${n} convergées.`);
  t = Date.now();
  for (const s of flotte) await s.appeler(socle, 'POST', '/v1/box/battement', { uptime_s: 1 });
  const db = Date.now() - t;
  console.log(`${n} battements : ${db} ms, soit ${Math.round((n * 1000) / db)} battements/s (objectif du MASTER : 200/s soutenus).`);
}
