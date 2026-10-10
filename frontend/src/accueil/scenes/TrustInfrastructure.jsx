import { useRef } from 'react';
import { Bouton, Icone } from '../composants.jsx';
import { useScene, MOBILE, BUREAU, gsap } from '../mouvement.js';

const MODES = [
  ['serveur', 'Local', 'Vos agents travaillent sur votre machine. Rien ne quitte vos bureaux.'],
  ['hybride', 'Hybride', 'Le quotidien en local, l’API seulement pour ce que la machine ne porte pas. Vous êtes prévenu avant.'],
  ['nuage', 'Cloud', 'Sans matériel : vos agents passent par l’API, avec votre propre clé, rangée sur votre poste.'],
];

const GARDES = [
  ['cle', 'Permissions', 'chaque agent n’ouvre que ce que vous lui confiez'],
  ['coche', 'Approbations', 'vous choisissez ce qui attend votre accord'],
  ['doc', 'Traçabilité', 'chaque action et chaque envoi consignés'],
  ['ecran', 'Supervision', 'tout se voit depuis le Desktop Commander'],
];

/** Scene 13 — calm: three ways to run, four guard rails, two pages to read. */
export default function TrustInfrastructure() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    const doux = (q) => q('.tr-bloc').forEach((el) => gsap.from(el, { opacity: 0, y: 24, duration: 1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
    ajouter(BUREAU, doux);
    ajouter(MOBILE, doux);
  });

  return (
    <section ref={ref} id="confiance" className="scene" aria-labelledby="titre-confiance">
      <div className="cadre">
        <div className="tr-bloc text-center max-w-3xl mx-auto">
          <p className="surtitre justify-center">Local, hybride ou cloud</p>
          <h2 id="titre-confiance" className="titre-display titre-grand mt-4">Votre entreprise. Vos données. <span className="degrade-froid">Vos règles.</span></h2>
        </div>

        <ul className="mt-12 grid md:grid-cols-3 gap-4">
          {MODES.map(([icone, nom, texte]) => (
            <li key={nom} className="tr-bloc neon neon-survol p-6 md:p-7">
              <span className="anneau"><Icone nom={icone} taille={22} /></span>
              <p className="mt-5 font-[Montserrat] font-extrabold text-2xl text-white">{nom}</p>
              <p className="mt-2 text-[0.92rem] text-[var(--texte-doux)] leading-relaxed">{texte}</p>
            </li>
          ))}
        </ul>

        <ul className="tr-bloc mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {GARDES.map(([icone, nom, texte], i) => (
            <li key={nom} className="flex items-start gap-3">
              <span className={`anneau !w-10 !h-10 ${i === 1 ? 'anneau-rose' : ''}`}><Icone nom={icone} taille={18} /></span>
              <span><span className="block text-white text-[0.95rem] font-semibold">{nom}</span><span className="block text-[0.8rem] text-[var(--texte-pale)] leading-snug">{texte}</span></span>
            </li>
          ))}
        </ul>

        <div className="tr-bloc mt-12 flex flex-wrap justify-center gap-3">
          <Bouton href="/security" variante="contour" evenement="security_click">Sécurité et contrôle</Bouton>
          <Bouton href="/local-ai" variante="contour" evenement="local_ai_click">IA locale et hybride</Bouton>
        </div>
      </div>
    </section>
  );
}
