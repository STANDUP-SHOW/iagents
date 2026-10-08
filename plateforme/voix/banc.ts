// Bench of the voice module. Pure parts first (registry, machine, hub, cost,
// campaign rules), then the adapters against fakes on 127.0.0.1, then the
// platform itself through a REAL server (creerPlateforme) with signed Box
// requests and signed operator webhooks. Every guard below fails if its rule is
// undone; the MASTER acceptance criterion (same business logic with two engines)
// is checked by running one scripted call through Gemini Live AND Mistral.
import { generateKeyPairSync, sign } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Box, VoiceProfile } from '../modele.ts';
import { creerPlateforme, messageASigner } from '../serveur.ts';
import { Stockage } from '../stockage.ts';
import { ecouter, fauxGemini, fauxMoteurs, fauxOperateur } from './banc-faux.ts';
import { verifierContact } from './campagnes.ts';
import { manque } from './cles.ts';
import { coutAppel } from './cout.ts';
import { fournisseur, lireWav, wav, type Bases, type EvenementVoix } from './fournisseurs-voix.ts';
import { admettre, enfiler, suivant } from './hub.ts';
import { choisirMoteur } from './registre.ts';
import { appliquerEvenement, configurerVoix } from './routes.ts';
import { conduireAppel, ETAT_INITIAL, OUTILS_STANDARD, standardInvalide, transition, type ContexteAppel, type EtatAppel } from './standard.ts';
import { normaliserE164, signatureSip, signatureTwilio } from './telephonie.ts';
import { joursFeriesFrance } from './temps.ts';
import type { AppelVoix, ContactCampagne, FileAttente, Plage, Standard } from './types.ts';

export async function lancer(): Promise<number> {
  let fautes = 0;
  const verifier = (quoi: string, vrai: boolean, detail = '') => {
    if (vrai) console.log(`  ok  ${quoi}`);
    else { fautes++; console.log(`  FAUTE  ${quoi}${detail ? ` — ${detail}` : ''}`); }
  };

  // -------------------------------------------------------------------------
  console.log(' Registre de voix');
  const profil: VoiceProfile = {
    id: 'vp-lea', persona_id: 'P-LEA', locale: 'fr-FR', palier: 'standard',
    voix_par_moteur: { gemini: 'Kore', elevenlabs: 'EXAVITQu4vr4xnSDxMaL', mistral: 'fr_marie_neutral', local: 'fr_FR-siwis-medium' },
    ordre_de_repli: ['gemini', 'mistral', 'elevenlabs', 'local'],
  };
  const tous = { gemini: null, elevenlabs: null, mistral: null, local: null };
  const q = choisirMoteur({ profil, mode: 'quality_first', langue: 'fr', canal: 'telephone', disponibilite: tous });
  verifier('quality_first retient le premier du classement (ElevenLabs)', q.moteur === 'elevenlabs' && q.voix === 'EXAVITQu4vr4xnSDxMaL');
  verifier('le motif est écrit même quand le premier gagne', q.motif.length > 20 && q.motif.includes('ElevenLabs'));
  verifier('le local ne sert pas le téléphone, et le motif le dit', q.ecartes.some((e) => e.moteur === 'local' && e.raison.includes('telephone')));
  const c = choisirMoteur({ profil, mode: 'cost_first', langue: 'fr', canal: 'desktop', disponibilite: tous });
  verifier('cost_first sur le Desktop retient la voix du poste (gratuite)', c.moteur === 'local');
  verifier('cost_first classe Mistral (prix non relevé) en dernier et le dit', c.repli[c.repli.length - 1]?.moteur === 'mistral' && c.motif.includes('Prix non relevé'));
  const l = choisirMoteur({ profil, mode: 'local_first', langue: 'fr', canal: 'telephone', disponibilite: tous });
  verifier('local_first au téléphone se replie sur un moteur en ligne', l.moteur !== 'local' && l.moteur !== null);
  const d = choisirMoteur({ profil, mode: 'balanced', langue: 'fr', canal: 'desktop', disponibilite: { ...tous, local: 'pas de Piper', elevenlabs: 'pas de clé' } });
  const t = choisirMoteur({ profil, mode: 'balanced', langue: 'fr', canal: 'telephone', disponibilite: { ...tous, local: 'pas de Piper', elevenlabs: 'pas de clé' } });
  verifier('même persona, même moteur : même voix sur Desktop et téléphone', d.moteur === t.moteur && d.voix === t.voix && d.voix === profil.voix_par_moteur[d.moteur!]);
  verifier('un repli garde la voix de la persona chez ce moteur', d.repli.every((r) => r.voix === profil.voix_par_moteur[r.moteur]));
  const sansVoix = choisirMoteur({ profil: { ...profil, voix_par_moteur: { mistral: 'fr_marie_neutral' }, ordre_de_repli: ['mistral'] }, mode: 'quality_first', langue: 'fr', canal: 'telephone', disponibilite: tous });
  verifier('un moteur où la persona n’a pas de voix n’est jamais retenu', sansVoix.moteur === 'mistral' && sansVoix.ecartes.some((e) => e.moteur === 'elevenlabs' && e.raison.includes('identité')));
  const rien = choisirMoteur({ profil, mode: 'balanced', langue: 'fr', canal: 'telephone', disponibilite: { gemini: 'a', elevenlabs: 'b', mistral: 'c', local: 'd' } });
  verifier('rien de disponible : aucun moteur, et le motif dit pourquoi', rien.moteur === null && rien.motif.includes('Aucun moteur'));
  const ja = choisirMoteur({ profil, mode: 'balanced', langue: 'ja', canal: 'desktop', disponibilite: tous });
  verifier('une langue non relevée écarte le moteur', ja.moteur === null);

  // -------------------------------------------------------------------------
  console.log(' Moteurs sans clé');
  const vides: Bases = { gemini: 'ws://127.0.0.1:1', elevenlabs: 'http://127.0.0.1:1', mistral: 'http://127.0.0.1:1', anthropic: 'http://127.0.0.1:1' };
  const ouverture = { voix: 'Kore', langue: 'fr', contexte: { tenant_id: 't1', agent: 'Léa', consigne: 'Accueil.' }, outils: OUTILS_STANDARD };
  for (const m of ['gemini', 'elevenlabs', 'mistral', 'local'] as const) {
    let motif = '';
    try { await fournisseur(m, { env: {}, bases: vides }).startSession(ouverture); } catch (e) { motif = (e as Error).message; }
    verifier(`${m} sans clé refuse en nommant ce qui manque`, motif.includes('il manque') && motif.includes('Rien n’a été envoyé'), motif);
  }
  const sansCerveau = fournisseur('elevenlabs', { env: { ELEVENLABS_API_KEY: 'k' }, bases: vides }).indisponible() ?? '';
  verifier('ElevenLabs sans modèle de langage refuse aussi', sansCerveau.includes('ANTHROPIC_API_KEY'));
  verifier('un message de manque ne recopie jamais une clé', !(manque(['gemini', 'mistral'], { MISTRAL_API_KEY: 'sk-tres-secret' }, 'X') ?? '').includes('sk-tres-secret'));

  // -------------------------------------------------------------------------
  console.log(' Numéros et signatures');
  verifier('E.164 : espaces retirés', normaliserE164('+33 1 86 00 00 01') === '+33186000001');
  verifier('E.164 : l’écriture de l’exemple Telnyx (+1-202-555-0133) est lue', normaliserE164('+1-202-555-0133') === '+12025550133');
  verifier('E.164 : 00 devient +', normaliserE164('0033612345678') === '+33612345678');
  verifier('E.164 : un numéro national est refusé', normaliserE164('0612345678') === null);
  verifier('E.164 : +0 et plus de 15 chiffres refusés', normaliserE164('+0123') === null && normaliserE164('+1234567890123456') === null);
  verifier('Twilio : la signature de l’exemple de la documentation tombe juste', signatureTwilio('12345', 'https://example.com/myapp.php?foo=1&bar=2',
    [['Digits', '1234'], ['To', '+18005551212'], ['From', '+14158675310'], ['Caller', '+14158675310'], ['CallSid', 'CA1234567890ABCDE']]) === 'L/OH5YylLD5NRKLltdqwSvS0BnU=');
  const feries = joursFeriesFrance(2026);
  verifier('jours fériés 2026 : lundi de Pâques, Ascension, Pentecôte', feries.includes('2026-04-06') && feries.includes('2026-05-14') && feries.includes('2026-05-25') && feries.length === 11);

  // -------------------------------------------------------------------------
  console.log(' Machine à états de l’appel');
  const std: Standard = {
    id: 'S1', tenant_id: 't1', nom: 'Standard', fuseau: 'Europe/Paris', accueil: 'Bonjour, ici Léa.', message_ferme: 'Nous sommes fermés.',
    horaires: [{ jours: [1, 2, 3, 4, 5], debut: '09:00', fin: '18:00' }], extension_accueil: '100',
    extensions: [
      { numero: '100', agent_instance_id: 'AI-LEA', prenom: 'Léa', departement: 'accueil' },
      { numero: '200', agent_instance_id: 'AI-MARC', prenom: 'Marc', departement: 'comptabilite' },
    ],
    humains: [{ id: 'H1', nom: 'Max', departements: ['comptabilite'], cibles: [
      { type: 'desktop', adresse: 'sip:max@box.iagent', plages: [{ jours: [1, 2, 3, 4, 5], debut: '09:00', fin: '10:00' }] },
      { type: 'mobile', adresse: '+33 6 12 34 56 78' },
    ] }],
    messagerie: true, rappel: true, file_id: 'F1', plafond_sessions: 1, consentement_enregistrement: false,
  };
  verifier('le standard témoin est valide', standardInvalide(std) === null, standardInvalide(std) ?? '');
  verifier('une cible mobile qui n’est pas E.164 est refusée', standardInvalide({ ...std, humains: [{ ...std.humains[0], cibles: [{ type: 'mobile', adresse: '0612' }] }] }) !== null);
  const mardi1030 = new Date('2026-10-13T08:30:00Z'); // 10:30 à Paris
  const ctx = (o: Partial<ContexteAppel> = {}): ContexteAppel => ({ standard: std, appelant: '+33155555555', maintenant: mardi1030, agent_au_telephone: true, places_libres: true, ...o });
  const ferme = transition(ctx({ maintenant: new Date('2026-10-13T19:00:00Z') }), ETAT_INITIAL, { type: 'entrant' });
  verifier('hors horaires : messagerie, message de fermeture dit', ferme.etat.etape === 'messagerie' && ferme.actions.some((a) => a.type === 'dire' && a.texte === std.message_ferme));
  const ouvert = transition(ctx(), ETAT_INITIAL, { type: 'entrant' });
  verifier('ouvert : l’agent d’accueil prend l’appel', ouvert.etat.etape === 'conversation' && ouvert.etat.extension === '100' && ouvert.actions.some((a) => a.type === 'connecter_agent'));
  const sansPont = transition(ctx({ agent_au_telephone: false }), ETAT_INITIAL, { type: 'entrant' });
  verifier('sans pont média : un humain est prévenu au lieu de faire semblant', sansPont.etat.etape === 'handoff' && sansPont.motif.includes('pont média'));
  const plein = transition(ctx({ places_libres: false }), ETAT_INITIAL, { type: 'entrant' });
  verifier('plafond atteint : l’appel attend dans la file', plein.etat.etape === 'attente' && plein.etat.file_id === 'F1');
  const tr = transition(ctx(), ouvert.etat, { type: 'transferer_agent', vers: 'comptabilite' });
  verifier('transfert agent→agent par département', tr.etat.extension === '200' && tr.etat.transferts === 1);
  const inconnu = transition(ctx(), ouvert.etat, { type: 'transferer_agent', vers: 'juridique' });
  verifier('département inconnu : l’agent garde l’appel et le dit', inconnu.etat.extension === '100' && inconnu.motif.includes('juridique'));
  const ho = transition(ctx(), tr.etat, { type: 'demander_humain', motif: 'litige', resume: 'facture' });
  const notif = ho.actions.find((a) => a.type === 'notifier_handoff');
  verifier('prise en main : identité appelant, motif et résumé transmis', ho.etat.etape === 'handoff' && notif?.type === 'notifier_handoff' && notif.appelant === '+33155555555' && notif.motif === 'litige' && notif.resume === 'facture');
  const prendre = transition(ctx(), ho.etat, { type: 'decision', decision: 'prendre' });
  const tf = prendre.actions.find((a) => a.type === 'transferer');
  verifier('Prendre : transfert vers la première cible ouverte (mobile, le Desktop est fermé à 10 h 30)', prendre.etat.etape === 'humain' && tf?.type === 'transferer' && tf.vers === '+33612345678' && tf.cible === 'mobile');
  const prendre930 = transition(ctx({ maintenant: new Date('2026-10-13T07:30:00Z') }), ho.etat, { type: 'decision', decision: 'prendre' });
  verifier('Prendre à 9 h 30 : le Desktop d’abord', prendre930.actions.some((a) => a.type === 'transferer' && a.cible === 'desktop'));
  verifier('Refuser : messagerie', transition(ctx(), ho.etat, { type: 'decision', decision: 'refuser' }).etat.etape === 'messagerie');
  const rap = transition(ctx(), ho.etat, { type: 'decision', decision: 'rappeler' });
  verifier('Rappeler : rappel programmé au numéro de l’appelant', rap.etat.etape === 'rappel' && rap.actions.some((a) => a.type === 'programmer_rappel' && a.numero === '+33155555555'));
  verifier('Laisser l’agent continuer : retour en conversation', transition(ctx(), ho.etat, { type: 'decision', decision: 'laisser' }).etat.etape === 'conversation');
  verifier('une décision sans prise en main en attente est refusée', transition(ctx(), ouvert.etat, { type: 'decision', decision: 'prendre' }).refuse);
  verifier('raccroché après transfert humain : issue transfere-humain', transition(ctx(), prendre.etat, { type: 'raccroche' }).etat.issue === 'transfere-humain');
  verifier('raccroché après transfert d’agent : issue transfere-agent', transition(ctx(), tr.etat, { type: 'raccroche' }).etat.issue === 'transfere-agent');
  verifier('raccroché en attente : abandonné', transition(ctx(), plein.etat, { type: 'raccroche' }).etat.issue === 'abandonne');
  const fini = transition(ctx(), tr.etat, { type: 'raccroche' }).etat;
  verifier('un appel terminé refuse tout le reste', transition(ctx(), fini, { type: 'transferer_agent', vers: '100' }).refuse);

  // -------------------------------------------------------------------------
  console.log(' Voice Hub : plafond et files');
  verifier('plafond : 1 session sur 1 refuse la suivante', !admettre(1, 1).admis && admettre(0, 1).admis);
  const F: FileAttente = { id: 'F1', tenant_id: 't1', nom: 'Accueil', priorite: 1, capacite: 2, attente_max_s: 60, debordement: { type: 'messagerie' }, rappel: true };
  const e = (id: string, prio: number, depuis: string) => ({ appel_id: id, tenant_id: 't1', file_id: 'F1', priorite: prio, depuis, appelant: '+33100000000' });
  verifier('file pleine : débordement vers ce que la file dit', enfiler(F, [e('a', 1, '2026-10-13T08:00:00Z'), e('b', 1, '2026-10-13T08:01:00Z')], e('c', 1, '2026-10-13T08:02:00Z')).resultat === 'debordement');
  verifier('priorité d’abord, ancienneté ensuite', suivant([F], [e('a', 1, '2026-10-13T08:00:00Z'), e('b', 5, '2026-10-13T08:05:00Z'), e('c', 5, '2026-10-13T08:01:00Z')])?.appel_id === 'c');

  // -------------------------------------------------------------------------
  console.log(' Coût d’un appel');
  const ct = coutAppel({ duree_s: 120, direction: 'entrant', provider: 'twilio', appele: '+33186000002', voix: null, outils: [] });
  verifier('Twilio entrant 2 min = 0,02 $ (taux lu)', ct.total === 0.02 && ct.manquants.length === 0);
  const cx = coutAppel({ duree_s: 120, direction: 'entrant', provider: 'telnyx', appele: '+33186000001', voix: null, outils: [] });
  verifier('Telnyx : taux non relevé → coût inconnu, jamais deviné', cx.total === null && cx.manquants.some((m) => m.includes('telnyx')));
  const ce = coutAppel({ duree_s: 60, direction: 'sortant', provider: 'twilio', appele: '+33612345678', outils: [{ nom: 'transferer_vers', cout_usd: 0 }],
    voix: { moteur: 'elevenlabs', duree_s: 60, secondes_audio_entree: 30, secondes_audio_sortie: 30, caracteres_synthetises: 1000, jetons_entree: 1_000_000, jetons_sortie: 100_000, appels_outils: 1 } });
  verifier('sortant mobile + ElevenLabs + LLM : chaque part comptée', ce.telephonie === 0.0404 && ce.voix === 0.081833 && ce.llm === 3 && ce.total === 3.122233, JSON.stringify(ce));
  const cm = coutAppel({ duree_s: 60, direction: 'entrant', provider: 'twilio', appele: '+33186000002', outils: [],
    voix: { moteur: 'mistral', duree_s: 60, secondes_audio_entree: 30, secondes_audio_sortie: 30, caracteres_synthetises: 10, jetons_entree: 0, jetons_sortie: 0, appels_outils: 0 } });
  verifier('Mistral : prix non relevé → total inconnu', cm.total === null && cm.manquants.some((m) => m.includes('mistral')));

  // -------------------------------------------------------------------------
  console.log(' Campagnes : consentement, opposition, horaires');
  const consent = (date: string, plus: Partial<ContactCampagne> = {}): ContactCampagne => ({ e164: '+33612000001', consentement: { source: 'formulaire site 12/09', date }, ...plus });
  const baseV = { pays: 'FR', fenetres: [] as Plage[], enregistrement_demande: true, maintenant: mardi1030, opposition: new Map<string, string>(), appels_30_jours: 0 };
  const vc = (o: Partial<typeof baseV> & { contact?: ContactCampagne }) => verifierContact({ ...baseV, contact: consent('2026-09-12T10:00:00Z'), ...o });
  const okv = vc({});
  verifier('consentement prouvé, mardi 10 h 30 : autorisé', okv.autorise);
  verifier('enregistrement demandé sans consentement d’enregistrement : pas d’enregistrement', okv.autorise && !okv.enregistrer);
  const okr = vc({ contact: consent('2026-09-12T10:00:00Z', { consentement_enregistrement: true }) });
  verifier('enregistrement seulement si le contact y a consenti', okr.autorise && okr.enregistrer);
  const motifDe = (v: ReturnType<typeof verifierContact>) => (v.autorise ? '' : v.motif);
  verifier('sans consentement : refusé avec motif', motifDe(vc({ contact: { e164: '+33612000001', consentement: null } })).includes('Aucun consentement'));
  verifier('consentement sans source : refusé', motifDe(vc({ contact: { e164: '+33612000001', consentement: { source: ' ', date: '2026-09-12T10:00:00Z' } } })).includes('source'));
  verifier('consentement de plus d’un an : refusé', motifDe(vc({ contact: consent('2025-09-01T10:00:00Z') })).includes('365'));
  verifier('consentement retiré : refusé', motifDe(vc({ contact: consent('2026-09-12T10:00:00Z', { consentement: { source: 'x', date: '2026-09-12T10:00:00Z', retire_le: '2026-10-01T00:00:00Z' } }) })).includes('retiré'));
  verifier('liste Bloctel : refusé', motifDe(vc({ opposition: new Map([['+33612000001', 'bloctel']]) })).includes('bloctel'));
  verifier('quatre appels en trente jours : refusé', motifDe(vc({ appels_30_jours: 4 })).includes('limite'));
  verifier('dimanche : refusé', motifDe(vc({ maintenant: new Date('2026-10-11T08:30:00Z') })).includes('dimanche'));
  verifier('samedi : refusé', motifDe(vc({ maintenant: new Date('2026-10-10T08:30:00Z') })).includes('samedi'));
  verifier('11 novembre (mercredi férié) : refusé', motifDe(vc({ maintenant: new Date('2026-11-11T09:30:00Z') })).includes('férié'));
  verifier('9 h 59 : refusé', motifDe(vc({ maintenant: new Date('2026-10-13T07:59:00Z') })).includes('hors des horaires'));
  verifier('13 h 30 : refusé (pause de midi)', motifDe(vc({ maintenant: new Date('2026-10-13T11:30:00Z') })).includes('hors des horaires'));
  verifier('20 h 00 : refusé (fin exclue)', motifDe(vc({ maintenant: new Date('2026-10-13T18:00:00Z') })).includes('hors des horaires'));
  verifier('19 h 59 : autorisé', vc({ maintenant: new Date('2026-10-13T17:59:00Z') }).autorise);
  verifier('hors fenêtre de la campagne : refusé', motifDe(vc({ fenetres: [{ jours: [1, 2, 3, 4, 5], debut: '14:00', fin: '18:00' }] })).includes('fenêtres'));
  verifier('pays sans règles relevées : refusé', motifDe(vc({ pays: 'DE' })).includes('DE'));

  // -------------------------------------------------------------------------
  console.log(' Moteurs réels contre faux moteurs locaux');
  const paroles = ['Bonjour, je voudrais la comptabilité.', 'Je veux parler à quelqu’un, c’est un litige.'];
  const gem = fauxGemini(paroles, 'cle-gemini-banc');
  const mot = fauxMoteurs([paroles[0], ...paroles]); // one turn for ElevenLabs, then the two of the scripted call
  const op = fauxOperateur();
  const baseGem = (await ecouter(gem.serveur)).replace('http', 'ws');
  const baseMot = await ecouter(mot.serveur);
  const baseOp = await ecouter(op.serveur);
  const outils = mkdtempSync(join(tmpdir(), 'iagent-banc-voix-'));
  const journalLocal = join(outils, 'piper-entree.txt');
  writeFileSync(join(outils, 'piper'), `#!/usr/bin/env node
const fs=require('fs');const a=process.argv;const o=a[a.indexOf('--output_file')+1];let t='';
process.stdin.on('data',d=>t+=d).on('end',()=>{fs.writeFileSync(${JSON.stringify(journalLocal)},t+'|'+a[a.indexOf('--model')+1]);
const p=Buffer.alloc(3200),h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+p.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(22050,24);h.writeUInt32LE(44100,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(p.length,40);fs.writeFileSync(o,Buffer.concat([h,p]));});
`);
  writeFileSync(join(outils, 'whisper-cli'), `#!/usr/bin/env node
const a=process.argv;require('fs').writeFileSync(a[a.indexOf('-of')+1]+'.txt','Je voudrais la comptabilité.');
`);
  chmodSync(join(outils, 'piper'), 0o755); chmodSync(join(outils, 'whisper-cli'), 0o755);

  const env: Record<string, string> = {
    GEMINI_API_KEY: 'cle-gemini-banc', ELEVENLABS_API_KEY: 'cle-eleven-banc', MISTRAL_API_KEY: 'cle-mistral-banc', ANTHROPIC_API_KEY: 'cle-anthropic-banc',
    PIPER_BINAIRE: join(outils, 'piper'), PIPER_VOIX_DOSSIER: '/voix', WHISPER_BINAIRE: join(outils, 'whisper-cli'), WHISPER_MODELE: '/modeles/ggml-small-q5_1.bin',
    TELNYX_API_KEY: 'cle-telnyx-banc', TELNYX_CONNECTION_ID: 'conn-banc', TWILIO_ACCOUNT_SID: 'ACbanc', TWILIO_AUTH_TOKEN: 'jeton-twilio-banc',
    VOIX_URL_PUBLIQUE: 'https://voix.iagent.example', SIP_PASSERELLE_URL: `${baseOp}/sip`, SIP_PASSERELLE_JETON: 'jeton-sip-banc', SIP_SECRET_WEBHOOK: 'secret-sip-banc',
  };
  const telnyxCles = generateKeyPairSync('ed25519');
  env.TELNYX_CLE_PUBLIQUE = (telnyxCles.publicKey.export({ type: 'spki', format: 'der' }) as Buffer).subarray(-32).toString('base64');
  const basesVoix: Bases = { gemini: baseGem, elevenlabs: baseMot, mistral: baseMot, anthropic: baseMot };
  configurerVoix({ env, basesVoix, basesTel: { telnyx: baseOp, twilio: baseOp }, pont_media: false, cerveau: null });
  const deps = { env, bases: basesVoix };

  // ElevenLabs, one turn: formats and headers
  const sEl = await fournisseur('elevenlabs', deps).startSession({ ...ouverture, voix: 'EXAVITQu4vr4xnSDxMaL' });
  const evEl: EvenementVoix[] = [];
  await sEl.sendAudio(Buffer.alloc(3200), { finDeTour: true });
  for await (const x of sEl.receiveAudio()) {
    evEl.push(x);
    if (x.type === 'appel-outil') await sEl.executeTool(x.appel, async () => ({ ok: true }));
    if (x.type === 'fin-de-tour' || x.type === 'erreur') break;
  }
  await sEl.closeSession();
  const stt = mot.recus.find((r) => r.chemin === '/v1/speech-to-text');
  const tts = mot.recus.find((r) => r.chemin.startsWith('/v1/text-to-speech/'));
  verifier('ElevenLabs écoute : xi-api-key, scribe_v2, pcm_s16le_16', stt?.entetes['xi-api-key'] === 'cle-eleven-banc' && !!stt?.corps.includes('scribe_v2') && !!stt?.corps.includes('pcm_s16le_16'));
  verifier('ElevenLabs voix : la voix de la persona dans le chemin, pcm_16000', tts?.chemin === '/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=pcm_16000' && JSON.parse(tts.corps).model_id === 'eleven_v4');
  const cer = mot.recus.find((r) => r.chemin === '/v1/messages');
  verifier('le cerveau reçoit les outils du standard et sa clé', cer?.entetes['x-api-key'] === 'cle-anthropic-banc' && cer?.entetes['anthropic-version'] === '2023-06-01' && JSON.parse(cer.corps).tools.some((o: { name: string }) => o.name === 'transferer_vers'));
  verifier('ElevenLabs : l’outil est appelé, puis la réponse est dite', evEl.some((x) => x.type === 'appel-outil' && x.appel.nom === 'transferer_vers') && evEl.some((x) => x.type === 'audio'));

  // Local chain, one turn
  const sLo = await fournisseur('local', deps).startSession({ ...ouverture, voix: 'fr_FR-siwis-medium' });
  await sLo.sendAudio(Buffer.alloc(3200), { finDeTour: true });
  const evLo: EvenementVoix[] = [];
  for await (const x of sLo.receiveAudio()) {
    evLo.push(x);
    if (x.type === 'appel-outil') await sLo.executeTool(x.appel, async () => ({ ok: true }));
    if (x.type === 'fin-de-tour' || x.type === 'erreur') break;
  }
  await sLo.closeSession();
  let entreePiper = ''; try { entreePiper = readFileSync(journalLocal, 'utf8'); } catch { /* absent */ }
  verifier('local : whisper entend, Piper parle (texte par l’entrée standard, voix de la persona)', evLo.some((x) => x.type === 'transcription' && x.texte.includes('comptabilité')) && entreePiper === 'Très bien.|/voix/fr_FR-siwis-medium.onnx', entreePiper || JSON.stringify(evLo.filter((x) => x.type === 'erreur')));
  const audioLo = evLo.find((x) => x.type === 'audio');
  verifier('local : le WAV de Piper est relu avec son taux', audioLo?.type === 'audio' && audioLo.taux === 22050);
  verifier('WAV : aller-retour', lireWav(wav(Buffer.alloc(10), 16000)).taux === 16000);

  // -------------------------------------------------------------------------
  console.log(' Plateforme : webhooks, standard, prise en main, files');
  const s = new Stockage(null);
  let horloge = mardi1030;
  const secret = 'secret-admin-du-banc-voix-assez-long';
  const { serveur } = creerPlateforme({ secretAdmin: secret, fichierDonnees: null }, { stockage: s, maintenant: () => horloge });
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  const reponses: string[] = [];
  const lire = async (r: Response) => { const t = await r.text(); reponses.push(t); try { return { statut: r.status, type: r.headers.get('content-type') ?? '', corps: JSON.parse(t), texte: t }; } catch { return { statut: r.status, type: r.headers.get('content-type') ?? '', corps: null as any, texte: t }; } };
  const admin = async (methode: string, chemin: string, corps?: unknown) =>
    lire(await fetch(`${base}${chemin}`, { method: methode, headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: corps === undefined ? undefined : JSON.stringify(corps) }));
  const boxes = ['t1', 't2'].map((tenant, i) => {
    const k = generateKeyPairSync('ed25519');
    const b: Box = { device_id: `BOX-V${i}`, tenant_id: tenant, serial: `SN${i}`, gamme: 'business', os: 'ubuntu-core', identite_publique: k.publicKey.export({ type: 'spki', format: 'pem' }).toString(), version_desktop: '0.2.1', statut: 'active', plan_id: null, sante: null, garantie_jusqu_au: null };
    s.poser('boxes', b.device_id, b);
    return { b, k };
  });
  const box = async (i: number, methode: string, chemin: string, corps?: unknown) => {
    const brut = corps === undefined ? '' : JSON.stringify(corps);
    const h = horloge.toISOString();
    const sig = sign(null, Buffer.from(messageASigner(methode, chemin.split('?')[0], h, brut)), boxes[i].k.privateKey).toString('base64');
    return lire(await fetch(`${base}${chemin}`, { method: methode, body: brut || undefined, headers: { 'x-box-id': boxes[i].b.device_id, 'x-horodatage': h, 'x-signature': sig } }));
  };
  const telnyxEntrant = async (type: string, id: string, de: string, vers: string, o: { signer?: boolean; decaler?: number; alterer?: boolean } = {}) => {
    const brut = JSON.stringify({ data: { record_type: 'event', event_type: type, id: `ev-${id}-${type}`, occurred_at: horloge.toISOString(), payload: { call_control_id: id, from: de, to: vers, direction: 'incoming', state: 'parked' } }, meta: { attempt: 1 } });
    const ts = String(Math.floor(horloge.getTime() / 1000) + (o.decaler ?? 0));
    const sig = sign(null, Buffer.from(`${ts}|${brut}`), telnyxCles.privateKey).toString('base64');
    const entetes: Record<string, string> = { 'content-type': 'application/json', 'telnyx-timestamp': ts };
    if (o.signer !== false) entetes['telnyx-signature-ed25519'] = sig;
    return lire(await fetch(`${base}/voix/fournisseurs/telnyx/entrant`, { method: 'POST', headers: entetes, body: o.alterer ? brut.replace('incoming', 'incominG') : brut }));
  };
  const twilioEntrant = async (statut: string, sid: string, de: string, vers: string, o: { faux?: boolean } = {}) => {
    const params: [string, string][] = [['CallSid', sid], ['From', de], ['To', vers], ['CallStatus', statut], ['Direction', 'inbound'], ['AccountSid', 'ACbanc']];
    const sig = signatureTwilio(o.faux ? 'autre-jeton' : env.TWILIO_AUTH_TOKEN, `${env.VOIX_URL_PUBLIQUE}/voix/fournisseurs/twilio/entrant`, params);
    return lire(await fetch(`${base}/voix/fournisseurs/twilio/entrant`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': sig }, body: new URLSearchParams(params).toString() }));
  };

  verifier('profil vocal accepté', (await admin('PUT', '/voix/profils/vp-lea', profil)).statut === 200);
  verifier('profil citant un moteur inconnu refusé', (await admin('PUT', '/voix/profils/x', { ...profil, voix_par_moteur: { openai: 'alloy' } })).statut === 400);
  const sess = await box(0, 'GET', '/voix/box/session?persona=P-LEA&mode=quality_first&canal=telephone');
  verifier('session de la Box : moteur, voix de la persona et motif', sess.statut === 200 && sess.corps.moteur === 'elevenlabs' && sess.corps.voix === profil.voix_par_moteur.elevenlabs && sess.corps.motif.length > 0, sess.texte);
  verifier('file d’attente acceptée', (await admin('PUT', '/voix/files/F1', { ...F, capacite: 1 })).statut === 200);
  verifier('standard accepté', (await admin('PUT', '/voix/standards/S1', std)).statut === 200);
  verifier('standard incohérent refusé (extension d’accueil absente)', (await admin('PUT', '/voix/standards/S9', { ...std, extension_accueil: '999' })).statut === 400);
  verifier('numéro mal écrit refusé', (await admin('POST', '/voix/numeros', { tenant_id: 't1', provider: 'telnyx', e164: '01 86 00 00 01' })).statut === 400);
  verifier('numéro sans e164 : la plateforme n’en achète pas, elle le dit', (await admin('POST', '/voix/numeros', { tenant_id: 't1', provider: 'telnyx' })).corps?.erreur?.includes('n’achète pas'));
  verifier('numéro Telnyx déclaré', (await admin('POST', '/voix/numeros', { tenant_id: 't1', provider: 'telnyx', e164: '+33 1 86 00 00 01', routage_id: 'S1' })).statut === 201);
  verifier('numéro Twilio déclaré', (await admin('POST', '/voix/numeros', { tenant_id: 't1', provider: 'twilio', e164: '+33186000002', routage_id: 'S1' })).statut === 201);

  // Signatures
  verifier('Telnyx non signé : refusé', (await telnyxEntrant('call.initiated', 'A', '+33155555555', '+33186000001', { signer: false })).statut === 401);
  verifier('Telnyx corps modifié : refusé', (await telnyxEntrant('call.initiated', 'A', '+33155555555', '+33186000001', { alterer: true })).statut === 401);
  verifier('Telnyx horodatage de 10 min : refusé (rejeu)', (await telnyxEntrant('call.initiated', 'A', '+33155555555', '+33186000001', { decaler: -600 })).statut === 401);
  configurerVoix({ env: { ...env, TELNYX_CLE_PUBLIQUE: '' } });
  const sansCle = await telnyxEntrant('call.initiated', 'A', '+33155555555', '+33186000001');
  verifier('Telnyx sans clé publique posée : refus qui nomme la variable', sansCle.statut === 401 && sansCle.corps.erreur.includes('TELNYX_CLE_PUBLIQUE'));
  configurerVoix({ env: { ...env, TWILIO_AUTH_TOKEN: '' } });
  verifier('Twilio sans jeton posé : refusé', (await twilioEntrant('ringing', 'CA1', '+33144444444', '+33186000002')).statut === 401);
  configurerVoix({ env });
  verifier('Twilio mauvaise signature : refusé', (await twilioEntrant('ringing', 'CA1', '+33144444444', '+33186000002', { faux: true })).statut === 401);
  const brutSip = JSON.stringify({ type: 'appel-entrant', id: 'sip-x', de: '+33100000000', vers: '+33199999999' });
  const hSip = horloge.toISOString();
  const sipOk = await lire(await fetch(`${base}/voix/fournisseurs/sip/entrant`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-iagent-horodatage': hSip, 'x-iagent-signature': signatureSip(env.SIP_SECRET_WEBHOOK, hSip, brutSip) }, body: brutSip }));
  verifier('SIP signé : accepté (puis refusé faute de numéro rattaché)', sipOk.statut === 404 && sipOk.corps.erreur.includes('+33199999999'));
  const sipKo = await lire(await fetch(`${base}/voix/fournisseurs/sip/entrant`, { method: 'POST', headers: { 'x-iagent-horodatage': hSip, 'x-iagent-signature': 'sha256=00' }, body: brutSip }));
  verifier('SIP mal signé : refusé', sipKo.statut === 401);

  // Call A (Telnyx): no media bridge -> handoff to Max
  const nOp = () => op.recus.length;
  const avantA = nOp();
  verifier('appel A Telnyx signé : accepté', (await telnyxEntrant('call.initiated', 'A', '+33155555555', '+33186000001')).statut === 200);
  const decrocheA = op.recus.slice(avantA).find((r) => r.chemin === '/v2/calls/A/actions/answer');
  verifier('appel A : décroché par une vraie commande HTTP Bearer chez l’opérateur', decrocheA?.entetes.authorization === 'Bearer cle-telnyx-banc');
  verifier('rejeu du même webhook : pas de second appel', (await telnyxEntrant('call.initiated', 'A', '+33155555555', '+33186000001')).statut === 200 && s.lister('voix_appels').length === 1);
  let ho1 = await box(0, 'GET', '/voix/box/handoffs');
  const hA = ho1.corps.handoffs?.[0];
  verifier('la Box voit la prise en main en attente, avec appelant et motif', hA?.appelant === '+33155555555' && typeof hA.motif === 'string' && hA.appel_id);
  verifier('une autre Box ne la voit pas', (await box(1, 'GET', '/voix/box/handoffs')).corps.handoffs.length === 0);

  // Call B (Twilio) while A holds the only place -> queue, TwiML
  const b1 = await twilioEntrant('ringing', 'CA1', '+33144444444', '+33186000002');
  verifier('appel B Twilio : réponse TwiML (text/xml) qui fait patienter', b1.statut === 200 && b1.type.startsWith('text/xml') && b1.texte.includes('<Say language="fr-FR">') && b1.texte.includes('<Pause'), b1.texte);
  // Call C (Telnyx): queue full (capacity 1) -> overflow to voicemail
  await telnyxEntrant('call.initiated', 'C', '+33133333333', '+33186000001');
  const appelC = s.lister<AppelVoix>('voix_appels', (a) => a.id_operateur === 'C')[0];
  verifier('appel C : file pleine, débordement vers la messagerie', (appelC?.etat as EtatAppel)?.etape === 'messagerie', JSON.stringify(appelC?.etat));
  const sup = await admin('GET', '/voix/appels?tenant_id=t1');
  verifier('supervision : appels en cours et contenu des files', sup.corps.en_cours.length === 3 && sup.corps.files[0].en_attente.length === 1);

  // Decisions
  const ref = await box(1, 'POST', `/voix/box/handoffs/${hA?.appel_id ?? "absent"}`, { decision: 'prendre' });
  verifier('une Box ne décide pas pour un autre client', ref.statut === 404);
  verifier('décision inconnue refusée', (await box(0, 'POST', `/voix/box/handoffs/${hA?.appel_id ?? "absent"}`, { decision: 'peut-etre' })).statut === 400);
  const avantPrendre = nOp();
  const pr = await box(0, 'POST', `/voix/box/handoffs/${hA?.appel_id ?? "absent"}`, { decision: 'prendre' });
  const transfert = op.recus.slice(avantPrendre).find((r) => r.chemin === '/v2/calls/A/actions/transfer');
  verifier('Prendre : transfert réel vers le mobile de Max', pr.statut === 200 && transfert !== undefined && JSON.parse(transfert.corps).to === '+33612345678', pr.texte);
  verifier('déjà décidé : 409', (await box(0, 'POST', `/voix/box/handoffs/${hA?.appel_id ?? "absent"}`, { decision: 'refuser' })).statut === 409);
  ho1 = await box(0, 'GET', '/voix/box/handoffs');
  const hB = ho1.corps.handoffs.find((h: { appelant: string }) => h.appelant === '+33144444444');
  verifier('la place libérée sert l’appel B qui attendait (file → prise en main)', hB !== undefined, ho1.texte);
  const avantRap = nOp();
  const rp = await box(0, 'POST', `/voix/box/handoffs/${hB?.appel_id ?? "absent"}`, { decision: 'rappeler' });
  const raccrocheB = op.recus.slice(avantRap).find((r) => r.chemin === '/2010-04-01/Accounts/ACbanc/Calls/CA1.json');
  verifier('Rappeler : Twilio raccroche par commande réelle (Basic, Status=completed)', rp.statut === 200 && raccrocheB?.corps === 'Status=completed' && raccrocheB.entetes.authorization === `Basic ${Buffer.from('ACbanc:jeton-twilio-banc').toString('base64')}`);
  verifier('le rappel est inscrit', s.lister('voix_rappels').length === 1);

  horloge = new Date(mardi1030.getTime() + 180_000);
  await telnyxEntrant('call.hangup', 'A', '+33155555555', '+33186000001');
  await twilioEntrant('completed', 'CA1', '+33144444444', '+33186000002');
  const appels = (await box(0, 'GET', '/voix/box/appels')).corps.appels as AppelVoix[];
  const A = appels.find((a) => a.id_operateur === undefined && a.appelant === '+33155555555');
  const B = appels.find((a) => a.appelant === '+33144444444');
  verifier('historique : A transféré à un humain, coût inconnu (Telnyx non relevé) et dit', A?.issue === 'transfere-humain' && A.cout === null && A.cout_manquants.length > 0, JSON.stringify(A));
  verifier('historique : B rappel, 3 min Twilio = 0,03 $', B?.issue === 'rappel' && B.cout?.total === 0.03, JSON.stringify(B?.cout));
  const conso = await box(0, 'GET', '/voix/box/consommation');
  verifier('consommation du mois : minutes, coûts, appels sans coût et pourquoi', conso.corps.mois === '2026-10' && conso.corps.minutes_entrantes === 6 && conso.corps.cout.total === 0.03 && conso.corps.appels_sans_cout === 1 && conso.corps.manquants.length > 0, conso.texte);
  verifier('consommation d’un autre client : vide', (await box(1, 'GET', '/voix/box/consommation')).corps.appels === 0);

  // -------------------------------------------------------------------------
  console.log(' Critère d’acceptation : même logique, deux moteurs');
  configurerVoix({ pont_media: true });
  await admin('PUT', '/voix/standards/S2', { ...std, id: 'S2', plafond_sessions: 10, file_id: null });
  await admin('POST', '/voix/numeros', { tenant_id: 't1', provider: 'telnyx', e164: '+33186000003', routage_id: 'S2' });
  const parcours: Record<string, { evenements: string[]; etape: string; handoff: string | undefined }> = {};
  for (const moteur of ['gemini', 'mistral'] as const) {
    const id = `M-${moteur}`;
    await telnyxEntrant('call.initiated', id, '+33122222222', '+33186000003');
    const appel = s.lister<AppelVoix>('voix_appels', (a) => a.id_operateur === id)[0];
    verifier(`${moteur} : l’agent d’accueil a l’appel (pont média branché)`, (appel?.etat as EtatAppel)?.etape === 'conversation');
    const session = await fournisseur(moteur, deps).startSession({ ...ouverture, voix: profil.voix_par_moteur[moteur]! });
    const r = await conduireAppel(session, (ev) => appliquerEvenement(s, 't1', appel.id, ev, horloge).then((x) => x!.t), [Buffer.alloc(3200), Buffer.alloc(3200)]);
    const m = await session.closeSession();
    const h = s.pourTenant('t1').lire<{ motif: string; tenant_id: string }>('voix_handoffs', appel.id);
    parcours[moteur] = { evenements: r.evenements, etape: r.etape, handoff: h?.motif };
    verifier(`${moteur} : métriques de fin de session`, m.moteur === moteur && m.appels_outils === 2 && m.secondes_audio_entree > 0);
  }
  verifier('Gemini Live et Mistral : mêmes transitions, même état final', JSON.stringify(parcours.gemini) === JSON.stringify(parcours.mistral) && parcours.gemini.evenements.join(',') === 'transferer_agent->conversation,demander_humain->handoff' && parcours.gemini.handoff === 'litige sur une facture', JSON.stringify(parcours));
  const setup = gem.recus.messages.find((x) => x.setup) as any;
  verifier('Gemini : setup au format relevé (modèle, voix de la persona, outils)', setup?.setup.model === 'models/gemini-3.8-live' && setup.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Kore' && setup.setup.tools[0].functionDeclarations.length === OUTILS_STANDARD.length);
  verifier('Gemini : clé dans l’adresse, audio PCM 16 kHz, réponse d’outil par identifiant', gem.recus.url.includes('key=cle-gemini-banc')
    && gem.recus.messages.some((x: any) => x.realtimeInput?.audio?.mimeType === 'audio/pcm;rate=16000')
    && gem.recus.messages.some((x: any) => x.toolResponse?.functionResponses?.[0]?.id === 'g1'));
  const ttsM = mot.recus.find((r) => r.chemin === '/v1/audio/speech');
  const sttM = mot.recus.find((r) => r.chemin === '/v1/audio/transcriptions');
  verifier('Mistral : Bearer, modèles relevés, WAV demandé', ttsM?.entetes.authorization === 'Bearer cle-mistral-banc' && JSON.parse(ttsM.corps).response_format === 'wav' && JSON.parse(ttsM.corps).voice_id === 'fr_marie_neutral' && !!sttM?.corps.includes('voxtral-mini-latest'));
  configurerVoix({ pont_media: false });

  // -------------------------------------------------------------------------
  console.log(' Campagnes sortantes par la plateforme');
  for (let i = 0; i < 4; i++) {
    s.pourTenant('t1').poser('voix_appels', `ancien-${i}`, { id: `ancien-${i}`, tenant_id: 't1', direction: 'sortant', appelant: '+33186000001', appele: '+33612000007', debut: new Date(mardi1030.getTime() - (i + 1) * 86_400_000).toISOString(), duree_s: 30, provider: 'telnyx', etat: { etape: 'termine' }, journal: [], cout_manquants: [], fin: mardi1030.toISOString() } as unknown as AppelVoix);
  }
  const contacts: ContactCampagne[] = [
    { e164: '+33612000001', nom: 'Ok', consentement: { source: 'formulaire', date: '2026-09-12T10:00:00Z' } },
    { e164: '+33612000002', nom: 'Ok enregistré', consentement: { source: 'formulaire', date: '2026-09-12T10:00:00Z' }, consentement_enregistrement: true },
    { e164: '+33612000003', nom: 'Sans', consentement: null },
    { e164: '+33612000004', nom: 'Expiré', consentement: { source: 'salon', date: '2025-06-01T10:00:00Z' } },
    { e164: '+33612000005', nom: 'Bloctel', consentement: { source: 'formulaire', date: '2026-09-12T10:00:00Z' } },
    { e164: '+33612000006', nom: 'Retiré', consentement: { source: 'formulaire', date: '2026-09-12T10:00:00Z', retire_le: '2026-10-01T00:00:00Z' } },
    { e164: '+33612000007', nom: 'Trop appelé', consentement: { source: 'formulaire', date: '2026-09-12T10:00:00Z' } },
  ];
  verifier('campagne sans source de consentement refusée', (await admin('POST', '/voix/campagnes', { tenant_id: 't1', pays: 'FR', provider: 'telnyx', numero_appelant: '+33186000001', contacts })).statut === 400);
  verifier('campagne vers un pays sans règles refusée', (await admin('POST', '/voix/campagnes', { tenant_id: 't1', pays: 'US', provider: 'telnyx', numero_appelant: '+33186000001', contacts, source_consentement: 'x' })).statut === 400);
  const cree = await admin('POST', '/voix/campagnes', { tenant_id: 't1', pays: 'FR', provider: 'telnyx', numero_appelant: '+33186000001', contacts, source_consentement: 'formulaire du site, case non cochée par défaut', enregistrement: true, fenetres: [], opposition: [{ e164: '+33 6 12 00 00 05', liste: 'bloctel' }] });
  verifier('campagne créée', cree.statut === 201, cree.texte);
  horloge = new Date('2026-10-11T08:30:00Z'); // Sunday
  const dim = await admin('POST', `/voix/campagnes/${cree.corps.id}/lancer`);
  verifier('lancée un dimanche : tout refusé, rien ne part', dim.corps.resultats.every((r: { statut: string }) => r.statut === 'refuse') && !op.recus.some((r) => r.chemin === '/v2/calls'));
  horloge = mardi1030;
  const avantCamp = nOp();
  const lan = await admin('POST', `/voix/campagnes/${cree.corps.id}/lancer`);
  const res = Object.fromEntries((lan.corps.resultats as { e164: string; statut: string; motif: string }[]).map((r) => [r.e164, r]));
  verifier('les deux contacts consentants sont appelés', res['+33612000001'].statut === 'appele' && res['+33612000002'].statut === 'appele');
  verifier('sans consentement, expiré, Bloctel, retiré, trop appelé : refusés avec motif', ['+33612000003', '+33612000004', '+33612000005', '+33612000006', '+33612000007'].every((n) => res[n].statut === 'refuse' && res[n].motif.length > 10), lan.texte);
  const dials = op.recus.slice(avantCamp).filter((r) => r.chemin === '/v2/calls');
  verifier('l’opérateur reçoit exactement deux appels réels, au format relevé', dials.length === 2 && dials.every((r) => JSON.parse(r.corps).connection_id === 'conn-banc' && JSON.parse(r.corps).from === '+33186000001'));
  const sortants = s.lister<AppelVoix>('voix_appels', (a) => a.direction === 'sortant' && !a.id.startsWith('ancien'));
  verifier('enregistrement seulement pour le contact qui y a consenti', sortants.find((a) => a.appele === '+33612000002')?.enregistre === true && sortants.find((a) => a.appele === '+33612000001')?.enregistre === false);
  configurerVoix({ env: { ...env, TELNYX_API_KEY: '' } });
  const sansOp = await admin('POST', `/voix/campagnes/${cree.corps.id}/lancer`);
  verifier('sans clé d’opérateur : échec qui nomme la variable, aucun appel', sansOp.corps.resultats.find((r: { e164: string }) => r.e164 === '+33612000001').motif.includes('TELNYX_API_KEY'));
  configurerVoix({ env });

  // -------------------------------------------------------------------------
  const secrets = Object.entries(env).filter(([k]) => /KEY|TOKEN|SECRET|JETON/.test(k)).map(([, v]) => v);
  verifier('aucune réponse de la plateforme ne contient un secret', !reponses.some((r) => secrets.some((x) => x && r.includes(x))));

  serveur.close(); gem.serveur.close(); mot.serveur.close(); op.serveur.close();
  rmSync(outils, { recursive: true, force: true });
  configurerVoix({ env: process.env, pont_media: false });
  return fautes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = await lancer();
  console.log(f ? `\n${f} faute(s).` : '\nVoix : tout passe.');
  process.exit(f ? 1 : 0);
}
