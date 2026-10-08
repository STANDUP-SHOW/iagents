import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { IntentInput, Bouton, LIENS } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const MANQUES = ['Pas de société.', 'Pas d’équipe.', 'Pas d’expertise dans ce secteur.'];

/** Scene 14 — and if you had nothing yet? Only an idea, and a team by phase. */
export default function CreateYourCompany() {
  const ref = useRef(null);
  const { phases } = donnees;

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      const cadre = q('.cy-ouverture')[0];
      cadre.classList.add('superpose');
      const tl = gsap.timeline({ scrollTrigger: { trigger: q('.cy-scene')[0], start: 'top top', end: '+=180%', scrub: 1, pin: true, anticipatePin: 1 } });
      tl.from(q('.cy-question'), { opacity: 0, y: 30, duration: 0.6 });
      q('.cy-manque').forEach((el) => tl.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }).to(el, { opacity: 0, filter: 'blur(8px)', duration: 0.4 }, '+=0.3'));
      tl.to(q('.cy-question'), { opacity: 0, duration: 0.4 })
        .fromTo(q('.cy-idee'), { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.7 })
        .to({}, { duration: 0.3 });
      gsap.from(q('.cy-phase'), { opacity: 0, y: 50, stagger: 0.15, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: q('.cy-phases')[0], start: 'top 78%' } });
      gsap.from(q('.cy-ligne'), { scaleX: 0, transformOrigin: 'left', duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: q('.cy-phases')[0], start: 'top 78%' } });
      return () => cadre.classList.remove('superpose');
    });
    ajouter(MOBILE, (q) => {
      q('.cy-phase').forEach((el) => gsap.from(el, { opacity: 0, y: 24, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 90%' } }));
    });
  });

  return (
    <section ref={ref} aria-labelledby="titre-entreprise">
      <div className="cy-scene scene epingle">
        <div className="cy-ouverture cadre w-full flex flex-col items-center justify-center text-center min-h-[40svh]">
          <div className="cy-question">
            <p className="titre-display titre-grand">Et si vous n'aviez<br />encore rien&nbsp;?</p>
            <ul className="mt-8 flex flex-col gap-2 text-[var(--texte-doux)] text-xl md:text-2xl font-[Montserrat] font-light">
              {MANQUES.map((m) => <li key={m} className="cy-manque">{m}</li>)}
            </ul>
          </div>
          <div className="cy-idee w-full max-w-2xl mt-14">
            <h2 id="titre-entreprise" className="titre-display titre-grand">Seulement <span className="lumiere">une idée.</span></h2>
            <div className="mt-10 text-left">
              <IntentInput id="intention-entreprise" cta="Décrire mon idée" evenement="create_company_click" exemples={['Je veux créer une entreprise qui…', 'Je veux créer une entreprise qui livre des repas bio aux bureaux.', 'Je veux créer une entreprise qui recycle le textile.']} />
            </div>
          </div>
        </div>
      </div>

      <div className="scene !pt-0">
        <div className="cadre">
          <div className="cy-phases relative">
            <div className="cy-ligne hidden lg:block absolute left-0 right-0 top-[26px] h-px bg-gradient-to-r from-[var(--cyan)] via-[rgba(3,243,255,0.4)] to-[var(--corail)]" aria-hidden="true" />
            <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {phases.map((p) => (
                <li key={p.numero} className="cy-phase relative">
                  <span className="relative z-10 inline-flex w-[52px] h-[52px] rounded-full items-center justify-center font-[Montserrat] text-sm text-[var(--cyan)] bg-[var(--fond)] border border-[rgba(3,243,255,0.45)] shadow-[0_0_24px_rgba(3,243,255,0.25)]">{p.numero}</span>
                  <h3 className="mt-4 font-[Montserrat] text-xl font-semibold uppercase tracking-wide">{p.nom}</h3>
                  <p className="text-[0.82rem] text-[var(--texte-pale)] mt-1">{p.sujets.join(' · ')}</p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {p.fiches.map((f) => (
                      <li key={f.id}>
                        <a href={f.url} className="verre !rounded-xl px-3 py-2.5 block hover:border-[rgba(3,243,255,0.35)] transition-colors">
                          <p className="text-[0.88rem] text-white leading-tight">{f.metier}</p>
                          <p className="text-[0.72rem] text-[var(--texte-pale)]">{f.id} · {f.secteur}</p>
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <p className="titre-display titre-petit">L'équipe évolue avec votre entreprise.<br /><span className="text-[var(--texte-doux)]">Vous apportez l'ambition. iAgent construit les moyens.</span></p>
            <Bouton href={LIENS.entreprise} evenement="create_company_click">Décrire mon idée</Bouton>
          </div>
        </div>
      </div>
    </section>
  );
}
