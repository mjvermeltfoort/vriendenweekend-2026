"""Exercise the real Bosch page with isolated local IndexedDB fixtures."""
import re
from playwright.sync_api import expect


def check_bosch(page, origin, diagnostics):
    page.evaluate("""async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('moerasdraak-storage', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const id = 'bosch-browser-fixture', now = new Date().toISOString();
      const tx = db.transaction(['teams', 'progress'], 'readwrite');
      tx.objectStore('teams').put({ id, gameSlug: 'moerasdraak-den-bosch', gameVersion: 1,
        name: 'Bosch browsercheck', joinCode: 'TEST12', memberNames: ['Tester'],
        privacyAccepted: true, createdAt: now, updatedAt: now, lastActivityAt: now });
      tx.objectStore('progress').put({ teamId: id, gameSlug: 'moerasdraak-den-bosch',
        gameVersion: 1, currentStopId: 'bosch-wezen', collectedRewards: [],
        wrongAttempts: 0, totalHintsUsed: 0, totalScore: 0, finalized: false, version: 1,
        stopProgress: { 'bosch-wezen': { state: 'started', unlockMethod: 'gps',
          attempts: 0, hintsUsed: 0, scoreAwarded: 0, answerData: {} } } });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
      localStorage.setItem('moerasdraak-last-team', id);
      localStorage.setItem('moerasdraak-settings', JSON.stringify({soundEnabled:false,
        backgroundMusicEnabled:false, highContrastEnabled:false, installDismissedAt: now}));
    }""")
    page.reload(wait_until='load')
    page.wait_for_function("document.body.textContent.includes('Bosch browsercheck')")
    page.evaluate("""() => {
      location.hash = '/challenge/bosch-wezen';
    }""")
    page.locator('input[value="penseelpalet"]').check()
    page.locator('input[value="1516"]').check()
    page.get_by_role('button', name='Open het schetsboek').click()
    expect(page.locator('.bosch-art img')).to_have_count(3)
    expect(page.get_by_role('button', name='Wek het monster tot leven')).to_be_disabled()
    for width in (320, 360, 390, 430):
        page.set_viewport_size({'width': width, 'height': 844})
        page.evaluate("() => Promise.all([...document.querySelectorAll('.bosch-art img')].map(i => i.decode()))")
        metrics = page.evaluate("""() => ({
          width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          height: document.querySelector('.bosch-puzzle__stage').getBoundingClientRect().height,
          targets: [...document.querySelectorAll('.bosch-puzzle__selector button')].map(b => ({
            w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }))
        })""")
        assert metrics['scrollWidth'] <= width, metrics
        assert 280 <= metrics['height'] <= 320, metrics
        assert all(t['w'] >= 44 and t['h'] >= 44 for t in metrics['targets']), metrics
        page.screenshot(path=str(diagnostics / f'bosch-{width}.png'), full_page=True)
        print('Bosch mobile layout:', metrics)
    page.get_by_role('button', name='Wissel hoofd', exact=True).click()
    expect(page.get_by_role('img', name='Monster met', exact=False)).to_have_attribute('aria-label', re.compile('vissenkop'))
    page.get_by_role('button', name='Wissel lijf', exact=True).focus()
    page.keyboard.press('Enter')
    page.get_by_role('button', name='Wissel benen', exact=True).click()
    expect(page.get_by_role('button', name='Wek het monster tot leven')).to_be_enabled()
    # Real pointer capture and swipe must change once, never a second synthetic click.
    zone = page.get_by_role('button', name='Wissel hoofd', exact=True).bounding_box()
    x, y = zone['x'] + zone['width'] * .65, zone['y'] + zone['height'] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - 60, y, steps=5)
    page.mouse.up()
    expect(page.locator('.bosch-art')).to_have_attribute('aria-label', re.compile('mensenkop'))
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 60, y, steps=5)
    page.mouse.up()
    expect(page.locator('.bosch-art')).to_have_attribute('aria-label', re.compile('vissenkop'))
    page.emulate_media(reduced_motion='reduce')
    assert page.locator('.bosch-art img').first.evaluate('(e) => getComputedStyle(e).animationName') == 'none'
    print('Bosch browser interactions and reduced motion passed.')
