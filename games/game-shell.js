(() => {
  'use strict';

  window.createGameGate = function createGameGate(onBack) {
    const root = document.getElementById('game-gate');
    const title = document.getElementById('gate-title');
    const message = document.getElementById('gate-message');
    const hint = document.getElementById('gate-hint');
    const startButton = document.getElementById('gate-start');
    const backButton = document.getElementById('gate-back');

    backButton.addEventListener('click', () => onBack());

    function show(heading, copy, options = {}) {
      root.hidden = false;
      root.dataset.loading = options.loading ? 'true' : 'false';
      title.textContent = heading;
      message.textContent = copy;
      hint.hidden = !options.hint;
      hint.textContent = options.hint || '';
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
      completed(heading, copy, clue, onReplay) {
        show(heading, copy, {
          hint: clue,
          onStart: onReplay,
          startLabel: 'Opnieuw spelen',
          showBack: true
        });
      },
      hide() {
        root.hidden = true;
      }
    };
  };

  window.createReplayHandler = function createReplayHandler(options) {
    return async function replayGame() {
      const confirmed = window.confirm(
        'Als je opnieuw speelt, wordt je huidige score voor dit spel verwijderd. Wil je doorgaan?'
      );
      if (!confirmed) return;

      options.gate.loading('Spel opnieuw klaarzetten…', 'Je huidige score wordt verwijderd.');
      try {
        await options.post('replay', {
          name: options.playerName,
          gameId: options.gameId
        });
        window.location.reload();
      } catch (error) {
        options.gate.blocked(
          'Opnieuw spelen mislukt',
          error && error.message ? error.message : 'De score kon niet worden verwijderd.'
        );
      }
    };
  };
})();
