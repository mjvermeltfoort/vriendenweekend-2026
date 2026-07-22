(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  const scriptUrl = document.currentScript && document.currentScript.src;
  if (!scriptUrl) return;

  const workerUrl = new URL('service-worker.js', scriptUrl);
  const appRootUrl = new URL('./', scriptUrl);
  const hadControllerAtStartup = Boolean(navigator.serviceWorker.controller);
  let hasController = hadControllerAtStartup;
  let registration = null;
  let pendingWorker = null;
  let reloadRequested = false;
  let reloadStarted = false;
  let dismissed = false;
  let notice = null;
  let refreshButton = null;

  function createNotice() {
    if (notice) return notice;

    const style = document.createElement('style');
    style.textContent = `
      .app-update-notice {
        position: fixed;
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        left: max(12px, env(safe-area-inset-left));
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 14px;
        width: min(560px, calc(100% - 24px));
        margin-left: auto;
        padding: 14px;
        border: 1px solid rgba(212, 189, 120, .48);
        border-radius: 16px;
        background: #20271f;
        color: #f5f0df;
        box-shadow: 0 18px 55px rgba(0, 0, 0, .55);
        font: 400 15px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .app-update-notice[hidden] { display: none; }
      .app-update-copy { flex: 1 1 auto; min-width: 0; }
      .app-update-copy strong { display: block; margin-bottom: 2px; color: #d4bd78; }
      .app-update-actions { display: flex; flex: 0 0 auto; gap: 7px; }
      .app-update-button {
        min-height: 40px;
        padding: 8px 12px;
        border: 1px solid rgba(212, 189, 120, .32);
        border-radius: 10px;
        background: transparent;
        color: #d8d1bd;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      .app-update-button.primary {
        border: 0;
        background: linear-gradient(145deg, #d4bd78, #a8833e);
        color: #241d10;
      }
      .app-update-button:disabled { cursor: wait; opacity: .72; }
      @media (max-width: 520px) {
        .app-update-notice { align-items: stretch; flex-direction: column; gap: 11px; }
        .app-update-actions { justify-content: flex-end; }
      }
    `;
    document.head.append(style);

    notice = document.createElement('aside');
    notice.className = 'app-update-notice';
    notice.hidden = true;
    notice.setAttribute('role', 'region');
    notice.setAttribute('aria-label', 'App-update');
    notice.setAttribute('aria-live', 'polite');

    const copy = document.createElement('div');
    copy.className = 'app-update-copy';
    const heading = document.createElement('strong');
    heading.textContent = 'Nieuwe versie beschikbaar';
    const message = document.createElement('span');
    message.textContent = 'Vernieuw de pagina om de nieuwste versie te gebruiken.';
    copy.append(heading, message);

    const actions = document.createElement('div');
    actions.className = 'app-update-actions';
    const laterButton = document.createElement('button');
    laterButton.className = 'app-update-button';
    laterButton.type = 'button';
    laterButton.textContent = 'Later';
    laterButton.addEventListener('click', () => {
      dismissed = true;
      notice.hidden = true;
    });

    refreshButton = document.createElement('button');
    refreshButton.className = 'app-update-button primary';
    refreshButton.type = 'button';
    refreshButton.textContent = 'Vernieuwen';
    refreshButton.addEventListener('click', activateUpdate);
    actions.append(laterButton, refreshButton);
    notice.append(copy, actions);
    document.body.append(notice);

    return notice;
  }

  function showUpdate(force = false) {
    if (dismissed && !force) return;
    if (force) dismissed = false;
    createNotice().hidden = false;
  }

  function reloadPage() {
    if (reloadStarted) return;
    reloadStarted = true;
    window.location.reload();
  }

  function activateUpdate() {
    reloadRequested = true;
    refreshButton.disabled = true;
    refreshButton.textContent = 'Vernieuwen…';

    const worker = (registration && registration.waiting) || pendingWorker;
    if (worker && worker.state === 'installed') {
      worker.postMessage({ type: 'SKIP_WAITING' });
      window.setTimeout(reloadPage, 4000);
      return;
    }

    if (worker && worker.state === 'activating') {
      window.setTimeout(reloadPage, 4000);
      return;
    }

    reloadPage();
  }

  function watchInstallingWorker(worker) {
    if (!worker || pendingWorker === worker) return;
    pendingWorker = worker;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdate();
      }
    });
  }

  function checkForUpdates() {
    if (!registration || !navigator.onLine) return;
    registration.update().catch(error => {
      console.warn('Controleren op een app-update is mislukt.', error);
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) {
      reloadPage();
      return;
    }

    if (hasController) showUpdate(true);
    hasController = true;
  });

  navigator.serviceWorker
    .register(workerUrl.href, {
      scope: appRootUrl.href,
      updateViaCache: 'none'
    })
    .then(activeRegistration => {
      registration = activeRegistration;

      if (registration.waiting && hadControllerAtStartup) {
        pendingWorker = registration.waiting;
        showUpdate();
      }

      watchInstallingWorker(registration.installing);

      registration.addEventListener('updatefound', () => {
        watchInstallingWorker(registration.installing);
      });

      checkForUpdates();
      window.setInterval(checkForUpdates, 60000);
      window.addEventListener('focus', checkForUpdates);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkForUpdates();
      });
    })
    .catch(error => {
      console.warn('De serviceworker kon niet worden gestart.', error);
    });
})();
