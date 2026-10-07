// Journal d'audit et télémétrie (MASTER §15, §18).
import { useState } from 'react';
import { useLecture } from '../donnees.jsx';
import { Bouton, Champ, Lecture, Panneau, Pastille, RouteAbsente, Tableau, dateHeure, lignesDe } from '../composants.jsx';
import { ChoixClient, useTenants } from './commun.jsx';
import { santeDe } from './Boxes.jsx';

export const lectures = [['audit', {}], ['boxes', {}], ['tenants', {}]];

/** A Box that has not reported for more than a day is flagged, not hidden. */
export function silence(sante, maintenant = Date.now()) {
  if (!sante || !sante.vu_le) return { ton: 'alerte', libelle: 'jamais vue' };
  const h = (maintenant - Date.parse(sante.vu_le)) / 3_600_000;
  if (!Number.isFinite(h)) return { ton: 'alerte', libelle: 'date illisible' };
  return h > 24 ? { ton: 'danger', libelle: `muette depuis ${Math.floor(h / 24)} j` } : { ton: 'succes', libelle: 'à jour' };
}

export default function Audit() {
  const { tenants, nomDe } = useTenants();
  const [tenant, setTenant] = useState('');
  const audit = useLecture('audit', { query: { tenant_id: tenant } });
  const boxes = useLecture('boxes');
  const traces = (lignesDe(audit.donnees, 'audit', 'traces') ?? []).slice().sort((a, b) => String(b.quand).localeCompare(String(a.quand)));
  const parc = (lignesDe(boxes.donnees, 'boxes') ?? []).filter((b) => !tenant || b.tenant_id === tenant);
  return (
    <>
      <Panneau titre="Journal d'audit" sousTitre="Actions sensibles, sans aucun secret (GET /controle/audit)." actions={<Bouton onClick={() => audit.recharger()}>Relire</Bouton>}>
        <div className="filtres"><Champ libelle="Client"><ChoixClient tenants={tenants} valeur={tenant} onChange={setTenant} /></Champ></div>
        <Lecture lecture={audit}>
          {() => (
            <Tableau vide="Aucune trace pour ce filtre." lignes={traces} cle={(t) => t.id}
              colonnes={[
                { titre: 'Quand', rendu: (t) => dateHeure(t.quand) },
                { titre: 'Client', rendu: (t) => (t.tenant_id ? nomDe(t.tenant_id) : 'plateforme') },
                { titre: 'Acteur', rendu: (t) => t.acteur },
                { titre: 'Action', rendu: (t) => <code>{t.action}</code> },
                { titre: 'Cible', rendu: (t) => <code>{t.cible}</code> },
                { titre: 'Détail', rendu: (t) => <span className="petit">{t.detail}</span> },
              ]} />
          )}
        </Lecture>
      </Panneau>
      <Panneau titre="Télémétrie des Box" sousTitre="Dernière mesure remontée par chaque Box (champ santé de /controle/boxes)." actions={<Bouton onClick={() => boxes.recharger()}>Relire</Bouton>}>
        <Lecture lecture={boxes}>
          {() => (
            <Tableau vide="Aucune Box pour ce filtre." lignes={parc} cle={(b) => b.device_id}
              colonnes={[
                { titre: 'Box', rendu: (b) => <><strong>{b.serial}</strong> <code>{b.device_id}</code></> },
                { titre: 'Client', rendu: (b) => (b.tenant_id ? nomDe(b.tenant_id) : 'en stock') },
                { titre: 'Version', rendu: (b) => b.version_desktop ?? '—' },
                { titre: 'Dernière mesure', rendu: (b) => <span className="petit">{santeDe(b.sante)}</span> },
                { titre: 'Remontée', rendu: (b) => { const s = silence(b.sante); return <Pastille ton={s.ton}>{s.libelle}</Pastille>; } },
              ]} />
          )}
        </Lecture>
      </Panneau>
      <Panneau titre="Historique, incidents, support">
        <RouteAbsente
          titre="Seule la dernière mesure est lisible"
          ceQuiManque="Le contrat garde la dernière santé de chaque Box mais aucune route ne rend l'historique de télémétrie, ni les incidents ou les demandes de support."
          proposition={[
            { methode: 'GET', chemin: '/controle/telemetrie', acces: 'admin', role: '?device_id=&depuis= mesures horodatées' },
            { methode: 'GET', chemin: '/controle/incidents', acces: 'admin', role: '?tenant_id=&statut= incidents de sécurité et de support' },
          ]}
        />
      </Panneau>
    </>
  );
}
