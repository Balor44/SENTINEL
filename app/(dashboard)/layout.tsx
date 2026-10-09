import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AppShell } from "@/components/layout";
import { AICopilot } from "@/components/ai-copilot";


export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Dashboard pages require finished onboarding. Same lookup the /api/setup route uses.
  const { data: state } = await supabase
    .from("app_state")
    .select("setup")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!state?.setup?.onboardingComplete) redirect("/onboarding");

  return (
    <AppShell>
      {children}
      <AICopilot />
    </AppShell>
  );
}
