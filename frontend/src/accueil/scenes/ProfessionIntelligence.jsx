import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Fleche, nombre } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';
import { suivre } from '../analytique.js';

/**
 * Scene 05 — the same job in three worlds: the accountant of a print shop, of
 * a real-estate agency and of an industrial plant, each with the words and
 * software of its activity pack. The catalogue's counts on one line under it.
 */
export default function ProfessionIntelligence() {
  const ref = useRef(null);
  const { compteurs, metierDansTroisMondes: m } = donnees;
  const CHIFFRES = [
    [compteurs.fiches, 'métiers'],
    [compteurs.secteurs, 'secteurs'],
    [compteurs.activites, 'activités'],
    [compteurs.logiciels, 'logiciels'],
    [compteurs.taches, 'tâches décrites'],
  ];

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.from(q('.pi-monde'), { opacity: 0, y: 50, stagger: 0.2, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: q('.pi-mondes')[0], start: 'top 75%' } });
      // The three cards light the same row together: same job, other world.
      gsap.timeline({ repeat: -1, scrollTrigger: { trigger: q('.pi-mondes')[0], start: 'top 60%', toggleActions: 'play pause resume pause' } })
        .to(q('.pi-rang-mots'), { backgroundColor: 'rgba(3,243,255,0.07)', duration: 0.8 }).to(q('.pi-rang-mots'), { backgroundColor: 'rgba(3,243,255,0)', duration: 0.8 }, '+=1.4')
        .to(q('.pi-rang-log'), { backgroundColor: 'rgba(229,0,126,0.08)', duration: 0.8 }).to(q('.pi-rang-log'), { backgroundColor: 'rgba(229,0,126,0)', duration: 0.8 }, '+=1.4');
      gsap.from(q('.pi-chiffre'), { opacity: 0, y: 16, stagger: 0.1, duration: 0.7, scrollTrigger: { trigger: q('.pi-chiffres')[0], start: 'top 90%' } });
    });
    ajouter(MOBILE, (q) => q('.pi-monde').forEach((el) => gsap.from(el, { opacity: 0, y: 24, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 90%' } })));
  });

  return (
    <section ref={ref} className="scene" aria-labelledby="titre-metier">
      <div className="cadre">
        <div className="text-center max-w-4xl mx-auto">
          <p className="surtitre justify-center">Un même métier, trois mondes</p>
          <h2 id="titre-metier" className="titre-display titre-grand mt-4">Un métier ne tient pas <span className="degrade-froid">dans un prompt.</span></h2>
        </div>

        <div className="pi-mondes mt-14 grid md:grid-cols-3 gap-5">
          {m.activites.map((a) => (
            <a key={a.nom} href={a.url} className="pi-monde neon neon-survol p-6 flex flex-col gap-4" onClick={() => suivre('catalog_click', { activite: a.nom })}>
              <p className="marge !text-[0.6rem]">{m.metier.metier}</p>
              <p className="font-[Montserrat] font-extrabold text-xl text-white leading-tight min-h-[2.6em]">{a.nom}</p>
              <div className="pi-rang-mots rounded-xl -mx-2 px-2 py-2">
                <p className="note mb-2">Ses mots</p>
                <ul className="flex flex-wrap gap-1.5">{a.vocabulaire.map((v) => <li key={v} className="puce">{v}</li>)}</ul>
              </div>
              <div className="pi-rang-log rounded-xl -mx-2 px-2 py-2">
                <p className="note mb-2">Ses logiciels</p>
                <ul className="flex flex-wrap gap-1.5">{a.logiciels.map((v) => <li key={v} className="puce puce-cyan">{v}</li>)}</ul>
              </div>
              <span className="mt-auto inline-flex items-center gap-2 text-sm text-[var(--cyan)] font-semibold">Voir ce poste <Fleche /></span>
            </a>
          ))}
        </div>

        <dl className="pi-chiffres mt-14 neon neon-calme !rounded-full px-6 py-4 flex flex-wrap justify-center gap-x-10 gap-y-3">
          {CHIFFRES.map(([n, nom]) => (
            <div key={nom} className="pi-chiffre flex items-baseline gap-2">
              <dd className="font-[Montserrat] font-extrabold text-white text-xl md:text-2xl">{nombre(n)}</dd>
              <dt className="text-[0.8rem] text-[var(--texte-doux)]">{nom}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
