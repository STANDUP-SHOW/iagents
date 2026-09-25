/**
 * Banc du relais WhatsApp. Il parle à un VRAI serveur sur la boucle locale,
 * comme les bancs de `mcp.rs` et de `telegram.rs`, plutôt qu'à une imitation :
 * ce qu'on veut éprouver ici, ce sont les octets et les en-têtes.
 *
 * Deux familles de fautes sont visées, et ce sont celles qui coûteraient cher :
 *
 *  1. LA SIGNATURE CALCULÉE SUR LE MAUVAIS CORPS. Meta signe « an escaped
 *     unicode version of the payload » : relire puis réémettre le JSON change
 *     les octets, donc la signature ne tombe plus juste. Comme les messages qui
 *     nous intéressent sont en français, ce serait le cas COURANT : le relais
 *     refuserait tout message accentué et laisserait passer le reste. Le banc
 *     signe exprès la forme réécrite et exige un refus.
 *
 *  2. LE DÉPOUILLEMENT QUI DÉRAPE. `depouillerEntrant` ici et
 *     `whatsapp::depouiller_entrant` en Rust font la même chose dans deux
 *     langages : le banc rejoue les deux pièges que le banc Rust rejoue de son
 *     côté, sur la charge recopiée verbatim de la page de Meta.
 */
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  Boite,
  creerRelais,
  depouillerEntrant,
  reglagesDeLEnvironnement,
  signatureValide,
  type Reglages,
} from './serveur.ts';

const REGLAGES: Reglages = {
  secretApplication: 'secret-de-l-application-de-banc',
  motDeVerification: 'mot-de-verification-de-banc',
  secretDuRelais: 'secret-du-relais-de-banc',
};

let fautes = 0;
function verifier(quoi: string, vrai: boolean, detail = ''): void {
  if (vrai) console.log(`  ok  ${quoi}`);
  else {
    console.log(`  ✗   ${quoi}${detail ? ` — ${detail}` : ''}`);
    fautes++;
  }
}

function signer(corps: string): string {
  return 'sha256=' + createHmac('sha256', REGLAGES.secretApplication).update(Buffer.from(corps, 'utf8')).digest('hex');
}

/** La charge d'un message texte, recopiée VERBATIM de la page de référence de Meta. */
const CHARGE_DE_META = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550783881', phone_number_id: '106540352242922' },
            contacts: [{ profile: { name: 'Sheena Nelson' }, wa_id: '16505551234' }],
            messages: [
              {
                from: '16505551234',
                id: 'wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=',
                timestamp: '1749416383',
                type: 'text',
                text: { body: 'Does it come in another color?' },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

console.log('\nLe dépouillement, la même chose qu’en Rust');

{
  const recus = depouillerEntrant(CHARGE_DE_META);
  verifier('la charge de Meta rend un message', recus.length === 1, `${recus.length} message(s)`);
  verifier('le numéro, le nom, le texte et l’heure sont lus',
    recus[0]?.de === '16505551234' &&
    recus[0]?.nom === 'Sheena Nelson' &&
    recus[0]?.texte === 'Does it come in another color?' &&
    recus[0]?.recu_le === '1749416383',
    JSON.stringify(recus[0]));
}

{
  // Le piège : deux personnes dans la même notification, `contacts` dans
  // l'ordre INVERSE de `messages`. Apparier par position collerait le nom de
  // l'une au message de l'autre.
  const deux = {
    entry: [{ changes: [{ value: {
      contacts: [
        { profile: { name: 'Bernard' }, wa_id: '33600000002' },
        { profile: { name: 'Alice' }, wa_id: '33600000001' },
      ],
      messages: [
        { from: '33600000001', timestamp: '1', type: 'text', text: { body: 'premier' } },
        { from: '33600000002', timestamp: '2', type: 'text', text: { body: 'second' } },
      ],
    } }] }],
  };
  const recus = depouillerEntrant(deux);
  verifier('le nom se prend par le numéro, jamais par la position',
    recus[0]?.nom === 'Alice' && recus[0]?.texte === 'premier' &&
    recus[1]?.nom === 'Bernard' && recus[1]?.texte === 'second',
    recus.map((r) => `${r.nom}:${r.texte}`).join(', '));
}

{
  const sansProfil = { entry: [{ changes: [{ value: {
    messages: [{ from: '33600000009', timestamp: '3', type: 'text', text: { body: 'bonjour' } }],
  } }] }] };
  verifier('un envoyeur sans profil reste nommable par son numéro',
    depouillerEntrant(sansProfil)[0]?.nom === '33600000009');
}

{
  const statut = { entry: [{ changes: [{ value: {
    statuses: [{ id: 'wamid.x', status: 'read', timestamp: '4' }],
  } }] }] };
  verifier('un accusé de lecture ne remonte rien', depouillerEntrant(statut).length === 0);
  verifier('une image sans texte ne remonte rien',
    depouillerEntrant({ entry: [{ changes: [{ value: {
      messages: [{ from: '336', timestamp: '5', type: 'image', image: { id: 'x' } }],
    } }] }] }).length === 0);
  verifier('une charge vide ou biscornue ne lève pas',
    depouillerEntrant({}).length === 0 && depouillerEntrant(null).length === 0 &&
    depouillerEntrant({ entry: 'pas un tableau' }).length === 0);
}

console.log('\nLa signature de Meta, sur les octets reçus tels quels');

{
  // Le corps tel que Meta l'envoie : l'accent y est ÉCHAPPÉ.
  const brut = '{"entry":[{"changes":[{"value":{"messages":[{"from":"336","timestamp":"6","type":"text","text":{"body":"caf\\u00e9 r\\u00e9serv\\u00e9"}}]}}]}]}';
  verifier('le corps de banc porte bien la forme échappée de Meta',
    brut.includes('\\u00e9') && !brut.includes('é'));

  verifier('la signature des octets reçus est acceptée',
    signatureValide(Buffer.from(brut, 'utf8'), signer(brut), REGLAGES.secretApplication));

  // La faute qu'on veut rendre impossible : signer la forme RÉÉCRITE.
  const reecrit = JSON.stringify(JSON.parse(brut));
  verifier('le JSON réécrit donne bien d’autres octets', reecrit !== brut && reecrit.includes('é'));
  verifier('une signature calculée sur le JSON réécrit est REFUSÉE',
    !signatureValide(Buffer.from(brut, 'utf8'), signer(reecrit), REGLAGES.secretApplication));

  verifier('une signature sans le préfixe sha256= est refusée',
    !signatureValide(Buffer.from(brut, 'utf8'), signer(brut).slice('sha256='.length), REGLAGES.secretApplication));
  verifier('une signature absente est refusée',
    !signatureValide(Buffer.from(brut, 'utf8'), undefined, REGLAGES.secretApplication));
  verifier('une signature d’un autre secret est refusée',
    !signatureValide(Buffer.from(brut, 'utf8'),
      'sha256=' + createHmac('sha256', 'un-autre-secret').update(brut).digest('hex'),
      REGLAGES.secretApplication));
  verifier('un octet changé dans le corps est refusé',
    !signatureValide(Buffer.from(brut.replace('caf', 'caF'), 'utf8'), signer(brut), REGLAGES.secretApplication));
}

console.log('\nLe relais ne démarre pas sans ses secrets');

{
  const essai = (env: Record<string, string | undefined>): string | null => {
    try { reglagesDeLEnvironnement(env); return null; } catch (e) { return (e as Error).message; }
  };
  verifier('un environnement vide est refusé', essai({}) !== null);
  const motif = essai({ META_APP_SECRET: 'a', META_VERIFY_TOKEN: 'b' });
  verifier('le motif nomme ce qui manque, en français',
    motif !== null && motif.includes('RELAIS_SECRET') && motif.includes('ne démarre pas'), motif ?? '');
  verifier('un secret vide ou blanc compte comme absent',
    essai({ META_APP_SECRET: 'a', META_VERIFY_TOKEN: '   ', RELAIS_SECRET: 'c' }) !== null);
  verifier('les trois posés, ça démarre',
    essai({ META_APP_SECRET: 'a', META_VERIFY_TOKEN: 'b', RELAIS_SECRET: 'c' }) === null);
}

console.log('\nLe point de reprise ne recule pas, et ne resserre jamais deux fois');

{
  // Horloge explicite d'un bout à l'autre. Sans elle, `balayer()` compare des
  // messages posés à une heure écrite ici avec `Date.now()` et les oublie tous :
  // le banc passerait en ne mesurant rien.
  const T = 1_700_000_000_000;
  const boite = new Boite();
  const un = { de: '336', nom: 'A', texte: 'un', recu_le: '1' };
  const deux = { de: '337', nom: 'B', texte: 'deux', recu_le: '2' };
  boite.poser([un], T);
  const p1 = boite.depuis(0, T);
  // On éprouve la propriété, pas la valeur : l'identifiant est planché sur
  // l'horloge, donc il ne vaut pas 1 et n'a pas à valoir un nombre écrit ici.
  verifier('la première relève rend le message et avance la suite',
    p1.messages.length === 1 && p1.suite >= T, JSON.stringify(p1));
  const p2 = boite.depuis(p1.suite, T);
  verifier('la relève suivante ne le rend pas une deuxième fois',
    p2.messages.length === 0 && p2.suite === p1.suite, JSON.stringify(p2));
  verifier('une relève vide rend le point demandé, pas zéro',
    boite.depuis(p1.suite + 9, T).suite === p1.suite + 9);
  boite.poser([deux], T + 1000);
  const p3 = boite.depuis(p2.suite, T + 1000);
  verifier('le message d’après arrive seul',
    p3.messages.length === 1 && p3.messages[0]?.texte === 'deux');
  verifier('et son point est plus haut que le précédent', p3.suite > p1.suite, JSON.stringify(p3));
  const vieux = new Boite();
  vieux.poser([un], 0);
  verifier('un message oublié après sa durée de vie ne revient pas',
    vieux.depuis(0, 11 * 60 * 1000).messages.length === 0);

  // Le cas qui a fait écrire la règle : le relais redémarre, sa boîte est
  // neuve, et le poste garde son point de reprise. Comptés depuis zéro, les
  // nouveaux identifiants repartaient sous ce point et le poste ne recevait
  // plus rien — sans une erreur nulle part, et jusqu'à ce qu'il rebranche.
  const apresRedemarrage = new Boite();
  apresRedemarrage.poser([deux], T + 2000);
  const p4 = apresRedemarrage.depuis(p3.suite, T + 2000);
  verifier('après un redémarrage du relais, le poste reçoit encore',
    p4.messages.length === 1 && p4.suite > p3.suite, JSON.stringify(p4));

  // Deux messages de la même milliseconde gardent deux identifiants, sinon le
  // second se resservirait à chaque relève.
  const memeInstant = new Boite();
  memeInstant.poser([un, deux], T);
  const p5 = memeInstant.depuis(0, T);
  verifier('deux messages du même instant gardent deux identifiants',
    p5.messages.length === 2 && memeInstant.depuis(p5.suite, T).messages.length === 0,
    JSON.stringify(p5));
}

console.log('\nLes trois routes, contre un vrai serveur');

const serveur = creerRelais(REGLAGES);
await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', () => r()));
const port = (serveur.address() as AddressInfo).port;
const base = `http://127.0.0.1:${port}`;
/** Le point de reprise, transmis d'un cas à l'autre comme le ferait un poste. */
let point = 0;
const releve = (depuis: number, attente = 0, secret = REGLAGES.secretDuRelais) =>
  fetch(`${base}/messages?depuis=${depuis}&attente=${attente}`, {
    headers: { authorization: `Bearer ${secret}` },
  });

try {
  {
    const bonne = await fetch(
      `${base}/webhook?hub.mode=subscribe&hub.verify_token=${REGLAGES.motDeVerification}&hub.challenge=defi-1234`);
    verifier('la poignée rend le défi quand le mot correspond',
      bonne.status === 200 && (await bonne.text()) === 'defi-1234');
    const mauvaise = await fetch(
      `${base}/webhook?hub.mode=subscribe&hub.verify_token=pas-le-bon&hub.challenge=defi-1234`);
    verifier('la poignée refuse un mot qui ne correspond pas et ne rend PAS le défi',
      mauvaise.status === 403 && !(await mauvaise.text()).includes('defi-1234'));
    const sansMode = await fetch(
      `${base}/webhook?hub.verify_token=${REGLAGES.motDeVerification}&hub.challenge=defi-1234`);
    verifier('la poignée refuse sans hub.mode=subscribe', sansMode.status === 403);
  }

  {
    const corps = JSON.stringify(CHARGE_DE_META);
    const refuse = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signer('autre chose') },
      body: corps,
    });
    verifier('une charge mal signée est refusée', refuse.status === 401);
    const apres = await (await releve(0)).json();
    verifier('et elle n’a RIEN rangé', apres.messages.length === 0, JSON.stringify(apres));

    const accepte = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signer(corps) },
      body: corps,
    });
    verifier('une charge bien signée est acceptée', accepte.status === 200);
    const lue = await (await releve(0)).json();
    verifier('le message est relevable, avec son nom de profil',
      lue.messages.length === 1 && lue.messages[0]?.nom === 'Sheena Nelson' && lue.suite > 0,
      JSON.stringify(lue));
    // Les cas suivants repartent de CE point, comme le ferait un poste. Écrits
    // en clair (0, 1, 99), ils passaient sous les identifiants et relevaient un
    // message déjà lu — le banc mesurait autre chose que ce qu'il annonçait.
    point = lue.suite;
  }

  {
    const sans = await fetch(`${base}/messages?depuis=0`);
    verifier('la relève sans secret est refusée', sans.status === 401);
    verifier('la relève avec un mauvais secret est refusée', (await releve(0, 0, 'pas-le-bon')).status === 401);
  }

  {
    // La longue attente : la ligne reste ouverte, et le message la réveille.
    const debut = Date.now();
    const enAttente = releve(point, 30);
    await new Promise((r) => setTimeout(r, 150));
    const corps = JSON.stringify({ entry: [{ changes: [{ value: {
      contacts: [{ profile: { name: 'Zoé' }, wa_id: '33611' }],
      messages: [{ from: '33611', timestamp: '7', type: 'text', text: { body: 'pendant l’attente' } }],
    } }] }] });
    await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signer(corps) },
      body: corps,
    });
    const rendu = await (await enAttente).json();
    const duree = Date.now() - debut;
    verifier('la longue attente rend la main dès qu’un message arrive',
      rendu.messages.length === 1 && rendu.messages[0]?.nom === 'Zoé' && duree < 10_000,
      `${duree} ms, ${JSON.stringify(rendu)}`);
    point = rendu.suite;
  }

  {
    // Le poste coupe au bout de 35 secondes et la longue attente peut tenir
    // plus longtemps : écrire sur une ligne déjà fermée est donc le cas
    // ORDINAIRE, et il ne doit jamais arrêter le processus.
    //
    // Honnêteté sur ce que ce cas prouve : en retirant le garde de `repondre`,
    // ce banc passe quand même — Node 22 ne lève pas sur cette écriture-là. Il
    // ne démontre donc PAS que le garde est indispensable aujourd'hui. Ce qu'il
    // épingle, c'est le comportement attendu : une coupure ne tue pas le relais.
    // C'est ce qui attrapera le jour où un changement, ici ou chez Node, y
    // ferait lever quelque chose.
    const rejets: unknown[] = [];
    const noter = (e: unknown) => rejets.push(e);
    process.on('unhandledRejection', noter);
    const coupe = new AbortController();
    void fetch(`${base}/messages?depuis=0&attente=2`, {
      headers: { authorization: `Bearer ${REGLAGES.secretDuRelais}` },
      signal: coupe.signal,
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 100));
    coupe.abort();
    await new Promise((r) => setTimeout(r, 2400));
    process.off('unhandledRejection', noter);
    verifier('une coupure pendant la longue attente ne lève rien',
      rejets.length === 0, `${rejets.length} rejet(s)`);
    verifier('et le relais répond encore après',
      (await fetch(`${base}/sante`)).status === 200);
  }

  {
    const vide = await releve(point, 1);
    verifier('une attente sans message rend une liste vide, pas une erreur',
      vide.status === 200 && (await vide.json()).messages.length === 0);
    verifier('une route inconnue rend 404', (await fetch(`${base}/autre`)).status === 404);
    verifier('la route de santé ne dit rien du contenu',
      (await fetch(`${base}/sante`)).status === 200);
  }
} finally {
  serveur.close();
}

if (fautes > 0) {
  console.error(`\n${fautes} faute(s) : le relais WhatsApp n'est pas sûr en l'état.`);
  process.exit(1);
}
console.log('\nrelais whatsapp : la signature se calcule sur les octets reçus, et le dépouillement dit la même chose que le Rust');
