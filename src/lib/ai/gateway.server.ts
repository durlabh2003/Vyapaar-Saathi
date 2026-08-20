/**
 * Provider-agnostic AI service boundary.
 *
 * Nothing outside this module knows which model or vendor is used. Swapping
 * provider means editing this file only.
 */
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash";

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
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AIUnavailableError("AI service not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 20000);

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
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
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AIUnavailableError("Empty AI response");
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
