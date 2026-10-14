"""Walk past a schub with real browser geolocation, then inspect the final summary."""
import json
import re
from pathlib import Path
from playwright.sync_api import expect


def check_henk_reminders(page, origin, diagnostics):
    root = Path(__file__).resolve().parents[2] / 'escape-the-city'
    clips = json.loads((root / 'src/features/audio/hintHenkClips.json').read_text())
    ids = [key[:-3] for key in clips if key.endswith(':h1')]
    bonus_ids = [key for key in ids if key.startswith('bonus:')]
    main_ids = [key for key in ids if not key.startswith('bonus:')]
    coordinates = re.search(r'coordinates: coordinate\(([\d.]+), ([\d.]+)', (root / 'src/game-data/moerasdraak/bonusLocations.ts').read_text())
    latitude, longitude = map(float, coordinates.groups())
    context = page.context
    context.grant_permissions(['geolocation'], origin=origin)
    context.set_geolocation({'latitude': latitude, 'longitude': longitude, 'accuracy': 5})
    # Keep every remote action disabled while using a realistic saved session.
    page.add_init_script("Object.defineProperty(navigator, 'onLine', {get: () => false})")
    page.evaluate('''async ({ids}) => {
      const db = await new Promise(resolve => { const r = indexedDB.open('moerasdraak-storage', 2); r.onsuccess = () => resolve(r.result); });
      const tx = db.transaction(['progress', 'team-sessions'], 'readwrite'), store = tx.objectStore('progress');
      const r = store.get('bosch-browser-fixture');
      r.onsuccess = () => {
        const p = r.result; p.currentStopId = 'drakenfontein'; p.totalHintsUsed = 0;
        p.stopProgress = Object.fromEntries(ids.map(id => [id, {state: id === 'drakenfontein' ? 'arrived' : 'available', attempts:0, hintsUsed:0, scoreAwarded:0, answerData:{}, unlockMethod:'gps'}]));
        store.put(p);
      };
      const now = new Date().toISOString();
      tx.objectStore('team-sessions').put({teamId:'bosch-browser-fixture', id:'henk-session-fixture', deviceId:'henk-browser-device', joinedAt:now, lastSeenAt:now});
      await new Promise(resolve => {tx.oncomplete = resolve;}); db.close();
      localStorage.removeItem('moerasdraak-henk-schub-reminders:v1:bosch-browser-fixture');
      localStorage.setItem('moerasdraak-settings', JSON.stringify({soundEnabled:false, backgroundMusicEnabled:false, highContrastEnabled:false, installDismissedAt:now}));
      location.hash = '/route';
    }''', {'ids': ids})
    page.reload(wait_until='load')
    page.wait_for_function('''id => {
      const state = JSON.parse(localStorage.getItem('moerasdraak-henk-schub-reminders:v1:bosch-browser-fixture') || 'null');
      return !!state?.encounters[id];
    }''', arg=bonus_ids[0])
    context.set_geolocation({'latitude': latitude + 350 / 111195, 'longitude': longitude, 'accuracy': 5})
    dialog = page.get_by_role('dialog', name='Hint Henk', exact=True)
    expect(dialog).to_contain_text('nog een drakenschub', timeout=15000)
    for width in (320, 390):
        page.set_viewport_size({'width': width, 'height': 740})
        bounds = dialog.bounding_box()
        assert bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= width + 1, bounds
        assert bounds['y'] >= 0 and bounds['y'] + bounds['height'] <= 741, bounds
        assert dialog.evaluate('(e) => e.scrollWidth <= e.clientWidth')
        page.screenshot(path=str(diagnostics / f'henk-passed-{width}.png'), full_page=True)
    dialog.get_by_role('button', name='Opnieuw beluisteren').click()
    expect(dialog.locator('.hint-henk__mascot--speaking')).to_be_visible()
    dialog.get_by_role('button', name='Laat zien op de kaart').click()
    expect(page).to_have_url(re.compile('schub=bonus%3Abolwerk-sint-jan'))
    expect(page.get_by_role('region', name='Schub: Bolwerk Sint-Jan')).to_be_visible()

    page.evaluate('''async ({mainIds, firstBonus}) => {
      const db = await new Promise(resolve => { const r = indexedDB.open('moerasdraak-storage', 2); r.onsuccess = () => resolve(r.result); });
      const tx = db.transaction('progress', 'readwrite'), store = tx.objectStore('progress'), r = store.get('bosch-browser-fixture');
      r.onsuccess = () => {
        const p = r.result;
        for (const id of mainIds) p.stopProgress[id].state = id === 'bossche-brouwers' ? 'available' : 'completed';
        p.stopProgress[firstBonus].state = 'completed'; store.put(p);
      };
      await new Promise(resolve => {tx.oncomplete = resolve;}); db.close();
      const key = 'moerasdraak-henk-schub-reminders:v1:bosch-browser-fixture';
      const state = JSON.parse(localStorage.getItem(key)); state.lastShownAt = Date.now() - 600001; localStorage.setItem(key, JSON.stringify(state));
      location.hash = '/route';
    }''', {'mainIds': main_ids, 'firstBonus': bonus_ids[0]})
    page.reload(wait_until='load')
    expect(dialog).to_contain_text('5 schubben', timeout=15000)
    page.screenshot(path=str(diagnostics / 'henk-final-summary-390.png'), full_page=True)
    dialog.get_by_role('button', name='Bekijk ontbrekende schubben').click()
    overview = page.get_by_role('region', name='Ontbrekende schubben')
    expect(overview).to_contain_text('Ontbrekende schubben (5)')
    expect(overview.get_by_role('link')).to_have_count(5)
    overview.get_by_role('link').first.click()
    expect(page.get_by_role('region', name='Schub: De Halve Peer')).to_be_visible()
    expect(dialog).not_to_be_visible()
    print('Hint Henk reminders: real GPS passage, mobile layout, v4 speech, map selection and missing-schub overview passed.')
