// Personas et voix (MASTER §8, §10, §15).
import { useState } from 'react';
import { useAction } from '../donnees.jsx';
import { Champ, Panneau, Resultat, RouteAbsente, lireJson } from '../composants.jsx';

export const lectures = [];

/** VoiceProfile body (plateforme/modele.ts) built from the form; throws a French sentence. */
export function corpsProfil(f) {
  const voix = lireJson(f.voix_par_moteur, 'Les voix par moteur');
  if (!voix || typeof voix !== 'object' || Array.isArray(voix)) throw new Error('Les voix par moteur doivent être un objet { moteur: identifiant de voix }.');
  const ordre = f.ordre_de_repli.split(',').map((s) => s.trim()).filter(Boolean);
  if (!ordre.length) throw new Error("Indiquez au moins un moteur dans l'ordre de repli.");
  return { id: f.id.trim(), persona_id: f.persona_id.trim() || null, locale: f.locale.trim(), voix_par_moteur: voix, ordre_de_repli: ordre, palier: f.palier };
}

export default function Personas() {
  const [f, setF] = useState({
    id: '', persona_id: '', locale: 'fr-FR', palier: 'standard', ordre_de_repli: 'gemini-live, elevenlabs, local',
    voix_par_moteur: JSON.stringify({ 'gemini-live': 'Aoede', elevenlabs: '', local: 'fr_FR-siwis-medium' }, null, 2),
  });
  const [etat, lancer] = useAction();
  const poser = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Panneau titre="Profil de voix" sousTitre="Une identité vocale stable par persona, quel que soit le moteur (PUT /voix/profils/:id).">
        <form className="formulaire" onSubmit={(e) => { e.preventDefault(); lancer('profilVoix', () => { const corps = corpsProfil(f); return { params: { id: corps.id }, corps }; }); }}>
          <div className="grille">
            <Champ libelle="Identifiant du profil"><input value={f.id} onChange={poser('id')} required /></Champ>
            <Champ libelle="Persona"><input value={f.persona_id} onChange={poser('persona_id')} /></Champ>
            <Champ libelle="Langue"><input value={f.locale} onChange={poser('locale')} required /></Champ>
            <Champ libelle="Palier"><select value={f.palier} onChange={poser('palier')}><option value="standard">standard</option><option value="premium">premium</option></select></Champ>
          </div>
          <Champ libelle="Ordre de repli des moteurs (séparés par des virgules)"><input value={f.ordre_de_repli} onChange={poser('ordre_de_repli')} /></Champ>
          <Champ libelle="Voix par moteur (JSON)"><textarea className="code" rows={6} value={f.voix_par_moteur} onChange={poser('voix_par_moteur')} spellCheck={false} /></Champ>
          <div className="rangee"><button type="submit" className="bouton bouton-principal" disabled={etat.statut === 'en-cours'}>Enregistrer le profil</button></div>
          <Resultat etat={etat} succes={(c) => `profil ${c?.id ?? f.id} (${c?.locale ?? f.locale}), repli ${(c?.ordre_de_repli ?? []).join(' → ')}.`} />
        </form>
      </Panneau>
      <Panneau titre="Personas, réputation, avis, entreprises actives">
        <RouteAbsente
          titre="Lecture des personas et des profils de voix absente du contrat"
          ceQuiManque="Le contrat permet d'écrire un profil de voix mais pas de le relire, et n'a aucune route pour les personas (visuel, personnalité), leur réputation, les avis clients ni les entreprises actives : l'écran ne peut rien en montrer."
          proposition={[
            { methode: 'GET', chemin: '/voix/profils', acces: 'admin', role: 'tous les VoiceProfile' },
            { methode: 'GET', chemin: '/controle/personas', acces: 'admin', role: 'Persona (modele.ts) avec voice_profile_id' },
            { methode: 'PUT', chemin: '/controle/personas/:id', acces: 'admin', role: '{visuel, voice_profile_id, personnalite, locale}' },
            { methode: 'GET', chemin: '/controle/avis', acces: 'admin', role: '?persona_id= avis et note, entreprises actives par persona' },
          ]}
        />
      </Panneau>
    </>
  );
}
