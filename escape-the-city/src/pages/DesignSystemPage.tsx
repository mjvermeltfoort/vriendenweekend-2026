import { useState } from 'react';
import { DragonEmblem, GameIcon, HintDialog, PageShell, ProgressBar, SyncStatus, TeamAvatar } from '../components/GameUi';
import { useGame } from '../app/gameContext';

export function DesignSystemPage() {
  const [hintOpen, setHintOpen] = useState(false);
  const { settings, updateSettings } = useGame();

  return (
    <PageShell title="Design preview" backTo="/" navigation={false}>
      <div className="design-grid">
        <section className="card">
          <p className="eyebrow">Kleuren</p>
          <div className="swatches" aria-label="Kleurstalen">
            {[
              ['Achtergrond', 'var(--color-background)', false],
              ['Oppervlak', 'var(--color-surface)', false],
              ['Groen', 'var(--color-surface-green)', false],
              ['Perkament', 'var(--color-parchment)', true],
              ['Water', '#12565a', false]
            ].map(([label, background, light]) => (
              <span className={`swatch design-swatch${light ? ' design-swatch--light' : ''}`} style={{ background: String(background) }} key={String(label)}>{label}</span>
            ))}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Typografie</p>
          <h1>Moerasdraak</h1>
          <h2>Bossche legende</h2>
          <p>Lora voor langere teksten en duidelijke interface-elementen.</p>
        </section>

        <section className="card stack">
          <p className="eyebrow">Knoppen</p>
          <button className="button primary">Primaire actie</button>
          <button className="button secondary">Secundaire actie</button>
          <button className="button ghost">Ghost actie</button>
          <button className="button primary" disabled>Uitgeschakelde actie</button>
          <a className="text-link" href="#focus-preview">Link met focus</a>
        </section>

        <section className="parchment-card">
          <p className="eyebrow">Perkament</p>
          <h2>Een verborgen verhaal</h2>
          <p>Donkere tekst blijft goed leesbaar op een warme, tactiele ondergrond.</p>
          <label className="field"><span>Antwoord</span><input placeholder="Vul antwoord in" /></label>
          <label className="choice-option">
            <input type="radio" defaultChecked name="design-choice" />
            <span>Geselecteerd antwoord</span>
          </label>
        </section>

        <section className="card stack" id="focus-preview">
          <p className="eyebrow">States</p>
          <div className="route-tabs" aria-label="Voorbeeld routeweergave">
            <button className="is-active" type="button" aria-pressed="true">Lijst</button>
            <button type="button" aria-pressed="false">Route</button>
          </div>
          <nav className="design-bottom-nav" aria-label="Navigatievoorbeeld">
            <span className="bottom-nav__item is-active"><GameIcon name="location" />Route</span>
            <span className="bottom-nav__item"><GameIcon name="team" />Team</span>
          </nav>
          {(['saved', 'local', 'syncing', 'failed', 'offline'] as const).map((status) => (
            <SyncStatus key={status} status={status} message={`Status: ${status}`} />
          ))}
          <p className="error" role="alert">Foutmelding: synchronisatie mislukt.</p>
          <p className="success" role="status">Succesmelding: voortgang opgeslagen.</p>
          <p className="muted">Gedempte aanvullende tekst.</p>
          <div className="design-map-label">Kaartlabel op waterkleur</div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.highContrastEnabled}
              onChange={(event) => updateSettings({ highContrastEnabled: event.target.checked })}
            />
            <span><strong>Hoogcontrastmodus</strong><small>Development-preview</small></span>
          </label>
        </section>

        <section className="card center">
          <p className="eyebrow">Embleem en iconen</p>
          <DragonEmblem />
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {(['dragon', 'location', 'scroll', 'lightbulb', 'shield', 'team', 'sync'] as const).map((name) => <GameIcon key={name} name={name} />)}
          </div>
        </section>

        <section className="card stack">
          <p className="eyebrow">Route en voortgang</p>
          <div className="row">
            <span className="route-marker">3</span>
            <div><h2>Huidige stop</h2><p className="muted">Gouden medaillon en routekaart.</p></div>
          </div>
          <ProgressBar value={4} max={7} label="Opdrachten voltooid" />
        </section>

        <section className="card stack">
          <p className="eyebrow">Team</p>
          <div className="team-avatars">
            {['Jij', 'Sanne', 'Tom', 'Lisa'].map((name, index) => <TeamAvatar key={name} name={name} index={index} />)}
          </div>
          <button className="button secondary" onClick={() => setHintOpen(true)}>Hintdialog openen</button>
        </section>

        <section className="result-label">
          <p className="eyebrow">Resultaat</p>
          <h2>Moerasdraak</h2>
          <p>Team Draakvangers</p>
          <p className="result-label__symbols">🔥 📜 💧 ✨ 🔔 🛡️ 🍺</p>
        </section>
      </div>
      <HintDialog open={hintOpen} hint="Kijk omhoog." penalty={100} onConfirm={() => undefined} onClose={() => setHintOpen(false)} />
    </PageShell>
  );
}
