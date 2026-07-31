import { GameIcon } from '../../components/GameUi';
import { isBonusLocation, type BonusLocation, type RouteStop } from '../game/gameTypes';
import type { RouteMarkerStatus } from './mapTypes';

interface RouteMarkerProps {
  stop: RouteStop | BonusLocation;
  status: RouteMarkerStatus;
  selected: boolean;
  style: React.CSSProperties;
  onSelect: (stop: RouteStop | BonusLocation) => void;
}

const statusLabels: Record<RouteMarkerStatus, string> = {
  locked: 'vergrendeld',
  available: 'beschikbaar',
  arrived: 'locatie gevonden',
  started: 'bezig',
  completed: 'voltooid',
  current: 'huidige stop',
  finale: 'finale'
};

export function RouteMarker({ stop, status, selected, style, onSelect }: RouteMarkerProps) {
  const bonus = isBonusLocation(stop);
  const locked = status === 'locked' && !bonus;
  const markerLabel = locked
    ? `Stop ${stop.order}, verborgen en vergrendeld`
    : bonus
      ? `Verborgen schub, ${statusLabels[status]}`
      : `Stop ${stop.order}: ${stop.title}, ${statusLabels[status]}`;

  return (
    <button
      className={`map-stop-marker map-stop-marker--${status}${bonus ? ' map-stop-marker--bonus' : ''}${selected ? ' is-selected' : ''}`}
      type="button"
      style={style}
      aria-label={markerLabel}
      aria-pressed={locked ? undefined : selected}
      disabled={locked}
      onClick={() => onSelect(stop)}
    >
      <span className="map-stop-marker__number" aria-hidden="true">{bonus ? '◈' : stop.order}</span>
      <span className="map-stop-marker__state" aria-hidden="true">
        {status === 'completed' ? <GameIcon name="check" size={16} />
          : status === 'locked' ? <GameIcon name="lock" size={14} />
            : status === 'finale' ? '🐉'
              : status === 'current' ? <GameIcon name="location" size={15} />
                : null}
      </span>
    </button>
  );
}
