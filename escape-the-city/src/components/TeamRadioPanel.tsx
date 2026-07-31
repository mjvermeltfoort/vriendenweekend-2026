import { useEffect, useRef, useState } from 'react';
import { useGame } from '../app/gameContext';
import { AudioPlayer } from './AudioPlayer';
import { GameIcon } from './GameUi';

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function formatMessageTime(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed);
}

function resolveMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  return 'audio/webm';
}

function hasAudioCapability() {
  return typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export function TeamRadioPanel() {
  const { sendRadioMessage, teamRadioMessages, activeTeam } = useGame();
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [recordingLabel, setRecordingLabel] = useState('0:00');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  async function startRecording() {
    if (!activeTeam || isRecording || isStarting || isUploading) return;
    if (!hasAudioCapability()) {
      setError('Audio-opnames worden niet ondersteund op deze browser.');
      return;
    }
    setError('');
    setRecordingLabel('0:00');
    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;
      const mimeType = resolveMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) chunksRef.current.push(data);
      };
      recorder.onstop = async () => {
        if (!chunksRef.current.length) {
          setIsUploading(false);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationMs = Math.max(1, Date.now() - startedAtRef.current);
        chunksRef.current = [];
        setIsUploading(true);
        try {
          await sendRadioMessage({
            audio: blob,
            durationMs,
            transcript: undefined
          });
        } catch (recordingError) {
          setError(recordingError instanceof Error ? recordingError.message : 'Het bericht kon niet worden verzonden.');
        } finally {
          setIsUploading(false);
        }
      };
      recorder.start(300);
      setIsRecording(true);
      setIsStarting(false);
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setRecordingLabel(formatDuration(seconds));
      }, 500);
    } catch (audioError) {
      const stream = streamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      recorderRef.current = null;
      setIsStarting(false);
      setError(audioError instanceof Error ? audioError.message : 'Microfoon startte niet op.');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.stop();
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    recorderRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsUploading(true);
  }

  const label = isStarting
    ? 'Microfoon starten…'
    : isUploading
    ? 'Verzenden…'
    : isRecording
      ? `Opnemen ${recordingLabel} · Klik om te stoppen`
      : 'Klik om op te nemen';

  return (
    <section className="card stack">
      <div>
        <p className="eyebrow">Teamradio</p>
        <h2>Meldkamer</h2>
      </div>
      <p>Klik om een kort stembericht op te nemen. Wacht even tot de timer loopt voordat je spreekt, en klik opnieuw om te stoppen.</p>
      <button
        className={`button ${isRecording ? 'danger' : 'primary'}`}
        type="button"
        aria-live="polite"
        aria-label={isRecording ? 'Voice message opnemen stoppen' : 'Voice message opnemen starten'}
        disabled={!activeTeam || isStarting || isUploading}
        onClick={() => {
          if (isRecording) stopRecording();
          else void startRecording();
        }}
      >
        <span className="row row--between">
          <span>{isRecording ? <GameIcon name="sync" /> : <GameIcon name="volume" />}</span>
          <span>{label}</span>
        </span>
      </button>
      {error ? <p className="audio-error" role="alert">{error}</p> : null}
      {!teamRadioMessages.length ? <p className="muted small">Nog geen teamberichten. Gebruik de knop hierboven om je eerste bericht te sturen.</p> : (
        <div className="stack">
          {teamRadioMessages.map((message) => (
            message.audioUrl
              ? (
                <AudioPlayer
                  key={message.id}
                  source={message.audioUrl}
                  title={`${message.senderKind === 'dashboard' ? 'Meldkamerbericht' : 'Spraakbericht'} · ${formatMessageTime(message.createdAt)}${message.isMine ? ' · jij' : ''}`}
                  transcript={message.transcript || 'Geen transcriptie beschikbaar.'}
                  showTranscript={false}
                  durationSeconds={message.durationMs ? message.durationMs / 1000 : undefined}
                />
              )
              : (
                <p className="muted small" key={message.id}>
                  {message.senderKind === 'dashboard' ? 'Meldkamerbericht' : 'Spraakbericht'} · {formatMessageTime(message.createdAt)}{message.isMine ? ' · jij' : ''}: opname is niet beschikbaar.
                </p>
              )
          ))}
        </div>
      )}
    </section>
  );
}
