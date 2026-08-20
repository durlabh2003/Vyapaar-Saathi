import { supabase } from "@/integrations/supabase/client";

export async function seedDemoKiranaData(businessId: string) {
  // 1. Seed Kirana Products
  const sampleProducts = [
    {
      business_id: businessId,
      name: "Parle-G Biscuit 100g",
      selling_price: 10,
      purchase_price: 8.5,
      stock: 50,
      low_stock_threshold: 10,
      unit: "packet",
    },
    {
      business_id: businessId,
      name: "Fortune Mustard Oil 1L",
      selling_price: 150,
      purchase_price: 135,
      stock: 12,
      low_stock_threshold: 5,
      unit: "litre",
    },
    {
      business_id: businessId,
      name: "Tata Salt 1kg",
      selling_price: 28,
      purchase_price: 24,
      stock: 30,
      low_stock_threshold: 8,
      unit: "packet",
    },
    {
      business_id: businessId,
      name: "Aashirvaad Atta 5kg",
      selling_price: 260,
      purchase_price: 235,
      stock: 8,
      low_stock_threshold: 3,
      unit: "packet",
    },
    {
      business_id: businessId,
      name: "Amul Butter 100g",
      selling_price: 58,
      purchase_price: 52,
      stock: 4,
      low_stock_threshold: 5,
      unit: "pcs",
    },
  ];

  await supabase.from("products").insert(sampleProducts as never);

  // 2. Seed Customers & Vendors
  const { data: customer } = await supabase
    .from("customers")
    .insert({
      business_id: businessId,
      name: "Ramesh Kumar",
      phone: "9876543210",
      notes: "Regular customer",
    } as never)
    .select("id")
    .single();

  const { data: vendor } = await supabase
    .from("vendors")
    .insert({
      business_id: businessId,
      name: "Gupta Wholesale Traders",
      phone: "9811223344",
      notes: "Grocery supplier",
    } as never)
    .select("id")
    .single();

  // 3. Seed Sample Transactions
  const customerId = (customer as { id: string } | null)?.id;
  const vendorId = (vendor as { id: string } | null)?.id;

  const sampleTxns = [
    {
      business_id: businessId,
      type: "sale",
      amount: 2500,
      amount_paid: 0,
      payment_method: "credit",
      customer_id: customerId,
      party_name: "Ramesh Kumar",
      source: "voice",
      ai_confidence: 0.92,
      notes: "Aaj Ramesh ko 2500 ka maal diya",
    },
    {
      business_id: businessId,
      type: "expense",
      amount: 800,
      amount_paid: 800,
      payment_method: "cash",
      category: "fuel",
      source: "voice",
      ai_confidence: 0.88,
      notes: "800 rupaye diesel mein kharch hue",
    },
    {
      business_id: businessId,
      type: "purchase",
      amount: 5000,
      amount_paid: 2000,
      payment_method: "upi",
      vendor_id: vendorId,
      party_name: "Gupta Wholesale Traders",
      source: "manual",
      notes: "Stock purchase",
    },
  ];

  await supabase.from("transactions").insert(sampleTxns as never);
}
