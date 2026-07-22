(() => {
  'use strict';

  window.createGameGate = function createGameGate(onBack) {
    const root = document.getElementById('game-gate');
    const title = document.getElementById('gate-title');
    const message = document.getElementById('gate-message');
    const startButton = document.getElementById('gate-start');
    const backButton = document.getElementById('gate-back');

    backButton.addEventListener('click', () => onBack());

    function show(heading, copy, options = {}) {
      root.hidden = false;
      root.dataset.loading = options.loading ? 'true' : 'false';
      title.textContent = heading;
      message.textContent = copy;
      startButton.hidden = !options.onStart;
      backButton.hidden = !options.showBack;
      startButton.textContent = options.startLabel || 'Start spel';
      startButton.onclick = options.onStart || null;

      if (options.onStart) {
        window.setTimeout(() => startButton.focus(), 0);
      } else if (options.showBack) {
        window.setTimeout(() => backButton.focus(), 0);
      }
    }

    return {
      loading(heading, copy = 'Toegang wordt gecontroleerd.') {
        show(heading, copy, { loading: true });
      },
      instructions(heading, copy, onStart, startLabel = 'Start spel') {
        show(heading, copy, { onStart, startLabel });
      },
      blocked(heading, copy) {
        show(heading, copy, { showBack: true });
      },
      hide() {
        root.hidden = true;
      }
    };
  };
})();
