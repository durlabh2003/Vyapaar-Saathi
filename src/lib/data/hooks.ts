import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Business, Party, Product, Transaction, TxnType } from "@/lib/business/constants";
import { daysAgo } from "@/lib/format";
import { enqueue, flush } from "./offlineQueue";

const TXN_COLUMNS =
  "id,business_id,type,amount,amount_paid,payment_method,category,customer_id,vendor_id,party_name,notes,occurred_at,source,ai_confidence,created_at";

export function useBusiness() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["business", session?.user?.id ?? user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let query = supabase.from("businesses").select("*");
      if (session?.user?.id) {
        query = query.eq("owner_id", session.user.id);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Business | null) ?? null;
    },
  });
}

export function useTransactions(businessId?: string, options?: { days?: number; limit?: number }) {
  const days = options?.days ?? 120;
  const limit = options?.limit ?? 800;
  return useQuery({
    queryKey: ["transactions", businessId, days, limit],
    enabled: !!businessId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(TXN_COLUMNS)
        .eq("business_id", businessId!)
        .gte("occurred_at", daysAgo(days).toISOString())
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Transaction[];
    },
  });
}

export function useCustomers(businessId?: string) {
  return useQuery({
    queryKey: ["customers", businessId],
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,business_id,name,phone,notes,created_at")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Party[];
    },
  });
}

export function useVendors(businessId?: string) {
  return useQuery({
    queryKey: ["vendors", businessId],
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id,business_id,name,phone,notes,created_at")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Party[];
    },
  });
}

export function useProducts(businessId?: string) {
  return useQuery({
    queryKey: ["products", businessId],
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

export function useReminders(businessId?: string) {
  return useQuery({
    queryKey: ["reminders", businessId],
    enabled: !!businessId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("business_id", businessId!)
        .eq("is_done", false)
        .order("due_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type NewTransaction = {
  business_id: string;
  type: TxnType;
  amount: number;
  amount_paid: number;
  payment_method?: string | null;
  category?: string | null;
  customer_id?: string | null;
  vendor_id?: string | null;
  party_name?: string | null;
  notes?: string | null;
  occurred_at?: string;
  source?: "voice" | "manual";
  ai_confidence?: number | null;
};

async function insertTransaction(row: Record<string, unknown>) {
  const { error } = await supabase.from("transactions").insert(row as never);
  if (error) throw error;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTransaction) => {
      const row = { ...input, occurred_at: input.occurred_at ?? new Date().toISOString() };
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueue(row);
        return { queued: true as const };
      }
      try {
        await insertTransaction(row);
        return { queued: false as const };
      } catch (error) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          enqueue(row);
          return { queued: true as const };
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function flushQueuedTransactions() {
  return flush(insertTransaction);
}

export function useCreateParty(kind: "customers" | "vendors") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { business_id: string; name: string; phone?: string | null }) => {
      const { data, error } = await supabase
        .from(kind)
        .insert(input as never)
        .select("id,business_id,name,phone,notes,created_at")
        .single();
      if (error) throw error;
      return data as Party;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [kind] }),
  });
}

export function useUpdateParty(kind: "customers" | "vendors") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Party> & { id: string }) => {
      const { error } = await supabase
        .from(kind)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [kind] }),
  });
}

export function useDeleteParty(kind: "customers" | "vendors") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(kind).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [kind] });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Product> & { business_id: string; name: string }) => {
      const { error } = await supabase.from("products").insert(input as never);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      business_id: string;
      customer_id?: string | null;
      vendor_id?: string | null;
      amount?: number | null;
      due_at: string;
      note?: string | null;
    }) => {
      const { error } = await supabase.from("reminders").insert(input as never);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").update({ is_done: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

/** Find an existing party by name (case-insensitive) or create it. */
export async function resolveParty(
  kind: "customers" | "vendors",
  businessId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from(kind)
    .select("id,name")
    .eq("business_id", businessId)
    .ilike("name", trimmed)
    .limit(1);
  if (existing?.[0]) return existing[0] as { id: string; name: string };

  const { data, error } = await supabase
    .from(kind)
    .insert({ business_id: businessId, name: trimmed } as never)
    .select("id,name")
    .single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Product> & { id: string }) => {
      const { error } = await supabase
        .from("products")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Business> & { id: string }) => {
      const { error } = await supabase
        .from("businesses")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business"] }),
  });
}
