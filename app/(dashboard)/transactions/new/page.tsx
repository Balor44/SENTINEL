import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import TransactionForm from "./transaction-form";
import { PageHeader } from "@/components/page-header";


export const dynamic = "force-dynamic";


export default async function NewTransactionPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  // Fetch only this user's active agents to populate the dropdown
  const { data: agentsData } = await supabase
    .from("agents")
    .select("id, name, balance, dailyLimit, spentToday")
    .eq("status", "active");


  const agents = agentsData || [];


  return (
    <div>
      <PageHeader
        eyebrow="Workspace / Transactions"
        title="Execute Transaction"
        description="Trigger an autonomous transfer on the Tempo Moderato testnet."
      />
      <div className="mt-6">
        <TransactionForm agents={agents} />
      </div>
    </div>
  );
}


