// Motion for the home page: one local timeline per scene, built in an effect
// and reverted when the scene unmounts. The markup is always the scene's
// final state (that is what the prerender and a reduced-motion visitor see);
// animations only start from somewhere else and come back to it.
import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export const BUREAU = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';
export const MOBILE = '(max-width: 899px) and (prefers-reduced-motion: no-preference)';

let enregistre = false;

/**
 * useScene(ref, (ajouter, q) => { ajouter(BUREAU, () => {...}); ajouter(MOBILE, ...) })
 * `ajouter` is gsap.matchMedia().add, scoped to the scene: what a condition
 * built is undone when it stops matching (resize, rotation, reduced motion).
 * `q` selects inside the scene only, never across the page.
 */
export function useScene(ref, construire) {
  useEffect(() => {
    if (!ref.current) return undefined;
    if (!enregistre) { gsap.registerPlugin(ScrollTrigger); enregistre = true; }
    const mm = gsap.matchMedia(ref.current);
    const q = gsap.utils.selector(ref.current);
    construire((condition, fn) => mm.add(condition, () => fn(q)), q);
    return () => mm.revert();
    // The build function is the scene's; it does not change between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Refresh the triggers once fonts and images have settled the layout. */
export function rafraichirApresChargement() {
  const go = () => ScrollTrigger.refresh();
  if (document.fonts?.ready) document.fonts.ready.then(go);
  window.addEventListener('load', go, { once: true });
}

export { gsap, ScrollTrigger };
