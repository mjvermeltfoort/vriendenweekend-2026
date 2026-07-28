import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { DragonEmblem, GameIcon, PageShell } from '../components/GameUi';
import { AudioControl } from '../components/GameUi';
import { AudioPlayer } from '../components/AudioPlayer';
import { narrationAudio } from '../features/audio/audioConfig';
import { audioTranscripts } from '../features/audio/audioTranscripts';

export function ResultPage({ pack }: { pack: GamePack }) {
  const { progress, activeTeam } = useGame();
  const result = progress?.finalResult;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const text = useMemo(() => result?.summary ?? `MOERASDRAAK\nTeam ${activeTeam?.name ?? 'Onbekend'}`, [result, activeTeam]);
  const score = result?.score ?? progress?.totalScore ?? 0;
  const hints = result?.hintsUsed ?? progress?.totalHintsUsed ?? 0;
  const wrongAttempts = result?.wrongAttempts ?? progress?.wrongAttempts ?? 0;
  const symbols = result?.symbols ?? progress?.collectedRewards ?? [];

  async function exportPng(share: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 1080;
    canvas.height = 1350;
    ctx.fillStyle = '#07100d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#c4974d';
    ctx.lineWidth = 8;
    ctx.strokeRect(45, 45, 990, 1260);
    ctx.strokeStyle = '#765326';
    ctx.lineWidth = 2;
    ctx.strokeRect(65, 65, 950, 1220);
    ctx.fillStyle = '#c4974d';
    ctx.font = '600 34px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('HET GEHEIM VAN DE', 540, 150);
    ctx.fillStyle = '#e0bc78';
    ctx.font = 'bold 78px Georgia';
    ctx.fillText('MOERASDRAAK', 540, 245);
    ctx.fillStyle = '#74ad88';
    ctx.font = '600 34px Georgia';
    ctx.fillText('DEN BOSCH', 540, 300);
    ctx.fillStyle = '#ead8af';
    ctx.font = '48px Georgia';
    ctx.fillText(`Team ${activeTeam?.name ?? 'Onbekend'}`, 540, 410);
    ctx.font = '34px Georgia';
    ctx.fillText(symbols.join('  ') || '✦  ✦  ✦  ✦  ✦  ✦  ✦', 540, 510);
    ctx.strokeStyle = '#765326';
    ctx.beginPath();
    ctx.moveTo(170, 575);
    ctx.lineTo(910, 575);
    ctx.stroke();
    ctx.font = '32px Georgia';
    ctx.fillStyle = '#ead8af';
    ctx.fillText(`Score ${score}   ·   Hints ${hints}   ·   Fouten ${wrongAttempts}`, 540, 655);
    ctx.fillText(new Date(result?.createdAt ?? Date.now()).toLocaleDateString('nl-NL'), 540, 720);
    ctx.fillStyle = '#ad9a74';
    ctx.font = '29px Georgia';
    ctx.fillText('Gebrouwen met water, moed, verbeelding', 540, 865);
    ctx.fillText('en een sterk verhaal.', 540, 910);
    ctx.fillStyle = '#c4974d';
    ctx.font = '600 30px Georgia';
    ctx.fillText('FINALE BIJ BOSSCHE BROUWERS', 540, 1125);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'moerasdraak-resultaat.png', { type: 'image/png' });
    if (share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Moerasdraak resultaat' });
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell navigation={false} className="result-page">
      <AudioControl className="result-audio-control" />
      <section className="result-hero">
        <p className="eyebrow">De legende is hersteld</p>
        <h1>Avontuur voltooid!</h1>
        <DragonEmblem />
        <p>Jullie hebben het geheim van de Moerasdraak ontrafeld.</p>
      </section>

      <section className="result-stats" aria-label="Spelresultaten">
        <div className="result-stat"><GameIcon name="time" /><span>Tijd</span><strong>{result?.durationMinutes ?? 0} min</strong></div>
        <div className="result-stat"><GameIcon name="lightbulb" /><span>Hints</span><strong>{hints}</strong></div>
        <div className="result-stat"><GameIcon name="star" /><span>Score</span><strong>{score}</strong></div>
      </section>

      <section className="result-label" style={{ marginTop: '1rem' }}>
        <p className="eyebrow">Het geheim van de</p>
        <h2>Moerasdraak</h2>
        <p className="home-city">Team {activeTeam?.name ?? 'Onbekend'}</p>
        <DragonEmblem compact />
        <p>Gebrouwen met water, moed,<br />verbeelding en een sterk verhaal.</p>
        <p className="result-label__symbols" aria-label={`${symbols.length} herinneringen`}>{symbols.join(' ') || '✦ ✦ ✦ ✦ ✦ ✦ ✦'}</p>
        <p className="small">{new Date(result?.createdAt ?? Date.now()).toLocaleDateString('nl-NL')} · Bossche Brouwers</p>
      </section>

      <section className="card stack" style={{ marginTop: '1rem' }}>
        <AudioPlayer
          source={narrationAudio.completed}
          title="Luister naar de afsluiting"
          transcript={audioTranscripts.completed}
        />
        <pre className="result-text">{text}</pre>
        <button className="button primary" onClick={() => void exportPng(true)}>Resultaat delen</button>
        <button className="button secondary" onClick={() => void exportPng(false)}>Afbeelding opslaan</button>
        <Link className="button ghost" to="/">Terug naar home</Link>
      </section>
      <canvas ref={canvasRef} hidden />
    </PageShell>
  );
}
