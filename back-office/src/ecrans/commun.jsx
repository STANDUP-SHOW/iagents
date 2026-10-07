// Pieces several screens share: the client picker and a generic view of an
// object whose exact shape the contract does not fix (études, scénarios).
import { useLecture } from '../donnees.jsx';
import { lignesDe } from '../composants.jsx';

export function useTenants() {
  const lecture = useLecture('tenants');
  const tenants = lignesDe(lecture.donnees, 'tenants') ?? [];
  const nomDe = (id) => {
    if (!id) return '—';
    const t = tenants.find((x) => x.tenant_id === id);
    return t ? t.nom : id;
  };
  return { lecture, tenants, nomDe };
}

export function ChoixClient({ tenants, valeur, onChange, tous = 'Tous les clients', requis = false }) {
  return (
    <select value={valeur} onChange={(e) => onChange(e.target.value)} required={requis}>
      <option value="">{tous}</option>
      {tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.nom} ({t.tenant_id})</option>)}
    </select>
  );
}

/** Shows any JSON value readably, without guessing what its fields mean. */
export function Apercu({ valeur, profondeur = 0 }) {
  if (valeur === null || valeur === undefined) return <span className="discret">—</span>;
  if (typeof valeur === 'number') return <span>{new Intl.NumberFormat('fr-FR').format(valeur)}</span>;
  if (typeof valeur === 'boolean') return <span>{valeur ? 'oui' : 'non'}</span>;
  if (typeof valeur !== 'object') return <span>{String(valeur)}</span>;
  if (profondeur > 4) return <code>{JSON.stringify(valeur)}</code>;
  if (Array.isArray(valeur)) {
    if (valeur.length === 0) return <span className="discret">aucun</span>;
    return (
      <ol className="apercu-liste">
        {valeur.map((v, i) => <li key={i}><Apercu valeur={v} profondeur={profondeur + 1} /></li>)}
      </ol>
    );
  }
  return (
    <dl className="apercu">
      {Object.entries(valeur).map(([k, v]) => (
        <div key={k} className="apercu-ligne">
          <dt>{k.replace(/_/g, ' ')}</dt>
          <dd><Apercu valeur={v} profondeur={profondeur + 1} /></dd>
        </div>
      ))}
    </dl>
  );
}
