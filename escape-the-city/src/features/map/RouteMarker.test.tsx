import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { RouteMarker } from './RouteMarker';
import type { RouteMarkerStatus } from './mapTypes';

describe('RouteMarker', () => {
  it('renders keyboard-native buttons with non-color status indicators', () => {
    const statuses: RouteMarkerStatus[] = [
      'locked',
      'available',
      'arrived',
      'started',
      'completed',
      'current',
      'finale'
    ];

    for (const status of statuses) {
      const html = renderToStaticMarkup(
        <RouteMarker
          stop={status === 'finale' ? gamePack.stops.at(-1)! : gamePack.stops[0]}
          status={status}
          selected={false}
          style={{ left: '10px', top: '10px' }}
          onSelect={() => undefined}
        />
      );
      expect(html).toContain('<button');
      expect(html).toContain(`map-stop-marker--${status}`);
      expect(html).toContain('map-stop-marker__number');
    }
  });

  it('does not disclose or activate a locked stop', () => {
    const stop = gamePack.stops[1];
    const html = renderToStaticMarkup(
      <RouteMarker
        stop={stop}
        status="locked"
        selected={false}
        style={{ left: '10px', top: '10px' }}
        onSelect={() => undefined}
      />
    );

    expect(html).toContain('disabled');
    expect(html).toContain('verborgen en vergrendeld');
    expect(html).not.toContain(stop.title);
  });
});
