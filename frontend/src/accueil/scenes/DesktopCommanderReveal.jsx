import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Bouton, Icone, Logo, nombre } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

// The centre of the application as max's mockup draws it (08/10): the brain
// in the middle, the menus in orbit as lit bubbles, the vocal dock on the
// left, the day's activity on the right. Example data, said so below.
const BULLES = [
  { nom: 'Vos agents', valeur: '6', detail: '4 au travail', icone: 'equipe', angle: -90 },
  { nom: 'Le travail', valeur: '21/22', detail: 'tâches prêtes', icone: 'agenda', angle: -30, rose: true },
  { nom: 'Courrier', valeur: '3', detail: 'à relire', icone: 'email', angle: 30 },
  { nom: 'Connexions', valeur: '4', detail: 'outils ouverts', icone: 'reseau', angle: 90, rose: true },
  { nom: 'Machine', valeur: 'OK', detail: 'charge jugée', icone: 'serveur', angle: 150 },
  { nom: 'Équipe', valeur: '8', detail: 'collaborateurs', icone: 'visage', angle: 210, rose: true },
];

const ACTIVITE = [
  ['julie', 'Julie a relancé 4 devis', 'il y a 2 min'],
  ['thomas', 'Thomas a livré l’étude Espagne', 'il y a 9 min'],
  ['samir', 'Samir attend votre accord', 'il y a 14 min'],
];

/** Scene 11 — the real product takes the stage, drawn as the new app is. */
export default function DesktopCommanderReveal() {
  const ref = useRef(null);
  const { compteurs } = donnees;

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: q('.dc-ecran')[0], start: 'top 75%' } })
        .from(q('.dc-ecran'), { y: 80, rotateX: 10, transformPerspective: 1600, opacity: 0, duration: 1.2 })
        .from(q('.dc-coeur'), { scale: 0.6, opacity: 0, duration: 0.8 }, 0.5)
        .from(q('.dc-bulle'), { scale: 0.5, opacity: 0, duration: 0.6, stagger: 0.18, ease: 'back.out(1.6)' }, 0.8)
        .from(q('.dc-cote'), { opacity: 0, x: (i) => (i ? 30 : -30), duration: 0.8 }, 1)
        .from(q('.dc-act'), { opacity: 0, y: 10, stagger: 0.2, duration: 0.5 }, 1.4);
    });
    ajouter(MOBILE, (q) => {
      gsap.from(q('.dc-ecran'), { opacity: 0, y: 40, duration: 1, scrollTrigger: { trigger: q('.dc-ecran')[0], start: 'top 88%' } });
    });
  });

  return (
    <section ref={ref} id="desktop-commander" className="scene overflow-hidden" aria-labelledby="titre-desktop">
      <div className="cadre">
        <div className="text-center max-w-3xl mx-auto">
          <p className="surtitre justify-center">iAgent Desktop Commander</p>
          <h2 id="titre-desktop" className="titre-display titre-grand mt-4">Toute votre organisation. <span className="degrade-froid">Sous vos yeux.</span></h2>
        </div>

        <figure className="mt-12">
          <div className="dc-ecran neon !rounded-[22px] p-3 md:p-4">
            <div className="flex items-center gap-3 px-2 pb-3 border-b border-[var(--trait)]">
              <Logo className="h-5 w-auto" />
              <span className="hidden sm:inline text-[0.8rem] font-bold text-[var(--cyan)]">Desktop Commander</span>
              <span className="ml-auto hidden md:flex items-center gap-2 text-[0.75rem] text-[var(--texte-pale)] border border-[var(--trait)] rounded-full px-3 py-1.5 w-[40%]">Dites ce que vous voulez faire…</span>
              <span className="ml-auto md:ml-0 flex items-center gap-2 text-[0.72rem] text-[var(--texte-doux)]"><span className="w-2 h-2 rounded-full bg-[#39e58c]" /> Rien ne bloque</span>
            </div>

            <div className="grid md:grid-cols-[0.8fr_2fr_0.95fr] gap-3 pt-3">
              <aside className="dc-cote hidden md:flex neon neon-calme !rounded-2xl p-4 flex-col items-center text-center" aria-label="Commande vocale">
                <p className="text-[0.6rem] tracking-[0.24em] uppercase text-[var(--texte-doux)]">Commande vocale</p>
                <div className="relative my-5 w-28 h-28 rounded-full flex items-center justify-center pulse-lent" style={{ border: '1px solid rgba(3,243,255,.6)', background: 'radial-gradient(circle, rgba(3,243,255,.18), rgba(3,9,20,.9) 70%)' }}>
                  <span className="absolute inset-[-10px] rounded-full border border-dashed border-[rgba(229,0,126,.5)] tourne-lent" />
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#03f3ff" strokeWidth="1.6" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                </div>
                <p className="font-[Montserrat] font-bold text-white text-lg leading-tight">Parlez à Julie</p>
                <p className="text-[0.75rem] text-[var(--cyan)]">En écoute…</p>
                <div className="mt-3 flex items-end gap-[3px] h-4" aria-hidden="true">
                  {[5, 10, 14, 8, 12, 16, 9, 6, 11, 15, 7].map((h, i) => <span key={i} className="onde w-[3px] rounded-full bg-[var(--cyan)]" style={{ height: h, animationDelay: `${i * 90}ms` }} />)}
                </div>
                <p className="mt-auto pt-5 text-[0.72rem] text-[var(--texte-pale)] italic">« Voice, Julie, où en sont mes devis ? »</p>
              </aside>

              <div className="relative aspect-square md:aspect-[4/3.1] orbite-pause overflow-hidden" role="img" aria-label="Le centre de l'application : le cerveau iAgent au milieu, et autour, vos agents, le travail du jour, le courrier, les connexions, la machine et l'équipe.">
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 aspect-square h-full">
                <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" aria-hidden="true">
                  <g className="tourne-lent"><circle cx="50" cy="50" r="36" fill="none" stroke="rgba(3,243,255,.22)" strokeWidth=".3" strokeDasharray="1 1.4" /></g>
                  <g className="tourne-lent-inverse"><circle cx="50" cy="50" r="24" fill="none" stroke="rgba(229,0,126,.3)" strokeWidth=".3" strokeDasharray="0.6 1.8" /></g>
                  <path d="M-10 108 Q 50 62 110 108" fill="none" stroke="rgba(3,243,255,.55)" strokeWidth=".4" />
                  {BULLES.map((b) => {
                    const a = (b.angle * Math.PI) / 180;
                    return <line key={b.nom} x1="50" y1="50" x2={50 + 36 * Math.cos(a)} y2={50 + 36 * Math.sin(a)} stroke="rgba(3,243,255,.25)" strokeWidth=".25" strokeDasharray="1 1" />;
                  })}
                </svg>
                <div className="dc-coeur absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <span className="w-[4.5rem] h-[4.5rem] md:w-24 md:h-24 rounded-[22px] overflow-hidden" style={{ boxShadow: '0 0 40px rgba(3,243,255,.5), 0 0 80px -10px rgba(229,0,126,.5)' }}>
                    <img src="/accueil/icone-iagent.png" alt="" width="128" height="128" className="w-full h-full object-cover" />
                  </span>
                  <span className="mt-2 font-[Montserrat] font-bold text-white text-sm">Victor</span>
                  <span className="text-[0.55rem] tracking-[0.2em] uppercase text-[#ff6fb5]">Task Commander</span>
                </div>
                {BULLES.map((b) => {
                  const a = (b.angle * Math.PI) / 180;
                  return (
                    <div key={b.nom} className="dc-bulle absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + 36 * Math.cos(a)}%`, top: `${50 + 36 * Math.sin(a)}%` }}>
                      <div className="w-[4.6rem] h-[4.6rem] md:w-[5.6rem] md:h-[5.6rem] rounded-full flex flex-col items-center justify-center text-center" style={{ border: `1px solid ${b.rose ? 'rgba(229,0,126,.6)' : 'rgba(3,243,255,.6)'}`, background: 'radial-gradient(circle, rgba(3,243,255,.10), rgba(3,9,20,.92) 70%)', boxShadow: `0 0 24px -6px ${b.rose ? 'rgba(229,0,126,.7)' : 'rgba(3,243,255,.7)'}` }}>
                        <Icone nom={b.icone} taille={14} className="text-[var(--cyan)]" />
                        <b className="font-[Montserrat] text-white text-sm md:text-base leading-none mt-1">{b.valeur}</b>
                        <span className="text-[0.48rem] md:text-[0.55rem] uppercase tracking-[0.08em] text-white mt-1 leading-none">{b.nom}</span>
                        <span className="hidden md:block text-[0.5rem] text-[var(--texte-pale)] leading-none mt-0.5">{b.detail}</span>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>

              <aside className="dc-cote hidden md:flex flex-col gap-3" aria-label="Activité en cours">
                <div className="neon neon-calme !rounded-2xl p-4">
                  <p className="text-[0.7rem] text-[var(--texte-doux)]">Jeudi</p>
                  <p className="font-[Montserrat] font-extrabold text-[var(--cyan)] text-4xl leading-none mt-1">09:18</p>
                  <p className="text-[0.68rem] italic text-[var(--texte-pale)] mt-2">Votre équipe travaille depuis 7 h.</p>
                </div>
                <div className="neon neon-calme !rounded-2xl p-4 flex-1">
                  <p className="text-[0.62rem] tracking-[0.22em] uppercase text-white">Activité en cours</p>
                  <ul className="mt-3 space-y-3">
                    {ACTIVITE.map(([p, t, h]) => (
                      <li key={p} className="dc-act flex items-center gap-2.5">
                        <img src={`/accueil/${p}.webp`} alt="" width="32" height="32" className="w-8 h-8 rounded-full object-cover" />
                        <span className="min-w-0"><span className="block text-[0.74rem] text-white leading-tight">{t}</span><span className="block text-[0.62rem] text-[var(--texte-pale)]">{h}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </div>
          <figcaption className="note mt-3 text-center">Le centre de l'application, avec des données d'exemple. {nombre(compteurs.fiches)} métiers à embaucher depuis ce même écran.</figcaption>
        </figure>

        <div className="mt-12 flex flex-col items-center text-center gap-6">
          <p className="titre-display titre-moyen">Voyez. Parlez. <span className="degrade">Décidez.</span></p>
          <Bouton href="/workforce" evenement="desktop_commander_click">Découvrir Desktop Commander</Bouton>
        </div>
      </div>
    </section>
  );
}
