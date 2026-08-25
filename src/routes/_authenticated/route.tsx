import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";

import { EntryProvider } from "@/components/app/EntryProvider";
import { supabase } from "@/integrations/supabase/client";

const mockUser: User = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "demo@vyapaar.local",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getUser();
      return { user: data?.user ?? mockUser };
    } catch {
      return { user: mockUser };
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <EntryProvider>
      <Outlet />
    </EntryProvider>
  );
}

