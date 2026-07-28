import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { isSupabaseAvailable } from '../lib/supabase/sync';
import { buildAssetManifest, precacheRouteAssets } from '../features/offline/offlinePack';
import { DragonEmblem, GameIcon, PageShell, ProgressBar, SyncStatus } from '../components/GameUi';
import { AudioPlayer } from '../components/AudioPlayer';
import { narrationAudio } from '../features/audio/audioConfig';
import { audioTranscripts } from '../features/audio/audioTranscripts';

export function PreparationPage({ pack }: { pack: GamePack }) {
  const navigate = useNavigate();
  const { activeTeam, progress, syncStatus, syncMessage, syncNow } = useGame();
  const [downloading, setDownloading] = useState(false);
  const assets = useMemo(() => buildAssetManifest(pack), [pack]);

  async function prepare() {
    setDownloading(true);
    try {
      await precacheRouteAssets(assets);
      await syncNow();
      navigate('/route');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <PageShell title="Voorbereiden" backTo="/team" navigation={false}>
      <div className="center"><DragonEmblem /></div>
      <h1 className="screen-title">Spel voorbereiden</h1>
      <section className="card stack stack--large">
        <AudioPlayer
          source={narrationAudio.welcome}
          title="Welkom bij de Moerasdraak"
          transcript={audioTranscripts.welcome}
        />
        <div>
          <p className="eyebrow">Team</p>
          <h2>{activeTeam?.name ?? 'Geen actief team'}</h2>
        </div>
        <ProgressBar value={progress?.collectedRewards.length ?? 0} max={pack.stops.length} label="Bestaande voortgang" />
        <ul className="prep-list">
          <li><span className="prep-check"><GameIcon name="check" size={16} /></span>Routeversie {pack.version} gereed</li>
          <li><span className="prep-check"><GameIcon name="check" size={16} /></span>{assets.length} routebestanden beschikbaar</li>
          <li><span className="prep-check"><GameIcon name="check" size={16} /></span>{isSupabaseAvailable() ? 'Cloudsynchronisatie beschikbaar' : 'Offline spelen beschikbaar'}</li>
          <li><span className="prep-check"><GameIcon name="check" size={16} /></span>GPS-controle klaar</li>
        </ul>
        <SyncStatus status={syncStatus} message={syncMessage} />
        <button className="button primary" onClick={() => void prepare()} disabled={downloading || !activeTeam}>
          {downloading ? 'Route opslaan…' : 'Routepakket voorbereiden'}
        </button>
        <Link className="button ghost" to="/route">Verder zonder opnieuw downloaden</Link>
      </section>
    </PageShell>
  );
}
