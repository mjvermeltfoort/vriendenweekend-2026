"""Restore a server-issued wrong-answer deadline in a real mobile browser."""
from playwright.sync_api import expect


def check_henk_wrong_answer(page, origin, diagnostics):
    page.clock.install()
    page.evaluate('''async () => {
      const db = await new Promise(resolve => {const r = indexedDB.open('moerasdraak-storage', 2); r.onsuccess = () => resolve(r.result);});
      const tx = db.transaction('progress', 'readwrite'), store = tx.objectStore('progress'), r = store.get('bosch-browser-fixture');
      r.onsuccess = () => {
        const p = r.result; p.serverTimeOffsetMs = 0; p.totalScore = -25;
        p.stopProgress.drakenfontein = {state:'started', attempts:1, hintsUsed:0, scoreAwarded:-25, answerData:{}, unlockMethod:'gps', retryAvailableAt:new Date(Date.now()+60000).toISOString(), lastWrongAnswerAt:new Date().toISOString(), lastWrongAnswerPenalty:25};
        store.put(p);
      };
      await new Promise(resolve => {tx.oncomplete = resolve;}); db.close();
      sessionStorage.removeItem('moerasdraak-henk-wrong-answer:bosch-browser-fixture:drakenfontein');
      location.hash = '/challenge/drakenfontein';
    }''')
    page.reload(wait_until='load')
    dialog = page.get_by_role('dialog', name='Hint Henk', exact=True)
    expect(dialog).to_contain_text('Puntenaftrek: −25 punten')
    expect(dialog).to_contain_text('01:00')
    for width in (320, 390):
        page.set_viewport_size({'width':width, 'height':740})
        box = dialog.bounding_box()
        assert box['x'] >= 0 and box['x'] + box['width'] <= width + 1, box
        assert box['y'] >= 0 and box['y'] + box['height'] <= 741, box
        assert dialog.evaluate('e => e.scrollWidth <= e.clientWidth')
        page.screenshot(path=str(diagnostics / f'henk-wrong-answer-{width}.png'), full_page=True)
    dialog.get_by_role('button', name='Opnieuw beluisteren').click()
    expect(dialog.locator('.hint-henk__mascot--speaking')).to_be_visible()
    dialog.get_by_role('button', name='Foutmelding van Henk sluiten').click()
    page.get_by_role('radio').first.check()
    expect(page.get_by_role('button', name='Nieuwe poging over')).to_be_disabled()
    page.get_by_role('button', name='Hint gebruiken', exact=False).click()
    expect(dialog).to_contain_text('Kosten: 100 punten')
    expect(dialog.locator('.hint-henk__mascot--speaking')).to_be_visible()
    page.keyboard.press('Escape')
    page.reload(wait_until='load')
    expect(dialog).not_to_be_visible()
    page.get_by_role('radio').first.check()
    page.clock.fast_forward(59000)
    expect(page.get_by_role('button', name='Nieuwe poging over 00:01')).to_be_disabled()
    page.get_by_role('button', name='Bekijk Henks foutmelding').click()
    expect(dialog).to_be_visible()
    page.clock.fast_forward(1000)
    expect(dialog).not_to_be_visible()
    expect(page.get_by_role('button', name='Controleer antwoord', exact=True)).to_be_enabled()
    print('Wrong answer: shared deadline survives reload; mobile Henk, v4 audio, hints and 60-second expiry passed.')
