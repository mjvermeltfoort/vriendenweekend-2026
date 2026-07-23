(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  const scriptUrl = document.currentScript && document.currentScript.src;
  if (!scriptUrl) return;

  const workerUrl = new URL('service-worker.js', scriptUrl);
  const appRootUrl = new URL('./', scriptUrl);
  const hadControllerAtStartup = Boolean(navigator.serviceWorker.controller);
  let registration = null;
  let pendingWorker = null;
  let reloadStarted = false;

  function reloadPage() {
    if (reloadStarted) return;
    reloadStarted = true;
    window.location.reload();
  }

  function activateUpdate() {
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
        activateUpdate();
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
    reloadPage();
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
        activateUpdate();
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
