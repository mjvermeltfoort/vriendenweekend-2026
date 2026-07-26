/* global performance */
(() => {
  'use strict';

  // ============================================================
  // Assistentteksten – aanpasbaar per spel of via options.messages
  // ============================================================
  const DEFAULT_ASSISTANT_NAME = 'Hint Henk';

  const ASSISTANT_MESSAGES = {
    start: [
      'Klaar voor het avontuur? Schuif die tegels op hun plek!',
      'Laten we beginnen. Ik hou een oogje in het zeil.',
      'Een goed puzzelaar kijkt altijd eerst naar het grote geheel.'
    ],
    oneMinute: [
      'Zie je het patroon al?',
      'Begin eens met de buitenranden.',
      'Grote kleurvlakken zijn vaak makkelijker.',
      'Niet gokken. Kijk welke tegel de meeste informatie geeft.',
      'Soms helpt het om even uit te zoomen.'
    ],
    twoMinutesLowProgress: [
      'Nog geen zorgen, deze puzzel is lastiger dan hij lijkt.',
      'Werk stukje voor stukje.',
      'Een juiste tegel kan ineens meerdere nieuwe mogelijkheden geven.',
      'Misschien zit de oplossing in een ander deel van de afbeelding.'
    ],
    wrongStreak: [
      'Misschien kijk je naar het verkeerde deel.',
      'Probeer eens een andere hoek.',
      'Even opnieuw kijken kan wonderen doen.',
      'Niet alles hoeft direct duidelijk te zijn.'
    ],
    idle: [
      'Nog aan het nadenken? Dat is meestal een goed teken.',
      'Ik wacht wel even...',
      'Soms zie je het ineens.'
    ],
    halfDone: [
      'Mooi! Je bent al over de helft.',
      'Nu begint het plaatje echt zichtbaar te worden.',
      'Je bent goed bezig.'
    ],
    threequartersDone: [
      'Nog een klein stukje!',
      'Je bent dichterbij dan je denkt.',
      'Volhouden!'
    ],
    almostDone: [
      'Nog een paar tegels!',
      'Ik weet al wat het wordt...',
      'De finish is in zicht.'
    ],
    fiveMinutes: [
      'Niet opgeven!',
      'Iedereen loopt hier wel even vast.',
      'Je kunt dit!',
      'Ik geloof in je.',
      'Bijna niemand lost deze in één keer op.'
    ],
    eightMinutes: [
      'Ik heb al moeilijkere puzzelaars gezien...',
      '...maar ook makkelijkere 😉',
      'Ik zou helpen...',
      '...maar dan zou het te makkelijk worden.',
      'Misschien eerst even koffie? ☕'
    ],
    tenMinutes: [
      'Kan ik je iets laten zien? Er is een hint beschikbaar.',
      'Je speelt al een tijdje. Wil je een kleine hint?'
    ],
    twentyMinutes: [
      'Zal ik Paco vragen om mee te kijken? 🐶',
      'Misschien is koffie de beste hint van vandaag. ☕'
    ],
    solved: [
      'Netjes gedaan!',
      'Die heb je gekraakt!',
      'Op naar de volgende aanwijzing!',
      'Dat ging uitstekend!'
    ],
    easterEgg: [
      'Ik weet het antwoord... maar ik mag het niet verklappen.'
    ]
  };

  // ============================================================
  // Hulpfuncties
  // ============================================================

  /** Kies willekeurig een bericht uit arr, sla het vorige over. */
  function pickRandom(arr, exclude) {
    if (!arr || arr.length === 0) return '';
    const pool = arr.length > 1 ? arr.filter(s => s !== exclude) : arr;
    return pool[Math.floor(Math.random() * pool.length)] || arr[0];
  }

  /** Gooi confetti vanuit de bovenkant van het scherm. */
  function launchConfetti() {
    const colors = ['#d1ae62', '#f5c030', '#e07000', '#fff3d5', '#c83200', '#ffd54f'];
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('div');
      el.className = 'asst-confetti';
      const size = 6 + Math.floor(Math.random() * 6);
      el.style.cssText = [
        'left:'             + (Math.random() * 100) + 'vw',
        'top:-10px',
        'width:'            + size + 'px',
        'height:'           + size + 'px',
        'background:'       + colors[i % colors.length],
        'border-radius:'    + (Math.random() > 0.5 ? '50%' : '2px'),
        'animation-duration:' + (0.9 + Math.random() * 1.1).toFixed(2) + 's',
        'animation-delay:'  + (Math.random() * 0.7).toFixed(2) + 's'
      ].join(';');
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  }

  /** Lege manager als de container niet bestaat. */
  function createNoopManager() {
    return {
      onGameStart() {},
      onMove() {},
      onGameSolved() {},
      pause() {},
      resume() {},
      destroy() {}
    };
  }

  // ============================================================
  // AssistantManager – centrale controller
  // ============================================================

  /**
   * Maak een spelassistent aan.
   *
   * @param {object} options
   * @param {string}  [options.containerId='game-assistant']  id van het HTML-element
   * @param {object}  [options.messages]  overschrijf één of meer berichtencategorieën
   */
  function createAssistantManager(options) {
    options = options || {};
    const assistantName = options.name || DEFAULT_ASSISTANT_NAME;
    const messages  = Object.assign({}, ASSISTANT_MESSAGES, options.messages || {});
    const container = document.getElementById(options.containerId || 'game-assistant');
    if (!container) return createNoopManager();

    // DOM-referenties
    const bubble     = container.querySelector('.asst-bubble');
    const bubbleText = container.querySelector('.asst-bubble-text');
    const hintBtn    = container.querySelector('.asst-hint-btn');
    const charRow    = container.querySelector('.asst-char-row');
    const character  = container.querySelector('.asst-character');
    const minimizeEl = container.querySelector('.asst-minimize');
    const restoreEl  = container.querySelector('.asst-restore');

    container.dataset.assistantName = assistantName;
    container.setAttribute('aria-label', assistantName);
    if (charRow) charRow.dataset.assistantName = assistantName;
    if (character) character.setAttribute('aria-label', assistantName + ' – klik voor laatste hint');
    if (restoreEl) {
      restoreEl.setAttribute('aria-label', assistantName + ' tonen');
      restoreEl.title = assistantName + ' tonen';
    }
    if (minimizeEl) {
      minimizeEl.setAttribute('aria-label', assistantName + ' minimaliseren');
      minimizeEl.title = assistantName + ' minimaliseren';
    }
    if (hintBtn) hintBtn.setAttribute('aria-label', assistantName + ' geeft een hint');

    // ---- Interne toestand ----
    let accMs        = 0;       // opgebouwde speeltijd vóór de laatste pauze
    let sessionAt    = 0;       // performance.now() bij hervatten
    let isPaused     = true;
    let lastText     = '';
    let bubbleTimer  = 0;
    let tickTimer    = 0;
    let hintUnlocked = false;
    let hintCallback = null;
    let idleShown    = false;
    let wrongStreak  = 0;
    let progress     = 0;       // 0..1
    let lastMoveAt   = 0;       // performance.now() van laatste zet
    const milestones = new Set();

    // ---- Helpers ----

    function playMs() {
      return accMs + (isPaused || !sessionAt ? 0 : performance.now() - sessionAt);
    }

    function setEmotion(name) {
      container.dataset.emotion = name || 'idle';
    }

    function clearEmotionAfter(name, ms) {
      window.setTimeout(() => {
        if (container.dataset.emotion === name) container.dataset.emotion = 'idle';
      }, ms);
    }

    function enter() {
      container.hidden = false;
      container.classList.remove('asst-hidden');
      container.classList.remove('asst-entering');
      void container.offsetWidth;
      container.classList.add('asst-entering');
      window.setTimeout(() => container.classList.remove('asst-entering'), 1800);
    }

    function showBubble(text, emotion, autoDismiss) {
      if (!bubble || !bubbleText || !text) return;
      window.clearTimeout(bubbleTimer);

      lastText = text;
      bubbleText.textContent = text;

      // Hintknop tonen zodra hint ontgrendeld is
      if (hintBtn) hintBtn.hidden = !hintUnlocked;

      bubble.hidden = false;
      // Herstart de verschijnanimate
      void bubble.offsetWidth;

      if (emotion) {
        setEmotion(emotion);
        const dur = { happy: 1650, excited: 1850, win: 2800, surprised: 520, thinking: 3600, curious: 2300 };
        clearEmotionAfter(emotion, dur[emotion] || 2000);
      }

      if (autoDismiss !== false) {
        bubbleTimer = window.setTimeout(() => { bubble.hidden = true; }, 8000);
      }
    }

    /** Toon eenmalig een mijlpaalbericht. */
    function milestone(key, arr, emotion) {
      if (milestones.has(key)) return;
      milestones.add(key);
      showBubble(pickRandom(arr, lastText), emotion, true);
    }

    // ---- Tik-lus (elke seconde tijdens het spelen) ----
    function tick() {
      if (isPaused) return;

      const totalSec = playMs() / 1000;
      const idleMs   = lastMoveAt ? performance.now() - lastMoveAt : playMs();

      // Tijdmijlpalen
      if (totalSec >= 60)   milestone('t1m',   messages.oneMinute,           'curious');
      if (totalSec >= 120 && progress < 0.2)
                            milestone('t2m_low', messages.twoMinutesLowProgress, 'thinking');
      if (totalSec >= 300)  milestone('t5m',   messages.fiveMinutes,          'happy');
      if (totalSec >= 480)  milestone('t8m',   messages.eightMinutes,         'thinking');
      if (totalSec >= 600 && !hintUnlocked) {
        hintUnlocked = true;
        milestone('t10m', messages.tenMinutes, 'curious');
        // Zorg dat ballon open blijft zodat speler knop ziet
        window.clearTimeout(bubbleTimer);
        if (bubble) bubble.hidden = false;
      }
      if (totalSec >= 1200) milestone('t20m',  messages.twentyMinutes,        'thinking');

      // Inactiviteit: 30 seconden zonder zet
      if (idleMs >= 30000 && lastMoveAt > 0) {
        if (!idleShown) {
          idleShown = true;
          showBubble(pickRandom(messages.idle, lastText), 'thinking', true);
        }
      } else {
        idleShown = false;
      }
    }

    // ---- UI-koppeling ----
    if (character) {
      character.addEventListener('click', () => {
        if (lastText) showBubble(lastText, null, true);
      });
    }

    if (minimizeEl) {
      minimizeEl.addEventListener('click', () => {
        container.classList.add('asst-minimized');
        if (restoreEl) restoreEl.hidden = false;
      });
    }

    if (restoreEl) {
      restoreEl.addEventListener('click', () => {
        container.classList.remove('asst-minimized');
        restoreEl.hidden = true;
        if (lastText) showBubble(lastText, null, true);
      });
    }

    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        if (hintCallback) hintCallback();
      });
    }

    // ---- Publieke API ----
    const manager = {
      /**
       * Aanroepen wanneer het spel start (of opnieuw begint).
       * @param {Function} [hintCb]  callback die één tegelhint toont
       */
      onGameStart(hintCb) {
        hintCallback  = hintCb || null;
        accMs         = 0;
        sessionAt     = performance.now();
        isPaused      = false;
        lastText      = '';
        hintUnlocked  = false;
        idleShown     = false;
        wrongStreak   = 0;
        progress      = 0;
        lastMoveAt    = 0;
        milestones.clear();

        window.clearTimeout(bubbleTimer);
        window.clearInterval(tickTimer);
        if (bubble)  bubble.hidden = true;
        if (hintBtn) hintBtn.hidden = true;

        // Easter egg: ~1% kans, verschijnt op willekeurig moment (5–15 min)
        if (Math.random() < 0.01) {
          const delay = (300 + Math.floor(Math.random() * 600)) * 1000;
          window.setTimeout(() => {
            if (!isPaused) showBubble(pickRandom(messages.easterEgg, lastText), 'thinking', true);
          }, delay);
        }

        showBubble(pickRandom(messages.start, ''), 'happy', true);
        tickTimer = window.setInterval(tick, 1000);
        setEmotion('idle');
      },

      /**
       * Aanroepen na elke zet.
       * @param {object} params
       * @param {boolean} params.correct        verbetert de zet de toestand?
       * @param {number}  params.progressValue  voltooiing 0..1
       */
      onMove({ correct, progressValue }) {
        lastMoveAt = performance.now();
        idleShown  = false;

        if (correct) {
          wrongStreak = 0;
          progress    = progressValue;

          if (progress >= 0.5)  milestone('p50', messages.halfDone,          'happy');
          if (progress >= 0.75) milestone('p75', messages.threequartersDone,  'happy');
          if (progress >= 0.9)  milestone('p90', messages.almostDone,         'excited');

          // Als er al vroeg goede voortgang is, skip het 2-min-melding
          if (progress >= 0.2) milestones.add('t2m_low');

        } else {
          wrongStreak++;
          if (wrongStreak >= 5) {
            wrongStreak = 0;
            showBubble(pickRandom(messages.wrongStreak, lastText), 'thinking', true);
          }
        }
      },

      /** Aanroepen wanneer de puzzel is opgelost. */
      onGameSolved() {
        manager.pause();
        window.clearInterval(tickTimer);
        tickTimer = 0;
        window.clearTimeout(bubbleTimer);

        showBubble(pickRandom(messages.solved, lastText), 'win', false);
        setEmotion('win');
        launchConfetti();
      },

      /** Pauzeer alle timers (bijv. bij verborgen tabblad of overlay). */
      pause() {
        if (isPaused) return;
        isPaused  = true;
        accMs    += performance.now() - (sessionAt || performance.now());
        sessionAt = 0;
        window.clearInterval(tickTimer);
        tickTimer = 0;
      },

      /** Hervat alle timers. */
      resume() {
        if (!isPaused) return;
        isPaused  = false;
        sessionAt = performance.now();
        if (!tickTimer) tickTimer = window.setInterval(tick, 1000);
      },

      speak(text, options = {}) {
        showBubble(text, options.emotion || null, options.autoDismiss);
      },

      emote(name, duration) {
        if (!name) {
          setEmotion('idle');
          return;
        }

        setEmotion(name);
        if (duration) clearEmotionAfter(name, duration);
      },

      enter,

      /** Ruim alle timers op bij afsluiten van de pagina. */
      destroy() {
        manager.pause();
        window.clearTimeout(bubbleTimer);
        bubbleTimer = 0;
      }
    };

    return manager;
  }

  // Exporteer naar window zodat elk spel createAssistantManager kan aanroepen
  window.createAssistantManager = createAssistantManager;
})();
