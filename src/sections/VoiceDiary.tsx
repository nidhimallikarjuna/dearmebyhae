import React, { useEffect, useRef, useState } from 'react';
import { Lock, Mic, Pause, Play, Square, Trash2, Upload } from 'lucide-react';
import { apiFetch, apiUpload } from '../api';
import type { VoiceNote } from '../types';
import {
  ChromeButton,
  GlossyButton,
  PearlPanel,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

const CASSETTE_IMG = '/src/assets/images/y2k_cassette_tape_1795533103396.jpg';

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function VoiceDiary() {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [title, setTitle] = useState('');
  const [mood, setMood] = useState('late night');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Custom retro cassette playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const samplesRef = useRef<number[]>([]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ voiceNotes: VoiceNote[] }>('/api/voice-notes');
      setNotes(res.voiceNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voice notes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
  }, []);

  const startRecording = async () => {
    setError('');
    setRecordedBlob(null);
    samplesRef.current = [];
    chunksRef.current = [];
    setRecSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        if (samplesRef.current.length < 48) {
          samplesRef.current.push(Math.max(12, Math.round((avg / 255) * 100)));
        }
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FFF0F5';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const barW = Math.max(4, Math.floor(canvas.width / dataArray.length) - 2);
            for (let i = 0; i < dataArray.length; i++) {
              const val = dataArray[i] / 255;
              const h = Math.max(6, val * (canvas.height - 8));
              ctx.fillStyle = i % 2 === 0 ? '#F20B83' : '#FF69AD';
              ctx.fillRect(i * (barW + 2), canvas.height - h - 4, barW, h);
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        cancelAnimationFrame(animFrameRef.current);
        clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedBlob(blob);
        setRecordedWaveform(
          samplesRef.current.length > 0
            ? samplesRef.current
            : Array.from({ length: 28 }, (_, idx) => 24 + ((idx * 17) % 60))
        );
      };

      recorder.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setError('Microphone permission was denied or unavailable. You can also upload an audio file below.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const saveRecordedNote = async () => {
    if (!recordedBlob) return;
    setSaving(true);
    setError('');
    try {
      const file = new File([recordedBlob], `voice-diary-${Date.now()}.webm`, {
        type: recordedBlob.type || 'audio/webm',
      });
      const uploaded = await apiUpload([file], 'voice');
      await apiFetch('/api/voice-notes', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || `Tape #${notes.length + 1}`,
          mood,
          durationSec: recSeconds || 1,
          mediaId: uploaded[0].id,
          waveform: recordedWaveform,
        }),
      });
      setTitle('');
      setRecordedBlob(null);
      setRecSeconds(0);
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save voice note.');
    } finally {
      setSaving(false);
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const uploaded = await apiUpload([file], 'voice');
      await apiFetch('/api/voice-notes', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
          mood,
          durationSec: 30,
          mediaId: uploaded[0].id,
          waveform: Array.from({ length: 30 }, (_, idx) => 20 + ((idx * 19) % 70)),
        }),
      });
      setTitle('');
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload audio.');
    } finally {
      setSaving(false);
    }
  };

  const togglePlay = (note: VoiceNote) => {
    if (playingId === note.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(note.audioUrl);
    audioRef.current = audio;
    setPlayingId(note.id);

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgressMap((prev) => ({ ...prev, [note.id]: (audio.currentTime / audio.duration) * 100 }));
      }
    };
    audio.onended = () => {
      setPlayingId(null);
      setProgressMap((prev) => ({ ...prev, [note.id]: 0 }));
    };
    void audio.play();
  };

  const deleteNote = async (id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    await apiFetch(`/api/voice-notes/${id}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag="PRIVATE CASSETTE STUDIO · ONLY YOU CAN LISTEN"
        title="Voice Diary"
        subtitle="Record late-night thoughts on your pink cassette deck."
        illustrationUrl={CASSETTE_IMG}
      />

      {error && (
        <div className="rounded-xl bg-[#FFE3EF] border border-[#F20B83] px-4 py-2 text-xs text-[#A30554]">
          {error}
        </div>
      )}

      {/* Retro Cassette Recorder */}
      <PearlPanel title="CASSETTE RECORDER DECK">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 items-center">
          <div className="rounded-2xl border-2 border-[#FFB6D5] bg-[#FFF0F5] p-3 text-center">
            <img
              src={CASSETTE_IMG}
              alt="Pink cassette tape"
              className={`w-full rounded-xl object-cover ${recording ? 'animate-pulse' : ''}`}
            />
            <div className="font-['VT323'] text-3xl text-[#F20B83] mt-2 tabular-nums">
              {formatDuration(recSeconds)}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tape title (e.g. Midnight thoughts)"
                className="rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
              />
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="Mood (e.g. cozy)"
                className="rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
              />
            </div>

            {/* Waveform Visualizer */}
            <div className="rounded-xl border-2 border-[#FF69AD] bg-[#FFF0F5] p-2">
              <canvas ref={canvasRef} width={480} height={64} className="w-full h-16 rounded-lg" />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {!recording ? (
                <GlossyButton onClick={startRecording}>
                  <Mic className="w-4 h-4" /> Record Cassette
                </GlossyButton>
              ) : (
                <GlossyButton onClick={stopRecording}>
                  <Square className="w-4 h-4 fill-white" /> Stop ({formatDuration(recSeconds)})
                </GlossyButton>
              )}

              {recordedBlob && !recording && (
                <GlossyButton onClick={saveRecordedNote} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Voice Note'}
                </GlossyButton>
              )}

              <label className="chrome-btn rounded-full px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Upload Audio
                <input type="file" accept="audio/*" onChange={handleAudioFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </PearlPanel>

      {/* Recording Library */}
      <PearlPanel
        title="PRIVATE RECORDING LIBRARY"
        rightSlot={<Lock className="w-3.5 h-3.5 text-white" />}
      >
        {loading ? (
          <p className="text-center py-6 font-['Pixelify_Sans'] text-sm text-[#C76B94]">Loading cassettes...</p>
        ) : notes.length === 0 ? (
          <p className="text-center py-8 font-['Pixelify_Sans'] text-sm text-[#C76B94]">
            No voice notes recorded yet. Press Record Cassette to save your first private audio diary!
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const isPlaying = playingId === note.id;
              const pct = progressMap[note.id] || 0;
              const bars = note.waveform.length > 0 ? note.waveform : [30, 50, 75, 45, 80, 60, 40, 65, 50, 35];

              return (
                <div
                  key={note.id}
                  className="rounded-2xl border-2 border-[#FFB6D5] bg-[#FFF8FB] p-3.5 flex flex-col sm:flex-row sm:items-center gap-3.5"
                >
                  <button
                    type="button"
                    onClick={() => togglePlay(note)}
                    className="glossy-btn w-11 h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">
                        {note.title}
                      </h4>
                      <span className="font-['VT323'] text-base text-[#F20B83] shrink-0 tabular-nums">
                        {formatDuration(note.durationSec)} · {formatShortDate(note.recordedAt)}
                      </span>
                    </div>

                    {/* Waveform Bars */}
                    <div className="flex items-end gap-1 h-7">
                      {bars.slice(0, 32).map((val, idx) => {
                        const activeBar = (idx / Math.min(bars.length, 32)) * 100 <= pct;
                        return (
                          <div
                            key={idx}
                            className={`flex-1 rounded-full transition-colors ${
                              activeBar ? 'bg-[#F20B83]' : 'bg-[#FFB6D5]'
                            }`}
                            style={{ height: `${Math.max(18, Math.min(100, val))}%` }}
                          />
                        );
                      })}
                    </div>

                    {/* Pink Audio Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-[#F8D8E6] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#FF69AD] to-[#F20B83] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="font-['Pixelify_Sans'] text-[11px] text-[#C76B94]">{note.mood}</span>
                    <ChromeButton onClick={() => deleteNote(note.id)} aria-label="Delete recording">
                      <Trash2 className="w-3.5 h-3.5 text-[#F20B83]" />
                    </ChromeButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PearlPanel>
    </div>
  );
}
