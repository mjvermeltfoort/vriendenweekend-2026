import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GamePack } from '../features/game/gameTypes';
import { normalizeJoinCode } from '../features/game/gameState';
import { isSupabaseAvailable } from '../lib/supabase/sync';
import { useGame } from '../app/gameContext';
import { PageShell, ProgressBar, SyncStatus, TeamAvatar } from '../components/GameUi';
import { TeamRadioPanel } from '../components/TeamRadioPanel';

export function TeamPage({ pack }: { pack: GamePack }) {
  const navigate = useNavigate();
  const { resumeWithJoinCode, removeActiveTeam, activeTeam, progress, syncStatus, syncMessage } = useGame();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = `Team · ${pack.title}`; }, [pack.title]);

  async function submitJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeJoinCode(joinCode);
    if (!code) {
      setError('Voer jullie teamcode in.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await resumeWithJoinCode(code);
      navigate('/route');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deze teamcode is niet geldig.');
    } finally {
      setBusy(false);
    }
  }

  async function leaveTeam() {
    setBusy(true);
    setError('');
    try {
      await removeActiveTeam();
      setJoinCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Het team kon niet worden verlaten.');
    } finally {
      setBusy(false);
    }
  }

  const names = activeTeam?.memberNames.length ? activeTeam.memberNames : activeTeam ? [activeTeam.name] : [];

  return (
    <PageShell title="Team" backTo={activeTeam ? '/route' : '/'}>
      {activeTeam ? (
        <section className="card stack stack--large">
          <div>
            <div className="row row--between">
              <p className="eyebrow">Team</p>
              <SyncStatus status={syncStatus} message={syncMessage} />
            </div>
            <h1>{activeTeam.name}</h1>
          </div>
          <div className="team-avatars">
            {names.map((member, index) => (
              <span className="team-member" key={`${member}-${index}`}>
                <TeamAvatar name={member} index={index} />
                {member}
              </span>
            ))}
          </div>
          <ProgressBar value={progress?.collectedRewards.length ?? 0} max={pack.stops.length} label="Voortgang" />
          <TeamRadioPanel />
          <button className="button danger" disabled={busy} onClick={() => void leaveTeam()}>
            {busy ? 'Team verlaten…' : 'Team verlaten'}
          </button>
          {error ? <p className="error" role="alert">{error}</p> : null}
        </section>
      ) : (
        <section className="card stack">
          <p className="eyebrow">Deelnemen</p>
          <h1>Voer jullie teamcode in</h1>
          <p>Gebruik de code die jullie van de spelleider hebben ontvangen.</p>
          <p className="muted small">
            Na deelname vragen we locatietoestemming om te bepalen of jullie bij de volgende opdracht zijn.
            Bij meerdere telefoons gebruiken we automatisch de nauwkeurigste actuele locatie.
          </p>
          <form className="stack" onSubmit={(event) => void submitJoin(event)} aria-busy={busy}>
            <label className="field" htmlFor="team-code">
              <span>Teamcode</span>
            </label>
            <input
              id="team-code"
              className="code-input"
              value={joinCode}
              onChange={(event) => {
                setJoinCode(event.target.value.toUpperCase());
                if (error) setError('');
              }}
              placeholder="ABC123"
              maxLength={12}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'team-code-error' : 'team-code-help'}
              disabled={busy}
            />
            <p className="muted small" id="team-code-help">Spaties en koppeltekens mogen worden gebruikt.</p>
            <button className="button primary" type="submit" disabled={busy || !isSupabaseAvailable()}>
              {busy ? 'Teamcode controleren…' : 'Deelnemen'}
            </button>
            {!isSupabaseAvailable() ? <p className="error" role="status">Deelnemen is nu niet beschikbaar. Controleer jullie internetverbinding.</p> : null}
            {error ? <p className="error" id="team-code-error" role="alert">{error}</p> : null}
            <p className="status" role="status" aria-live="polite">
              {busy ? 'Teamcode wordt gecontroleerd.' : ''}
            </p>
          </form>
        </section>
      )}
    </PageShell>
  );
}
