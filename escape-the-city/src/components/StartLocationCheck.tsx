import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../app/gameContext';
import { GameIcon } from './GameUi';
import { browserLocationProvider } from '../features/location/browserProvider';
import { detectLocationDevice, getLocationGuide, locationAccuracyState } from '../features/location/startLocationGuide';

type LocationCheckStatus =
  | 'checking' | 'permission' | 'denied' | 'timeout' | 'unavailable' | 'insecure' | 'ready' | 'imprecise';
type LocationCheck = { status: LocationCheckStatus; accuracy?: number };

const VISITED_KEY = 'moerasdraak-gps-dialog-visited-v1';

function alreadyVisited() {
  try {
    return sessionStorage.getItem(VISITED_KEY) === '1';
  } catch {
    return false;
  }
}

function markVisited() {
  try {
    sessionStorage.setItem(VISITED_KEY, '1');
  } catch {
    // De gebruiker kan het venster ook sluiten als opslag niet beschikbaar is.
  }
}

function messageForStatus({ status, accuracy }: LocationCheck) {
  switch (status) {
    case 'checking': return 'GPS-positie controleren…';
    case 'permission': return 'Locatietoestemming is nog nodig.';
    case 'denied': return 'Locatietoegang is geblokkeerd.';
    case 'timeout': return 'Geen GPS-positie ontvangen binnen de wachttijd.';
    case 'unavailable': return 'Locatie is op dit moment niet beschikbaar.';
    case 'insecure': return 'Locatie werkt alleen via een beveiligde HTTPS-verbinding.';
    case 'ready': return 'GPS gereed · nauwkeurig tot ongeveer ' + Math.round(accuracy ?? 0) + ' meter.';
    case 'imprecise': return 'GPS is nog onnauwkeurig (±' + Math.round(accuracy ?? 0) + ' m). Voor de hoofdopdrachten is maximaal 40 m nodig.';
  }
}

export function StartLocationCheck({ blockedByIntro = false }: { blockedByIntro?: boolean }) {
  const { deviceLocation } = useGame();
  const [check, setCheck] = useState<LocationCheck>({ status: 'checking' });
  const [showInstructions, setShowInstructions] = useState(false);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);
  const autoOpenedRef = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const device = useMemo(() => detectLocationDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0), []);
  const guide = useMemo(() => getLocationGuide(device), [device]);

  const closeDialog = useCallback(() => {
    setOpen(false);
    markVisited();
    // Focus wordt na het sluiten teruggezet naar de knop op de beginpagina.
    triggerRef.current?.focus();
  }, []);

  const testLocation = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setCheck({ status: 'checking' });
    if (window.isSecureContext === false) {
      setCheck({ status: 'insecure' });
      return;
    }
    if (!navigator.geolocation) {
      setCheck({ status: 'unavailable' });
      return;
    }
    try {
      const result = await browserLocationProvider.getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12_000
      });
      if (currentRequest !== requestId.current) return;
      if ('kind' in result) {
        setCheck({ status: result.kind === 'permission-denied' ? 'denied' : result.kind });
        setShowInstructions(true);
      } else {
        setCheck({ status: locationAccuracyState(result.accuracy), accuracy: result.accuracy });
      }
    } catch {
      if (currentRequest !== requestId.current) return;
      setCheck({ status: 'unavailable' });
      setShowInstructions(true);
    }
  }, []);

  const inspectPermission = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (window.isSecureContext === false) {
      setCheck({ status: 'insecure' });
      return;
    }
    if (!navigator.geolocation) {
      setCheck({ status: 'unavailable' });
      return;
    }
    try {
      if (navigator.permissions?.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (currentRequest !== requestId.current) return;
        if (result.state === 'granted') {
          void testLocation();
          return;
        }
        if (result.state === 'denied') {
          setCheck({ status: 'denied' });
          return;
        }
      }
    } catch {
      // Safari en andere browsers ondersteunen deze permissiecontrole soms niet.
    }
    if (currentRequest === requestId.current) setCheck({ status: 'permission' });
  }, [testLocation]);

  useEffect(() => {
    void inspectPermission();
    const onReturn = () => {
      if (!document.hidden) void inspectPermission();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      ++requestId.current;
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [inspectPermission]);

  // Bestaande teams hebben al een GPS-watcher. Gebruik de verse positie op dit apparaat.
  useEffect(() => {
    if (!deviceLocation) return;
    const age = Date.now() - Date.parse(deviceLocation.capturedAt ?? '');
    if (Number.isFinite(age) && age >= 0 && age <= 60_000) {
      ++requestId.current;
      setCheck({ status: locationAccuracyState(deviceLocation.accuracy), accuracy: deviceLocation.accuracy });
    }
  }, [deviceLocation?.capturedAt, deviceLocation?.accuracy]);

  // Eerst Hint Henk, dan pas de GPS-pop-up. Per browsersessie automatisch eenmaal.
  useEffect(() => {
    if (blockedByIntro) {
      setOpen(false);
      return;
    }
    if (!autoOpenedRef.current) {
      autoOpenedRef.current = true;
      if (!alreadyVisited()) setOpen(true);
    }
  }, [blockedByIntro]);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
      } else if (event.key === 'Tab') {
        const focusables = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? []
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeDialog]);

  const failed = ['denied', 'timeout', 'unavailable', 'insecure', 'imprecise'].includes(check.status);
  const shouldShowGuide = failed || showInstructions;
  const checked = check.status === 'ready';

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={'start-location-check__trigger start-location-check__trigger--' + check.status}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <GameIcon name={checked ? 'check' : 'location'} size={19} />
        {checked ? 'GPS gereed · opnieuw controleren' : 'GPS controleren'}
      </button>
      {open ? createPortal(
        <div className="start-location-check__overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section
            ref={dialogRef}
            className={'start-location-check start-location-check--' + check.status}
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-location-heading"
            aria-describedby="start-location-message"
          >
            <button
              ref={closeButtonRef}
              type="button"
              className="start-location-check__close"
              aria-label="GPS-controle sluiten"
              onClick={closeDialog}
            >×</button>
            <div className="start-location-check__heading">
              <GameIcon name={checked ? 'check' : 'location'} size={24} />
              <h2 id="start-location-heading">GPS-controle</h2>
            </div>
            <p className="start-location-check__message" id="start-location-message" role="status" aria-live="polite">
              {messageForStatus(check)}
            </p>
            {!checked && check.status !== 'checking' ? (
              <div className="start-location-check__actions">
                <button type="button" className="button secondary" onClick={() => void testLocation()}>
                  {check.status === 'permission' ? 'Locatie toestaan en testen' : 'Opnieuw testen'}
                </button>
                {!shouldShowGuide ? (
                  <button type="button" className="text-link" onClick={() => setShowInstructions(true)}>
                    Hoe stel ik dit in?
                  </button>
                ) : null}
              </div>
            ) : null}
            {checked ? (
              <div className="start-location-check__actions">
                <button type="button" className="button primary" onClick={closeDialog}>Verder naar het spel</button>
                <button type="button" className="start-location-check__retest" onClick={() => void testLocation()}>
                  Opnieuw testen
                </button>
              </div>
            ) : null}
            {shouldShowGuide && !checked ? (
              <div className="start-location-check__guide">
                <h3>Locatie aanzetten op {guide.title}</h3>
                <ol>
                  {guide.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
                <div className="start-location-check__links">
                  {guide.links.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.title} <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
                <p className="muted small">
                  De instellingen kun je meestal niet vanuit de website openen. Volg de stappen hierboven en probeer de GPS-test opnieuw.
                </p>
              </div>
            ) : null}
            {!checked ? (
              <button type="button" className="start-location-check__skip" onClick={closeDialog}>
                Later instellen
              </button>
            ) : null}
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}
