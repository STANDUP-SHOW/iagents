// Bench data: what the platform answers, in the shapes of plateforme/modele.ts
// and docs/master/routes.md. Read by the SSR bench (banc/rendu.jsx) and by the
// bench platform the captures run against (banc/plateforme-de-banc.ts), so the
// two never show different worlds. Everything here is invented and says so:
// tenant names end with « (banc) », keys are throwaway.

export const JETON_DE_BANC = 'jeton-admin-de-banc-0123456789abcdef';

export const tenants = [
  { tenant_id: 'tn-boulangerie', nom: 'Boulangerie Martin (banc)', segment: 'business', pays: 'FR', opt_in_skills: true, cree_le: '2026-09-02T09:12:00Z' },
  { tenant_id: 'tn-cabinet', nom: 'Cabinet Roux Avocats (banc)', segment: 'enterprise', pays: 'FR', opt_in_skills: false, cree_le: '2026-09-15T14:00:00Z' },
  { tenant_id: 'tn-famille', nom: 'Famille Durand (banc)', segment: 'home', pays: 'BE', opt_in_skills: false, cree_le: '2026-10-01T18:30:00Z' },
];

const PEM = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA9tJ0bancbancbancbancbancbancbancbancbanc=\n-----END PUBLIC KEY-----\n';
export const boxes = [
  { device_id: 'BOX-7F3A', tenant_id: 'tn-boulangerie', serial: 'IAB-2026-0001', identite_publique: PEM, gamme: 'business', os: 'ubuntu-core 24', version_desktop: '0.2.1', statut: 'active', plan_id: 'box-commander-36', sante: { vu_le: '2026-10-07T07:58:00Z', cpu: 23, memoire: 61, disque: 38, temperature: 54 }, garantie_jusqu_au: '2028-09-02' },
  { device_id: 'BOX-91C2', tenant_id: 'tn-cabinet', serial: 'IAB-2026-0002', identite_publique: PEM, gamme: 'business', os: 'ubuntu-core 24', version_desktop: '0.2.0', statut: 'suspendue', plan_id: 'box-commander-24', sante: { vu_le: '2026-10-02T11:20:00Z', cpu: 4, memoire: 22, disque: 71, temperature: 41 }, garantie_jusqu_au: '2026-09-30' },
  { device_id: 'BOX-0D11', tenant_id: 'tn-famille', serial: 'IAB-2026-0003', identite_publique: PEM, gamme: 'home', os: 'ubuntu-core 24', version_desktop: '0.2.1', statut: 'provisionnee', plan_id: 'home-box', sante: null, garantie_jusqu_au: '2028-10-01' },
  { device_id: 'BOX-55EE', tenant_id: null, serial: 'IAB-2026-0004', identite_publique: PEM, gamme: 'business', os: 'ubuntu-core 24', version_desktop: '0.2.1', statut: 'stock', plan_id: null, sante: null, garantie_jusqu_au: null },
];

const plan = (p) => ({
  description: '', segment: 'business', currency: 'EUR', billing_period: 'mois', commitment_months: 0, base_price: null,
  base_price_max: null, a_partir_de: false, included_agents: 0, included_commander: false, included_box: false,
  included_voice_minutes: 0, usage_rate_llm: null, usage_rate_voice: null, usage_rate_telephony: null, overage_rules: null,
  effective_from: '2026-10-01', effective_to: null, public_visibility: true, region: 'FR', tax_mode: 'HT', legacy_flag: false, ...p,
});
export const plans = [
  plan({ plan_id: 'box-commander-36', nom: 'Box Commander 36 mois', description: 'La Box louée, engagement 36 mois.', base_price: 69, commitment_months: 36, included_box: true, included_commander: true }),
  plan({ plan_id: 'box-commander-24', nom: 'Box Commander 24 mois', base_price: 89, commitment_months: 24, included_box: true, included_commander: true }),
  plan({ plan_id: 'agent-essential', nom: 'Agent Essential', base_price: 29, included_agents: 1, effective_from: '2026-10-01' }),
  plan({ plan_id: 'agent-essential', nom: 'Agent Essential', base_price: 25, included_agents: 1, effective_from: '2026-06-01', effective_to: '2026-10-01' }),
  plan({ plan_id: 'agent-professional', nom: 'Agent Professional', base_price: 59, included_agents: 1 }),
  plan({ plan_id: 'agent-professional', nom: 'Agent Professional', base_price: 55, included_agents: 1, region: 'BE' }),
  plan({ plan_id: 'pack-enterprise', nom: 'Pack Enterprise', segment: 'enterprise', base_price: null, included_agents: 50 }),
  plan({ plan_id: 'voice-reception', nom: 'Voice Réception', segment: 'voice', base_price: 49, a_partir_de: true, included_voice_minutes: 300, usage_rate_voice: 0.09 }),
  plan({ plan_id: 'home-family', nom: 'Home Family', segment: 'home', base_price: 19.9, tax_mode: 'TTC', included_agents: 3 }),
  plan({ plan_id: 'pack-team', nom: 'Pack Team', base_price: 599, base_price_max: 749, included_agents: 10, effective_from: '2026-11-01' }),
  plan({ plan_id: 'agent-unique', nom: 'Agent unique', base_price: 9.9, public_visibility: false, legacy_flag: true, effective_from: '2026-01-01' }),
  plan({ plan_id: 'box-max', nom: 'Box Max', base_price: 149, public_visibility: false, legacy_flag: true, included_box: true, effective_from: '2026-03-01', effective_to: '2026-09-30' }),
];

export const entitlements = [
  { id: 'ent-0001', tenant_id: 'tn-boulangerie', device_id: 'BOX-7F3A', agent_template_id: 'AG-0001', specialisation_id: 'boulangerie', licence: 'professional', statut: 'active', debut: '2026-09-02', fin: null },
  { id: 'ent-0002', tenant_id: 'tn-boulangerie', device_id: 'BOX-7F3A', agent_template_id: 'AG-0179', specialisation_id: null, licence: 'essential', statut: 'active', debut: '2026-09-02', fin: '2027-09-01' },
  { id: 'ent-0003', tenant_id: 'tn-cabinet', device_id: 'BOX-91C2', agent_template_id: 'AG-0028', specialisation_id: 'avocats', licence: 'expert', statut: 'suspendue', debut: '2026-09-15', fin: null },
  { id: 'ent-0004', tenant_id: 'tn-cabinet', device_id: 'BOX-91C2', agent_template_id: 'AG-0196', specialisation_id: null, licence: 'professional', statut: 'revoquee', debut: '2026-09-15', fin: '2026-10-03' },
];

export const numeros = [
  { e164: '+33187650001', tenant_id: 'tn-boulangerie', provider: 'telnyx', statut: 'actif', routage_id: 'std-boulangerie' },
  { e164: '+33187650002', tenant_id: 'tn-cabinet', provider: 'twilio', statut: 'demande', routage_id: null },
];

export const appels = [
  { id: 'call-01', tenant_id: 'tn-boulangerie', direction: 'entrant', appelant: '+33612345678', appele: '+33187650001', agent_instance_id: 'inst-julie', debut: '2026-10-07T07:41:00Z', duree_s: 132, resume: 'Commande de 3 baguettes tradition et une tarte pour 11 h.', consentement_enregistrement: true, issue: 'traite', cout: { telephonie: 0.02, voix: 0.11, llm: 0.03, outils: 0, total: 0.16, devise: 'EUR' } },
  { id: 'call-02', tenant_id: 'tn-boulangerie', direction: 'entrant', appelant: '+33698765432', appele: '+33187650001', agent_instance_id: 'inst-julie', debut: '2026-10-07T08:05:00Z', duree_s: 64, resume: 'Demande de parler au boulanger : transférée.', consentement_enregistrement: true, issue: 'transfere-humain', cout: { telephonie: 0.01, voix: 0.05, llm: 0.01, outils: 0, total: 0.07, devise: 'EUR' } },
];

export const skills = [
  { skill_pack_id: 'SP-relances-factures', version: '1.2.0', source_type: 'iagent', validation_status: 'valide', compatible_agents: ['AG-0001', 'AG-0002'], compatible_tools: ['LOG-0012'], sector_scope: ['administration'], locale: 'fr-FR', changelog: 'Relance J+30 ajoutée.', empreinte: '9f2c4e1a7b3d5e6f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7' },
  { skill_pack_id: 'SP-commandes-telephone', version: '0.3.0', source_type: 'terrain-anonymise', validation_status: 'en-revue', compatible_agents: ['AG-0179'], compatible_tools: [], sector_scope: ['commerce-alimentaire'], locale: 'fr-FR', changelog: 'Proposition terrain anonymisée.', empreinte: null },
  { skill_pack_id: 'SP-agenda-cabinet', version: '1.0.0', source_type: 'editeur', validation_status: 'candidat', compatible_agents: ['AG-0028'], compatible_tools: ['LOG-0201'], sector_scope: ['juridique'], locale: 'fr-FR', changelog: 'Première version.', empreinte: 'ab12' },
  { skill_pack_id: 'SP-ancien-export', version: '0.9.0', source_type: 'iagent', validation_status: 'retire', compatible_agents: ['AG-0010'], compatible_tools: [], sector_scope: ['administration'], locale: 'fr-FR', changelog: 'Remplacé par SP-relances-factures.', empreinte: 'cd34' },
];

export const compteur = { metiers: 1249, profils: 182490, calcule_le: '2026-10-07T06:00:00Z' };

export const opportunites = [
  { id: 'opp-2026-10-07-a', date: '2026-10-07', titre: 'Accueil téléphonique des boulangeries de quartier', marche: 'Artisans alimentaires, France', score: 82, statut: 'brouillon', carte: { pourquoi_maintenant: 'Pénurie de vendeurs le matin.', demande: 'Commandes par téléphone pendant la cuisson.', concurrence: 'Standards téléphoniques génériques.' }, etude_id: null },
  { id: 'opp-2026-10-06-b', date: '2026-10-06', titre: 'Secrétariat juridique pour cabinets de 2 à 5 avocats', marche: 'Professions juridiques, France', score: 74, statut: 'publiee', carte: { pourquoi_maintenant: 'Facturation au temps passé sous pression.', demande: 'Prise de rendez-vous et relances.' }, etude_id: 'etu-7c9e2b' },
];

export const etude = {
  id: 'etu-7c9e2b', opportunite_id: 'opp-2026-10-06-b', idee: 'Secrétariat juridique pour cabinets de 2 à 5 avocats',
  scenarios: [
    { nom: 'prudent', budget: 18000, equipes: ['AG-0028', 'AG-0001'], seuil_rentabilite_mois: 14 },
    { nom: 'central', budget: 32000, equipes: ['AG-0028', 'AG-0001', 'AG-0196'], seuil_rentabilite_mois: 10 },
    { nom: 'ambitieux', budget: 61000, equipes: ['AG-0028', 'AG-0001', 'AG-0196', 'AG-0179'], seuil_rentabilite_mois: 8 },
  ],
};

export const audit = [
  { id: 'aud-1', tenant_id: 'tn-cabinet', quand: '2026-10-03T16:02:00Z', acteur: 'back-office', action: 'entitlement.revoquer', cible: 'ent-0004', detail: 'Fin de contrat demandée par le client.' },
  { id: 'aud-2', tenant_id: 'tn-cabinet', quand: '2026-10-04T09:00:00Z', acteur: 'back-office', action: 'box.statut', cible: 'BOX-91C2', detail: 'suspendue : impayé de septembre.' },
  { id: 'aud-3', tenant_id: null, quand: '2026-10-06T10:30:00Z', acteur: 'back-office', action: 'skill.revue', cible: 'SP-commandes-telephone', detail: 'en-revue : données vérifiées anonymes.' },
];

/** The answer of each GET route of routes.json, as the bench platform serves it. */
export function reponsesDeBanc() {
  return {
    'GET /controle/tenants': tenants,
    'GET /controle/boxes': boxes,
    'GET /controle/entitlements': entitlements,
    'GET /controle/skills': skills,
    'GET /controle/compteur': compteur,
    'GET /controle/audit': audit,
    'GET /tarifs/plans/tous': plans,
    'GET /tarifs/plans': plans.filter((p) => p.public_visibility && !p.legacy_flag && !p.effective_to),
    'GET /voix/numeros': numeros,
    'GET /voix/appels': appels,
    'GET /create/opportunites/toutes': opportunites,
    'GET /create/opportunites': opportunites.filter((o) => o.statut === 'publiee'),
    [`GET /create/etudes/${etude.id}`]: etude,
    ...Object.fromEntries(boxes.map((b) => [`GET /controle/boxes/${b.device_id}`, b])),
  };
}
