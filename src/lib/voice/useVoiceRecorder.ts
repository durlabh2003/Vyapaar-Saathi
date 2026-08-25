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

export function cleanTranscript(raw: string): string {
  if (!raw) return "";
  let text = raw.replace(/\s+/g, " ").trim();

  let prevText = "";
  while (text !== prevText) {
    prevText = text;

    // 1. Token-level cleanup: remove adjacent exact duplicates & pronoun stutters ("मैंने", "मैं", "main")
    const words = text.split(" ");
    const cleanWords: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const current = words[i];
      if (!current) continue;
      const last = cleanWords[cleanWords.length - 1];
      if (last) {
        const lastLower = last.toLowerCase();
        const currLower = current.toLowerCase();
        if (lastLower === currLower) continue;
        if (
          (lastLower === "मैंने" || lastLower === "मैं" || lastLower === "main") &&
          (currLower === "मैंने" || currLower === "मैं" || currLower === "main")
        ) {
          continue;
        }
      }
      cleanWords.push(current);
    }
    text = cleanWords.join(" ");

    // 2. Remove repeated multi-word chunks (length 1 to 6 words)
    for (let phraseLen = 6; phraseLen >= 1; phraseLen--) {
      const w = text.split(" ");
      const newWords: string[] = [];
      let i = 0;
      while (i < w.length) {
        if (i + phraseLen * 2 <= w.length) {
          const chunk1 = w.slice(i, i + phraseLen).join(" ").toLowerCase();
          const chunk2 = w.slice(i + phraseLen, i + phraseLen * 2).join(" ").toLowerCase();
          if (chunk1 === chunk2) {
            newWords.push(...w.slice(i, i + phraseLen));
            i += phraseLen * 2;
            continue;
          }
        }
        const currentWord = w[i];
        if (currentWord !== undefined) newWords.push(currentWord);
        i++;
      }
      text = newWords.join(" ");
    }

    // 3. Remove "token X token" sandwich stutters (e.g. "₹200 filler ₹200" -> "₹200")
    const words2 = text.split(" ");
    const cleanWords2: string[] = [];
    let idx = 0;
    while (idx < words2.length) {
      const w0 = words2[idx];
      const w2 = words2[idx + 2];
      if (w0 !== undefined && w2 !== undefined && w0.toLowerCase() === w2.toLowerCase()) {
        cleanWords2.push(w0);
        idx += 2;
      } else {
        if (w0 !== undefined) cleanWords2.push(w0);
        idx++;
      }
    }
    text = cleanWords2.join(" ");
  }

  return text.trim();
}

export function mergeTranscripts(prefix: string, newText: string): string {
  const p = prefix.trim();
  const n = newText.trim();
  if (!p) return n;
  if (!n) return p;

  const pLower = p.toLowerCase();
  const nLower = n.toLowerCase();

  // 1. Full prefix match or inclusion
  if (nLower.startsWith(pLower)) return n;
  if (pLower.startsWith(nLower)) return p;

  const pWords = p.split(/\s+/);
  const nWords = n.split(/\s+/);

  // 2. Overlap suffix matching (find overlap between tail of prefix and head of newText)
  const maxPossible = Math.min(pWords.length, nWords.length);
  for (let len = maxPossible; len >= 1; len--) {
    const pSuffix = pWords.slice(pWords.length - len).join(" ").toLowerCase();
    const nPrefix = nWords.slice(0, len).join(" ").toLowerCase();
    if (pSuffix === nPrefix) {
      const remaining = nWords.slice(len).join(" ");
      return (p + " " + remaining).trim();
    }
  }

  // 3. Shared prefix matching (if both start with same phrase)
  for (let len = maxPossible; len >= 1; len--) {
    const pPrefix = pWords.slice(0, len).join(" ").toLowerCase();
    const nPrefix = nWords.slice(0, len).join(" ").toLowerCase();
    if (pPrefix === nPrefix) {
      return pWords.length >= nWords.length ? p : n;
    }
  }

  return (p + " " + n).trim();
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
  const accumulatedFinalRef = useRef<string>("");
  const manualStoppedRef = useRef<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [hasSpeech, setHasSpeech] = useState<boolean>(false);

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
    accumulatedFinalRef.current = "";
    manualStoppedRef.current = false;
    setLiveTranscript("");
    setHasSpeech(false);

    // 1. Always start microphone PCM recorder via getUserMedia & AudioContext
    let mediaStarted = false;
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
      mediaStarted = true;
    } catch (err) {
      console.warn("getUserMedia failed or denied:", err);
    }

    // 2. Initialize Web Speech API in parallel for live transcript preview if available
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
            onend: () => void;
            start: () => void;
            stop: () => void;
          })();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = languageCode === "en" ? "en-IN" : "hi-IN";

          rec.onresult = (event: unknown) => {
            const ev = event as {
              results: Array<{
                0: { transcript: string };
                isFinal?: boolean;
              }>;
            };
            let sessionFinalText = "";
            let sessionInterimText = "";
            for (let i = 0; i < ev.results.length; i++) {
              const res = ev.results[i];
              const item = res?.[0];
              if (!item?.transcript) continue;
              if (res?.isFinal) {
                sessionFinalText += item.transcript + " ";
              } else {
                sessionInterimText = item.transcript;
              }
            }

            const prefix = accumulatedFinalRef.current.trim();
            const sessionClean = (sessionFinalText.trim() + " " + sessionInterimText.trim()).trim();

            const merged = mergeTranscripts(prefix, sessionClean);
            const cleaned = cleanTranscript(merged);

            if (cleaned) {
              transcriptRef.current = cleaned;
              setLiveTranscript(cleaned);
              setHasSpeech(true);
            }
          };
          rec.onerror = (err: unknown) => {
            console.warn("SpeechRecognition error:", err);
          };
          rec.onend = () => {
            if (transcriptRef.current.trim()) {
              accumulatedFinalRef.current = cleanTranscript(transcriptRef.current.trim());
            }
            if (!manualStoppedRef.current && recognitionRef.current) {
              try {
                (recognitionRef.current as { start: () => void }).start();
                return;
              } catch {
                // Ignore if already active
              }
            }
          };
          rec.start();
          recognitionRef.current = rec;
        } catch (err) {
          console.warn("SpeechRecognition start failed:", err);
        }
      }
    }

    if (mediaStarted || recognitionRef.current) {
      setRecording(true);
      return true;
    }

    setError("failed");
    teardown();
    return false;
  }, [teardown]);

  /** Stop recording and return the finished WAV clip and any browser transcript. */
  const stop = useCallback(async (): Promise<{ clip: Blob | null; transcript: string }> => {
    manualStoppedRef.current = true;
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
      if (!capturedText.trim()) {
        setError("empty");
      }
      return { clip: null, transcript: capturedText };
    }
    const blob = encodeWav(downsample(chunks, rate, TARGET_RATE), TARGET_RATE);
    if (blob.size < 4096 && !capturedText.trim()) {
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

  return { supported, recording, level, error, liveTranscript, hasSpeech, start, stop, cancel, reset };
}
