import { useState } from 'react';
import { useInstallPrompt } from './useInstallPrompt';

export function InstallBanner() {
  const install = useInstallPrompt();
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  if (install.isStandalone || install.dismissed || (!install.event && !install.isiOS)) {
    return null;
  }

  return (
    <aside className="install-banner" aria-labelledby="install-banner-title">
      <div className="install-banner__copy">
        <strong id="install-banner-title">Installeer de Moerasdraak</strong>
        <span>Sneller openen en beter offline spelen.</span>
        {showIosInstructions ? (
          <span className="install-banner__instructions">Tik op Deel en daarna op ‘Zet op beginscherm’.</span>
        ) : null}
      </div>
      <button
        className="button primary install-banner__button"
        type="button"
        onClick={() => {
          if (install.isiOS) {
            setShowIosInstructions(true);
          } else {
            void install.prompt();
          }
        }}
      >
        Installeer
      </button>
      <button
        className="install-banner__close"
        type="button"
        aria-label="Installatiebalk sluiten"
        onClick={() => install.setDismissed(true)}
      >
        ×
      </button>
    </aside>
  );
}
