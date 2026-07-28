import { useState } from 'react';
import { DragonEmblem, GameIcon, HintDialog, PageShell, ProgressBar, TeamAvatar } from '../components/GameUi';

export function DesignSystemPage() {
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <PageShell title="Design preview" backTo="/" navigation={false}>
      <div className="design-grid">
        <section className="card">
          <p className="eyebrow">Kleuren</p>
          <div className="swatches" aria-label="Kleurstalen">
            <span className="swatch" style={{ background: 'var(--color-surface-green)' }} />
            <span className="swatch" style={{ background: 'var(--color-success)' }} />
            <span className="swatch" style={{ background: 'var(--color-parchment)' }} />
            <span className="swatch" style={{ background: 'var(--color-gold)' }} />
            <span className="swatch" style={{ background: 'var(--color-background-deep)' }} />
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
        </section>

        <section className="parchment-card">
          <p className="eyebrow">Perkament</p>
          <h2>Een verborgen verhaal</h2>
          <p>Donkere tekst blijft goed leesbaar op een warme, tactiele ondergrond.</p>
          <label className="field"><span>Antwoord</span><input placeholder="Vul antwoord in" /></label>
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
