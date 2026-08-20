import type { TranslationKey } from "@/lib/i18n/translations";

export const TXN_TYPES = [
  "sale",
  "purchase",
  "expense",
  "payment_in",
  "payment_out",
  "adjustment",
] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export const MONEY_IN: TxnType[] = ["sale", "payment_in"];
export const MONEY_OUT: TxnType[] = ["purchase", "expense", "payment_out"];

export const TXN_LABEL: Record<TxnType, TranslationKey> = {
  sale: "txn.sale",
  purchase: "txn.purchase",
  expense: "txn.expense",
  payment_in: "txn.payment_in",
  payment_out: "txn.payment_out",
  adjustment: "txn.adjustment",
};

export const PAYMENT_METHODS = [
  { value: "cash", label: "txn.cash" as TranslationKey },
  { value: "upi", label: "txn.upi" as TranslationKey },
  { value: "card", label: "txn.card" as TranslationKey },
  { value: "credit", label: "txn.creditMode" as TranslationKey },
];

export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "cat.rent" as TranslationKey },
  { value: "electricity", label: "cat.electricity" as TranslationKey },
  { value: "salary", label: "cat.salary" as TranslationKey },
  { value: "fuel", label: "cat.fuel" as TranslationKey },
  { value: "transport", label: "cat.transport" as TranslationKey },
  { value: "inventory", label: "cat.inventory" as TranslationKey },
  { value: "marketing", label: "cat.marketing" as TranslationKey },
  { value: "maintenance", label: "cat.maintenance" as TranslationKey },
  { value: "food", label: "cat.food" as TranslationKey },
  { value: "misc", label: "cat.misc" as TranslationKey },
];

export const BUSINESS_TYPES = [
  { value: "kirana", label: "biz.kirana" as TranslationKey },
  { value: "clothing", label: "biz.clothing" as TranslationKey },
  { value: "electronics", label: "biz.electronics" as TranslationKey },
  { value: "pharmacy", label: "biz.pharmacy" as TranslationKey },
  { value: "restaurant", label: "biz.restaurant" as TranslationKey },
  { value: "salon", label: "biz.salon" as TranslationKey },
  { value: "hardware", label: "biz.hardware" as TranslationKey },
  { value: "wholesale", label: "biz.wholesale" as TranslationKey },
  { value: "service", label: "biz.service" as TranslationKey },
  { value: "other", label: "biz.other" as TranslationKey },
];

export const UNITS = ["pcs", "kg", "g", "litre", "ml", "box", "packet", "dozen", "metre"];

export type Transaction = {
  id: string;
  business_id: string;
  type: TxnType;
  amount: number;
  amount_paid: number;
  payment_method: string | null;
  category: string | null;
  customer_id: string | null;
  vendor_id: string | null;
  party_name: string | null;
  notes: string | null;
  occurred_at: string;
  source: "voice" | "manual" | "import";
  ai_confidence: number | null;
  created_at: string;
};

export type Party = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  selling_price: number;
  purchase_price: number;
  stock: number;
  low_stock_threshold: number;
};

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  business_type: string;
  currency: string;
  language: string;
  inventory_enabled: boolean;
};
