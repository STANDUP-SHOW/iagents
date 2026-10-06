import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { euros } from '../composants.jsx';
import { useScene, MOBILE, BUREAU, gsap } from '../mouvement.js';

const MODES = [
  ['Local', 'Vos agents travaillent sur votre machine. Rien ne quitte vos bureaux, aucun jeton facturé.'],
  ['Hybride', 'Le quotidien en local, l’API seulement pour ce que la machine ne porte pas. Vous êtes prévenu avant.'],
  ['Cloud', 'Sans matériel : vos agents passent par l’API, avec votre propre clé, rangée sur votre poste.'],
];

const MATRICE = [
  ['Lire un dossier', 'Autorisé', 'ok'],
  ['Préparer un devis', 'Autorisé', 'ok'],
  ['Envoyer un devis', 'Selon votre règle', 'regle'],
  ['Engager une dépense', 'Votre validation', 'humain'],
];

const GARDES = [
  ['Permissions', 'Chaque agent n’ouvre que ce que vous lui confiez.'],
  ['Approbations', 'Vous décidez des tâches qui attendent votre accord.'],
  ['Traçabilité', 'Chaque action et chaque envoi sont consignés.'],
  ['Supervision', 'Vous voyez tout depuis le Desktop Commander.'],
];

/** Scene 13 — deliberately calm: your company, your data, your rules. */
export default function TrustInfrastructure() {
  const ref = useRef(null);
  const { prixAgent, financement } = donnees;
  useScene(ref, (ajouter) => {
    const doux = (q) => q('.tr-bloc').forEach((el) => gsap.from(el, { opacity: 0, y: 24, duration: 1.2, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
    ajouter(BUREAU, doux);
    ajouter(MOBILE, doux);
  });

  return (
    <section ref={ref} id="confiance" className="scene bg-[var(--fond-2)] border-y border-[var(--trait)]" aria-labelledby="titre-confiance">
      <div className="cadre">
        <h2 id="titre-confiance" className="tr-bloc titre-display titre-moyen">Votre entreprise.<br />Vos données.<br /><span className="text-[var(--texte-doux)]">Vos règles.</span></h2>

        <ul className="tr-bloc mt-14 grid md:grid-cols-3 gap-px bg-[var(--trait)] rounded-[var(--rayon)] overflow-hidden border border-[var(--trait)]">
          {MODES.map(([nom, texte]) => (
            <li key={nom} className="bg-[var(--fond-2)] p-7">
              <p className="font-[Orbitron] text-[0.8rem] tracking-[0.24em] uppercase text-[var(--cyan)]">{nom}</p>
              <p className="mt-3 text-[0.95rem] text-[var(--texte-doux)] leading-relaxed">{texte}</p>
            </li>
          ))}
        </ul>

        <div className="mt-20 grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <div className="tr-bloc">
            <h3 className="titre-display titre-petit">Autonome ne signifie pas incontrôlé.</h3>
            <p className="chapeau mt-4">L'agent va seul là où vous l'y autorisez. Ce qui engage l'entreprise attend une règle ou votre accord, et rien ne part par courriel sans que le texte exact ait été relu.</p>
            <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
              {GARDES.map(([nom, texte]) => (
                <li key={nom}><p className="text-white text-[0.98rem]">{nom}</p><p className="text-[0.82rem] text-[var(--texte-pale)] leading-snug">{texte}</p></li>
              ))}
            </ul>
          </div>
          <div className="tr-bloc verre p-6 md:p-8">
            <p className="note mb-4">Exemple de règles pour Julie</p>
            <table className="w-full text-left">
              <caption className="sr-only">Ce que Julie peut faire seule</caption>
              <thead><tr className="text-[0.75rem] uppercase tracking-[0.12em] text-[var(--texte-pale)]"><th className="pb-3 font-medium">Action</th><th className="pb-3 font-medium text-right">Décision</th></tr></thead>
              <tbody>
                {MATRICE.map(([action, decision, sorte]) => (
                  <tr key={action} className="border-t border-[var(--trait)]">
                    <td className="py-3.5 text-[0.95rem]">{action}</td>
                    <td className="py-3.5 text-right">
                      <span className={`puce ${sorte === 'ok' ? 'puce-cyan' : sorte === 'humain' ? 'puce-corail' : ''}`}>{decision}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="tr-bloc mt-20 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <h3 className="titre-display titre-petit">Des prix lisibles,<br />toujours séparés.</h3>
          </div>
          <div className="verre p-6">
            <p className="note">Chaque agent</p>
            <p className="mt-1"><span className="font-[Sora] text-3xl font-semibold">{euros(prixAgent.mensuel)}</span><span className="text-[var(--texte-doux)]"> / mois</span></p>
            <p className="text-sm text-[var(--texte-doux)]">ou {euros(prixAgent.achat)} à l'achat</p>
          </div>
          <div className="verre p-6">
            <p className="note">Votre machine, si vous en prenez une</p>
            <p className="mt-1 text-[0.95rem] text-[var(--texte)]">Achat ou financement sur {financement.mois} mois, et l'abonnement de la box, chacun sur sa ligne.</p>
            <a href="/catalogue?page=box" className="inline-block mt-2 text-sm text-[var(--cyan)] font-semibold">Voir les machines et leurs prix</a>
          </div>
        </div>
      </div>
    </section>
  );
}
