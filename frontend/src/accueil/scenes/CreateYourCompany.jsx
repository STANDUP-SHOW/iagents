import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { IntentInput, Bouton, LIENS } from '../composants.jsx';
import { Decor } from './HeroAccomplish.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

/**
 * Scene 15 — a city at dawn: and if you had nothing yet? Only an idea; the
 * five phases build up as a team.
 */
export default function CreateYourCompany() {
  const ref = useRef(null);
  const { phases } = donnees;

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: 1 } })
        .fromTo(q('.decor img'), { yPercent: -3 }, { yPercent: 3, ease: 'none' });
      gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: q('.cy-ouverture')[0], start: 'top 65%' } })
        .from(q('.cy-ligne-1'), { opacity: 0, y: 30, duration: 0.9 })
        .from(q('.cy-ligne-2'), { opacity: 0, y: 30, filter: 'blur(8px)', duration: 1 }, '+=0.2')
        .from(q('.cy-champ'), { opacity: 0, y: 20, duration: 0.8 }, '-=0.3');
      gsap.timeline({ scrollTrigger: { trigger: q('.cy-phases')[0], start: 'top 78%' } })
        .from(q('.cy-trait'), { scaleX: 0, transformOrigin: 'left', duration: 1.6, ease: 'power2.inOut' })
        .from(q('.cy-phase'), { opacity: 0, y: 40, stagger: 0.2, duration: 0.8, ease: 'power3.out' }, 0.2);
    });
    ajouter(MOBILE, (q) => {
      q('.cy-phase').forEach((el) => gsap.from(el, { opacity: 0, y: 24, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 90%' } }));
    });
  });

  return (
    <section ref={ref} id="creer" className="relative overflow-hidden" aria-labelledby="titre-entreprise">
      <Decor nom="ville" voile="linear-gradient(180deg, var(--fond) 0%, rgba(2,8,23,.35) 18%, rgba(2,8,23,.25) 45%, rgba(2,8,23,.85) 72%, var(--fond) 100%)" />
      <div className="au-dessus scene">
        <div className="cy-ouverture cadre flex flex-col items-center text-center min-h-[62svh] justify-center">
          <p className="cy-ligne-1 titre-display titre-grand">Et si vous n'aviez encore rien&nbsp;?</p>
          <h2 id="titre-entreprise" className="cy-ligne-2 titre-display titre-grand mt-2"><span className="degrade">Seulement une idée.</span></h2>
          <div className="cy-champ intention-heros-cadre w-full max-w-2xl mt-10 text-left">
            <IntentInput id="intention-entreprise" cta="Décrire mon idée" evenement="create_company_click" exemples={['Je veux créer une entreprise qui…', 'Je veux créer une entreprise qui livre des repas bio aux bureaux.', 'Je veux créer une entreprise qui recycle le textile.']} />
          </div>
        </div>

        <div className="cadre mt-16 md:mt-24">
          <div className="cy-phases relative">
            <div className="cy-trait hidden lg:block absolute left-[26px] right-[26px] top-[26px] h-px" style={{ background: 'linear-gradient(90deg, #03f3ff, #b98cff, #e5007e)' }} aria-hidden="true" />
            <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {phases.map((p) => (
                <li key={p.numero} className="cy-phase relative">
                  <span className="relative z-10 inline-flex w-[52px] h-[52px] rounded-full items-center justify-center font-[Montserrat] font-bold text-sm text-[var(--cyan)] bg-[var(--fond)] border border-[rgba(3,243,255,0.6)] shadow-[0_0_24px_rgba(3,243,255,0.35)]">{p.numero}</span>
                  <div className="neon neon-calme mt-4 p-4">
                    <h3 className="font-[Montserrat] text-lg font-extrabold uppercase tracking-wide text-white">{p.nom}</h3>
                    <p className="text-[0.78rem] text-[var(--texte-pale)] mt-1">{p.sujets.join(' · ')}</p>
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {p.fiches.map((f) => (
                        <li key={f.id}>
                          <a href={f.url} className="block text-[0.84rem] text-[var(--texte)] hover:text-[var(--cyan)] leading-snug">{f.metier}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-16 flex flex-col items-center text-center gap-6">
            <p className="titre-display titre-moyen">Devenez qui vous <span className="degrade">voulez être.</span></p>
            <Bouton href={LIENS.entreprise} evenement="create_company_click">Créer mon entreprise</Bouton>
          </div>
        </div>
      </div>
    </section>
  );
}
