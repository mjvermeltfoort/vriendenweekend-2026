import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useGame } from '../app/gameContext';
import { MeldkamerAudioIcon } from './MeldkamerAudioIcon';
import { TeamRadioPanel } from './TeamRadioPanel';

export function FloatingTeamRadio() {
  const { activeTeam } = useGame();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onDocumentKeyDown);

    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  function onOpen() {
    if (!activeTeam) return;
    setOpen(true);
  }

  function onClose() {
    setOpen(false);
  }

  const onToggleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  if (!activeTeam) return null;

  return (
    <div className="floating-team-radio">
      {!open ? (
        <button
          ref={triggerRef}
          type="button"
          className="icon-button floating-team-radio__toggle"
          aria-label="Meldkamer openen"
          onClick={onOpen}
          onKeyDown={onToggleKeyDown}
        >
          <MeldkamerAudioIcon className="meldkamer-audio-icon" />
          <span className="floating-team-radio__toggle-text">Meldkamer</span>
        </button>
      ) : (
        <>
          <div className="floating-team-radio__backdrop" role="presentation" onClick={onClose} />
          <div className="floating-team-radio__sheet" role="dialog" aria-modal="true" aria-label="Meldkamer">
            <button
              ref={closeRef}
              type="button"
              className="icon-button floating-team-radio__close"
              aria-label="Meldkamer sluiten"
              onClick={onClose}
            >
              ×
            </button>
            <TeamRadioPanel />
          </div>
        </>
      )}
    </div>
  );
}
