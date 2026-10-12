import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../app/gameContext';
import { GameIcon } from './GameUi';
import { browserLocationProvider } from '../features/location/browserProvider';
import { detectLocationDevice, getLocationGuide, locationAccuracyState } from '../features/location/startLocationGuide';

type LocationCheckStatus =
  | 'checking' | 'permission' | 'denied' | 'timeout' | 'unavailable' | 'insecure' | 'ready' | 'imprecise';
type LocationCheck = { status: LocationCheckStatus; accuracy?: number };

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

export function StartLocationCheck() {
  const { deviceLocation } = useGame();
  const [check, setCheck] = useState<LocationCheck>({ status: 'checking' });
  const [showInstructions, setShowInstructions] = useState(false);
  const requestId = useRef(0);
  const device = useMemo(() => detectLocationDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0), []);
  const guide = useMemo(() => getLocationGuide(device), [device]);

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

  const failed = ['denied', 'timeout', 'unavailable', 'insecure', 'imprecise'].includes(check.status);
  const shouldShowGuide = failed || showInstructions;
  const checked = check.status === 'ready';

  return (
    <section className={'start-location-check start-location-check--' + check.status} aria-labelledby="start-location-heading">
      <div className="start-location-check__heading">
        <GameIcon name={checked ? 'check' : 'location'} size={20} />
        <h2 id="start-location-heading">GPS-controle</h2>
      </div>
      <p className="start-location-check__message" role="status" aria-live="polite">{messageForStatus(check)}</p>
      {!checked && check.status !== 'checking' ? (
        <div className="start-location-check__actions">
          <button type="button" className="button secondary" onClick={() => void testLocation()}>
            {check.status === 'permission' ? 'Locatie toestaan en testen' : 'Opnieuw testen'}
          </button>
          {!shouldShowGuide ? (
            <button type="button" className="text-link" onClick={() => setShowInstructions(true)}>Hoe stel ik dit in?</button>
          ) : null}
        </div>
      ) : null}
      {checked ? <button type="button" className="start-location-check__retest" onClick={() => void testLocation()}>Opnieuw testen</button> : null}
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
          <p className="muted small">De instellingen kun je meestal niet vanuit de website openen. Volg de stappen hierboven en probeer de GPS-test opnieuw.</p>
        </div>
      ) : null}
    </section>
  );
}
