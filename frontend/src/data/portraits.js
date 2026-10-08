// Portraits: max's bank of AI-generated professional portraits, cut from his
// sheets (public/portraits/agents). The same one for a fiche every time (its
// number picks it), so a profile keeps its face from one visit to the next,
// in the library as on its search page. The first name is not shown: the
// client gives it at the hiring interview.
export const NOMBRE_DE_PORTRAITS = 428;
export const PORTRAITS = Array.from({ length: NOMBRE_DE_PORTRAITS }, (_, i) => `/portraits/agents/a${String(i + 1).padStart(3, '0')}.webp`);
export const portraitDe = (agent) => {
  const n = parseInt(String(agent?.id ?? '').slice(3), 10) || 0;
  // A stride prime to the bank's size (428 = 4 x 107) spreads neighbours apart.
  return PORTRAITS[(n * 37) % PORTRAITS.length];
};
