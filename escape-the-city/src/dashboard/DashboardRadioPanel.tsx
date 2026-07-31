import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDashboardTeamRadioMessages,
  sendDashboardTeamRadioMessage,
  subscribeToDashboardRadio,
  type DashboardRadioMessage
} from './api';

function formatTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDuration(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  return `${Math.floor(safeSeconds / 60)}:${Math.floor(safeSeconds % 60).toString().padStart(2, '0')}`;
}

function supportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  return MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
}

export function DashboardRadioPanel({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [messages, setMessages] = useState<DashboardRadioMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recordingLabel, setRecordingLabel] = useState('0:00');
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const currentTeamIdRef = useRef(teamId);

  useEffect(() => {
    currentTeamIdRef.current = teamId;
  }, [teamId]);

  const refresh = useCallback(async () => {
    try {
      const current = await getDashboardTeamRadioMessages(teamId);
      setMessages(current);
      setError('');
    } catch (radioError) {
      setError(radioError instanceof Error ? radioError.message : 'Meldkamer kon niet worden geladen.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    void refresh();
    return subscribeToDashboardRadio(teamId, () => { void refresh(); });
  }, [refresh, teamId]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (recorderRef.current) {
      recorderRef.current.onstop = null;
      if (recorderRef.current.state === 'recording') recorderRef.current.stop();
      recorderRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((track) => track.stop());
  }, [teamId]);

  async function startRecording() {
    if (isStarting || isRecording || isSending) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Audio-opnames worden niet ondersteund op deze browser.');
      return;
    }
    setError('');
    setRecordingLabel('0:00');
    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      if (currentTeamIdRef.current !== teamId) {
        stream.getTracks().forEach((track) => track.stop());
        setIsStarting(false);
        return;
      }
      streamRef.current = stream;
      const mimeType = supportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) chunksRef.current.push(data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (!blob.size) {
          setIsSending(false);
          return;
        }
        try {
          await sendDashboardTeamRadioMessage(teamId, blob, Math.max(1, Date.now() - startedAtRef.current));
          await refresh();
        } catch (radioError) {
          setError(radioError instanceof Error ? radioError.message : 'De opname kon niet worden verzonden.');
        } finally {
          setIsSending(false);
        }
      };
      recorder.start(300);
      setIsStarting(false);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingLabel(formatDuration((Date.now() - startedAtRef.current) / 1000));
      }, 500);
    } catch (radioError) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setIsStarting(false);
      setError(radioError instanceof Error ? radioError.message : 'Microfoon startte niet op.');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsSending(true);
  }

  const label = isStarting
    ? 'Microfoon starten…'
    : isSending
      ? 'Verzenden…'
      : isRecording
        ? `Opnemen ${recordingLabel} · Klik om te stoppen`
        : 'Opname voor team starten';

  return (
    <section id="dashboard-radio-panel" className="dashboard-radio" aria-labelledby="dashboard-radio-title">
      <div>
        <p className="dashboard-eyebrow">Meldkamer</p>
        <h3 id="dashboard-radio-title">Berichten voor {teamName}</h3>
      </div>
      <p>Neem een bericht op voor dit team. Wacht tot de timer loopt voordat je spreekt.</p>
      <button
        type="button"
        className={isRecording ? 'danger' : 'primary'}
        disabled={isStarting || isSending}
        onClick={() => {
          if (isRecording) stopRecording();
          else void startRecording();
        }}
      >
        {label}
      </button>
      {error ? <p className="dashboard-radio__error" role="alert">{error}</p> : null}
      {loading ? <p>Opnames laden…</p> : null}
      {!loading && messages.length === 0 ? <p>Nog geen opnames voor dit team.</p> : null}
      <div className="dashboard-radio__messages">
        {messages.map((message) => (
          <article key={message.id} className="dashboard-radio__message">
            <strong>{message.senderKind === 'dashboard' ? 'Meldkamer' : 'Team'} · {formatTime(message.createdAt)}</strong>
            <audio controls preload="metadata" src={message.audioUrl}>
              Je browser ondersteunt geen audio-afspelen.
            </audio>
          </article>
        ))}
      </div>
    </section>
  );
}
