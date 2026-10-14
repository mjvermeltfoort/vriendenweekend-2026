"""Check Hint Henk against local fixture progress, without a live backend."""
from playwright.sync_api import expect


def check_henk(page, origin, diagnostics):
    # browser-smoke has already prepared the isolated Bosch fixture.
    button = page.get_by_role('button', name='Hint gebruiken', exact=False)
    button.click()
    dialog = page.get_by_role('dialog', name='Hint Henk', exact=True)
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text('Kosten: 100 punten')
    expect(dialog).not_to_contain_text('mensengezicht')
    for width in (320, 390, 430):
        page.set_viewport_size({'width': width, 'height': 740})
        metrics = dialog.evaluate('''e => ({
          left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right,
          bottom: e.getBoundingClientRect().bottom, width: innerWidth,
          scrollWidth: e.scrollWidth, clientWidth: e.clientWidth
        })''')
        assert metrics['left'] >= 0 and metrics['right'] <= width, metrics
        assert metrics['bottom'] <= 740, metrics
        assert metrics['scrollWidth'] <= metrics['clientWidth'], metrics
        page.screenshot(path=str(diagnostics / f'henk-cost-{width}.png'), full_page=True)
    page.keyboard.press('Escape')
    expect(dialog).not_to_be_visible()
    expect(button).to_be_focused()

    # An already purchased hint must open directly and never request payment.
    page.evaluate('''async () => {
      const db = await new Promise(resolve => {
        const r = indexedDB.open('moerasdraak-storage', 2);
        r.onsuccess = () => resolve(r.result);
      });
      const tx = db.transaction('progress', 'readwrite'), store = tx.objectStore('progress');
      const r = store.get('bosch-browser-fixture');
      r.onsuccess = () => {
        const progress = r.result;
        progress.stopProgress['bosch-wezen'].hintsUsed = 1;
        progress.totalHintsUsed = 1;
        store.put(progress);
      };
      await new Promise(resolve => { tx.oncomplete = resolve; });
      db.close();
    }''')
    page.reload(wait_until='load')
    page.get_by_role('button', name='Hint Henk opnieuw bekijken').click()
    expect(dialog).to_contain_text('mensengezicht')
    expect(dialog).not_to_contain_text('Kosten:')
    expect(dialog.get_by_role('button', name='Hint tonen')).to_have_count(0)
    # Explicit listening is a user gesture and must load the bundled voice clip.
    dialog.get_by_role('button', name='Opnieuw beluisteren').click()
    expect(dialog.locator('.hint-henk__mascot--speaking')).to_be_visible()
    page.screenshot(path=str(diagnostics / 'henk-hint-430.png'), full_page=True)
    dialog.get_by_role('button', name='Hint Henk sluiten', exact=True).click()
    expect(dialog).not_to_be_visible()
    print('Hint Henk: mobile layout, cost warning, focus, purchased replay and audio passed.')
