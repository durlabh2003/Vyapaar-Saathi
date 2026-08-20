import { describe, expect, it } from "vitest";
import { parseLocally } from "../localParser";

describe("Voice Agent Offline Local Parser", () => {
  it("correctly parses sale on credit in Hinglish", () => {
    const result = parseLocally("Aaj Ramesh ko 2500 ka maal diya");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("sale");
    expect(result.amount).toBe(2500);
    expect(result.partyName).toBe("Ramesh");
    expect(result.onCredit).toBe(true);
  });

  it("correctly parses payment received in Hinglish", () => {
    const result = parseLocally("Ramesh se 1000 rupaye aaye");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("payment_in");
    expect(result.amount).toBe(1000);
    expect(result.partyName).toBe("Ramesh");
  });

  it("correctly parses expense with auto-category detection", () => {
    const result = parseLocally("800 rupaye diesel mein kharch hue");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("expense");
    expect(result.amount).toBe(800);
    expect(result.category).toBe("fuel");
  });

  it("correctly parses Devanagari numerals in Hindi", () => {
    const result = parseLocally("रमेश को २५०० का माल दिया");
    expect(result.kind).toBe("transaction");
    expect(result.amount).toBe(2500);
  });

  it("correctly parses stock updates", () => {
    const result = parseLocally("20 packet Parle aa gaye");
    expect(result.kind).toBe("stock");
    expect(result.quantity).toBe(20);
    expect(result.stockDirection).toBe("in");
  });

  it("correctly parses payment reminders", () => {
    const result = parseLocally("Kal Ramesh se paise lene yaad dilana");
    expect(result.kind).toBe("reminder");
    expect(result.partyName).toBe("Ramesh");
  });

  it("correctly classifies financial questions", () => {
    const result = parseLocally("Is mahine kitna profit hua?");
    expect(result.kind).toBe("question");
  });

  it("correctly parses phonetic Hindi numbers and sales like 'doso rupyee k santre beche'", () => {
    const result = parseLocally("doso rupyee k santre beche");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("sale");
    expect(result.amount).toBe(200);
  });

  it("returns unknown for unparseable random noise", () => {
    const result = parseLocally("");
    expect(result.kind).toBe("unknown");
    expect(result.confidence).toBe(0);
  });
});
