import { describe, expect, it } from "vitest";
import { parseLocally } from "../localParser";

import { cleanTranscript } from "../useVoiceRecorder";

describe("Voice Agent Offline Local Parser", () => {
  it("cleanTranscript deduplicates stuttered speech and repeated phrase loops", () => {
    const raw = "मैंने मैंने मैंने मैं ₹200 मैं ₹200 मैं ₹200 का मैं ₹200 का सामान मैं ₹200 का सामान बेचा";
    const cleaned = cleanTranscript(raw);
    expect(cleaned).toBe("मैंने ₹200 का सामान बेचा");
  });

  it("cleanTranscript deduplicates Android SpeechRecognition cumulative stream loops", () => {
    const raw =
      "मैंने मैंने मैंने मैंने आज मैंने आज मैंने आज ₹200 मैंने आज ₹200 मैंने आज ₹200 का मैंने आज ₹200 का मैंने आज ₹200 का मैंने आज ₹200 का सामान मैंने आज ₹200 का सामान बेचा";
    const cleaned = cleanTranscript(raw);
    expect(cleaned).toBe("मैंने आज ₹200 का सामान बेचा");
  });

  it("Test 1: Aaj maine 50 rs ka saman becha -> Sale ₹50", () => {
    const result = parseLocally("Aaj maine 50 rs ka saman becha");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("sale");
    expect(result.amount).toBe(50);
  });

  it("Test 2: Aaj Ramesh ko 2500 ka maal diya -> Sale Credit ₹2500 Ramesh", () => {
    const result = parseLocally("Aaj Ramesh ko 2500 ka maal diya");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("sale");
    expect(result.amount).toBe(2500);
    expect(result.partyName).toBe("Ramesh");
    expect(result.onCredit).toBe(true);
  });

  it("Test 3: 800 rupaye diesel mein kharch hue -> Expense ₹800 diesel/fuel", () => {
    const result = parseLocally("800 rupaye diesel mein kharch hue");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("expense");
    expect(result.amount).toBe(800);
    expect(result.category).toBe("fuel");
  });

  it("Test 4: Ramesh se 1000 rupaye aaye -> Payment received ₹1000 Ramesh", () => {
    const result = parseLocally("Ramesh se 1000 rupaye aaye");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("payment_in");
    expect(result.amount).toBe(1000);
    expect(result.partyName).toBe("Ramesh");
  });

  it("Test 5: paanch sau ka saman becha -> Sale ₹500", () => {
    const result = parseLocally("paanch sau ka saman becha");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("sale");
    expect(result.amount).toBe(500);
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

  it("correctly parses party names with honorifics like 'Sharma ji'", () => {
    const result = parseLocally("Sharma ji ko 1500 rupaye diye");
    expect(result.kind).toBe("transaction");
    expect(result.amount).toBe(1500);
    expect(result.partyName).toBe("Sharma");
  });

  it("correctly parses English payment out like 'i gave 5200 to naman'", () => {
    const result = parseLocally("i gave 5200 to naman");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("payment_out");
    expect(result.amount).toBe(5200);
    expect(result.partyName).toBe("Naman");
  });

  it("correctly parses English payment in like 'received 3000 from rahul'", () => {
    const result = parseLocally("received 3000 from rahul");
    expect(result.kind).toBe("transaction");
    expect(result.type).toBe("payment_in");
    expect(result.amount).toBe(3000);
    expect(result.partyName).toBe("Rahul");
  });

  it("correctly extracts customer party with 'ne / ने' marker like 'दक्ष ने ₹2000 का सामान खरीदा'", () => {
    const result = parseLocally("दक्ष ने ₹2000 का सामान खरीदा");
    expect(result.kind).toBe("transaction");
    expect(result.amount).toBe(2000);
    expect(result.partyName).toBe("दक्ष");
  });

  it("correctly parses multi-transaction compound sentences", () => {
    const result = parseLocally(
      "सुबह मैं ₹2000 का सामान खरीदा उसके बाद ₹500 का सामान बेचा",
    );
    expect(result.kind).toBe("transaction");
    expect(result.items).toBeDefined();
    expect(result.items?.length).toBe(2);
    expect(result.items?.[0]?.type).toBe("purchase");
    expect(result.items?.[0]?.amount).toBe(2000);
    expect(result.items?.[1]?.type).toBe("sale");
    expect(result.items?.[1]?.amount).toBe(500);
  });

  it("correctly parses dedh hazar (1500) compound transactions", () => {
    const result = parseLocally(
      "मैंने आज ₹2000 का सामान बेचा उसके बाद ₹500 का सामान खरीदा उसके बाद डेड हजार रुपए का सामान भेजा",
    );
    expect(result.kind).toBe("transaction");
    expect(result.items).toBeDefined();
    expect(result.items?.length).toBe(3);
    expect(result.items?.[0]?.amount).toBe(2000);
    expect(result.items?.[1]?.amount).toBe(500);
    expect(result.items?.[2]?.amount).toBe(1500);
  });

  it("returns unknown for unparseable random noise", () => {
    const result = parseLocally("blabla xyz");
    expect(result.kind).toBe("unknown");
    expect(result.confidence).toBe(0);
  });
});
