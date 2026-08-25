/**
 * Offline fallback parser.
 *
 * Rule-based understanding of Hindi / English / Hinglish business phrases.
 * Used when the AI service is unavailable (no network, slow connection) so the
 * voice flow never dead-ends. The AI parser is preferred when reachable.
 */
import type { TxnType } from "@/lib/business/constants";

export type Interpretation = {
  kind: "transaction" | "stock" | "reminder" | "question" | "unknown";
  type?: TxnType | undefined;
  amount?: number | null | undefined;
  partyName?: string | null | undefined;
  category?: string | null | undefined;
  paymentMethod?: string | null | undefined;
  onCredit?: boolean | undefined;
  notes?: string | null | undefined;
  question?: string | null | undefined;
  /** Stock updates */
  productName?: string | null | undefined;
  quantity?: number | null | undefined;
  stockDirection?: "in" | "out" | "set" | null | undefined;
  unit?: string | null | undefined;
  /** Reminders */
  dueAt?: string | null | undefined;
  reminderNote?: string | null | undefined;
  confidence: number;
  language: "hi" | "en" | "hi-en";
  items?:
    | Array<{
        type: TxnType;
        amount: number;
        partyName?: string | null | undefined;
        notes?: string | null | undefined;
      }>
    | undefined;
  spokenResponse?: string | null | undefined;
  requiresClarification?: boolean | undefined;
  clarificationQuestion?: string | null | undefined;
};

const HINDI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

const WORD_NUMBERS: Record<string, number> = {
  // Colloquial & Fractional Modifiers
  safa: 25,
  सफा: 25,
  sawa: 25,
  sawaa: 25,
  सवा: 25,
  ded: 50,
  dedh: 50,
  deadh: 50,
  डेढ़: 50,
  डेढ: 50,
  pone: 75,
  pona: 75,
  pauna: 75,
  paune: 75,
  पौने: 75,
  dhai: 2.5,
  dhaye: 2.5,
  ढाई: 2.5,

  // Single units
  ek: 1,
  one: 1,
  एक: 1,
  do: 2,
  two: 2,
  दो: 2,
  teen: 3,
  three: 3,
  तीन: 3,
  char: 4,
  chaar: 4,
  four: 4,
  चार: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  पांच: 5,
  पाँच: 5,
  chhe: 6,
  che: 6,
  six: 6,
  छह: 6,
  saat: 7,
  seven: 7,
  सात: 7,
  aath: 8,
  eight: 8,
  आठ: 8,
  nau: 9,
  nine: 9,
  नौ: 9,
  das: 10,
  ten: 10,
  दस: 10,

  // Tens
  gyarah: 11,
  barah: 12,
  terah: 13,
  chaudah: 14,
  pandrah: 15,
  solah: 16,
  satrah: 17,
  atharah: 18,
  unnees: 19,
  bees: 20,
  bis: 20,
  twenty: 20,
  बीस: 20,
  tees: 30,
  thirty: 30,
  तीस: 30,
  chalis: 40,
  forty: 40,
  चालीस: 40,
  pachas: 50,
  pachasa: 50,
  fifty: 50,
  पचास: 50,
  sath: 60,
  saath: 60,
  sixty: 60,
  साठ: 60,
  sattar: 70,
  seventy: 70,
  सत्तर: 70,
  assi: 80,
  eighty: 80,
  अस्सी: 80,
  nabbe: 90,
  ninety: 90,
  नब्बे: 90,

  // Hundreds & Compound Hundreds
  sau: 100,
  so: 100,
  hundred: 100,
  सौ: 100,
  ekso: 100,
  eksau: 100,
  एकसौ: 100,
  doso: 200,
  douso: 200,
  dosau: 200,
  dousau: 200,
  दोसौ: 200,
  teenso: 300,
  teensau: 300,
  तीनसौ: 300,
  charso: 400,
  charsau: 400,
  chaarso: 400,
  chaarsau: 400,
  चारसौ: 400,
  pachso: 500,
  panchso: 500,
  paanchso: 500,
  pachsau: 500,
  पांचसौ: 500,
  chheso: 600,
  chhesau: 600,
  छहसौ: 600,
  saatso: 700,
  saatsau: 700,
  सातसौ: 700,
  aathso: 800,
  aathsau: 800,
  आठसौ: 800,
  nauso: 900,
  nausau: 900,
  नौसौ: 900,

  // Thousands & Lakhs
  hazar: 1000,
  hazaar: 1000,
  thousand: 1000,
  हजार: 1000,
  हज़ार: 1000,
  lakh: 100000,
  laak: 100000,
  laakh: 100000,
  lac: 100000,
  लाख: 100000,
};

function normalise(text: string): string {
  // Deduplicate consecutive repeated words or phrases from STT stream
  let cleaned = text
    .replace(/(\b[\w\u0900-\u097F]+\b)(?:\s+\1)+/gi, "$1")
    .replace(/(\b[\w\u0900-\u097F]+\s+[\w\u0900-\u097F]+\b)(?:\s+\1)+/gi, "$1")
    .split("")
    .map((ch) => HINDI_DIGITS[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/₹|rs\.?|rupees?|rupaye|rupyee|rupiye|रु/gi, " ")
    .replace(/,/g, "")
    .trim();

  // Normalize Hindi compound words FIRST before individual numbers
  cleaned = cleaned
    .replace(/(?:^|\s)(dedh|ded|deadh|डेढ़|डेढ|डेड)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 1500 ")
    .replace(/(?:^|\s)(dhai|dhaye|ढाई|ढाइ)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 2500 ")
    .replace(/(?:^|\s)(dedh|ded|deadh|डेढ़|डेढ|डेड)\s*(sau|so|सौ)(?=\s|$)/gi, " 150 ")
    .replace(/(?:^|\s)(dhai|dhaye|ढाई|ढाइ)\s*(sau|so|सौ)(?=\s|$)/gi, " 250 ")
    .replace(/(?:^|\s)(dedh|ded|deadh|डेढ़|डेढ|डेड)\s*(lakh|laakh|लाख)(?=\s|$)/gi, " 150000 ")
    .replace(/(?:^|\s)(dhai|dhaye|ढाई|ढाइ)\s*(lakh|laakh|लाख)(?=\s|$)/gi, " 250000 ")
    .replace(/(?:^|\s)(saadhe|sadhe|साढ़े|साढे)\s*(teen|तीन)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 3500 ")
    .replace(/(?:^|\s)(saadhe|sadhe|साढ़े|साढे)\s*(char|chaar|चार)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 4500 ")
    .replace(/(?:^|\s)(saadhe|sadhe|साढ़े|साढे)\s*(paanch|panch|पांच|पाँच)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 5500 ")
    .replace(/(?:^|\s)(paune|pone|pona|पौने|पौना)\s*(do|दो)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 1750 ")
    .replace(/(?:^|\s)(sawa|safa|सवा|सफा)\s*(do|दो)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 2250 ")
    .replace(/(?:^|\s)(sawa|safa|सवा|सफा)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 1250 ")
    .replace(/(?:^|\s)(paune|pone|pona|पौने|पौना)\s*(hazar|hazaar|हजार|हज़ार)(?=\s|$)/gi, " 750 ")
    .replace(/(?:^|\s)(saadhe|sadhe|साढ़े|साढे)\s*(teen|तीन)\s*(sau|so|सौ)(?=\s|$)/gi, " 350 ")
    .replace(/(?:^|\s)(saadhe|sadhe|साढ़े|साढे)\s*(char|chaar|चार)\s*(sau|so|सौ)(?=\s|$)/gi, " 450 ")
    .replace(/(?:^|\s)(saadhe|sadhe|साढ़े|साढे)\s*(paanch|panch|पांच|पाँच)\s*(sau|so|सौ)(?=\s|$)/gi, " 550 ")
    .replace(/(?:^|\s)(paune|pone|pona|पौने|पौना)\s*(do|दो)\s*(sau|so|सौ)(?=\s|$)/gi, " 175 ")
    .replace(/(?:^|\s)(paune|pone|pona|पौने|पौना)\s*(sau|so|सौ)(?=\s|$)/gi, " 75 ")
    .replace(/(?:^|\s)(sawa|safa|सवा|सफा)\s*(sau|so|सौ)(?=\s|$)/gi, " 125 ")
    .replace(/(?:^|\s)(sawa|safa|सवा|सफा)\s*(do|दो)\s*(sau|so|सौ)(?=\s|$)/gi, " 225 ");

  // Standalone dedh / dhai
  cleaned = cleaned
    .replace(/(?:^|\s)(dedh|ded|deadh|डेढ़|डेढ|डेड)(?=\s|$)/gi, " 1.5 ")
    .replace(/(?:^|\s)(dhai|dhaye|ढाई|ढाइ)(?=\s|$)/gi, " 2.5 ");

  // Unstick STT merged words (e.g. "दूधबेच" -> "दूध बेच", "सामानभेजा" -> "सामान भेजा")
  cleaned = cleaned
    .replace(/([a-z\u0900-\u097F]+)(बेच|बेचा|बेचे|भेजा|भेज|बिक्री|खरीद|खरीदा|दिया|लिया|खर्च|खर्चा)/g, "$1 $2")
    .replace(/(रुपए|रुपये|रु|rs|rupaye)(का|की|के|में|से|को|[a-z\u0900-\u097F]+)/g, "$1 $2");

  return cleaned.replace(/\s+/g, " ").trim();
}

function detectLanguage(text: string): Interpretation["language"] {
  const devanagari = /[\u0900-\u097F]/.test(text);
  const latin = /[a-z]/i.test(text);
  if (devanagari && latin) return "hi-en";
  if (devanagari) return "hi";
  const hinglishHints =
    /\b(aaj|kal|diya|liya|aaye|mila|kharch|udhaar|paise|rupaye|rupyee|rupiye|rupee|maal|kitna|hua|hue|beche|becha|bheja)\b/;
  return hinglishHints.test(text) ? "hi-en" : "en";
}

function extractAmount(text: string): number | null {
  const digits =
    text.match(/(\d+(?:\.\d+)?)\s*\b(k|hazar|hazaar|हज़ार|हजार|lakh|लाख)\b/i) ??
    text.match(/(\d+(?:\.\d+)?)/);
  if (digits) {
    let value = parseFloat(digits[1]!);
    const suffix = digits[2]?.toLowerCase();
    if (
      suffix === "k" ||
      suffix === "hazar" ||
      suffix === "hazaar" ||
      suffix === "हज़ार" ||
      suffix === "हजार"
    )
      value *= 1000;
    if (suffix === "lakh" || suffix === "लाख") value *= 100000;
    return value;
  }
  const words = text.split(/\s+/);
  let total = 0;
  let current = 0;
  let matched = false;
  for (const word of words) {
    const value = WORD_NUMBERS[word];
    if (value === undefined) continue;
    matched = true;
    if (value >= 100) {
      current = (current || 1) * value;
      total += current;
      current = 0;
    } else {
      current += value;
    }
  }
  if (!matched) return null;
  return total + current || null;
}

const CATEGORY_HINTS: { category: string; words: RegExp }[] = [
  { category: "fuel", words: /diesel|petrol|डीज़ल|डीजल|पेट्रोल|fuel/ },
  { category: "electricity", words: /bijli|बिजली|electric|light bill/ },
  { category: "rent", words: /kiraya|किराया|rent/ },
  { category: "salary", words: /salary|tankhwah|तनख्वाह|majduri|मजदूरी|wages/ },
  { category: "transport", words: /bhada|भाड़ा|transport|tempo|auto|freight/ },
  { category: "food", words: /chai|चाय|nashta|नाश्ता|snack|khana|खाना|food|tea/ },
  { category: "inventory", words: /maal|माल|stock|goods|saman|सामान/ },
  { category: "marketing", words: /poster|banner|ad|marketing|prachar|प्रचार/ },
  { category: "maintenance", words: /repair|marammat|मरम्मत|maintenance/ },
];

const QUESTION_HINTS =
  /\?|kitna|kitne|kaisi|kaise|kaun|konsa|compare|dikhao|दिखाओ|कितना|कितने|कौन|कैसी|how much|how many|who|which|show|report|profit hua|top|highest|owe/;

const PAYMENT_IN =
  /(se|से)\s|aaye|आए|aaya|आया|mila|मिला|mile|मिले|received|receive|got|jama|जमा|(?:received|got|collected)\b/i;
const PAYMENT_OUT =
  /(ko|को)\s.*(diye|दिए|diya|दिया|de|दी|paid|pay|chukaye|चुकाए|bheja|भेजा|bheje|भेजे|transfer|transferred)|payment (kiya|diya|made|sent)|bhugtan|भुगतान|\b(?:gave|given|paid|pay|transferred|sent)\b/i;
const EXPENSE = /kharch|खर्च|expense|kharcha|खर्चा|lag gaye|lage/;
const PURCHASE = /kharid|खरीद|purchase|mangwaya|मंगवाया/;
const SALE = /becha|बेचा|beche|बेचे|bikri|बिक्री|sale|sold|bheja|भेजा|bhej|भेज|maal diya|माल दिया|saman diya|सामान दिया/;
const CREDIT = /udhaar|उधार|udhar|credit|baki|बाकी|likh (do|dena)|खाते में/;
const REMINDER = /yaad dila|याद दिला|remind|reminder|yaad rakh|याद रख/;
const STOCK =
  /stock|स्टॉक|inventory|(?:aa gaya|आ गया|aa gaye|आ गए|add karo|jod do|जोड़ दो|bach[ae]|बचे|kam ho gaya|कम हो गया)/;

const STOCK_UNITS =
  /\b(pcs|piece|pieces|kg|kilo|gram|g|litre|liter|ltr|ml|box|packet|dozen|metre|meter)\b/;

function extractStockDirection(text: string): "in" | "out" | "set" {
  if (/(bach[ae]|बचे|left|remaining|total)/.test(text)) return "set";
  if (/(aa gaya|आ गया|aa gaye|आ गए|add|jod|arrived|received|bought|aaye)/.test(text)) return "in";
  if (/(nikl|निकल|kam|कम|used|sold|becha|बेचा|beche|बेचे)/.test(text)) return "out";
  return "in";
}

function extractProductName(text: string): string | null {
  const stopWords = new Set([
    "aaj",
    "kal",
    "maal",
    "paise",
    "rupaye",
    "rupyee",
    "rupie",
    "rupiye",
    "rupee",
    "rupees",
    "rs",
    "k",
    "ka",
    "ke",
    "ko",
    "se",
    "beche",
    "becha",
    "bikri",
    "diya",
    "liya",
    "kharida",
    "kharch",
    "aaye",
    "aaya",
    "mila",
    "doso",
    "sau",
    "hazar",
    "bheja",
    "bhej",
    "saman",
    "सामान",
  ]);
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (
      w === "beche" ||
      w === "becha" ||
      w === "sold" ||
      w === "diya" ||
      w === "kharida" ||
      w === "liya" ||
      w === "bheja" ||
      w === "bhej"
    ) {
      const p = words[i - 1];
      if (p && !stopWords.has(p) && !/^\d+$/.test(p) && WORD_NUMBERS[p] === undefined) {
        return p.charAt(0).toUpperCase() + p.slice(1);
      }
    }
  }
  // eslint-disable-next-line no-misleading-character-class
  const match = text.match(
    // eslint-disable-next-line no-misleading-character-class
    /(?:\d+\s*(?:[a-z]+\s+)?)?([a-z\u0900-\u097F]{3,})\s*(?:ka|की|के|stock|स्टॉक|aa gaya|आ गया|bach[ae]|बचे)/,
  );
  const name = match?.[1];
  if (!name || /^\d+$/.test(name) || stopWords.has(name.toLowerCase())) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function tomorrowMorning(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
}

function extractParty(text: string): string | null {
  const patterns = [
    /([a-z\u0900-\u097F]{2,})(?:\s+(?:ji|जी|bhai|bhaiya|sir|uncle))?\s+(?:ne|ने)(?:\s|$)/i,
    /([a-z\u0900-\u097F]{2,})(?:\s+(?:ji|जी|bhai|bhaiya|sir|uncle))?\s+(?:ko|को)(?:\s|$)/i,
    /([a-z\u0900-\u097F]{2,})(?:\s+(?:ji|जी|bhai|bhaiya|sir|uncle))?\s+(?:se|से)(?:\s|$)/i,
    /([a-z\u0900-\u097F]{2,})(?:\s+(?:ji|जी|bhai|bhaiya|sir|uncle))?\s+(?:ka|ki|ke|का|की|के)(?:\s|$)/i,
    /(?:to|for|from|paid to|given to|received from|by)\s+([a-z\u0900-\u097F]{2,})/i,
  ];
  const stop = new Set([
    "aaj",
    "kal",
    "maal",
    "saman",
    "saaman",
    "paise",
    "rupaye",
    "rupyee",
    "rupie",
    "rupiye",
    "rupee",
    "rupees",
    "rs",
    "k",
    "mujhe",
    "main",
    "maine",
    "hum",
    "humne",
    "ham",
    "hamne",
    "aap",
    "aapne",
    "ye",
    "yeh",
    "wo",
    "usne",
    "unhone",
    "ji",
    "जी",
    "bhai",
    "भाई",
    "bhaiya",
    "भैया",
    "sir",
    "uncle",
    "आज",
    "मैंने",
    "मैं",
    "हम",
    "हमने",
    "माल",
    "सामान",
    "पैसे",
    "रुपये",
    "रुपए",
    "पए",
    "मुझे",
    "becha",
    "beche",
    "diya",
    "liya",
    "lene",
    "dene",
    "lena",
    "dena",
    "लेने",
    "देने",
    "लेना",
    "देना",
    "kharch",
    "kharcha",
    "sale",
    "purchase",
    "udhar",
    "udhaar",
    "baki",
    "baaki",
    "bheja",
    "stock",
    "cash",
    "upi",
    "card",
    "online",
    "payment",
    "entry",
    "safa",
    "sawa",
    "sawaa",
    "सवा",
    "सफा",
    "ded",
    "dedh",
    "deadh",
    "डेढ़",
    "डेढ",
    "pone",
    "pona",
    "pauna",
    "paune",
    "पौने",
    "पौना",
    "hazar",
    "hazaar",
    "thousand",
    "हजार",
    "सौ",
    "sau",
    "so",
    "gave",
    "given",
    "paid",
    "received",
    "got",
    "to",
    "from",
    "for",
    "i",
    "me",
    "you",
  ]);

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = match?.[1];
    if (
      name &&
      !stop.has(name.toLowerCase()) &&
      !/^\d+$/.test(name) &&
      WORD_NUMBERS[name.toLowerCase()] === undefined
    ) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  return null;
}

export function parseLocally(raw: string): Interpretation {
  const text = normalise(raw);
  const language = detectLanguage(raw);

  if (!text) return { kind: "unknown", confidence: 0, language };

  if (REMINDER.test(text)) {
    return {
      kind: "reminder",
      partyName: extractParty(text),
      amount: extractAmount(text),
      dueAt: tomorrowMorning(),
      reminderNote: raw,
      notes: raw,
      confidence: 0.6,
      language,
    };
  }

  const amount = extractAmount(text);
  const partyName = extractParty(text);
  const onCredit = CREDIT.test(text);

  // Check for questions first: if the phrase has question indicators, treat as question
  if (QUESTION_HINTS.test(text)) {
    return { kind: "question", question: raw, confidence: 0.8, language };
  }

  if (STOCK.test(text) && !EXPENSE.test(text) && !SALE.test(text)) {
    const quantity = extractAmount(text);
    return {
      kind: "stock",
      productName: extractProductName(text),
      quantity,
      stockDirection: extractStockDirection(text),
      unit: text.match(STOCK_UNITS)?.[1] ?? null,
      notes: raw,
      confidence: quantity ? 0.65 : 0.45,
      language,
    };
  }

  // --- Multi-transaction local detection ("uske baad", "phir", "and then", "aur") ---
  const splitPattern = /(?:\s+(?:uske baad|उसके बाद|phir|फिर|and then|then)\s+)|(?:\s+(?:aur|और)\s+(?=\d|₹|[a-z\u0900-\u097F]+\s*(?:ka|ki|ke|ko|se|का|की|के|को|से)))/i;
  const rawSegments = raw.split(splitPattern).map((s) => s.trim()).filter(Boolean);
  if (rawSegments.length > 1) {
    const parsedItems: Array<{ type: TxnType; amount: number; partyName?: string | null; notes?: string | null }> = [];
    for (const segment of rawSegments) {
      const segText = normalise(segment);
      const segAmount = extractAmount(segText);
      if (!segAmount || segAmount <= 0) continue;

      let segType: TxnType = "sale";
      if (PURCHASE.test(segText)) segType = "purchase";
      else if (EXPENSE.test(segText)) segType = "expense";
      else if (PAYMENT_OUT.test(segText)) segType = "payment_out";
      else if (PAYMENT_IN.test(segText)) segType = "payment_in";
      else if (SALE.test(segText)) segType = "sale";

      parsedItems.push({
        type: segType,
        amount: segAmount,
        partyName: extractParty(segText),
        notes: segment,
      });
    }

    if (parsedItems.length > 1) {
      return {
        kind: "transaction",
        type: parsedItems[0]?.type ?? "purchase",
        amount: parsedItems[0]?.amount ?? null,
        items: parsedItems,
        notes: raw,
        confidence: 0.8,
        language,
      };
    }
  }

  let type: TxnType | undefined;
  if (EXPENSE.test(text)) type = "expense";
  else if (PURCHASE.test(text)) type = "purchase";
  else if (SALE.test(text)) type = "sale";
  else if (PAYMENT_OUT.test(text)) type = "payment_out";
  else if (PAYMENT_IN.test(text)) type = "payment_in";

  if (!type) {
    if (QUESTION_HINTS.test(text))
      return { kind: "question", question: raw, confidence: 0.5, language };
    
    if (amount && amount > 0) {
      return {
        kind: "transaction",
        type: "sale",
        amount,
        partyName: partyName ?? "Cash / Anonymous",
        category: null,
        paymentMethod: "cash",
        onCredit: false,
        notes: raw,
        confidence: 0.5,
        language,
      };
    }

    return { kind: "unknown", confidence: 0, language };
  }

  let category: string | null = null;
  if (type === "expense") {
    category = CATEGORY_HINTS.find((hint) => hint.words.test(text))?.category ?? "misc";
  }

  const isExplicitCash = /(cash|nagad|nagli|upi|card)/.test(text);
  const isPartyCredit =
    (type === "sale" || type === "purchase") && partyName !== null && !isExplicitCash;
  const finalOnCredit = onCredit || isPartyCredit;

  let confidence = 0.45;
  if (amount) confidence += 0.25;
  if (partyName || type === "expense") confidence += 0.15;
  if (type === "expense" && category !== "misc") confidence += 0.05;

  let spokenResponse: string | null = null;
  if (type === "sale" && amount && partyName) {
    spokenResponse = `${partyName} ke khaate mein ₹${amount} का entry add kar diya.`;
  } else if (type === "payment_in" && amount && partyName) {
    spokenResponse = `${partyName} se ₹${amount} receive kar liya.`;
  } else if (type === "expense" && amount) {
    spokenResponse = `₹${amount} ka expense entry save kar diya.`;
  }

  return {
    kind: "transaction",
    type,
    amount,
    partyName: type === "expense" ? null : partyName,
    category,
    paymentMethod: finalOnCredit ? "credit" : null,
    onCredit: finalOnCredit,
    notes: raw,
    confidence: Math.min(confidence, 0.9),
    language,
    spokenResponse,
  };
}
