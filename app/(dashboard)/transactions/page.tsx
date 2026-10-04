import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import TransactionsClient from "./transactions-client";


export const dynamic = "force-dynamic";


export default async function TransactionsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  // Securely fetch transactions directly on the server
  const { data: transactionsData } = await supabase
    .from("transactions")
    .select("*")
    .order("createdAt", { ascending: false });


  return <TransactionsClient initialTransactions={transactionsData || []} />;
}


