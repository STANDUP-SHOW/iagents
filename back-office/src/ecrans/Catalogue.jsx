// Catalogue et compteur (MASTER §8, §15).
import { useLecture } from '../donnees.jsx';
import { Bouton, Lecture, Panneau, RouteAbsente, dateHeure, nombre } from '../composants.jsx';

export const lectures = [['compteur', {}]];

export default function Catalogue() {
  const compteur = useLecture('compteur');
  return (
    <>
      <Panneau titre="Compteur des profils" sousTitre="Calculé par la plateforme depuis le catalogue (GET /controle/compteur, public)." actions={<Bouton onClick={() => compteur.recharger()}>Relire</Bouton>}>
        <Lecture lecture={compteur}>
          {(c) => (
            <dl className="chiffres">
              <div><dt>Métiers</dt><dd>{nombre(c.metiers)}</dd></div>
              <div><dt>Profils</dt><dd>{nombre(c.profils)}</dd></div>
              <div><dt>Calculé le</dt><dd className="petit">{dateHeure(c.calcule_le)}</dd></div>
            </dl>
          )}
        </Lecture>
      </Panneau>
      <Panneau titre="Catalogue des agents">
        <RouteAbsente
          titre="Aucune route de catalogue au contrat"
          ceQuiManque="Le catalogue (1 249 fiches, 43 secteurs) vit dans le dépôt (agents/, catalogue/catalogue.json) et la plateforme n'en sert que le compteur. Le back-office ne peut ni le parcourir ni le modifier : une fiche se change dans le dépôt, validée par npm run verifier."
          proposition={[
            { methode: 'GET', chemin: '/controle/catalogue', acces: 'admin', role: '?secteur=&q= → [{id, metier, secteur, profil, prix}] lu dans catalogue/catalogue.json, en lecture seule' },
          ]}
        />
      </Panneau>
    </>
  );
}
