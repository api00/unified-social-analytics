import DashboardShell from "../components/DashboardShell";
import { hasPublicSupabaseEnv } from "../lib/env";
import { createSupabaseServerClient, ensureUserProfile } from "../lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (user) await ensureUserProfile(user);

  return (
    <DashboardShell
      initialUser={
        user
          ? {
              id: user.id,
              email: user.email ?? "",
              name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Creator",
              avatarUrl: user.user_metadata?.avatar_url ?? null,
            }
          : null
      }
      supabaseConfigured={hasPublicSupabaseEnv()}
    />
  );
}
