// Le détecteur de données client (MASTER §7) : « aucun contenu confidentiel ne
// devient Skill Pack par défaut ». C'est le SEUL endroit du dépôt où l'on dit ce
// qu'est une donnée client détectable ; le dépôt de Skill Pack et les
// propositions terrain l'appellent tous les deux.
//
// It is deliberately conservative: a false refusal costs a reviewer a rewrite,
// a false acceptance ships a client's data to every other client. It never
// returns the matched value, only its kind, so a refusal does not echo the data.

import { readFileSync } from 'node:fs';

export type TypeDonnee =
  | 'adresse e-mail'
  | 'numéro de téléphone'
  | 'IBAN'
  | 'SIRET ou SIREN'
  | 'numéro de carte bancaire'
  | 'numéro de sécurité sociale'
  | 'secret ou clé d’accès'
  | 'montant rattaché à un nom propre';

const chiffres = (s: string) => s.replace(/\D/g, '');

function luhn(n: string): boolean {
  let somme = 0;
  for (let i = 0; i < n.length; i++) {
    let d = n.charCodeAt(n.length - 1 - i) - 48;
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    somme += d;
  }
  return n.length > 0 && somme % 10 === 0;
}

/** ISO 13616 mod-97 check, so that a random reference is not taken for an IBAN. */
function ibanValide(brut: string): boolean {
  const s = brut.replace(/\s/g, '').toUpperCase();
  if (s.length < 15 || s.length > 34) return false;
  const r = s.slice(4) + s.slice(0, 4);
  let reste = 0;
  for (const ch of r) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of v) reste = (reste * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return reste === 1;
}

/** French NIR: 13 digits + 2-digit key = 97 - (n mod 97). Corsica 2A/2B -> 19/18. */
function nirValide(brut: string): boolean {
  const s = brut.replace(/\s/g, '').toUpperCase();
  if (s.length !== 15) return false;
  const corps = s.slice(0, 13).replace('2A', '19').replace('2B', '18');
  if (!/^\d{13}$/.test(corps)) return false;
  return 97 - Number(BigInt(corps) % 97n) === Number(s.slice(13));
}

const MOTIFS: { type: TypeDonnee; re: RegExp; valider?: (m: string) => boolean }[] = [
  { type: 'secret ou clé d’accès', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{16,}|\bBearer\s+[A-Za-z0-9._~+/-]{16,}|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}|\bxox[abp]-[A-Za-z0-9-]{10,}/g },
  { type: 'adresse e-mail', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { type: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/g, valider: ibanValide },
  { type: 'numéro de sécurité sociale', re: /\b[12]\s?\d{2}\s?(?:0[1-9]|1[0-2]|[2-9]\d)\s?(?:\d{2}|2A|2B)\s?\d{3}\s?\d{3}\s?\d{2}\b/g, valider: nirValide },
  { type: 'numéro de carte bancaire', re: /\b\d(?:[ -]?\d){12,18}\b/g, valider: (m) => { const d = chiffres(m); return d.length >= 13 && d.length <= 19 && d.length !== 14 && luhn(d); } },
  { type: 'SIRET ou SIREN', re: /\b\d{3}[ .]?\d{3}[ .]?\d{3}(?:[ .]?\d{5})?\b/g, valider: (m) => { const d = chiffres(m); return (d.length === 9 || d.length === 14) && luhn(d); } },
  { type: 'numéro de téléphone', re: /(?:\+|00)\d{1,3}[\s.-]?\(?\d\)?(?:[\s.-]?\d){7,12}\b|\b0[1-9](?:[\s.-]?\d{2}){4}\b/g },
];

// Capitalised words that are not a person or a company: the software catalogue
// (every word of every product name) plus a short list of product words.
let connus: Set<string> | null = null;
function motsConnus(): Set<string> {
  if (connus) return connus;
  connus = new Set(['iagent', 'box', 'skill', 'pack', 'commander', 'workforce', 'france', 'europe', 'union', 'européenne']);
  try {
    const ref = JSON.parse(readFileSync(new URL('../../catalogue/logiciels.json', import.meta.url), 'utf8'));
    for (const l of ref.logiciels ?? []) {
      for (const mot of String(l.nom).split(/[\s/()-]+/)) if (mot) connus.add(mot.toLowerCase());
    }
  } catch {
    // Without the catalogue we refuse more, never less.
  }
  return connus;
}

const MONTANT = /(?:\d[\d\s.,']*\d|\d)\s?(?:€|EUR\b|euros?\b|\$|USD\b|£|GBP\b|CHF\b|k€|M€)|(?:€|\$|£)\s?\d/i;
const NOM_PROPRE = /[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ’'-]+/g;
const CIVILITE = /\b(?:M|Mme|Mlle|Monsieur|Madame|Maître|Me|Dr|SARL|SAS|SASU|EURL|SA|SCI)\s+[A-ZÀ-ÖØ-Þ]/;

/** A sentence carrying an amount and a capitalised word that is not its first word. */
function montantAvecNomPropre(texte: string): boolean {
  // "M. Martin" must not end the sentence before the amount.
  const normalise = texte.replace(/\b(M|Mme|Mlle|Dr|Me|Pr)\.\s/g, '$1 ');
  for (const phrase of normalise.split(/[.!?\n;:]+(?:\s|$)/)) {
    if (!MONTANT.test(phrase)) continue;
    if (CIVILITE.test(phrase)) return true;
    const debut = phrase.search(/\S/);
    for (const m of phrase.matchAll(NOM_PROPRE)) {
      if (m.index === debut) continue; // sentence-initial capital
      if (!motsConnus().has(m[0].toLowerCase())) return true;
    }
  }
  return false;
}

/** Kinds of client data found in `texte`, each kind once. Empty = nothing detected. */
export function detecterDonneeClient(texte: string): TypeDonnee[] {
  const trouve = new Set<TypeDonnee>();
  let reste = texte;
  for (const { type, re, valider } of MOTIFS) {
    reste = reste.replace(re, (m) => {
      if (valider && !valider(m)) return m;
      trouve.add(type);
      return ' ';
    });
  }
  if (montantAvecNomPropre(texte)) trouve.add('montant rattaché à un nom propre');
  return [...trouve];
}

/** Every string inside a JSON value, so no field escapes the detector. */
export function textesDe(valeur: unknown): string[] {
  if (typeof valeur === 'string') return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(textesDe);
  if (valeur && typeof valeur === 'object') return Object.values(valeur).flatMap(textesDe);
  return [];
}

/** French refusal naming the kinds found, never the values; null when clean. */
export function refusDonneeClient(valeur: unknown): string | null {
  const types = [...new Set(textesDe(valeur).flatMap(detecterDonneeClient))];
  if (types.length === 0) return null;
  return `Refusé : ce contenu porte une donnée client (${types.join(', ')}). Aucun contenu confidentiel ne devient Skill Pack : retirez-la ou anonymisez-la, puis reproposez.`;
}
