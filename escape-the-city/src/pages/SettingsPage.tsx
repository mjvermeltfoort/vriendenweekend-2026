import { useState } from 'react';
import { PageShell, SyncStatus } from '../components/GameUi';
import { useGame } from '../app/gameContext';
import { useAudio } from '../features/audio/audioContext';

export function SettingsPage() {
  const { syncStatus, syncMessage, syncNow, removeActiveTeam, settings, updateSettings } = useGame();
  const { toggleSound, toggleBackgroundMusic } = useAudio();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <PageShell title="Info" backTo="/route">
      <section className="card settings-section">
        <p className="eyebrow">Spel</p>
        <h2>Hoe werkt het?</h2>
        <details>
          <summary>Route en opdrachten</summary>
          <p>Volg de zeven routepunten in Den Bosch. Controleer per plek jullie locatie en los samen de opdracht op.</p>
        </details>
        <details>
          <summary>GPS en privacy</summary>
          <p>GPS wordt alleen gebruikt om te controleren of jullie bij een routepunt zijn. Als GPS niet werkt, blijft handmatige controle beschikbaar.</p>
        </details>
        <details>
          <summary>Offline spelen</summary>
          <p>Team en voortgang worden lokaal opgeslagen. Bereid de route vooraf voor voor de beste offline ervaring.</p>
        </details>
      </section>

      <section className="card settings-section stack">
        <p className="eyebrow">Weergave</p>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.highContrastEnabled}
            onChange={(event) => updateSettings({ highContrastEnabled: event.target.checked })}
          />
          <span>
            <strong>Hoger contrast voor buiten</strong>
            <small>Maakt teksten, randen en panelen duidelijker in fel licht.</small>
          </span>
        </label>
      </section>

      <section className="card settings-section stack">
        <p className="eyebrow">Geluid</p>
        <label className="row">
          <input type="checkbox" checked={settings.soundEnabled} onChange={toggleSound} />
          <span>Geluid aan</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={settings.backgroundMusicEnabled}
            disabled={!settings.soundEnabled}
            onChange={toggleBackgroundMusic}
          />
          <span>Sfeermuziek aan</span>
        </label>
        <p className="muted small">Bij ontbrekende audio blijft altijd een tekstversie zichtbaar.</p>
      </section>

      <section className="card settings-section stack">
        <p className="eyebrow">Synchronisatie</p>
        <SyncStatus status={syncStatus} message={syncMessage} />
        <button className="button primary" onClick={() => void syncNow()}>Nu synchroniseren</button>
      </section>

      <section className="card settings-section stack">
        <p className="eyebrow">Teamdata</p>
        <button className="button danger" onClick={() => setConfirmDelete(true)}>Lokaal team verwijderen</button>
        {confirmDelete ? (
          <div className="card stack" role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-description">
            <h2 id="delete-title">Team verwijderen?</h2>
            <p id="delete-description">Dit verwijdert team en voortgang van dit toestel. Deze actie kan niet lokaal ongedaan worden gemaakt.</p>
            <button className="button danger" onClick={() => void removeActiveTeam()}>Ja, lokaal verwijderen</button>
            <button className="button ghost" onClick={() => setConfirmDelete(false)}>Annuleren</button>
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
