import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { gamePack } from '../game-data/moerasdraak/game';
import { validateGamePack } from '../features/game/dataValidation';
import { HomePage } from '../pages/HomePage';
import { TeamPage } from '../pages/TeamPage';
import { PreparationPage } from '../pages/PreparationPage';
import { RoutePage } from '../pages/RoutePage';
import { StopPage } from '../pages/StopPage';
import { ChallengePage } from '../pages/ChallengePage';
import { ResultPage } from '../pages/ResultPage';
import { SettingsPage } from '../pages/SettingsPage';
import { DesignSystemPage } from '../pages/DesignSystemPage';
import { PageShell } from '../components/GameUi';
import { scenicForPath } from '../features/audio/audioConfig';
import { useAudio } from '../features/audio/audioContext';

function AudioSceneController() {
  const location = useLocation();
  const { setBackgroundTrack, stopEffects, stopNarration } = useAudio();

  useEffect(() => {
    stopNarration();
    stopEffects();
    setBackgroundTrack(scenicForPath(location.pathname));
  }, [location.pathname, setBackgroundTrack, stopEffects, stopNarration]);

  return null;
}

export function App() {
  const validation = validateGamePack(gamePack);
  if (!validation.valid) {
    return <PageShell navigation={false}><h1>Spelconfiguratie fout</h1><p>{validation.message}</p></PageShell>;
  }

  return (
    <>
      <AudioSceneController />
      <Routes>
        <Route path="/" element={<HomePage pack={gamePack} />} />
        <Route path="/team" element={<TeamPage pack={gamePack} />} />
        <Route path="/voorbereiden" element={<PreparationPage pack={gamePack} />} />
        <Route path="/route" element={<RoutePage pack={gamePack} />} />
        <Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} />
        <Route path="/challenge/:stopId" element={<ChallengePage pack={gamePack} />} />
        <Route path="/resultaat" element={<ResultPage pack={gamePack} />} />
        <Route path="/instellingen" element={<SettingsPage />} />
        {import.meta.env.DEV ? <Route path="/dev/design-system" element={<DesignSystemPage />} /> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
