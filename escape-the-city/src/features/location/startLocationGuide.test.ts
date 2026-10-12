import { describe, expect, it } from 'vitest';
import { detectLocationDevice, getLocationGuide, locationAccuracyState } from './startLocationGuide';

describe('GPS-startscherm apparaatherkenning', () => {
  it('herkent Android Chrome en toont relevante browserinstellingen', () => {
    const device = detectLocationDevice('Mozilla/5.0 (Linux; Android 15; Pixel) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36');
    expect(device).toMatchObject({ platform: 'android', browser: 'chrome' });
    expect(getLocationGuide(device).steps.join(' ')).toContain('Site-instellingen');
    expect(getLocationGuide(device).links[0].url).toContain('support.google.com');
  });

  it('herkent Chrome op iPhone ook als Safari in de user-agent staat', () => {
    const device = detectLocationDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/138.0 Mobile/15E148 Safari/604.1');
    expect(device).toMatchObject({ platform: 'ios', browser: 'chrome' });
    expect(getLocationGuide(device).steps.join(' ')).toContain('Exacte locatie');
  });

  it('herkent Safari op iPhone en iPad met desktop user-agent', () => {
    const safari = detectLocationDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1');
    expect(safari).toMatchObject({ platform: 'ios', browser: 'safari' });
    expect(getLocationGuide(safari).steps.join(' ')).toContain('Website-instellingen');
    expect(detectLocationDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15', 5).platform).toBe('ios');
  });

  it('heeft een generieke handleiding voor onbekende browsers', () => {
    const device = detectLocationDevice('CustomBrowser/1.0');
    expect(device.platform).toBe('other');
    expect(getLocationGuide(device).steps).toHaveLength(3);
  });

  it('maakt onderscheid tussen een GPS-fix en voldoende nauwkeurigheid', () => {
    expect(locationAccuracyState(18)).toBe('ready');
    expect(locationAccuracyState(40)).toBe('ready');
    expect(locationAccuracyState(41)).toBe('imprecise');
    expect(locationAccuracyState(Number.NaN)).toBe('imprecise');
  });
});
