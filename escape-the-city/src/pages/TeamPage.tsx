import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GamePack } from '../features/game/gameTypes';
import { normalizeJoinCode } from '../features/game/gameState';
import { isSupabaseAvailable } from '../lib/supabase/sync';
import { useGame } from '../app/gameContext';
import { GameIcon, PageShell, ProgressBar, SyncStatus, TeamAvatar } from '../components/GameUi';

export function TeamPage({ pack }: { pack: GamePack }) {
  const navigate = useNavigate();
  const { createTeam, resumeWithJoinCode, activeTeam, progress, syncStatus, syncMessage, syncNow } = useGame();
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeMessage, setCodeMessage] = useState('');

  useEffect(() => { document.title = `Team · ${pack.title}`; }, [pack.title]);

  async function submitCreate() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      setError('Teamnaam moet 2 tot 40 tekens zijn.');
      return;
    }
    if (!privacyAccepted) {
      setError('Bevestig privacyuitleg om verder te gaan.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createTeam({ name: trimmed, members: members.split(',').map((item) => item.trim()).filter(Boolean), privacyAccepted });
      navigate('/voorbereiden');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Team kon niet worden aangemaakt.');
    } finally {
      setBusy(false);
    }
  }

  async function submitJoin() {
    setBusy(true);
    setError('');
    try {
      const code = normalizeJoinCode(joinCode);
      await resumeWithJoinCode(code);
      navigate('/route');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Teamcode kon niet worden geladen.');
    } finally {
      setBusy(false);
    }
  }

  async function shareCode() {
    if (!activeTeam) return;
    const text = `Speel mee met ${activeTeam.name}. Teamcode: ${activeTeam.joinCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Moerasdraak team', text });
      } catch {
        setCodeMessage('Delen geannuleerd.');
      }
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(activeTeam.joinCode);
      setCodeMessage('Teamcode gekopieerd.');
    } else {
      setCodeMessage(`Teamcode: ${activeTeam.joinCode}`);
    }
  }

  async function retrySync() {
    setBusy(true);
    setError('');
    try {
      await syncNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synchroniseren is mislukt.');
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
          <div>
            <p className="eyebrow">Teamcode</p>
            <div className="join-code">{activeTeam.joinCode}</div>
            <p className="muted small">
              {syncStatus === 'saved'
                ? 'Met deze code kan jullie team op een ander toestel worden hersteld.'
                : 'Synchroniseer het team eerst voordat je deze code deelt.'}
            </p>
            <button className="button secondary" disabled={busy || syncStatus !== 'saved'} onClick={() => void shareCode()}>
              <GameIcon name="team" size={18} /> Teamcode delen
            </button>
            {syncStatus === 'failed' ? (
              <button className="button primary" disabled={busy} onClick={() => void retrySync()}>
                <GameIcon name="sync" size={18} /> Opnieuw synchroniseren
              </button>
            ) : null}
            {codeMessage ? <p className="status" role="status">{codeMessage}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="card stack" style={{ marginTop: activeTeam ? '1rem' : 0 }}>
        <p className="eyebrow">{activeTeam ? 'Nieuw avontuur' : 'Begin avontuur'}</p>
        <h2>Team aanmaken</h2>
        <label className="field">
          <span>Teamnaam</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="organization" />
        </label>
        <label className="field">
          <span>Namen teamleden, optioneel</span>
          <input value={members} onChange={(event) => setMembers(event.target.value)} placeholder="Anna, Bas, Noor" />
        </label>
        <label className="row">
          <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
          <span className="small">Akkoord met privacyuitleg</span>
        </label>
        <button className="button primary" disabled={busy} onClick={() => void submitCreate()}>Team maken</button>
        {error ? <p className="error" role="alert">{error}</p> : null}
      </section>

      <section className="card stack" style={{ marginTop: '1rem' }}>
        <p className="eyebrow">Verder op ander toestel</p>
        <h2>Teamcode gebruiken</h2>
        <p className="muted small">{isSupabaseAvailable() ? 'Cloudherstel is beschikbaar.' : 'Cloudherstel is niet beschikbaar; lokaal spelen blijft werken.'}</p>
        <label className="field">
          <span>Code van 6 tekens</span>
          <input className="code-input" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} />
        </label>
        <button className="button secondary" disabled={busy || !isSupabaseAvailable()} onClick={() => void submitJoin()}>Met code laden</button>
      </section>
    </PageShell>
  );
}
