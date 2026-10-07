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
  // max's site plan (07/10), §19.
  'pricing_view',
  'box_plan_select',
  'local_ai_quote_start',
  'enterprise_quote_start',
  'inside_iagent_view',
];

export function suivre(evenement, donnees = {}) {
  if (!EVENEMENTS.includes(evenement)) throw new Error(`événement inconnu : ${evenement}`);
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer?.push({ event: evenement, ...donnees });
    window.dispatchEvent(new CustomEvent('iagent:analytique', { detail: { evenement, ...donnees } }));
  } catch { /* measuring must never break the page */ }
}
