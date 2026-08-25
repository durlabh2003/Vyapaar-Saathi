import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const utteranceSchema = z.object({
  text: z.string().trim().min(1).max(500),
  businessId: z.string().uuid().optional(),
});

const questionSchema = z.object({
  businessId: z.string().uuid(),
  question: z.string().trim().min(2).max(500),
  locale: z.enum(["en", "hi", "hi-en"]).optional(),
});

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export const transcribeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Audio upload expected");
    const file = input.get("audio");
    if (!(file instanceof Blob)) throw new Error("Audio file missing");
    if (file.size === 0) throw new Error("Audio file is empty");
    if (file.size > MAX_AUDIO_BYTES) throw new Error("Recording is too long");
    const language = input.get("language");
    return { file, language: typeof language === "string" ? language : undefined };
  })
  .handler(async ({ data }) => {
    const { transcribe } = await import("@/lib/voice/stt.server");
    return { text: await transcribe(data.file, data.language) };
  });

const MAX_BILL_BYTES = 12 * 1024 * 1024;
const BILL_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export const extractBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Bill upload expected");
    const file = input.get("bill");
    if (!(file instanceof Blob)) throw new Error("Bill file missing");
    if (file.size === 0) throw new Error("Bill file is empty");
    if (file.size > MAX_BILL_BYTES) throw new Error("Bill file is too large");
    if (file.type && !BILL_TYPES.has(file.type)) throw new Error("Unsupported file type");
    const name = input.get("filename");
    return { file, filename: typeof name === "string" && name ? name.slice(0, 120) : "bill" };
  })
  .handler(async ({ data }) => {
    const { extractBillData } = await import("@/lib/ai/bill.server");
    return extractBillData(data.file, data.filename);
  });

export const interpretUtterance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => utteranceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { interpret } = await import("@/lib/ai/interpret.server");
    return interpret(data.text, data.businessId, context.supabase);
  });

export const askBusinessQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => questionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { loadSnapshot, answerQuestion } = await import("@/lib/ai/answer.server");
    const snapshot = await loadSnapshot(context.supabase, data.businessId);
    return answerQuestion(data.question, snapshot, data.locale);
  });
