import { useEffect, useState } from 'react';
import { isStandalone as getIsStandalone } from './pwaUtils';

export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(getIsStandalone);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setEvent(null);
      setIsStandalone(true);
    };
    const handleDisplayMode = () => setIsStandalone(getIsStandalone());

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    displayMode.addEventListener('change', handleDisplayMode);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      displayMode.removeEventListener('change', handleDisplayMode);
    };
  }, []);

  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  return {
    event,
    dismissed,
    isStandalone,
    isiOS,
    setDismissed,
    async prompt() {
      if (!event) return false;
      await event.prompt();
      const result = await event.userChoice;
      setEvent(null);
      if (result.outcome === 'accepted') setIsStandalone(true);
      return result.outcome === 'accepted';
    }
  };
}
