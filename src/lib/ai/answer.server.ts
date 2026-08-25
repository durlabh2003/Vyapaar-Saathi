import type { SupabaseClient } from "@supabase/supabase-js";

import type { Transaction } from "@/lib/business/constants";
import {
  averageSale,
  dailySeries,
  expenseByCategory,
  inRange,
  partyBalances,
  payables,
  receivables,
  topParties,
  totals,
} from "@/lib/business/metrics";
import { daysAgo, money, startOfDay } from "@/lib/format";
import { AIUnavailableError, chat } from "./gateway.server";

export type Snapshot = ReturnType<typeof buildSnapshot>;

type Named = { id: string; name: string };

/** All figures here are computed from stored rows — never from the model. */
export function buildSnapshot(txns: Transaction[], customers: Named[], vendors: Named[]) {
  const nameOf = (list: Named[], id: string) => list.find((p) => p.id === id)?.name ?? "Unknown";

  const today = totals(inRange(txns, startOfDay()));
  const yesterday = totals(inRange(txns, daysAgo(1), startOfDay()));
  const last7 = totals(inRange(txns, daysAgo(6)));
  const prev7 = totals(inRange(txns, daysAgo(13), daysAgo(6)));
  const last30 = totals(inRange(txns, daysAgo(29)));
  const prev30 = totals(inRange(txns, daysAgo(59), daysAgo(29)));

  const customerDue = [...partyBalances(txns, "customer_id").entries()]
    .filter(([, row]) => row.due > 0.5)
    .map(([id, row]) => ({ name: nameOf(customers, id), due: row.due, last: row.last }))
    .sort((a, b) => b.due - a.due)
    .slice(0, 10);

  const vendorDue = [...partyBalances(txns, "vendor_id").entries()]
    .filter(([, row]) => row.due > 0.5)
    .map(([id, row]) => ({ name: nameOf(vendors, id), due: row.due, last: row.last }))
    .sort((a, b) => b.due - a.due)
    .slice(0, 10);

  const daily = dailySeries(txns, 30);
  const bestDay = [...daily].sort((a, b) => b.sales - a.sales)[0] ?? null;

  // Raw today transactions for party-specific offline answers
  const todayTxns = inRange(txns, startOfDay());
  const todayRawTransactions = todayTxns.map((t) => ({
    type: t.type,
    amount: t.amount,
    partyName: t.party_name ?? nameOf(customers, t.customer_id ?? "") ?? nameOf(vendors, t.vendor_id ?? "") ?? null,
    notes: t.notes ?? null,
  }));

  // Last-30-days per-party summary (union of customers + vendors by name)
  const partyMap30 = new Map<string, { paid: number; received: number }>();
  for (const t of inRange(txns, daysAgo(29))) {
    const name = (
      t.party_name ??
      nameOf(customers, t.customer_id ?? "") ??
      nameOf(vendors, t.vendor_id ?? "")
    )?.toLowerCase();
    if (!name || name === "unknown") continue;
    const entry = partyMap30.get(name) ?? { paid: 0, received: 0 };
    if (["payment_out", "purchase", "expense"].includes(t.type)) entry.paid += t.amount;
    else if (["sale", "payment_in"].includes(t.type)) entry.received += t.amount;
    partyMap30.set(name, entry);
  }
  const recentPartyTransactions = [...partyMap30.entries()].map(([name, row]) => ({ name, ...row }));

  return {
    today,
    yesterday,
    last7Days: last7,
    previous7Days: prev7,
    last30Days: last30,
    previous30Days: prev30,
    totalToReceive: receivables(txns),
    totalToPay: payables(txns),
    averageSale: averageSale(inRange(txns, daysAgo(29))),
    expenseCategoriesLast30Days: expenseByCategory(inRange(txns, daysAgo(29))).slice(0, 8),
    topCustomersLast30Days: topParties(inRange(txns, daysAgo(29)), "customer_id").map((row) => ({
      name: nameOf(customers, row.id),
      amount: row.amount,
    })),
    topVendorsLast30Days: topParties(inRange(txns, daysAgo(29)), "vendor_id").map((row) => ({
      name: nameOf(vendors, row.id),
      amount: row.amount,
    })),
    customersWhoOweMoney: customerDue,
    vendorsToPay: vendorDue,
    bestSalesDayLast30Days: bestDay,
    dailyLast30Days: daily,
    todayRawTransactions,
    recentPartyTransactions,
  };
}

export async function loadSnapshot(supabase: SupabaseClient, businessId: string) {
  const since = daysAgo(120).toISOString();
  const [txnRes, custRes, vendRes] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id,business_id,type,amount,amount_paid,payment_method,category,customer_id,vendor_id,party_name,notes,occurred_at,source,ai_confidence,created_at",
      )
      .eq("business_id", businessId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(2000),
    supabase.from("customers").select("id,name").eq("business_id", businessId).limit(1000),
    supabase.from("vendors").select("id,name").eq("business_id", businessId).limit(1000),
  ]);

  if (txnRes.error) throw txnRes.error;

  return buildSnapshot(
    (txnRes.data ?? []) as unknown as Transaction[],
    (custRes.data ?? []) as Named[],
    (vendRes.data ?? []) as Named[],
  );
}

const SYSTEM = `You are the business assistant inside a shopkeeper's app in India.

You are given a JSON snapshot of FACTS computed from the shop's own records, and a question.

Hard rules:
- Use ONLY the numbers present in the snapshot. Never estimate, extrapolate or invent a figure.
- If the snapshot does not contain the answer, say plainly that there is not enough recorded data yet.
- Format money in Indian rupees like ₹1,85,000.
- Answer in the SAME language style as the question (Hindi, English or Hinglish).
- Be short: a one-line answer, then up to 3 supporting lines. No headings, no markdown tables, no emoji.`;

/** Pattern buckets used for offline question-answering */
const Q = {
  profit:    /profit|munafa|मुनाफ़ा|मुनाफा|kamaai|कमाई/i,
  sales:     /sale|bikri|बिक्री|revenue|income|kamaai|बिक्री|beche/i,
  expense:   /expense|kharch|ख़र्च|खर्च|kharcha/i,
  udhaar:    /udhaar|udhar|उधार|baaki|बाकी|credit|receivable|lena|लेना/i,
  topCustomer: /top.?customer|sabse.?zyada|best.?customer|सबसे.?ज्यादा.*(customer|kharid)|who.*(buy|owe|paid)/i,
  lowestStock: /low.?stock|khatam|ख़त्म|khatm|stock.*(kam|khatam|thoda)/i,
  payable:   /pay|dena|देना|vendor|supplier|payment.*(karna|due)/i,
  today:     /aaj|आज|today/i,
  week:      /hafte|हफ़्ते|week|7.day|7 din/i,
};

/**
 * Extract a person/party name from a natural-language question.
 * Handles English patterns ("to saksham", "from naman", "of ramesh") and
 * Hinglish patterns ("saksham ko", "ramesh se", "naman ka").
 */
/**
 * Extract a person/party name token from a natural-language question.
 * Returns the raw token (may be Devanagari or Latin).
 * Handles: "to saksham", "from naman", "saksham ko", "सक्षम को"
 */
function extractPartyFromQuestion(q: string): string | null {
  const latinStop = new Set([
    "we","i","me","you","how","much","aaj","kal","today","yesterday","did","does","do",
    "amount","give","gave","paid","pay","received","sent","what","is","the","a","an",
    "kitna","kitne","kya","hai","tha","mujhe","humne","hum","aap","vo","who","which",
    "total","rupaye","rupee","rs","paise","ko","se","ka","ki","ke","ne","diya","diye",
    "liya","liye","aaye","aaya","mila","mile","bata","batao",
  ]);
  // Devanagari stop words (question words, postpositions, verbs)
  const devanagariStop = new Set([
    "आज","कल","कितना","कितने","क्या","है","था","हम","आप","वो","कौन","कुल",
    "रुपये","पैसे","को","से","का","की","के","ने","दिया","दिये","लिया","मिला","मिले",
    "हुआ","हुए","बता","बताओ","कितनी","कभी","कहाँ","कैसा","कैसी",
  ]);

  const patterns = [
    // English/Hinglish: "to saksham", "from naman", "for ramesh"
    /\b(?:to|from|for|of|by)\s+([a-zA-Z]{2,})/,
    // Hinglish Latin: "saksham ko", "ramesh se", "naman ka"
    /\b([a-zA-Z]{2,})\s+(?:ko|se|ka|ki|ke)\b/i,
    // Hindi Devanagari + postposition: "सक्षम को", "राम से"
    /([\u0900-\u097F]{2,})\s+(?:को|से|का|की|के|ने)/,
    // Hindi: postposition + Devanagari name (less common but valid)
    /(?:को|से|का|की|के)\s+([\u0900-\u097F]{2,})/,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    const token = match?.[1];
    if (!token) continue;
    const lower = token.toLowerCase();
    // Skip if it's a known stop word (Latin or Devanagari)
    if (latinStop.has(lower) || devanagariStop.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    if (token.length < 2) continue;
    return token; // Return raw token (preserves Devanagari)
  }
  return null;
}

/**
 * Resolve a raw party token (could be Devanagari "सक्षम" or Latin "saksham")
 * against the actual stored party names in the snapshot.
 * Returns the stored normalized name (lowercase Latin) for filtering, or null.
 *
 * Strategy: for Devanagari, try to find a stored name whose phonetic romanization
 * is a substring of the query. Since we can't transliterate server-side easily,
 * we check if any stored party name (lowercase) appears directly in the
 * ORIGINAL QUESTION when the question is lowercased (handles typed English input),
 * OR if the snapshot has any transaction where the stored name phonetically
 * matches the Devanagari token via a character-overlap heuristic.
 */
function resolvePartyName(
  rawToken: string,
  question: string,
  allPartyNames: string[], // all known party names (lowercase Latin)
): string | null {
  const qLower = question.toLowerCase();

  // 1. If the token is Latin, return it directly (already validated)
  if (/^[a-z]+$/i.test(rawToken)) {
    return rawToken.toLowerCase();
  }

  // 2. Token is Devanagari — search the ORIGINAL QUESTION for any known party name
  // This covers: user typed "saksham" somewhere in the query even alongside Devanagari,
  // or the speech engine partly preserved the Latin name.
  for (const name of allPartyNames) {
    if (qLower.includes(name)) return name;
  }

  // 3. Cross-script phonetic heuristic:
  // Map the first character of the Devanagari token to its common Latin initial,
  // and look for stored names starting with that letter.
  // Devanagari initial → Latin initial mapping (common Indian names)
  const devToLatin: Record<string, string> = {
    "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
    "ए": "e", "ऐ": "a", "ओ": "o", "औ": "a",
    "क": "k", "ख": "k", "ग": "g", "घ": "g",
    "च": "ch", "छ": "ch", "ज": "j", "झ": "jh",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh",
    "त": "t", "थ": "th", "द": "d", "ध": "dh",
    "न": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh",
    "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy",
  };

  const firstChar = rawToken.charAt(0);
  const latinInitial = devToLatin[firstChar];
  if (latinInitial) {
    // Find stored names starting with this initial
    const candidates = allPartyNames.filter((n) => n.startsWith(latinInitial));
    // Return the first match (usually there's only one "s" name = saksham)
    if (candidates.length === 1) return candidates[0] ?? null;
    // Multiple candidates: try matching length heuristic
    // Devanagari syllables ≈ vowel sounds in Latin name
    const tokenSyllables = rawToken.replace(/[\u0900-\u0902\u0903\u0904\u093C-\u094F\u0951-\u0954]/g, "").length;
    const best = candidates.find((c) => Math.abs(c.length - tokenSyllables) <= 2);
    if (best) return best;
    if (candidates.length > 0) return candidates[0] ?? null;
  }

  return null;
}

/**
 * Question-aware offline fallback — reads the question and picks the
 * single most relevant metric from the snapshot instead of always
 * dumping the full summary.
 */
function smartDeterministicAnswer(
  question: string,
  snapshot: Snapshot,
  locale?: "hi" | "en" | "hi-en",
): string {
  const q = question;

  const isHindi = locale === "hi";
  const isHinglish = locale === "hi-en";

  // --- Party-specific question ("how much did we give to saksham today") ---
  const rawToken = extractPartyFromQuestion(q);
  if (rawToken) {
    // Collect all known party names from snapshot (lowercase Latin)
    const allPartyNames = [
      ...snapshot.todayRawTransactions
        .map((t) => t.partyName?.toLowerCase())
        .filter((n): n is string => !!n && n !== "unknown"),
      ...snapshot.recentPartyTransactions.map((p) => p.name),
      ...snapshot.customersWhoOweMoney.map((c) => c.name.toLowerCase()),
      ...snapshot.vendorsToPay.map((v) => v.name.toLowerCase()),
    ];
    const uniqueNames = [...new Set(allPartyNames)];
    const partyName = resolvePartyName(rawToken, q, uniqueNames);

    const isToday = Q.today.test(q);
    const isPaymentOut = /\b(?:gave|give|paid|pay|diya|diye|transfer|sent|bheja|dena|दिया|दिए|दी)\b/i.test(q);
    const isPaymentIn = /\b(?:received|got|aaye|aaya|mila|mile|collect|liya|liye|मिला|मिले|लिया)\b/i.test(q);

    if (!partyName) {
      // fall through to general keyword matching below
    } else if (isToday) {
      // Filter today's raw transactions for this party
      const partyTxns = snapshot.todayRawTransactions.filter(
        (t) => t.partyName?.toLowerCase().includes(partyName),
      );

      const name = partyName.charAt(0).toUpperCase() + partyName.slice(1);

      if (partyTxns.length === 0) {
        return isHindi
          ? `आज ${name} के नाम पर कोई भी लेन-देन दर्ज नहीं है।`
          : isHinglish
            ? `Aaj ${name} ke saath koi bhi transaction record nahi hua hai.`
            : `I checked your records, but there are no transactions recorded for ${name} today.`;
      }

      const realName = partyTxns[0]?.partyName ?? name;

      if (isPaymentOut) {
        const outTxns = partyTxns.filter((t) => ["payment_out", "purchase"].includes(t.type));
        if (outTxns.length > 0) {
          const total = outTxns.reduce((s, t) => s + t.amount, 0);
          return isHindi
            ? `आज आपने ${realName} को कुल ${money(total)} दिए हैं।`
            : isHinglish
              ? `Aaj aapne ${realName} ko total ${money(total)} diye hain.`
              : `You gave a total of ${money(total)} to ${realName} today.`;
        }
        return isHindi
          ? `आज ${realName} को कोई पैसे देने की एंट्री नहीं मिली है।`
          : isHinglish
            ? `Aaj ${realName} ko koi payment dene ki entry nahi mili.`
            : `There is no payment given to ${realName} recorded today.`;
      }

      if (isPaymentIn) {
        const inTxns = partyTxns.filter((t) => ["payment_in", "sale"].includes(t.type));
        if (inTxns.length > 0) {
          const total = inTxns.reduce((s, t) => s + t.amount, 0);
          return isHindi
            ? `आज ${realName} से कुल ${money(total)} प्राप्त हुए हैं।`
            : isHinglish
              ? `Aaj ${realName} se total ${money(total)} receive huye hain.`
              : `You received a total of ${money(total)} from ${realName} today.`;
        }
        return isHindi
          ? `आज ${realName} से कोई पैसे मिलने की एंट्री नहीं है।`
          : isHinglish
            ? `Aaj ${realName} se koi payment receive hone ki entry nahi hai.`
            : `There is no payment received from ${realName} recorded today.`;
      }

      const lines = partyTxns.map((t) => `• ${t.type.replace("_", " ")}: ${money(t.amount)}`);
      return isHindi
        ? `आज ${realName} के साथ ये लेन-देन हुए हैं:\n${lines.join("\n")}`
        : isHinglish
          ? `Aaj ${realName} ke saath ye transactions huye hain:\n${lines.join("\n")}`
          : `Here are today's recorded transactions for ${realName}:\n${lines.join("\n")}`;
    } else {
      // Not today-specific — look up 30-day party summary
      const partySummary = snapshot.recentPartyTransactions.find(
        (p) => p.name.includes(partyName),
      );
      const displayName = partyName.charAt(0).toUpperCase() + partyName.slice(1);
      if (partySummary) {
        if (isPaymentOut && partySummary.paid > 0) {
          return isHindi
            ? `पिछले 30 दिनों में आपने ${displayName} को कुल ${money(partySummary.paid)} दिए हैं।`
            : isHinglish
              ? `Last 30 din mein aapne ${displayName} ko total ${money(partySummary.paid)} diye hain.`
              : `You have given ${money(partySummary.paid)} to ${displayName} over the last 30 days.`;
        }
        if (isPaymentIn && partySummary.received > 0) {
          return isHindi
            ? `पिछले 30 दिनों में ${displayName} से कुल ${money(partySummary.received)} मिले हैं।`
            : isHinglish
              ? `Last 30 din mein ${displayName} se total ${money(partySummary.received)} mile hain.`
              : `You have received ${money(partySummary.received)} from ${displayName} over the last 30 days.`;
        }
        return isHindi
          ? `पिछले 30 दिनों में ${displayName} को ${money(partySummary.paid)} दिए हैं और ${money(partySummary.received)} प्राप्त हुए हैं।`
          : isHinglish
            ? `Last 30 din mein ${displayName} ko ${money(partySummary.paid)} diye hain aur ${money(partySummary.received)} mile hain.`
            : `Over the last 30 days with ${displayName}: Paid ${money(partySummary.paid)} and Received ${money(partySummary.received)}.`;
      }

      return isHindi
        ? `माफ़ कीजिए, आपके रिकॉर्ड्स में ${displayName} के बारे में कोई डेटा नहीं मिला।`
        : isHinglish
          ? `Sorry, aapke records mein ${displayName} ka koi data nahi mila.`
          : `I couldn't find any transaction records for ${displayName}.`;
    }
  }

  // --- Today-specific overrides ---
  if (Q.today.test(q)) {
    if (Q.profit.test(q)) {
      return isHindi
        ? `आज का आपका मुनाफ़ा ${money(snapshot.today.profit)} है। (कुल बिक्री ${money(snapshot.today.sales)}, कुल ख़र्च ${money(snapshot.today.expenses + snapshot.today.purchases)})`
        : isHinglish
          ? `Aaj aapka net profit ${money(snapshot.today.profit)} hai. (Total sale ${money(snapshot.today.sales)}, total kharcha ${money(snapshot.today.expenses + snapshot.today.purchases)})`
          : `Today's net profit is ${money(snapshot.today.profit)} from ${money(snapshot.today.sales)} in sales and ${money(snapshot.today.expenses + snapshot.today.purchases)} in expenses.`;
    }
    if (Q.sales.test(q)) {
      return isHindi
        ? `आज की कुल बिक्री ${money(snapshot.today.sales)} दर्ज हुई है।`
        : isHinglish
          ? `Aaj ki total sale ${money(snapshot.today.sales)} hui hai.`
          : `Today's total recorded sales stand at ${money(snapshot.today.sales)}.`;
    }
    if (Q.expense.test(q)) {
      const total = snapshot.today.expenses + snapshot.today.purchases;
      return isHindi
        ? `आज का कुल ख़र्चा ${money(total)} हुआ है।`
        : isHinglish
          ? `Aaj ka total kharcha ${money(total)} hua hai.`
          : `Today's total recorded expenses are ${money(total)}.`;
    }
    return isHindi
      ? `आज का हिसाब: बिक्री ${money(snapshot.today.sales)}, ख़र्चा ${money(snapshot.today.expenses + snapshot.today.purchases)}, और मुनाफ़ा ${money(snapshot.today.profit)} है।`
      : isHinglish
        ? `Aaj ka hisaab: Sale ${money(snapshot.today.sales)}, Kharcha ${money(snapshot.today.expenses + snapshot.today.purchases)}, aur Profit ${money(snapshot.today.profit)} hai.`
        : `Here is today's summary: Sales of ${money(snapshot.today.sales)}, expenses of ${money(snapshot.today.expenses + snapshot.today.purchases)}, with a net profit of ${money(snapshot.today.profit)}.`;
  }

  // --- This-week overrides ---
  if (Q.week.test(q)) {
    if (Q.profit.test(q)) {
      return isHindi
        ? `इस हफ़्ते आपका कुल मुनाफ़ा ${money(snapshot.last7Days.profit)} रहा है।`
        : isHinglish
          ? `Is hafte aapka total net profit ${money(snapshot.last7Days.profit)} raha hai.`
          : `Your net profit for this week is ${money(snapshot.last7Days.profit)}.`;
    }
    if (Q.sales.test(q)) {
      return isHindi
        ? `इस हफ़्ते की कुल बिक्री ${money(snapshot.last7Days.sales)} हुई है।`
        : isHinglish
          ? `Is hafte ki total sale ${money(snapshot.last7Days.sales)} rahi hai.`
          : `Total sales for this week amount to ${money(snapshot.last7Days.sales)}.`;
    }
    if (Q.expense.test(q)) {
      const total = snapshot.last7Days.expenses + snapshot.last7Days.purchases;
      return isHindi
        ? `इस हफ़्ते आपका कुल ख़र्च ${money(total)} हुआ है।`
        : isHinglish
          ? `Is hafte ka total kharcha ${money(total)} hua hai.`
          : `Your total expenses for this week are ${money(total)}.`;
    }
  }

  // --- Profit ---
  if (Q.profit.test(q)) {
    return isHindi
      ? `पिछले 30 दिनों में आपका कुल मुनाफ़ा ${money(snapshot.last30Days.profit)} रहा है (बिक्री: ${money(snapshot.last30Days.sales)}, ख़र्च: ${money(snapshot.last30Days.expenses + snapshot.last30Days.purchases)})।`
      : isHinglish
        ? `Last 30 din mein aapka total profit ${money(snapshot.last30Days.profit)} raha hai (Sale: ${money(snapshot.last30Days.sales)}, Kharcha: ${money(snapshot.last30Days.expenses + snapshot.last30Days.purchases)}).`
        : `Your net profit over the last 30 days is ${money(snapshot.last30Days.profit)} (Sales: ${money(snapshot.last30Days.sales)}, Expenses: ${money(snapshot.last30Days.expenses + snapshot.last30Days.purchases)}).`;
  }

  // --- Udhaar / receivables ---
  if (Q.udhaar.test(q) && !Q.payable.test(q)) {
    if (snapshot.customersWhoOweMoney.length === 0) {
      return isHindi
        ? "बहुत बढ़िया! फ़िलहाल किसी भी ग्राहक पर कोई उधार बाकी नहीं है।"
        : isHinglish
          ? "Great! Abhi kisi bhi customer par koi udhaar baaki nahi hai."
          : "Good news! You have no outstanding receivables right now.";
    }
    const top = snapshot.customersWhoOweMoney.slice(0, 4);
    const header = isHindi
      ? `ग्राहकों से कुल ${money(snapshot.totalToReceive)} लेने बाकी हैं। मुख्य उधारी:`
      : isHinglish
        ? `Customers se total ${money(snapshot.totalToReceive)} lene baaki hain. Main udhaar:`
        : `You have a total of ${money(snapshot.totalToReceive)} to receive from customers:`;
    const rows = top.map((c) => `• ${c.name}: ${money(c.due)}`);
    return [header, ...rows].join("\n");
  }

  // --- Payables ---
  if (Q.payable.test(q)) {
    if (snapshot.vendorsToPay.length === 0) {
      return isHindi
        ? "फ़िलहाल किसी भी सप्लायर या वेंडर का कोई बकाया भुगतान नहीं है।"
        : isHinglish
          ? "Filhaal kisi vendor ka koi payment pending nahi hai."
          : "You have no pending vendor payments right now.";
    }
    const top = snapshot.vendorsToPay.slice(0, 4);
    const header = isHindi
      ? `वेंडर्स को कुल ${money(snapshot.totalToPay)} चुकाने बाकी हैं:`
      : isHinglish
        ? `Vendors ko total ${money(snapshot.totalToPay)} dene baaki hain:`
        : `You have a total of ${money(snapshot.totalToPay)} pending to pay vendors:`;
    const rows = top.map((v) => `• ${v.name}: ${money(v.due)}`);
    return [header, ...rows].join("\n");
  }

  // --- Sales ---
  if (Q.sales.test(q)) {
    return isHindi
      ? `पिछले 30 दिनों में कुल बिक्री ${money(snapshot.last30Days.sales)} रही है, जिसमें से आज की बिक्री ${money(snapshot.today.sales)} है।`
      : isHinglish
        ? `Last 30 din mein total sale ${money(snapshot.last30Days.sales)} rahi hai, jisme aaj ki sale ${money(snapshot.today.sales)} hai.`
        : `Your total sales over the last 30 days are ${money(snapshot.last30Days.sales)}, with ${money(snapshot.today.sales)} recorded today.`;
  }

  // --- Expenses ---
  if (Q.expense.test(q)) {
    const total = snapshot.last30Days.expenses + snapshot.last30Days.purchases;
    const cats = snapshot.expenseCategoriesLast30Days.slice(0, 3);
    const header = isHindi
      ? `पिछले 30 दिनों का कुल ख़र्चा ${money(total)} रहा है:`
      : isHinglish
        ? `Last 30 din ka total kharcha ${money(total)} raha hai:`
        : `Your total expenses in the last 30 days were ${money(total)}:`;
    const rows = cats.map((c) => `• ${c.category}: ${money(c.amount)}`);
    return [header, ...rows].join("\n");
  }

  // --- Top customers ---
  if (Q.topCustomer.test(q)) {
    const top = snapshot.topCustomersLast30Days.slice(0, 3);
    if (top.length === 0) {
      return isHindi
        ? "अभी आपके पास पर्याप्त ग्राहक डेटा दर्ज नहीं है।"
        : isHinglish
          ? "Abhi aapke paas customer data recorded nahi hai."
          : "There is not enough customer purchase data recorded yet.";
    }
    const header = isHindi ? "पिछले 30 दिनों के आपके प्रमुख ग्राहक:" : "Your top customers over the last 30 days:";
    const rows = top.map((c, i) => `${i + 1}. ${c.name} (${money(c.amount)})`);
    return [header, ...rows].join("\n");
  }

  // --- Low stock ---
  if (Q.lowestStock.test(q)) {
    return isHindi
      ? "स्टॉक की पूरी जानकारी और कम स्टॉक वाले आइटम्स देखने के लिए ऐप के 'Products' सेक्शन में जाएं।"
      : isHinglish
        ? "Stock details check karne ke liye kripya app ke 'Products' section mein dekhein."
        : "You can view items running low on inventory in the 'Products' section.";
  }

  // --- General helpful conversational response ---
  if (isHindi) {
    return `व्यापार का संक्षिप्त विवरण:\n• 30 दिनों का मुनाफ़ा: ${money(snapshot.last30Days.profit)}\n• कुल बिक्री: ${money(snapshot.last30Days.sales)}\n• कुल ख़र्चा: ${money(snapshot.last30Days.expenses + snapshot.last30Days.purchases)}\n• ग्राहकों से लेने हैं: ${money(snapshot.totalToReceive)}`;
  }
  if (isHinglish) {
    return `Business ka quick summary:\n• 30 days profit: ${money(snapshot.last30Days.profit)}\n• Total sale: ${money(snapshot.last30Days.sales)}\n• Total kharcha: ${money(snapshot.last30Days.expenses + snapshot.last30Days.purchases)}\n• Market se lene hain: ${money(snapshot.totalToReceive)}`;
  }
  return `Here is your business snapshot:\n• 30-Day Net Profit: ${money(snapshot.last30Days.profit)}\n• Sales: ${money(snapshot.last30Days.sales)}\n• Expenses: ${money(snapshot.last30Days.expenses + snapshot.last30Days.purchases)}\n• Receivables: ${money(snapshot.totalToReceive)}`;
}

export async function answerQuestion(
  question: string,
  snapshot: Snapshot,
  locale?: "hi" | "en" | "hi-en",
) {
  const languageRequirement =
    locale === "en"
      ? "Answer STRICTLY in clear, natural English."
      : locale === "hi"
        ? "Answer STRICTLY in Devanagari Hindi (हिन्दी)."
        : "Answer in natural Hinglish (Hindi language using English/Roman script) or the language of the question.";

  const SYSTEM = `You are the business intelligence engine inside a shopkeeper's app in India.

You are given a JSON snapshot of FACTS computed from the shop's own records, and a question.

Hard rules:
- Use ONLY the numbers present in the snapshot. Never estimate, extrapolate or invent a figure.
- If the snapshot does not contain the answer, say plainly in a polite, helpful way that there is not enough recorded data yet.
- Format money in Indian rupees like ₹1,85,000.
- ${languageRequirement}
- Be concise and clear (1 direct summary line, then up to 3 bullet points if helpful). No markdown tables, no headings, no thinking tags (<think>), no internal monologues. Provide ONLY the final answer directly to the shopkeeper.`;

  try {
    const text = await chat([
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `SNAPSHOT:\n${JSON.stringify(snapshot)}\n\nQUESTION: ${question}`,
      },
    ]);
    return { answer: text.trim(), grounded: true };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) console.error(error);
    // Smart offline fallback — answers based on what was actually asked
    return { answer: smartDeterministicAnswer(question, snapshot, locale), grounded: true, degraded: true };
  }
}

