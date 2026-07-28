import { GameProvider } from './gameContext';
import { AudioProvider } from '../features/audio/audioContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GameProvider>
      <AudioProvider>{children}</AudioProvider>
    </GameProvider>
  );
}
