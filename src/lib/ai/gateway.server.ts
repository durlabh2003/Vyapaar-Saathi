/**
 * Provider-agnostic AI service boundary.
 *
 * Supports Groq, OpenAI, Gemini, OpenRouter, Ollama, or any OpenAI-compatible provider.
 */
function getAiConfig() {
  const customUrl = process.env["AI_GATEWAY_URL"];
  const customModel = process.env["AI_MODEL"];

  const groqKey = process.env["GROQ_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"];
  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  const genericKey = process.env["AI_API_KEY"] || process.env["LOVABLE_API_KEY"];

  if (groqKey) {
    return {
      url: customUrl || "https://api.groq.com/openai/v1/chat/completions",
      model: customModel || "qwen/qwen3.6-27b",
      apiKey: groqKey,
    };
  }

  if (openaiKey) {
    return {
      url: customUrl || "https://api.openai.com/v1/chat/completions",
      model: customModel || "gpt-4o-mini",
      apiKey: openaiKey,
    };
  }

  if (geminiKey) {
    return {
      url: customUrl || "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: customModel || "gemini-1.5-flash",
      apiKey: geminiKey,
    };
  }

  if (openrouterKey) {
    return {
      url: customUrl || "https://openrouter.ai/api/v1/chat/completions",
      model: customModel || "meta-llama/llama-3.3-70b-instruct",
      apiKey: openrouterKey,
    };
  }

  const isLocal = customUrl?.includes("localhost") || customUrl?.includes("127.0.0.1");
  return {
    url: customUrl || "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: customModel || "google/gemini-3.5-flash",
    apiKey: genericKey || (isLocal ? "local" : ""),
  };
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
};

export class AIUnavailableError extends Error {}

export async function chat(messages: ChatMessage[], opts?: { json?: boolean; timeoutMs?: number }) {
  const { url, model, apiKey } = getAiConfig();
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

  if (!apiKey && !isLocal) throw new AIUnavailableError("AI service not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 20000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("AI gateway error", response.status, detail.slice(0, 400));
      throw new AIUnavailableError(`AI gateway ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let content = data.choices?.[0]?.message?.content;
    if (!content) throw new AIUnavailableError("Empty AI response");

    // Clean out all thinking/reasoning tags from models like Qwen/DeepSeek (closed or open)
    content = content
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<think>[\s\S]*/gi, "")
      .replace(/^[\s\S]*?<\/think>/gi, "")
      .trim();

    return content;
  } catch (error) {
    if (error instanceof AIUnavailableError) throw error;
    throw new AIUnavailableError("AI request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatJson<T>(
  messages: ChatMessage[],
  opts?: { timeoutMs?: number },
): Promise<T> {
  const raw = await chat(messages, { json: true, ...opts });

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new AIUnavailableError("AI returned malformed JSON");
  }
}
