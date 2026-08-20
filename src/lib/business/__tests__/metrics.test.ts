import { describe, expect, it } from "vitest";
import { payables, receivables, todayTotals } from "../metrics";
import type { Transaction } from "../constants";

describe("Deterministic Financial Calculations Engine", () => {
  const mockTxns: Transaction[] = [
    {
      id: "1",
      business_id: "b1",
      type: "sale",
      amount: 2500,
      amount_paid: 1000, // 1500 pending
      payment_method: "credit",
      category: null,
      customer_id: "c1",
      vendor_id: null,
      party_name: "Ramesh",
      notes: null,
      occurred_at: new Date().toISOString(),
      source: "voice",
      ai_confidence: 0.9,
      created_at: new Date().toISOString(),
    },
    {
      id: "2",
      business_id: "b1",
      type: "expense",
      amount: 800,
      amount_paid: 800,
      payment_method: "cash",
      category: "fuel",
      customer_id: null,
      vendor_id: null,
      party_name: null,
      notes: null,
      occurred_at: new Date().toISOString(),
      source: "voice",
      ai_confidence: 0.85,
      created_at: new Date().toISOString(),
    },
    {
      id: "3",
      business_id: "b1",
      type: "purchase",
      amount: 3000,
      amount_paid: 1000, // 2000 payable
      payment_method: "upi",
      category: null,
      customer_id: null,
      vendor_id: "v1",
      party_name: "Gupta Wholesale",
      notes: null,
      occurred_at: new Date().toISOString(),
      source: "manual",
      ai_confidence: null,
      created_at: new Date().toISOString(),
    },
  ];

  it("calculates correct today's summary sales, expenses, and net profit", () => {
    const totals = todayTotals(mockTxns);
    expect(totals.sales).toBe(2500);
    expect(totals.expenses).toBe(800);
    expect(totals.purchases).toBe(3000);
    expect(totals.profit).toBe(2500 - (800 + 3000));
    expect(totals.received).toBe(1000);
  });

  it("calculates exact receivables (customer udhaar)", () => {
    expect(receivables(mockTxns)).toBe(1500);
  });

  it("calculates exact payables (vendor udhaar)", () => {
    expect(payables(mockTxns)).toBe(2000);
  });
});
