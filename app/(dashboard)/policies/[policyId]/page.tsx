import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PolicyEditor from "./policy-editor";


export const dynamic = "force-dynamic";


export default async function PolicyDetailPage({ params }: { params: Promise<{ policyId: string }> }) {
  const resolvedParams = await params;
  const policyId = resolvedParams.policyId; 


  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  const { data: policy } = await supabase
    .from("policies")
    .select("*")
    .eq("id", policyId)
    .single();


  if (!policy) {
    notFound(); 
  }


  return <PolicyEditor policy={policy} />;
}


