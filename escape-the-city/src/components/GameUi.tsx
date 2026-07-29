import { useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../app/gameContext';
import { useAudio } from '../features/audio/audioContext';

type IconName =
  | 'arrow-left'
  | 'check'
  | 'compass'
  | 'dragon'
  | 'info'
  | 'lightbulb'
  | 'location'
  | 'lock'
  | 'map'
  | 'menu'
  | 'offline'
  | 'pause'
  | 'play'
  | 'scroll'
  | 'shield'
  | 'star'
  | 'sync'
  | 'team'
  | 'time'
  | 'volume'
  | 'volume-off';

export function GameIcon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    'arrow-left': <path d="m15 18-6-6 6-6M9 12h11" />,
    check: <path d="m5 12 4 4L19 6" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
    dragon: <path d="M4 17c3-1 4-4 5-7 2 2 5 2 8 1-1 4-4 7-8 7l-3 2 1-3H4Zm6-8c1-3 4-5 8-5l-2 2 3 1-3 2" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    lightbulb: <><path d="M9 18h6M10 22h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-1 .8-1.5 1.6-1.5 2.5h-4c0-.9-.5-1.7-1.5-2.5Z" /></>,
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    offline: <><path d="M5 5 19 19M8.5 8.5A6 6 0 0 1 18 13M6 13a8.5 8.5 0 0 1 .8-3.6M9.5 16.5A3.5 3.5 0 0 1 12 15c1.1 0 2 .4 2.7 1.1M12 20h.01" /></>,
    pause: <><path d="M8 6v12M16 6v12" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    scroll: <><path d="M6 4h11a3 3 0 0 1 0 6h-1v10H7V7a3 3 0 0 0-3-3h2Z" /><path d="M7 20a3 3 0 0 1-3-3h8" /></>,
    shield: <path d="M12 3 20 6v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Zm0 4v11M8 10h8" />,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
    sync: <path d="M20 7v5h-5M4 17v-5h5M6.1 9a7 7 0 0 1 11.5-2L20 12M4 12l2.4 5a7 7 0 0 0 11.5-2" />,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M14 15c4-.8 7 1.3 7 5" /></>,
    time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    volume: <><path d="M5 10v4h3l4 4V6L8 10H5Z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></>,
    'volume-off': <><path d="M5 10v4h3l4 4V6L8 10H5ZM16 10l5 5M21 10l-5 5" /></>
  };

  return (
    <svg className="game-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</g>
    </svg>
  );
}

export function DragonEmblem({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`dragon-emblem${compact ? ' dragon-emblem--compact' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="54" />
        <circle cx="60" cy="60" r="45" />
        <path d="M30 75c22-2 18-31 39-37 10-3 20 2 25 7l-14-1 8 10-15-4c5 6 6 14 2 21-6 10-19 14-32 10l-12 8 4-14h-5Z" />
        <path d="M48 67c10 4 18 2 25-5M64 39l-2-12 10 9M46 76l-13-9" />
        <circle cx="73" cy="43" r="1.5" className="dragon-eye" />
      </svg>
    </span>
  );
}

export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <svg className="hero-dragon" viewBox="0 0 360 210">
        <path d="M40 92c31-47 88-74 148-61-19 5-31 16-39 31 37-20 83-19 123 8-30-3-50 4-64 19 24 1 47 13 64 35-34-14-64-12-89 6-24 18-43 20-65 14l-37 20 13-27c-24-9-42-24-54-45Z" />
        <path d="m126 57-10-38 25 29m27-16 14-28 3 32M96 111 55 99l31 27m106-72 36-23-20 38" />
        <circle cx="132" cy="82" r="3" />
      </svg>
      <svg className="hero-skyline" viewBox="0 0 360 120">
        <path d="M0 120V90h26V69h15v21h20V76h18V59h8V37h7V15h6v22h8v22h9v31h18V73h12v17h20V64h13v26h27V72h20v18h14V54h8v36h22V76h18v14h25v30Z" />
        <path d="M79 59h39M87 37h22M90 48h16M94 15v-9M88 24h24M226 72v-9M219 76h14" />
      </svg>
    </div>
  );
}

export function AudioControl({ className = '' }: { className?: string }) {
  const { soundEnabled, unlocked, toggleSound, unlockAudio } = useAudio();
  return (
    <button
      className={`icon-button audio-control ${className}`.trim()}
      type="button"
      aria-label={soundEnabled && unlocked ? 'Geluid uitschakelen' : 'Geluid inschakelen'}
      aria-pressed={soundEnabled && unlocked}
      onClick={() => {
        if (!unlocked || !soundEnabled) {
          unlockAudio();
        } else {
          toggleSound();
        }
      }}
    >
      <GameIcon name={soundEnabled && unlocked ? 'volume' : 'volume-off'} />
    </button>
  );
}

export function GameTopBar({ title, backTo }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <header className="game-topbar">
      {backTo ? (
        <button className="icon-button" type="button" aria-label="Ga terug" onClick={() => navigate(backTo)}>
          <GameIcon name="arrow-left" />
        </button>
      ) : <span className="topbar-spacer" />}
      <span className="game-topbar__title">{title}</span>
      <AudioControl />
    </header>
  );
}

export function BottomGameNavigation() {
  const { progress } = useGame();
  const location = useLocation();
  const currentStop = progress?.currentStopId ? `/stop/${progress.currentStopId}` : '/route';
  const links = [
    { to: '/route', label: 'Route', icon: 'location' as IconName, active: location.pathname === '/route' },
    { to: '/team', label: 'Team', icon: 'team' as IconName, active: location.pathname === '/team' },
    { to: currentStop, label: 'Spel', icon: 'scroll' as IconName, active: location.pathname.startsWith('/stop/') || location.pathname.startsWith('/challenge/') },
    { to: '/instellingen', label: 'Info', icon: 'info' as IconName, active: location.pathname === '/instellingen' }
  ];

  return (
    <nav className="bottom-nav" aria-label="Hoofdnavigatie">
      {links.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          aria-current={item.active ? 'page' : undefined}
          className={`bottom-nav__item${item.active ? ' is-active' : ''}`}
        >
          <GameIcon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function PageShell({
  children,
  title,
  backTo,
  navigation = true,
  className = ''
}: {
  children: ReactNode;
  title?: string;
  backTo?: string;
  navigation?: boolean;
  className?: string;
}) {
  return (
    <main className={`page shell ${navigation ? 'page--with-nav' : ''} ${className}`.trim()}>
      {title ? <GameTopBar title={title} backTo={backTo} /> : null}
      <div className="page-content">{children}</div>
      {navigation ? <BottomGameNavigation /> : null}
    </main>
  );
}

export function SyncStatus({ status, message }: { status: 'saved' | 'local' | 'syncing' | 'failed' | 'offline'; message: string }) {
  return (
    <span className={`sync-status sync-status--${status}`} role="status">
      <GameIcon name={status === 'offline' ? 'offline' : 'sync'} size={16} />
      {message}
    </span>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const percentage = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress-block">
      {label ? <div className="progress-label"><span>{label}</span><span>{value} / {max}</span></div> : null}
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function TeamAvatar({ name, index = 0 }: { name: string; index?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  return <span className={`team-avatar team-avatar--${index % 4}`} title={name}>{initials || '?'}</span>;
}

export function HintDialog({
  open,
  hint,
  penalty,
  onConfirm,
  onClose
}: {
  open: boolean;
  hint: string;
  penalty: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function close() {
    onClose();
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  return (
    <dialog
      ref={dialogRef}
      className="hint-dialog"
      aria-labelledby="hint-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <button className="dialog-close" type="button" aria-label="Hintvenster sluiten" onClick={close}>×</button>
      <span className="hint-dialog__icon"><GameIcon name="lightbulb" size={38} /></span>
      <h2 id="hint-title">Hint</h2>
      <p>Weet je het zeker?</p>
      <p className="hint-dialog__cost"><strong>Kosten:</strong> {penalty} punten</p>
      <button
        className="button primary"
        type="button"
        onClick={() => {
          onConfirm();
          close();
        }}
      >
        Hint tonen
      </button>
      <button className="button ghost" type="button" onClick={close}>Annuleren</button>
      <p className="hint-dialog__preview" aria-hidden="true">{hint ? 'De aanwijzing wordt na bevestiging zichtbaar.' : 'Geen hint meer beschikbaar.'}</p>
    </dialog>
  );
}

export function StoryLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="text-link" to={to}>{children}</Link>;
}
