/**
 * Server-side speech-to-text boundary.
 *
 * Audio bytes arrive from the browser as a complete WAV file and are sent to
 * the transcription service. Nothing else in the app knows the provider.
 */
const STT_URL = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const STT_MODEL = "openai/gpt-4o-mini-transcribe";

export class TranscriptionError extends Error {}

export async function transcribe(file: File | Blob, language?: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new TranscriptionError("Speech service not configured");

  const body = new FormData();
  body.append("model", STT_MODEL);
  body.append("file", file, "recording.wav");
  // Hinglish speech is best handled by auto-detection, so only pin pure locales.
  if (language === "hi" || language === "en") body.append("language", language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("STT error", response.status, detail.slice(0, 400));
      throw new TranscriptionError(`Transcription failed (${response.status})`);
    }

    const data = (await response.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    if (!text) throw new TranscriptionError("Nothing was heard");
    return text;
  } catch (error) {
    if (error instanceof TranscriptionError) throw error;
    throw new TranscriptionError("Transcription request failed");
  } finally {
    clearTimeout(timeout);
  }
}
