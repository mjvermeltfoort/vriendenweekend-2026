import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { gamePack } from '../game-data/moerasdraak/game';
import {
  dashboardActions,
  initializeDashboard,
  subscribeToDashboard,
  type RealtimeStatus
} from './api';
import { DashboardMap } from './DashboardMap';
import { dashboardReducer, initialDashboardState } from './store';
import {
  ACCURATE_LOCATION_M,
  activeParticipants,
  ageLabel,
  dashboardSummary,
  locationIsFresh,
  sortDashboardTeams,
  teamHealth,
  type DashboardParticipant,
  type DashboardTeam
} from './types';

type DialogState =
  | { kind: 'create' }
  | { kind: 'rename'; team: DashboardTeam }
  | { kind: 'rotate'; team: DashboardTeam }
  | { kind: 'disable'; team: DashboardTeam }
  | { kind: 'reset'; team: DashboardTeam }
  | { kind: 'abandon'; team: DashboardTeam }
  | { kind: 'revoke'; team: DashboardTeam; participant: DashboardParticipant }
  | { kind: 'release'; team: DashboardTeam; stopName: string }
  | null;

const stopById = new Map(gamePack.stops.map((stop) => [stop.id, stop]));

function statusLabel(team: DashboardTeam, now: number) {
  const health = teamHealth(team, now);
  if (team.status === 'disabled') return 'Uitgeschakeld';
  if (health === 'completed') return 'Voltooid';
  if (health === 'inactive') return 'Offline';
  if (health === 'location-problem') {
    return team.location && locationIsFresh(team, now) ? 'Onnauwkeurig' : 'Locatieprobleem';
  }
  return 'Live';
}

function TeamRow({ team, selected, now, onSelect }: {
  team: DashboardTeam;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);
  const participants = activeParticipants(team, now);
  const stop = team.currentStopId ? stopById.get(team.currentStopId) : null;
  return (
    <article
      className={`team-row ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <div className="team-row__heading">
        <h3><button className="team-row__select" type="button" onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}>{team.name}</button></h3>
        <span className={`status-pill status-pill--${teamHealth(team, now)}`}>{statusLabel(team, now)}</span>
      </div>
      <div className="team-row__code">
        <span>Code <strong>{team.code}</strong></span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void navigator.clipboard.writeText(team.code).then(() => {
              setCopied(true);
              if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
              copyTimerRef.current = window.setTimeout(() => {
                setCopied(false);
                copyTimerRef.current = null;
              }, 1_500);
            });
          }}
        >{copied ? 'Code gekopieerd' : 'Kopiëren'}</button>
      </div>
      <p>Stop {team.currentStopIndex ?? '–'} van {gamePack.stops.length} · {stop?.locationName ?? 'Nog niet gestart'}</p>
      <p>Opdracht: {team.activeGame ? stopById.get(team.activeGame.gameId)?.title ?? team.activeGame.gameId : 'geen actieve opdracht'}</p>
      <div className="team-row__meta">
        <span>{participants.length} {participants.length === 1 ? 'deelnemer' : 'deelnemers'}</span>
        <span>Laatst actief {ageLabel(team.lastSeenAt ?? team.updatedAt, now)}</span>
        <span>
          {team.location
            ? `GPS ±${Math.round(team.location.accuracyM)} m · ${ageLabel(team.location.capturedAt, now)}`
            : 'Geen locatie'}
        </span>
      </div>
    </article>
  );
}

export function DashboardDialog({ state, busy, error, onClose, onSubmit }: {
  state: DialogState;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
}) {
  if (!state) return null;
  const copy = {
    create: ['Nieuw team', 'Maak een team met een automatisch gegenereerde of zelfgekozen code.'],
    rename: ['Teamnaam wijzigen', `Wijzig de naam van ${state.kind === 'rename' ? state.team.name : ''}.`],
    rotate: ['Nieuwe code genereren', 'De oude code werkt hierna niet meer voor nieuwe deelnemers. Bestaande actieve deelnemers blijven verbonden.'],
    disable: ['Team uitschakelen', 'Alle actieve teamsessies worden ingetrokken. Resultaten blijven bewaard.'],
    reset: ['Voortgang resetten', state.kind === 'reset' ? `Weet je zeker dat je de volledige voortgang van ${state.team.name} wilt resetten?` : ''],
    abandon: ['Actieve opdracht beëindigen', 'De actieve opdracht wordt als afgebroken opgeslagen. Er wordt geen score toegekend.'],
    revoke: ['Sessie stoppen', 'Dit apparaat kan daarna niet meer schrijven en keert bij de volgende synchronisatie terug naar het codescherm.'],
    release: [
      'Stop vrijgeven',
      state.kind === 'release'
        ? `Geef ${state.stopName} vrij voor ${state.team.name}. De opdracht wordt direct opengezet voor het hele team.`
        : ''
    ]
  }[state.kind];
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <form className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}>
        <h2 id="dialog-title">{copy[0]}</h2>
        <p>{copy[1]}</p>
        {state.kind === 'create' ? (
          <>
            <label>Teamnaam<input name="name" minLength={2} maxLength={80} required autoFocus /></label>
            <label>Zelfgekozen code (optioneel)<input name="code" minLength={6} maxLength={6} pattern="[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}" /></label>
          </>
        ) : null}
        {state.kind === 'rename' ? (
          <label>Teamnaam<input name="name" minLength={2} maxLength={80} required defaultValue={state.team.name} autoFocus /></label>
        ) : null}
        {state.kind === 'release' ? (
          <label>
            Reden
            <textarea name="reason" minLength={3} maxLength={500} required autoFocus />
          </label>
        ) : null}
        {error ? <p className="dialog-error" role="alert">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" onClick={onClose} disabled={busy}>Annuleren</button>
          <button className={['disable', 'reset', 'abandon', 'revoke', 'release'].includes(state.kind) ? 'danger' : 'primary'} disabled={busy}>
            {busy ? 'Bezig…' : state.kind === 'create' ? 'Team aanmaken' : 'Bevestigen'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DashboardApp() {
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [connection, setConnection] = useState<RealtimeStatus>('disconnected');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const serverOffsetRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    let pollTimer: number | null = null;

    const applySnapshot = (snapshot: Awaited<ReturnType<typeof initializeDashboard>>) => {
      serverOffsetRef.current = Date.parse(snapshot.serverNow) - Date.now();
      setNow(Date.now() + serverOffsetRef.current);
      dispatch({ type: 'snapshot', teams: snapshot.teams });
    };
    const ensureSubscription = () => {
      if (unsubscribe || disposed) return;
      unsubscribe = subscribeToDashboard(
        (team) => dispatch({ type: 'replace-team', team }),
        handleStatus
      );
    };
    const loadSnapshot = async () => {
      const snapshot = await initializeDashboard();
      if (!disposed) {
        applySnapshot(snapshot);
        setLoadError('');
        ensureSubscription();
      }
    };
    const stopPolling = () => {
      if (pollTimer !== null) window.clearInterval(pollTimer);
      pollTimer = null;
    };
    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(() => {
        void loadSnapshot().catch(() => undefined);
      }, 10_000);
    };
    const handleStatus = (status: RealtimeStatus) => {
      if (disposed) return;
      setConnection(status);
      if (status === 'connected') stopPolling();
      else startPolling();
    };

    void initializeDashboard().then((snapshot) => {
      if (disposed) return;
      applySnapshot(snapshot);
      ensureSubscription();
      setLoading(false);
    }).catch((error) => {
      if (disposed) return;
      setLoadError(error instanceof Error ? error.message : 'Dashboard kon niet worden geladen.');
      setLoading(false);
      startPolling();
    });

    return () => {
      disposed = true;
      stopPolling();
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + serverOffsetRef.current), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const sortedTeams = useMemo(() => sortDashboardTeams(state.teams, now), [state.teams, now]);
  const summary = useMemo(() => dashboardSummary(state.teams, now), [state.teams, now]);
  const selectedTeam = state.teams.find((team) => team.id === state.selectedTeamId) ?? null;

  const performDialogAction = async (formData: FormData) => {
    if (!dialog) return;
    setBusy(true);
    setActionError('');
    try {
      let updated: DashboardTeam;
      if (dialog.kind === 'create') {
        updated = await dashboardActions.createTeam(String(formData.get('name')), String(formData.get('code') ?? ''));
      } else if (dialog.kind === 'rename') {
        updated = await dashboardActions.renameTeam(dialog.team.id, String(formData.get('name')));
      } else if (dialog.kind === 'rotate') {
        updated = await dashboardActions.rotateCode(dialog.team.id);
      } else if (dialog.kind === 'disable') {
        updated = await dashboardActions.setStatus(dialog.team.id, 'disabled');
      } else if (dialog.kind === 'reset') {
        updated = await dashboardActions.resetProgress(dialog.team.id);
      } else if (dialog.kind === 'abandon') {
        updated = await dashboardActions.abandonGame(dialog.team.id);
      } else if (dialog.kind === 'release') {
        updated = await dashboardActions.releaseCurrentStop(
          dialog.team.id,
          String(formData.get('reason') ?? '')
        );
      } else {
        updated = await dashboardActions.revokeSession(dialog.team.id, dialog.participant.sessionId);
      }
      dispatch({ type: 'replace-team', team: updated });
      dispatch({ type: 'select', teamId: updated.id });
      setDialog(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'De actie is mislukt.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="dashboard-loading">Dashboard laden…</main>;
  if (loadError && state.teams.length === 0) {
    return <main className="dashboard-loading"><h1>Dashboard niet beschikbaar</h1><p role="alert">{loadError}</p></main>;
  }

  const selectedParticipants = selectedTeam ? activeParticipants(selectedTeam, now) : [];
  const selectedStop = selectedTeam?.currentStopId ? stopById.get(selectedTeam.currentStopId) : null;
  const selectedStopProgress = selectedTeam?.currentStopId
    ? selectedTeam.stopProgress.find((item) => item.stopId === selectedTeam.currentStopId)
    : null;

  return (
    <>
      <div className="desktop-warning">Dit dashboard is ontworpen voor een desktopbeeldscherm.</div>
      <main className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Openbaar teamdashboard</p>
            <h1>Het Geheim van de Moerasdraak</h1>
          </div>
          <div className={`connection-state connection-state--${connection}`}>
            <span aria-hidden="true" />
            {connection === 'connected' ? `Live · ${new Date(now).toLocaleTimeString('nl-NL')}` : 'Verbinding herstellen…'}
          </div>
        </header>

        <section className="dashboard-summary" aria-label="Samenvatting">
          <strong>{summary.teams}<span>teams</span></strong>
          <strong>{summary.activeTeams}<span>actief</span></strong>
          <strong>{summary.participants}<span>deelnemers</span></strong>
          <strong>{summary.locationProblems}<span>zonder actuele locatie</span></strong>
          <button className="primary" type="button" onClick={() => setDialog({ kind: 'create' })}>Nieuw team</button>
        </section>

        <div className="dashboard-grid">
          <section className="team-list" aria-label="Alle teams">
            {sortedTeams.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                selected={team.id === state.selectedTeamId}
                now={now}
                onSelect={() => dispatch({ type: 'select', teamId: team.id })}
              />
            ))}
            {sortedTeams.length === 0 ? <p className="empty-state">Er zijn nog geen teams.</p> : null}
          </section>
          <DashboardMap
            teams={state.teams}
            selectedTeamId={state.selectedTeamId}
            now={now}
            onSelect={(teamId) => dispatch({ type: 'select', teamId })}
          />
        </div>

        <section className="team-detail" aria-live="polite">
          {selectedTeam ? (
            <>
              <div className="team-detail__header">
                <div>
                  <p className="dashboard-eyebrow">Teamdetails</p>
                  <h2>{selectedTeam.name}</h2>
                  <p>Code <strong>{selectedTeam.code}</strong> · {statusLabel(selectedTeam, now)}</p>
                </div>
                <div className="detail-actions">
                  <button type="button" onClick={() => setDialog({ kind: 'rename', team: selectedTeam })}>Naam wijzigen</button>
                  <button type="button" onClick={() => setDialog({ kind: 'rotate', team: selectedTeam })}>Nieuwe code</button>
                  {selectedTeam.status === 'disabled'
                    ? <button type="button" onClick={() => {
                      void dashboardActions.setStatus(selectedTeam.id, 'active').then((team) => dispatch({ type: 'replace-team', team }));
                    }}>Team activeren</button>
                    : selectedTeam.status !== 'completed'
                      ? <button type="button" onClick={() => setDialog({ kind: 'disable', team: selectedTeam })}>Uitschakelen</button>
                      : null}
                  <button className="danger" type="button" onClick={() => setDialog({ kind: 'reset', team: selectedTeam })}>Voortgang resetten</button>
                  {selectedTeam.activeGame
                    ? <button className="danger" type="button" onClick={() => setDialog({ kind: 'abandon', team: selectedTeam })}>Opdracht beëindigen</button>
                    : null}
                  {selectedStop && selectedStopProgress?.state === 'available' ? (
                    <button
                      className="danger"
                      type="button"
                      onClick={() => setDialog({
                        kind: 'release',
                        team: selectedTeam,
                        stopName: selectedStop.title
                      })}
                    >
                      Stop vrijgeven
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="detail-columns">
                <div>
                  <h3>Voortgang</h3>
                  <p>Stop {selectedTeam.currentStopIndex ?? '–'} van {gamePack.stops.length}</p>
                  <p>{selectedStop?.title ?? 'Nog niet gestart'} · {selectedStop?.locationName ?? 'Geen stop'}</p>
                  <p>Score {selectedTeam.score} · versie {selectedTeam.progressVersion}</p>
                  <ol className="progress-list">
                    {gamePack.stops.map((stop) => {
                      const progress = selectedTeam.stopProgress.find((item) => item.stopId === stop.id);
                      return <li key={stop.id} data-state={progress?.state ?? 'locked'}>{stop.order}. {stop.shortTitle} <span>{progress?.state ?? 'locked'}</span></li>;
                    })}
                  </ol>
                </div>
                <div>
                  <h3>Locatie</h3>
                  {selectedTeam.location ? (
                    <>
                      <p>GPS ±{Math.round(selectedTeam.location.accuracyM)} meter {selectedTeam.location.accuracyM > ACCURATE_LOCATION_M ? '· onnauwkeurig' : '· nauwkeurig'}</p>
                      <p>Meting {ageLabel(selectedTeam.location.capturedAt, now)}</p>
                      <p>{locationIsFresh(selectedTeam, now) ? 'Actuele locatie' : 'Laatste bekende locatie'}</p>
                    </>
                  ) : <p>Er is nog geen locatie ontvangen.</p>}
                  <h3>Actieve opdracht</h3>
                  <p>{selectedTeam.activeGame
                    ? stopById.get(selectedTeam.activeGame.gameId)?.title ?? selectedTeam.activeGame.gameId
                    : 'Geen actieve opdracht'}</p>
                </div>
                <div>
                  <h3>Actieve deelnemers ({selectedParticipants.length})</h3>
                  {selectedParticipants.map((participant, index) => (
                    <article className="participant" key={participant.sessionId}>
                      <div>
                        <strong>Deelnemer {index + 1}</strong>
                        <span>{participant.deviceLabel} · {participant.browserLabel}</span>
                        <span>{ageLabel(participant.lastSeenAt, now)}</span>
                        <span>{participant.locationAccuracyM === null ? 'Geen GPS' : `GPS ±${Math.round(participant.locationAccuracyM)} m`}</span>
                        {participant.isLocationSource ? <em>Gekozen locatiebron</em> : null}
                      </div>
                      <button type="button" onClick={() => setDialog({ kind: 'revoke', team: selectedTeam, participant })}>Sessie stoppen</button>
                    </article>
                  ))}
                  {selectedParticipants.length === 0 ? <p>Geen actieve deelnemers.</p> : null}
                </div>
              </div>
            </>
          ) : <p>Selecteer een team voor details.</p>}
        </section>
        <footer>
          Openbaar dashboard: iedereen met deze URL kan teamcodes, locaties en deelnemers zien en beheeracties uitvoeren.
        </footer>
      </main>
      <DashboardDialog
        state={dialog}
        busy={busy}
        error={actionError}
        onClose={() => { setDialog(null); setActionError(''); }}
        onSubmit={(data) => { void performDialogAction(data); }}
      />
    </>
  );
}
