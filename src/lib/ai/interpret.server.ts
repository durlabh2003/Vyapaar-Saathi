import type { SupabaseClient } from "@supabase/supabase-js";
import type { Interpretation } from "@/lib/voice/localParser";
import { parseLocally } from "@/lib/voice/localParser";
import { AIUnavailableError, chatJson } from "./gateway.server";
import { VYAPAAR_SAATHI_SYSTEM_PROMPT } from "./systemPrompt";

type RawResult = Partial<Interpretation> & {
  kind?: string;
  intent?: string;
  requires_clarification?: boolean;
  clarification_question?: string | null;
  spoken_response?: string | null;
  entities?: {
    party_name?: string | null;
    product_name?: string | null;
    quantity?: number | null;
    unit?: string | null;
    unit_price?: number | null;
    amount?: number | null;
    payment_mode?: string | null;
    credit?: boolean | null;
    date?: string | null;
    due_date?: string | null;
    notes?: string | null;
  };
};

const KINDS = new Set(["transaction", "stock", "reminder", "question", "unknown"]);

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Prefer the AI parser; fall back to the offline rule parser on any failure. */
export async function interpret(
  text: string,
  businessId?: string,
  supabase?: SupabaseClient,
): Promise<Interpretation> {
  const local = parseLocally(text);

  let systemPrompt = VYAPAAR_SAATHI_SYSTEM_PROMPT;

  if (businessId && supabase) {
    try {
      const [custRes, vendRes, prodRes] = await Promise.all([
        supabase.from("customers").select("name").eq("business_id", businessId).limit(50),
        supabase.from("vendors").select("name").eq("business_id", businessId).limit(50),
        supabase.from("products").select("name").eq("business_id", businessId).limit(50),
      ]);
      const customers = (custRes.data ?? []).map((c) => c.name).filter(Boolean);
      const vendors = (vendRes.data ?? []).map((v) => v.name).filter(Boolean);
      const products = (prodRes.data ?? []).map((p) => p.name).filter(Boolean);

      if (customers.length > 0 || vendors.length > 0 || products.length > 0) {
        systemPrompt += `\n\n--- DATABASE ENTITY CONTEXT ---
- Active Customers: ${customers.join(", ") || "None"}
- Active Vendors: ${vendors.join(", ") || "None"}
- Active Products: ${products.join(", ") || "None"}
Prefer matching party_name and product_name against these stored database entities when speech is phonetically similar.`;
      }
    } catch {
      // Ignore DB context fetch errors
    }
  }

  try {
    const result = await chatJson<RawResult>([
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ]);

    const entities = result.entities ?? {};

    // Map intent to kind/type if intent is provided
    let kind: Interpretation["kind"] = local.kind;
    let type: Interpretation["type"] = local.type;

    if (result.intent) {
      const intentMap: Record<string, { kind: Interpretation["kind"]; type?: Interpretation["type"] }> = {
        SALE: { kind: "transaction", type: "sale" },
        PURCHASE: { kind: "transaction", type: "purchase" },
        EXPENSE: { kind: "transaction", type: "expense" },
        PAYMENT_IN: { kind: "transaction", type: "payment_in" },
        PAYMENT_OUT: { kind: "transaction", type: "payment_out" },
        ADJUSTMENT: { kind: "transaction", type: "adjustment" },
        ADD_STOCK: { kind: "stock" },
        REMOVE_STOCK: { kind: "stock" },
        CHECK_STOCK: { kind: "stock" },
        CREATE_REMINDER: { kind: "reminder" },
        CUSTOMER_BALANCE: { kind: "question" },
        PROFIT: { kind: "question" },
        SALES_SUMMARY: { kind: "question" },
      };
      const mapped = intentMap[result.intent];
      if (mapped) {
        kind = mapped.kind;
        type = mapped.type;
      }
    }

    if (typeof result.kind === "string" && KINDS.has(result.kind)) {
      kind = result.kind as Interpretation["kind"];
    }

    const amount = positive(result.amount ?? entities.amount) ?? local.amount ?? null;
    const partyName = result.partyName ?? entities.party_name ?? local.partyName ?? null;
    const productName = result.productName ?? entities.product_name ?? local.productName ?? null;
    const quantity = positive(result.quantity ?? entities.quantity) ?? local.quantity ?? null;
    const paymentMethod = result.paymentMethod ?? entities.payment_mode ?? local.paymentMethod ?? null;
    const onCredit = result.onCredit ?? entities.credit ?? local.onCredit ?? false;

    return {
      kind,
      type: (result.type as Interpretation["type"]) ?? type,
      amount,
      partyName,
      category: result.category ?? local.category ?? null,
      paymentMethod,
      onCredit,
      productName,
      quantity,
      stockDirection:
        result.stockDirection === "in" ||
        result.stockDirection === "out" ||
        result.stockDirection === "set"
          ? result.stockDirection
          : (local.stockDirection ?? null),
      unit: result.unit ?? entities.unit ?? local.unit ?? null,
      dueAt: isoOrNull(result.dueAt ?? entities.due_date) ?? local.dueAt ?? null,
      reminderNote: result.reminderNote ?? local.reminderNote ?? null,
      notes: result.notes ?? entities.notes ?? text,
      question: kind === "question" ? (result.question ?? text) : null,
      confidence:
        typeof result.confidence === "number"
          ? Math.max(0, Math.min(result.confidence, 1))
          : local.confidence,
      items: Array.isArray(result.items) && result.items.length > 0 ? result.items : undefined,
      language: (result.language as Interpretation["language"]) ?? local.language,
      spokenResponse: result.spoken_response ?? null,
      requiresClarification: result.requires_clarification ?? false,
      clarificationQuestion: result.clarification_question ?? null,
    };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) console.error(error);
    return local;
  }
}
