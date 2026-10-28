import { useEffect, useState } from 'react';
import type { DashboardTeam } from './types';
import { dashboardClientId } from './api';
import { spacingRpc, type DashboardSpacing } from '../features/spacing/api';

export function localDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function SpacingPanel({ teams }: { teams: DashboardTeam[] }) {
  const [rows, setRows] = useState<DashboardSpacing[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [startAt, setStartAt] = useState(() => localDateInput(new Date(Date.now() + 5 * 60_000)));
  useEffect(() => {
    let disposed = false;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try { const data = await spacingRpc<DashboardSpacing[]>('dashboard_get_spacing'); if (!disposed) { setRows(data); setError(''); } }
      catch { if (!disposed) setError('Teamspreiding is niet beschikbaar. Controleer of migratie 043 is uitgevoerd.'); }
      finally { pending = false; }
    }
    void refresh(); const timer = window.setInterval(() => void refresh(), 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);
  async function action(work: () => Promise<unknown>) {
    setBusy(true); setError(''); setMessage('');
    try {
      await work();
      setRows(await spacingRpc<DashboardSpacing[]>('dashboard_get_spacing'));
      setMessage('Teamspreiding opgeslagen.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Opslaan mislukt.'); }
    finally { setBusy(false); }
  }
  const eligible = teams.filter(t => t.status === 'active' && !t.stopProgress.some(p => p.startedAt || p.state === 'completed')
    && !rows.find(r => r.teamId === t.id)?.departedAt);
  const chosen = selected.filter(id => eligible.some(t => t.id === id));
  return <section className="team-detail spacing-panel" aria-label="Teamspreiding">
    <h2>Teamspreiding</h2>
    <p>Plan een speelsessie voor de gekozen teams. Alleen teams uit die sessie worden met elkaar vergeleken. Henk adviseert; nabijheid blokkeert geen opdrachten.</p>
    <form className="spacing-plan" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      void action(() => spacingRpc('dashboard_plan_spacing', {
        p_name: data.get('name'), p_team_ids: chosen, p_start_at: new Date(startAt).toISOString(),
        p_interval_minutes: Number(data.get('interval')), p_gap_m: Number(data.get('gap')), p_client_id: dashboardClientId()
      }));
    }}>
      <label>Naam speelsessie<input name="name" defaultValue="Vriendenweekend" minLength={2} maxLength={80} required /></label>
      <label>Eerste vertrek (lokale tijd)<input type="datetime-local" required value={startAt} onChange={e => setStartAt(e.target.value)} /></label>
      <label>Minuten tussen teams<input name="interval" type="number" min={1} max={30} defaultValue={5} required /></label>
      <label>Waarschuwen onder (meter)<input name="gap" type="number" min={50} max={300} defaultValue={100} required /></label>
      <fieldset><legend>Teams kiezen — de lijst eronder bepaalt de vertrekvolgorde</legend>
        {eligible.map(team => <label key={team.id}><input type="checkbox" checked={chosen.includes(team.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids.filter(id => id !== team.id), team.id] : ids.filter(id => id !== team.id))} />{team.name}</label>)}
        {!eligible.length ? <p>Geen teams beschikbaar die nog moeten starten.</p> : null}
      </fieldset>
      <ol>{chosen.map((id, index) => <li key={id}>{teams.find(t => t.id === id)?.name} <button type="button" disabled={index === 0} onClick={() => {
        const next = [...chosen]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setSelected(next);
      }}>Eerder</button></li>)}</ol>
      <button className="primary" disabled={busy || !chosen.length}>Starttijden plannen</button>
    </form>
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {rows.length ? <div className="spacing-table"><table><thead><tr><th>Team / sessie</th><th>Vertrek</th><th>Afstand tot voorganger</th><th>Begeleiding</th></tr></thead><tbody>
      {rows.filter(row => teams.some(t => t.id === row.teamId)).map(row => <tr key={row.teamId}>
        <td><strong>{teams.find(t => t.id === row.teamId)?.name}</strong><br />{row.eventName}</td>
        <td>{row.departedAt ? `Gestart ${new Date(row.departedAt).toLocaleTimeString('nl-NL')}` : <form onSubmit={event => {
          event.preventDefault(); const value = new FormData(event.currentTarget).get('time') as string;
          void action(() => spacingRpc('dashboard_update_spacing', { p_team_id: row.teamId, p_scheduled_at: new Date(value).toISOString(), p_enabled: null, p_client_id: dashboardClientId() }));
        }}><input aria-label={`Vertrekmoment ${teams.find(t => t.id === row.teamId)?.name}`} key={row.scheduledAt} name="time" type="datetime-local" required defaultValue={localDateInput(new Date(row.scheduledAt))} /><button disabled={busy}>Wijzigen</button></form>}</td>
        <td>{row.gapM === null ? 'Geen betrouwbare nabijheidsmeting' : `${Math.round(row.gapM)} m tot ${teams.find(t => t.id === row.aheadTeamId)?.name ?? 'voorganger'}`}{row.closeSince && Date.now() - Date.parse(row.closeSince) >= 30_000 ? ' · te dicht op elkaar' : ''}</td>
        <td><button disabled={busy} onClick={() => void action(() => spacingRpc('dashboard_update_spacing', { p_team_id: row.teamId, p_scheduled_at: null, p_enabled: !row.enabled, p_client_id: dashboardClientId() }))}>{row.enabled ? 'Sessie uitschakelen' : 'Sessie inschakelen'}</button></td>
      </tr>)}
    </tbody></table></div> : null}
  </section>;
}
