// The home page's events, named once. No analytics provider is chosen yet:
// each event goes to window.dataLayer when a tag manager put one there, and
// is dispatched as a DOM event that any future provider can listen to.
export const EVENEMENTS = [
  'hero_start',
  'idea_input_focus',
  'idea_submit',
  'catalog_click',
  'agent_recruitment_click',
  'desktop_commander_click',
  'box_click',
  'create_company_click',
  'enterprise_click',
  'final_cta_click',
  // max's art-direction audit (08/10): the header's demo, the home page's prices and trust.
  'demo_click',
  'pricing_click',
  'security_click',
  'local_ai_click',
  // max's site plan (07/10), §19.
  'pricing_view',
  'local_ai_quote_start',
  'enterprise_quote_start',
  'inside_iagent_view',
  // max's global document (07/10), §17.
  'plan_select',
  'box_quote',
  'recruit_agent',
  'recruit_list',
  'personalize_agent',
  'create_idea_submit',
  'opportunity_view',
  'opportunity_build_company',
  'voice_demo',
  'phone_number_request',
  'call_center_quote',
  'local_ai_contact',
  'enterprise_contact',
];

export function suivre(evenement, donnees = {}) {
  if (!EVENEMENTS.includes(evenement)) throw new Error(`événement inconnu : ${evenement}`);
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer?.push({ event: evenement, ...donnees });
    window.dispatchEvent(new CustomEvent('iagent:analytique', { detail: { evenement, ...donnees } }));
  } catch { /* measuring must never break the page */ }
}
