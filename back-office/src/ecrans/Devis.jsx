// Demandes de devis Home / Business / Enterprise (MASTER §15). Le contrat
// n'a aucune route de demande : l'écran le dit, et garde le calcul de devis
// public (POST /tarifs/devis) pour répondre à une demande reçue ailleurs.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Resultat, RouteAbsente, lignesDe } from '../composants.jsx';
import { Apercu } from './commun.jsx';

export const lectures = [['plansPublics', {}]];

export function corpsDevis(lignes, region, jour) {
  const propres = lignes.filter((l) => l.plan_id).map((l) => ({ plan_id: l.plan_id, quantite: Number(l.quantite) }));
  if (!propres.length) throw new Error('Ajoutez au moins une ligne avec un plan.');
  for (const l of propres) if (!Number.isInteger(l.quantite) || l.quantite < 1) throw new Error(`Quantité invalide pour ${l.plan_id}.`);
  return { lignes: propres, region, date: jour };
}

export default function Devis() {
  const plans = useLecture('plansPublics');
  const liste = lignesDe(plans.donnees, 'plans') ?? [];
  const [lignes, setLignes] = useState([{ plan_id: '', quantite: 1 }]);
  const [region, setRegion] = useState('FR');
  const [jour, setJour] = useState(new Date().toISOString().slice(0, 10));
  const [etat, lancer] = useAction();
  const poserLigne = (i, k, v) => setLignes(lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <>
      <Panneau titre="Demandes de devis">
        <RouteAbsente
          titre="Aucune route de demande de devis au contrat"
          ceQuiManque="docs/master/routes.md ne prévoit ni le dépôt d'une demande de devis Home, Business ou Enterprise depuis les sites, ni sa lecture : le back-office ne peut afficher aucune demande. Rien n'est inventé ici."
          proposition={[
            { methode: 'POST', chemin: '/devis/demandes', acces: 'public', role: '{segment: home|business|enterprise, nom, email, telephone?, pays, besoin, lignes?:[{plan_id, quantite}], consentement_contact} — refus sans consentement' },
            { methode: 'GET', chemin: '/devis/demandes', acces: 'admin', role: '?segment=&statut= demandes reçues' },
            { methode: 'POST', chemin: '/devis/demandes/:id/statut', acces: 'admin', role: '{statut: nouvelle|en-cours|envoyee|gagnee|perdue, motif, devis?}' },
          ]}
        />
      </Panneau>
      <Panneau titre="Chiffrer un devis" sousTitre="HT, TVA, TTC et détail calculés par la plateforme (POST /tarifs/devis), sur les plans visibles.">
        <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('devis', () => ({ corps: corpsDevis(lignes, region, jour) })); }}>
          <Lecture lecture={plans}>
            {() => (
              <>
                {lignes.map((l, i) => (
                  <div className="grille" key={i}>
                    <Champ libelle={`Plan ${i + 1}`}><select value={l.plan_id} onChange={(e) => poserLigne(i, 'plan_id', e.target.value)}>
                      <option value="">Choisir…</option>
                      {liste.map((p) => <option key={`${p.plan_id}@${p.region}`} value={p.plan_id}>{p.nom} ({p.plan_id})</option>)}
                    </select></Champ>
                    <Champ libelle="Quantité"><input inputMode="numeric" value={l.quantite} onChange={(e) => poserLigne(i, 'quantite', e.target.value)} /></Champ>
                  </div>
                ))}
              </>
            )}
          </Lecture>
          <div className="grille">
            <Champ libelle="Pays"><input value={region} maxLength={2} onChange={(e) => setRegion(e.target.value)} /></Champ>
            <Champ libelle="Date"><input type="date" value={jour} onChange={(e) => setJour(e.target.value)} /></Champ>
          </div>
          <div className="rangee">
            <Bouton onClick={() => setLignes([...lignes, { plan_id: '', quantite: 1 }])}>Ajouter une ligne</Bouton>
            <button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Chiffrer</button>
          </div>
          <Resultat etat={etat} succes={(c) => <Apercu valeur={c} />} />
        </form>
      </Panneau>
    </>
  );
}
