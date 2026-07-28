import { useEffect, useState } from 'react';

export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window);

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
      return result.outcome === 'accepted';
    }
  };
}
