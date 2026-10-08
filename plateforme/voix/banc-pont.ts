// Bench of the media bridge (`pont.ts`, `audio.ts`, `../ws.ts`). Pure parts first
// (μ-law, rates, turn detection, the RFC 6455 handshake and refusals on a raw
// socket), then two real calls through the platform server: Twilio with Gemini
// Live (a transfer to a colleague, a human asked for, barge-in) and Telnyx with
// Mistral (greeting, a question, the call closed by the agent). The operator's
// side is Node's own WebSocket client — an implementation we did not write.
import { connect } from 'node:net';
import { decoderUlaw, DetecteurTours, encoderUlaw, energie, pcmVersUlaw, reechantillonner, ulawVersPcm } from './audio.ts';
import { ecouter, fauxGemini, fauxMoteurs, type Recu } from './banc-faux.ts';
import type { Bases } from './fournisseurs-voix.ts';
import { ponts } from './pont.ts';
import { configurerVoix, pontIndisponible } from './routes.ts';
import type { Stockage } from '../stockage.ts';
import { cleAcceptation } from '../ws.ts';
import type { AppelVoix, Standard } from './types.ts';

type R = { statut: number; corps: any; texte: string; type: string };
export type ContextePont = {
  verifier: (quoi: string, vrai: boolean, detail?: string) => void;
  base: string;
  s: Stockage;
  env: Record<string, string>;
  basesVoix: Bases;
  admin: (methode: string, chemin: string, corps?: unknown) => Promise<R>;
  box: (i: number, methode: string, chemin: string, corps?: unknown) => Promise<R>;
  twilioEntrant: (statut: string, sid: string, de: string, vers: string) => Promise<R>;
  telnyxEntrant: (type: string, id: string, de: string, vers: string) => Promise<R>;
  operateur: Recu[];
  std: Standard;
  horloge: { lire: () => Date; poser: (d: Date) => void };
};

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function attendre(condition: () => boolean, ms = 4000): Promise<boolean> {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (condition()) return true; await pause(10); }
  return condition();
}

/** 20 ms μ-law frames of a voiced sound (a 400 Hz tone) or of line silence. */
function trames(ms: number, voix: boolean): Buffer[] {
  const out: Buffer[] = [];
  for (let f = 0; f < ms / 20; f++) {
    const b = Buffer.alloc(160);
    for (let i = 0; i < 160; i++) b[i] = voix ? encoderUlaw(6000 * Math.sin((2 * Math.PI * 400 * (f * 160 + i)) / 8000)) : 0xff;
    out.push(b);
  }
  return out;
}

/** The operator's end of the stream, through Node's WebSocket client. */
async function ligne(url: string, o: { retenirMarques?: boolean } = {}) {
  const recus: Record<string, any>[] = [];
  const ws = new WebSocket(url);
  const etat = { ouvert: false, ferme: false, code: 0, retenir: o.retenirMarques ?? false };
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    recus.push(m);
    if (m.event === 'mark' && !etat.retenir) ws.send(JSON.stringify({ event: 'mark', streamSid: m.streamSid, stream_id: m.stream_id, mark: m.mark }));
  };
  ws.onclose = (e) => { etat.ferme = true; etat.code = e.code; };
  ws.onerror = () => {};
  await new Promise<void>((r) => { ws.onopen = () => { etat.ouvert = true; r(); }; setTimeout(r, 2000); });
  return {
    ws, recus, etat,
    envoyer: (m: unknown) => ws.send(JSON.stringify(m)),
    parler: async (media: (b: Buffer) => unknown, ms: number) => {
      for (const t of [...trames(ms, true), ...trames(900, false)]) ws.send(JSON.stringify(media(t)));
    },
    rendreMarques: () => {
      etat.retenir = false;
      for (const m of recus.filter((x) => x.event === 'mark')) ws.send(JSON.stringify({ event: 'mark', streamSid: m.streamSid, stream_id: m.stream_id, mark: m.mark }));
    },
  };
}

/** Raw socket: handshake, then one frame of our own making; returns what the server sent back. */
function brut(port: number, chemin: string, trame: Buffer | null, entetes = ''): Promise<Buffer> {
  return new Promise((res) => {
    const c = connect(port, '127.0.0.1');
    const morceaux: Buffer[] = [];
    let envoye = false;
    c.on('data', (d: Buffer) => {
      morceaux.push(d);
      if (!envoye && trame && Buffer.concat(morceaux).includes('\r\n\r\n')) { envoye = true; c.write(trame); }
    });
    c.on('close', () => res(Buffer.concat(morceaux)));
    c.on('error', () => res(Buffer.concat(morceaux)));
    c.write(`GET ${chemin} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n${entetes}\r\n`);
    setTimeout(() => c.destroy(), 1500);
  });
}

export async function lancerPont(x: ContextePont): Promise<void> {
  const { verifier, s } = x;

  // -------------------------------------------------------------------------
  console.log(' Pont média : son de la ligne');
  const mauvais = [...Array(256).keys()].filter((c) => encoderUlaw(decoderUlaw(c)) !== c);
  verifier('μ-law : 255 codes sur 256 reviennent identiques, le « zéro négatif » 0x7F devient 0xFF', mauvais.length === 1 && mauvais[0] === 0x7f && encoderUlaw(decoderUlaw(0x7f)) === 0xff, JSON.stringify(mauvais));
  verifier('μ-law : extrêmes de la table G.711 (±32124)', decoderUlaw(0x00) === -32124 && decoderUlaw(0x80) === 32124);
  const sinus = Buffer.alloc(4800);
  for (let i = 0; i < 2400; i++) sinus.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 300 * i) / 24000)), i * 2);
  const descendu = reechantillonner(sinus, 24000, 8000);
  verifier('24 kHz → 8 kHz : un tiers des échantillons, même énergie à 5 % près', descendu.length === 1600 && Math.abs(energie(descendu) / energie(sinus) - 1) < 0.05, `${descendu.length} ${energie(descendu)} ${energie(sinus)}`);
  verifier('8 kHz → 16 kHz : deux fois plus d’échantillons', reechantillonner(Buffer.alloc(320), 8000, 16000).length === 640);
  const allerRetour = ulawVersPcm(pcmVersUlaw(descendu));
  verifier('μ-law aller-retour : le son reste reconnaissable (énergie à 5 % près)', Math.abs(energie(allerRetour) / energie(descendu) - 1) < 0.05);

  const pcm = (t: Buffer[]) => ulawVersPcm(Buffer.concat(t));
  const d1 = new DetecteurTours(8000);
  const types = [...d1.pousser(pcm(trames(500, false))), ...d1.pousser(pcm(trames(800, true))), ...d1.pousser(pcm(trames(800, false)))].map((o) => o.type);
  verifier('tours : silence, parole, silence = un début, du son, une fin', types[0] === 'debut' && types[types.length - 1] === 'fin' && types.filter((t) => t === 'debut').length === 1 && types.filter((t) => t === 'fin').length === 1, types.join(','));
  const d2 = new DetecteurTours(8000);
  verifier('tours : le silence de la ligne ne coûte rien (rien n’est transmis)', d2.pousser(pcm(trames(2000, false))).length === 0);
  const d3 = new DetecteurTours(8000);
  verifier('tours : un claquement de 100 ms n’est pas un tour', [...d3.pousser(pcm(trames(100, true))), ...d3.pousser(pcm(trames(1000, false)))].length === 0);
  const d4 = new DetecteurTours(8000);
  const premier = d4.pousser(pcm([...trames(400, false), ...trames(400, true)]));
  const preroll = premier.find((o) => o.type === 'son');
  verifier('tours : le début du mot n’est pas coupé (le son d’avant la détection part aussi)', preroll?.type === 'son' && preroll.pcm.length >= 0.4 * 8000 * 2 * 0.9, String(preroll?.type === 'son' ? preroll.pcm.length : 0));
  const d5 = new DetecteurTours(8000, { seuil_min: 600, facteur_bruit: 3, parole_min_ms: 200, silence_fin_ms: 700, avant_ms: 200, tour_max_ms: 2000 });
  verifier('tours : un tour sans fin est clos au plafond', d5.pousser(pcm(trames(3000, true))).some((o) => o.type === 'fin'));

  // -------------------------------------------------------------------------
  console.log(' Pont média : WebSocket du serveur');
  verifier('poignée de main : l’exemple de la RFC 6455 §1.3', cleAcceptation('dGhlIHNhbXBsZSBub25jZQ==') === 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  const port = Number(new URL(x.base).port);
  const inconnu = (await brut(port, '/voix/flux/twilio/jeton-invente', null)).toString('utf8');
  verifier('jeton inventé : refusé avant toute ouverture (401)', inconnu.startsWith('HTTP/1.1 401') && !inconnu.includes('101'), inconnu.slice(0, 40));
  verifier('adresse inconnue : 404', (await brut(port, '/ailleurs', null)).toString('utf8').startsWith('HTTP/1.1 404'));

  // -------------------------------------------------------------------------
  console.log(' Pont média : un appel Twilio tenu par Gemini Live');
  const gem = fauxGemini(['Bonjour, je voudrais la comptabilité.', 'Je veux parler à quelqu’un, c’est un litige.'], x.env.GEMINI_API_KEY);
  const mot = fauxMoteurs(['Quels sont vos horaires ?', 'Merci, au revoir.']);
  const baseGem = (await ecouter(gem.serveur)).replace('http', 'ws');
  const baseMot = await ecouter(mot.serveur);
  configurerVoix({ pont_media: true, basesVoix: { gemini: baseGem, elevenlabs: baseMot, mistral: baseMot, anthropic: baseMot } });
  verifier('opérateur sans flux (SIP) : le pont se dit indisponible et dit pourquoi', pontIndisponible('sip')?.includes('n’envoie pas le son') === true);
  await x.admin('PUT', '/voix/profils/vp-gemini', { id: 'vp-gemini', persona_id: null, locale: 'fr-FR', palier: 'standard', voix_par_moteur: { gemini: 'Kore' }, ordre_de_repli: ['gemini'] });
  await x.admin('PUT', '/voix/profils/vp-mistral', { id: 'vp-mistral', persona_id: null, locale: 'fr-FR', palier: 'standard', voix_par_moteur: { mistral: 'fr_marie_neutral' }, ordre_de_repli: ['mistral'] });
  const ext = (profil: string) => x.std.extensions.map((e) => ({ ...e, profil_voix: profil }));
  verifier('standard au téléphone par Gemini accepté', (await x.admin('PUT', '/voix/standards/S-PONT-G', { ...x.std, id: 'S-PONT-G', file_id: null, plafond_sessions: 10, extensions: ext('vp-gemini') })).statut === 200);
  await x.admin('PUT', '/voix/standards/S-PONT-M', { ...x.std, id: 'S-PONT-M', file_id: null, plafond_sessions: 10, extensions: ext('vp-mistral') });
  await x.admin('POST', '/voix/numeros', { tenant_id: 't1', provider: 'twilio', e164: '+33186000010', routage_id: 'S-PONT-G' });
  await x.admin('POST', '/voix/numeros', { tenant_id: 't1', provider: 'telnyx', e164: '+33186000011', routage_id: 'S-PONT-M' });

  const tw = await x.twilioEntrant('ringing', 'CA-PONT', '+33133333333', '+33186000010');
  const flux = /<Connect><Stream url="(wss:\/\/voix\.iagent\.example\/voix\/flux\/twilio\/([A-Za-z0-9_-]{20,}))"\/><\/Connect>/.exec(tw.texte);
  verifier('Twilio : l’accueil est dit, puis le son est demandé par <Connect><Stream>', tw.texte.includes(`<Say language="fr-FR">${x.std.accueil}</Say><Connect><Stream`) && !!flux, tw.texte);
  verifier('l’adresse du flux ne porte pas de paramètres (Twilio les refuse)', !!flux && !flux[1].includes('?'));
  const appelT = () => s.lister<AppelVoix>('voix_appels', (a) => a.id_operateur === 'CA-PONT')[0];
  verifier('seule l’empreinte du jeton est gardée', !!flux && !JSON.stringify(s.lister('voix_flux')).includes(flux[2]) && !JSON.stringify(appelT()).includes(flux[2]));
  const urlLocale = (jeton: string, op: string) => `${x.base.replace('http', 'ws')}/voix/flux/${op}/${jeton}`;

  const t = await ligne(urlLocale(flux![2], 'twilio'));
  verifier('Twilio : la ligne s’ouvre avec le jeton émis', t.etat.ouvert);
  const deuxieme = (await brut(port, `/voix/flux/twilio/${flux![2]}`, null)).toString('utf8');
  verifier('le même jeton ne sert pas deux fois', deuxieme.startsWith('HTTP/1.1 401') && deuxieme.includes('déjà servi'), deuxieme.slice(0, 80));
  const mediaT = (b: Buffer) => ({ event: 'media', streamSid: 'MZ-PONT', sequenceNumber: '3', media: { track: 'inbound', chunk: '1', timestamp: '20', payload: b.toString('base64') } });
  t.envoyer({ event: 'connected', protocol: 'Call', version: '1.0.0' });
  t.envoyer({ event: 'start', sequenceNumber: '1', streamSid: 'MZ-PONT', start: { accountSid: 'ACbanc', streamSid: 'MZ-PONT', callSid: 'CA-PONT', tracks: ['inbound'], mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 }, customParameters: {} } });
  verifier('Gemini : la session de Léa s’ouvre sur la ligne', await attendre(() => gem.recus.messages.some((m) => (m as any).setup)));
  const setup = gem.recus.messages.find((m) => (m as any).setup) as any;
  verifier('Gemini : voix du profil, outils du standard, consigne du téléphone', setup?.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Kore' && setup.setup.tools[0].functionDeclarations.some((f: any) => f.name === 'transferer_vers') && setup.setup.systemInstruction.parts[0].text.includes('a_dire'));

  await t.parler(mediaT, 800);
  verifier('Gemini : le son arrive en PCM 16 kHz, et le tour se clôt', await attendre(() => gem.recus.messages.some((m) => (m as any).realtimeInput?.audioStreamEnd)) && gem.recus.messages.some((m) => (m as any).realtimeInput?.audio?.mimeType === 'audio/pcm;rate=16000'));
  verifier('transfert : Marc (comptabilité) prend la ligne après la phrase de Léa', await attendre(() => gem.recus.connexions === 2 && ponts.get(appelT().id) !== undefined && (appelT().etat as any).extension === '200'), `${gem.recus.connexions} ${JSON.stringify(appelT().etat)}`);
  const reponseOutil = gem.recus.messages.find((m) => (m as any).toolResponse) as any;
  verifier('la phrase du standard revient dans la réponse de l’outil (a_dire)', String(reponseOutil?.toolResponse.functionResponses[0].response.resultat.a_dire ?? '').includes('Je vous passe Marc'), JSON.stringify(reponseOutil));
  verifier('Marc se présente en prenant la ligne', await attendre(() => gem.recus.messages.some((m) => String((m as any).clientContent?.turns?.[0]?.parts?.[0]?.text ?? '').includes('Marc, comptabilite, je vous écoute.'))));
  const sons = () => t.recus.filter((m) => m.event === 'media');
  verifier('la voix de l’agent revient en μ-law 8 kHz, chaque trame avec son streamSid', await attendre(() => sons().length > 0) && sons().every((m) => m.streamSid === 'MZ-PONT' && typeof m.media.payload === 'string'));
  verifier('100 ms de voix à 24 kHz font 800 octets μ-law sur la ligne', await attendre(() => sons().reduce((n, m) => n + Buffer.from(m.media.payload, 'base64').length, 0) >= 1600));
  verifier('une marque suit chaque réponse de l’agent', t.recus.some((m) => m.event === 'mark' && /^fin-\d+$/.test(m.mark.name) && m.streamSid === 'MZ-PONT'));

  await pause(300);
  await t.parler(mediaT, 800);
  verifier('Marc demande un humain : l’appel passe en prise en main, Max est prévenu', await attendre(() => (appelT().etat as any).etape === 'handoff' && !!s.pourTenant('t1').lire('voix_handoffs', appelT().id)), JSON.stringify(appelT().etat));
  verifier('le motif de Marc suit la demande', (s.pourTenant('t1').lire<{ motif: string; tenant_id: string | null }>('voix_handoffs', appelT().id))?.motif === 'litige sur une facture');
  verifier('l’agent de l’appel est Marc', appelT().agent_instance_id === 'AI-MARC');
  await pause(300);
  const avantAttente = gem.recus.messages.filter((m) => (m as any).realtimeInput?.audio).length;
  await t.parler(mediaT, 600);
  await pause(200);
  verifier('en attente d’un humain, l’agent n’écoute plus l’appelant', gem.recus.messages.filter((m) => (m as any).realtimeInput?.audio).length === avantAttente);

  t.etat.retenir = true;
  const decision = await x.box(0, 'POST', `/voix/box/handoffs/${appelT().id}`, { decision: 'laisser' });
  verifier('l’humain laisse l’agent continuer', decision.statut === 200 && decision.corps.etat.etape === 'conversation', decision.texte);
  verifier('la phrase du standard est dite par l’agent en ligne', await attendre(() => gem.recus.messages.some((m) => String((m as any).clientContent?.turns?.[0]?.parts?.[0]?.text ?? '').includes('Je continue avec vous.'))));
  const nSons = sons().length;
  await attendre(() => sons().length > nSons);
  const avantCoupure = t.recus.filter((m) => m.event === 'clear').length;
  await t.parler(mediaT, 400);
  verifier('l’appelant parle par-dessus l’agent : sa voix est coupée sur la ligne (clear)', await attendre(() => t.recus.filter((m) => m.event === 'clear').length > avantCoupure) && t.recus.filter((m) => m.event === 'clear').every((m) => m.streamSid === 'MZ-PONT'));
  t.rendreMarques();

  t.envoyer({ event: 'stop', sequenceNumber: '99', streamSid: 'MZ-PONT', stop: { accountSid: 'ACbanc', callSid: 'CA-PONT' } });
  verifier('fin du flux : le pont se ferme et rend ses deux sessions', await attendre(() => !ponts.has(appelT().id) && (appelT().sessions_voix?.length ?? 0) === 2), JSON.stringify(appelT().sessions_voix));
  const sv = appelT().sessions_voix ?? [];
  verifier('métriques : Gemini deux fois, du son entendu, des outils appelés', sv.every((m) => m.moteur === 'gemini') && sv[0].secondes_audio_entree > 0 && sv.reduce((n, m) => n + m.appels_outils, 0) === 2);
  verifier('le journal de l’appel dit qui a parlé, par quel moteur', appelT().journal.some((j) => j.quoi.startsWith('pont : Léa parle par gemini')) && appelT().journal.some((j) => j.quoi.startsWith('pont : Marc parle par gemini')));
  verifier('la ligne est refermée de notre côté', await attendre(() => t.etat.ferme));
  await x.twilioEntrant('completed', 'CA-PONT', '+33133333333', '+33186000010');
  verifier('raccroché : l’appel est clos, le coût compte la voix ou dit ce qui manque', !!appelT().fin && (appelT().cout !== null || appelT().cout_manquants.some((m) => m.startsWith('voix'))), JSON.stringify({ c: appelT().cout, m: appelT().cout_manquants }));

  // -------------------------------------------------------------------------
  console.log(' Pont média : un appel Telnyx tenu par Mistral');
  const avantOp = x.operateur.length;
  const tx = await x.telnyxEntrant('call.initiated', 'PONT-TX', '+33144444445', '+33186000011');
  verifier('Telnyx : appel reçu', tx.statut === 200, tx.texte);
  const depart = x.operateur.slice(avantOp).find((r) => r.chemin === '/v2/calls/PONT-TX/actions/streaming_start');
  const corps = depart ? JSON.parse(depart.corps) : {};
  verifier('Telnyx : décroché, puis streaming_start au format relevé (RTP, PCMU, piste entrante)', x.operateur.slice(avantOp).some((r) => r.chemin === '/v2/calls/PONT-TX/actions/answer') && corps.stream_bidirectional_mode === 'rtp' && corps.stream_bidirectional_codec === 'PCMU' && corps.stream_track === 'inbound_track' && /^wss:\/\/voix\.iagent\.example\/voix\/flux\/telnyx\//.test(corps.stream_url ?? ''), JSON.stringify(corps));
  const appelX = () => s.lister<AppelVoix>('voix_appels', (a) => a.id_operateur === 'PONT-TX')[0];
  const jetonX = String(corps.stream_url ?? '').split('/').pop()!;
  verifier('un jeton Twilio ne s’ouvre pas sur Telnyx', (await brut(port, `/voix/flux/twilio/${jetonX}`, null)).toString('utf8').startsWith('HTTP/1.1 401'));
  const l = await ligne(urlLocale(jetonX, 'telnyx'));
  verifier('Telnyx : la ligne s’ouvre', l.etat.ouvert);
  const mediaX = (b: Buffer) => ({ event: 'media', sequence_number: '4', stream_id: 'ST-PONT', media: { track: 'inbound', chunk: '2', timestamp: '5', payload: b.toString('base64') } });
  l.envoyer({ event: 'connected', version: '1.0.0' });
  l.envoyer({ event: 'start', sequence_number: '1', stream_id: 'ST-PONT', start: { user_id: 'u', call_control_id: 'PONT-TX', client_state: null, media_format: { encoding: 'PCMU', sample_rate: 8000, channels: 1 } } });
  const ttsX = () => mot.recus.filter((r) => r.chemin === '/v1/audio/speech').map((r) => JSON.parse(r.corps).input as string);
  verifier('l’accueil que Telnyx n’a pas dit est dit par l’agent, avec sa voix', await attendre(() => ttsX().includes(x.std.accueil)) && JSON.parse(mot.recus.find((r) => r.chemin === '/v1/audio/speech')!.corps).voice_id === 'fr_marie_neutral', JSON.stringify(ttsX()));
  verifier('Telnyx : la voix revient en trames media, sans streamSid', await attendre(() => l.recus.some((m) => m.event === 'media')) && l.recus.filter((m) => m.event === 'media').every((m) => !('streamSid' in m) && typeof m.media.payload === 'string'));
  await pause(300);
  await l.parler(mediaX, 800);
  verifier('Mistral entend le tour de l’appelant en WAV 16 kHz', await attendre(() => mot.recus.some((r) => r.chemin === '/v1/audio/transcriptions')));
  verifier('l’agent répond à la question', await attendre(() => ttsX().includes('Je vous écoute.')));
  await pause(300);
  await l.parler(mediaX, 800);
  verifier('« au revoir » : l’agent clôt l’appel, Telnyx raccroche', await attendre(() => x.operateur.some((r) => r.chemin === '/v2/calls/PONT-TX/actions/hangup')) && (appelX().etat as any).etape === 'termine' && appelX().issue === 'traite', JSON.stringify(appelX().etat));
  l.envoyer({ event: 'stop', sequence_number: '9', stream_id: 'ST-PONT', stop: { user_id: 'u', call_control_id: 'PONT-TX' } });
  verifier('fin du flux : la session Mistral est comptée, puis le coût recalculé', await attendre(() => (appelX().sessions_voix?.length ?? 0) === 1) && appelX().sessions_voix![0].moteur === 'mistral' && appelX().sessions_voix![0].caracteres_synthetises >= x.std.accueil.length && (appelX().cout !== null || appelX().cout_manquants.some((m) => m.includes('mistral'))), JSON.stringify(appelX().cout_manquants));

  // -------------------------------------------------------------------------
  console.log(' Pont média : ce qui le ferme');
  const h0 = x.horloge.lire();
  await x.telnyxEntrant('call.initiated', 'PONT-TARD', '+33144444446', '+33186000011');
  const tard = x.operateur.filter((r) => r.chemin === '/v2/calls/PONT-TARD/actions/streaming_start').map((r) => JSON.parse(r.corps).stream_url as string)[0] ?? '';
  x.horloge.poser(new Date(h0.getTime() + 3 * 60_000));
  const expire = (await brut(port, `/voix/flux/telnyx/${tard.split('/').pop()}`, null)).toString('utf8');
  verifier('un jeton inutilisé expire au bout de deux minutes', expire.startsWith('HTTP/1.1 401') && expire.includes('expiré'), expire.slice(0, 80));
  x.horloge.poser(h0);
  configurerVoix({ env: { ...x.env, VOIX_URL_PUBLIQUE: '' } });
  verifier('sans adresse publique, le pont se dit indisponible en nommant la variable', pontIndisponible('telnyx')?.includes('VOIX_URL_PUBLIQUE') === true);
  configurerVoix({ env: { ...x.env, GEMINI_API_KEY: '', ELEVENLABS_API_KEY: '', MISTRAL_API_KEY: '' } });
  verifier('sans clé de moteur pour le téléphone, le pont se dit indisponible', pontIndisponible('telnyx')?.includes('Aucun moteur') === true);
  const sansVoix = await x.telnyxEntrant('call.initiated', 'PONT-SANS', '+33144444447', '+33186000011');
  const appelS = s.lister<AppelVoix>('voix_appels', (a) => a.id_operateur === 'PONT-SANS')[0];
  verifier('…et l’appel va à un humain au lieu de faire semblant', sansVoix.statut === 200 && (appelS?.etat as any)?.etape === 'handoff', JSON.stringify(appelS?.etat));
  configurerVoix({ env: x.env });

  // Refusals of the WebSocket itself, on a raw socket with a fresh stream.
  await x.telnyxEntrant('call.initiated', 'PONT-BRUT', '+33144444448', '+33186000011');
  const jetonBrut = (x.operateur.filter((r) => r.chemin === '/v2/calls/PONT-BRUT/actions/streaming_start').map((r) => JSON.parse(r.corps).stream_url as string)[0] ?? '').split('/').pop();
  const nonMasquee = Buffer.concat([Buffer.from([0x81, 2]), Buffer.from('{}')]);
  const r1 = await brut(port, `/voix/flux/telnyx/${jetonBrut}`, nonMasquee);
  const i101 = r1.indexOf('\r\n\r\n');
  const fermeture = r1.subarray(i101 + 4);
  verifier('ouverture acceptée (101) avec la clé de la RFC', r1.toString('utf8').startsWith('HTTP/1.1 101') && r1.toString('utf8').includes('s3pPLMBiTxaQ9kYGzzhZRbK+xOo='));
  verifier('une trame non masquée ferme la connexion (code 1002)', fermeture[0] === 0x88 && fermeture.readUInt16BE(2) === 1002, fermeture.toString('hex'));
  verifier('aucun pont ne reste ouvert après la fermeture', await attendre(() => ponts.size === 0), String(ponts.size));

  gem.serveur.close(); mot.serveur.close();
  configurerVoix({ pont_media: false, basesVoix: x.basesVoix });
}
