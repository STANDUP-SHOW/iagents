# Centre d'appels IA d'iAgent Tech (opérations internes)

Module `plateforme/centre/`, servi par la plateforme (les deux portes : Node et
Cloudflare). Une assistante IA, « Léa », tient deux canaux avec le même cerveau :

- **WhatsApp** (WhatsApp Cloud API de Meta) : webhook `/centre/whatsapp`, signature
  vérifiée sur les octets reçus (`relais/meta.ts`, la même fonction que le relais des
  clients) ; réponse envoyée par l'API Graph `v21.0`.
- **Téléphone** (Twilio) : webhook vocal du numéro `/centre/telephone/entrant`, un tour
  de parole par `<Gather input="speech" language="fr-FR">` ; chaque webhook est vérifié
  par l'adaptateur Twilio du module voix.

Ce que fait l'assistante, par ses outils (`centre.ts`) : répondre à partir de ce qui est
vrai (les prix viennent de `frontend/src/data/tarifs.json`, le reste de
`connaissances.ts`) ; qualifier (nom, entreprise, activité, besoin, postes, échéance,
e-mail, intérêt) ; proposer de vrais créneaux et réserver un rendez-vous (`reglages.json`) ;
passer la main à un conseiller (au téléphone, transfert vers `CENTRE_NUMERO_HUMAIN` aux
heures ouvrées, sinon rappel noté ; sur WhatsApp, l'assistante se tait et le conseiller
répond depuis la console) ; retirer le consentement à la demande (« STOP », « ne
m'appelez plus »).

Elle annonce dès la première phrase qu'elle est une intelligence artificielle et que
l'échange est transcrit. Les appels sortants ne partent que par `peutAppeler` :
consentement prouvé (source, preuve, date), horaires et jours légaux, quatre appels au
plus par trente jours — les règles de `plateforme/voix/regles-demarchage.json`.

Console : `/centre/console` (secret du back-office) — canaux branchés ou non avec le nom
de ce qui manque, demandes à traiter, rendez-vous, journal des conversations, réponse
humaine, consentements, appel sortant. Conservation : 365 jours.

## Variables

| Variable | Rôle |
| --- | --- |
| `ANTHROPIC_API_KEY` | le modèle de langage |
| `META_APP_SECRET`, `META_VERIFY_TOKEN`, `WHATSAPP_JETON`, `WHATSAPP_NUMERO_ID` | WhatsApp |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `VOIX_URL_PUBLIQUE` | appels entrants |
| `CENTRE_NUMERO` | le numéro du centre chez Twilio (appels sortants) |
| `CENTRE_NUMERO_HUMAIN` | le conseiller qui reçoit les transferts |

## Vérifié, et ce qui ne l'est pas

`npm run controle-centre` : 71 contrôles, dont des parcours complets par HTTP contre de
faux Meta, Twilio et Anthropic écrits sur la boucle locale ; la signature Twilio est
comparée à la valeur de la bibliothèque officielle. `npm run controle-cloudflare` rejoue
un message WhatsApp signé dans workerd. `npm run demo-centre` joue trois parcours et
laisse la console ouverte.

Jamais vus en vrai : un message de Meta, un appel Twilio, une réponse d'un vrai modèle
(le banc conduit l'échange avec `cerveau-demonstration.ts`), la voix `Polly.Lea-Neural`.
