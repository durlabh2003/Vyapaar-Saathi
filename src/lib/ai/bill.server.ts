import { AIUnavailableError, chatJson, type ContentBlock } from "./gateway.server";

import type { BillExtraction, BillLine } from "./bill.types";

export type { BillExtraction, BillLine };

const SYSTEM = `You read a photo or PDF of an Indian shop bill / invoice / receipt and return structured data.

Return STRICT JSON:
{
  "type": "purchase" | "sale" | "expense",
  "total": number | null,
  "partyName": string | null,
  "category": string | null,
  "paymentMethod": "cash" | "upi" | "card" | "credit" | null,
  "billNumber": string | null,
  "billDate": "YYYY-MM-DD" | null,
  "items": [{ "name": string, "quantity": number | null, "amount": number | null }],
  "confidence": number
}

Rules:
- "total" is the final payable grand total in rupees (after tax and discount). Never a per-item price.
- "partyName" is the OTHER business or person on the bill (supplier name for a purchase, customer name for a sale). Ignore GSTIN, address and phone lines.
- Supplier / vendor / distributor invoice addressed to the shop => "purchase".
- A bill the shop issued to a customer => "sale".
- Utility, rent, fuel, telecom, repair, salary or similar service bills => "expense" with category from: rent, electricity, salary, fuel, transport, inventory, marketing, maintenance, food, misc.
- Use null when a field is not clearly printed. NEVER invent numbers, names or dates.
- items: at most 15 line items, product name as printed.
- confidence: 0 to 1, how legible and certain the whole reading is.
Only output JSON.`;

const ALLOWED_TYPES = new Set(["purchase", "sale", "expense"]);
const ALLOWED_METHODS = new Set(["cash", "upi", "card", "credit"]);

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function text(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed.slice(0, max) : null;
}

function dateOrNull(value: unknown): string | null {
  const raw = text(value, 40);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Extract bill fields from an uploaded image or PDF. */
export async function extractBillData(file: Blob, filename: string): Promise<BillExtraction> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mime =
    file.type || (filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

  const attachment: ContentBlock =
    mime === "application/pdf"
      ? { type: "file", file: { filename, file_data: `data:${mime};base64,${base64}` } }
      : { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } };

  const raw = await chatJson<Partial<BillExtraction>>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [{ type: "text", text: "Read this bill and return the JSON." }, attachment],
      },
    ],
    { timeoutMs: 45000 },
  );

  const type = ALLOWED_TYPES.has(String(raw.type))
    ? (raw.type as BillExtraction["type"])
    : "purchase";
  const method = ALLOWED_METHODS.has(String(raw.paymentMethod))
    ? (raw.paymentMethod as BillExtraction["paymentMethod"])
    : null;

  const items = Array.isArray(raw.items)
    ? raw.items
        .slice(0, 15)
        .map((item) => ({
          name: text((item as BillLine)?.name, 80) ?? "",
          quantity: positive((item as BillLine)?.quantity),
          amount: positive((item as BillLine)?.amount),
        }))
        .filter((item) => item.name)
    : [];

  const total =
    positive(raw.total) ?? (items.reduce((sum, item) => sum + (item.amount ?? 0), 0) || null);

  if (!total && items.length === 0) throw new AIUnavailableError("Could not read this bill");

  return {
    type,
    total,
    partyName: text(raw.partyName, 80),
    category: text(raw.category, 40),
    paymentMethod: method,
    billNumber: text(raw.billNumber, 40),
    billDate: dateOrNull(raw.billDate),
    items,
    confidence:
      typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1
        ? raw.confidence
        : 0.5,
  };
}
