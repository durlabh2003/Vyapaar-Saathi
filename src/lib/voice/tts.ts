export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function pauseSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.resume();
  }
}

export function isSpeaking(): boolean {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

/**
 * Text-to-Speech (TTS) Voice Synthesis Utility.
 *
 * Provides spoken audio response in Hindi or English using Web Speech Synthesis API.
 */
export function speakText(
  text: string,
  language?: "hi" | "en" | "hi-en" | string,
  onEnd?: () => void,
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel(); // Stop any ongoing speech

    // Determine active target language from explicit parameter or user's stored locale preference
    const storedLocale = (window.localStorage?.getItem("vs.locale") as "hi" | "en" | "hi-en") || "hi-en";
    const activeLang = language || storedLocale;

    const currencyWord = activeLang === "en" ? "rupees" : "rupaye";

    // Clean text & format currency/symbols for speech
    const spokenText = text
      .replace(/₹\s*([0-9,]+)/g, `$1 ${currencyWord}`)
      .replace(/[*#_~`•]/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const targetLang = activeLang === "en" ? "en-IN" : "hi-IN";
    utterance.lang = targetLang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    const speakWithVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const voice =
          voices.find((v) => v.lang === targetLang) ||
          voices.find((v) => v.lang.startsWith(targetLang.slice(0, 2))) ||
          voices.find((v) => v.lang.includes("IN")) ||
          voices.find((v) => v.lang.startsWith("en"));
        if (voice) utterance.voice = voice;
      }
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      speakWithVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        speakWithVoice();
        window.speechSynthesis.onvoiceschanged = null;
      };
      // Fallback invocation if onvoiceschanged doesn't fire
      setTimeout(speakWithVoice, 100);
    }
  } catch (error) {
    console.error("Speech synthesis failed:", error);
    onEnd?.();
  }
}

