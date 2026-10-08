// Opportunités du jour (MASTER §9, §15) : générer, relire, publier.
import { useState } from 'react';
import { useAction, useLecture } from '../donnees.jsx';
import { Bouton, Lecture, Panneau, Pastille, Resultat, Tableau, date, lignesDe, nombre } from '../composants.jsx';
import { Apercu } from './commun.jsx';

export const lectures = [['opportunitesToutes', {}]];
const TON = { brouillon: 'info', publiee: 'succes', retiree: 'neutre' };

function Publier({ id, onFini }) {
  const [etat, lancer] = useAction();
  return (
    <>
      <Bouton principal disabled={etat.statut === 'en-cours'} onClick={() => lancer('publierOpportunite', { params: { id } }, onFini)}>Publier</Bouton>
      <Resultat etat={etat} succes={(c) => `« ${c?.titre ?? id} » : ${c?.statut ?? '?'}.`} />
    </>
  );
}

export default function Opportunites({ ouverteInitiale = '' }) {
  const lecture = useLecture('opportunitesToutes');
  const [etatGen, generer] = useAction();
  const [ouverte, setOuverte] = useState(ouverteInitiale);
  const lignes = (lignesDe(lecture.donnees, 'opportunites') ?? []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.score ?? 0) - (a.score ?? 0));
  const relue = lignes.find((o) => o.id === ouverte);
  return (
    <>
      <Panneau
        titre="Opportunités du jour"
        sousTitre="Brouillons et publiées (GET /create/opportunites/toutes). La génération demande la clé du moteur d'IA sur la plateforme."
        actions={<Bouton principal disabled={etatGen.statut === 'en-cours'} onClick={() => generer('genererOpportunites', { corps: {} }, () => lecture.recharger())}>Générer les brouillons du jour</Bouton>}
      >
        <Resultat etat={etatGen} succes={(c) => `${nombre(Array.isArray(c) ? c.length : (lignesDe(c, 'opportunites') ?? []).length)} brouillon(s) généré(s).`} />
        <Lecture lecture={lecture}>
          {() => (
            <Tableau vide="Aucune opportunité." lignes={lignes} cle={(o) => o.id}
              colonnes={[
                { titre: 'Date', rendu: (o) => date(o.date) },
                { titre: 'Opportunité', rendu: (o) => <><strong>{o.titre}</strong><br /><span className="petit">{o.marche}</span></> },
                { titre: 'Score', rendu: (o) => <span className="score">{nombre(o.score)}</span> },
                { titre: 'Statut', rendu: (o) => <Pastille ton={TON[o.statut] ?? 'neutre'}>{o.statut}</Pastille> },
                { titre: 'Étude', rendu: (o) => (o.etude_id ? <code>{o.etude_id}</code> : '—') },
                { titre: '', rendu: (o) => <div className="rangee"><Bouton onClick={() => setOuverte(o.id)}>Relire</Bouton>{o.statut === 'brouillon' ? <Publier id={o.id} onFini={() => lecture.recharger()} /> : null}</div> },
              ]} />
          )}
        </Lecture>
      </Panneau>
      {relue ? (
        <Panneau titre={`Relecture : ${relue.titre}`} sousTitre={`${relue.marche} · score ${nombre(relue.score)} · ${relue.statut}`} actions={<Bouton onClick={() => setOuverte('')}>Fermer</Bouton>}>
          <Apercu valeur={relue.carte} />
        </Panneau>
      ) : null}
    </>
  );
}
