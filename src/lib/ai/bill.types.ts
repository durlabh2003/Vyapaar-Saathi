export type BillLine = { name: string; quantity: number | null; amount: number | null };

export type BillExtraction = {
  type: "purchase" | "sale" | "expense";
  total: number | null;
  partyName: string | null;
  category: string | null;
  paymentMethod: "cash" | "upi" | "card" | "credit" | null;
  billNumber: string | null;
  billDate: string | null;
  items: BillLine[];
  confidence: number;
};
