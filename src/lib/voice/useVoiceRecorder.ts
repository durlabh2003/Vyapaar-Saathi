import { useCallback, useEffect, useRef, useState } from "react";

const TARGET_RATE = 16000;

function downsample(chunks: Float32Array[], from: number, to: number) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  if (to >= from) return merged;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(merged.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = merged[Math.floor(i * ratio)] ?? 0;
  return out;
}

/** Encode mono PCM samples into a complete 16-bit WAV file. */
function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Microphone recorder that produces a complete WAV file per recording.
 *
 * WAV is used (instead of MediaRecorder fragments) so every clip is decodable
 * by the server transcription service on any browser, including iOS Safari.
 */
export function useVoiceRecorder() {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<"denied" | "failed" | "empty" | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const recognitionRef = useRef<unknown>(null);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        !!(
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
        ),
    );
  }, []);

  const teardown = useCallback(() => {
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    nodeRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    if (recognitionRef.current) {
      try {
        (recognitionRef.current as { stop: () => void }).stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  const start = useCallback(async (languageCode?: string) => {
    setError(null);
    setLevel(0);
    chunksRef.current = [];
    transcriptRef.current = "";

    // Initialize Web Speech API in browser if available
    if (typeof window !== "undefined") {
      const SpeechRec =
        (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new (SpeechRec as new () => {
            continuous: boolean;
            interimResults: boolean;
            lang: string;
            onresult: (e: unknown) => void;
            onerror: (e: unknown) => void;
            start: () => void;
            stop: () => void;
          })();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = languageCode === "hi" ? "hi-IN" : "hi-IN"; // Default to Hindi/Hinglish in India
          rec.onresult = (event: unknown) => {
            const ev = event as {
              results: Array<{ [key: number]: { transcript: string } }>;
            };
            let text = "";
            for (let i = 0; i < ev.results.length; i++) {
              text += ev.results[i]?.[0]?.transcript ?? "";
            }
            if (text.trim()) transcriptRef.current = text.trim();
          };
          rec.start();
          recognitionRef.current = rec;
        } catch {
          // ignore Web Speech API start errors
        }
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
        let peak = 0;
        for (let i = 0; i < input.length; i += 64) peak = Math.max(peak, Math.abs(input[i] ?? 0));
        setLevel(peak);
      };
      source.connect(node);
      node.connect(ctx.destination);
      sourceRef.current = source;
      nodeRef.current = node;
      setRecording(true);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed");
      teardown();
    }
  }, [teardown]);

  /** Stop recording and return the finished WAV clip and any browser transcript. */
  const stop = useCallback(async (): Promise<{ clip: Blob | null; transcript: string }> => {
    setRecording(false);
    setLevel(0);
    const capturedText = transcriptRef.current;
    const ctx = ctxRef.current;
    const rate = ctx?.sampleRate ?? TARGET_RATE;
    teardown();
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (ctx) {
      await ctx.close().catch(() => undefined);
      ctxRef.current = null;
    }
    if (!chunks.length) {
      setError("empty");
      return { clip: null, transcript: capturedText };
    }
    const blob = encodeWav(downsample(chunks, rate, TARGET_RATE), TARGET_RATE);
    if (blob.size < 4096 && !capturedText) {
      setError("empty");
      return { clip: null, transcript: capturedText };
    }
    return { clip: blob, transcript: capturedText };
  }, [teardown]);

  const cancel = useCallback(() => {
    setRecording(false);
    setLevel(0);
    chunksRef.current = [];
    transcriptRef.current = "";
    teardown();
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
  }, [teardown]);

  useEffect(() => cancel, [cancel]);

  const reset = useCallback(() => setError(null), []);

  return { supported, recording, level, error, start, stop, cancel, reset };
}
