/**
 * Text-to-Speech (TTS) Voice Synthesis Utility.
 *
 * Provides spoken audio response in Hindi or English using Web Speech Synthesis API.
 */
export function speakText(text: string, language: "hi" | "en" | "hi-en" = "hi-en"): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel(); // Stop any ongoing speech

    // Clean text & format currency/symbols for speech
    let spokenText = text
      .replace(/₹\s*([0-9,]+)/g, "$1 rupaye")
      .replace(/[*#_~`•]/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const targetLang = language === "en" ? "en-IN" : "hi-IN";
    utterance.lang = targetLang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const speakWithVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const voice =
          voices.find((v) => v.lang === targetLang) ||
          voices.find((v) => v.lang.startsWith(targetLang.slice(0, 2))) ||
          voices.find((v) => v.lang.includes("IN"));
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
  }
}
