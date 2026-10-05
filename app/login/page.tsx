"use client";


import { useState, Suspense } from "react";
import { ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";


// 1. Move the form logic into its own component
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
 
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/onboarding";


  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


  async function handleAuth(action: "login" | "signup") {
    setIsLoading(true);
    setError(null);
    setSuccess(null);


    try {
      if (action === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;


        if (data.session) {
          setSuccess("Account created successfully! Preparing workspace...");
          setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
          }, 1500);
        } else {
          setSuccess("Account registered! Please check your email to verify.");
          setIsLoading(false); 
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;


        router.push(redirectTo);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  }


  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-[#0b0b12] p-8 shadow-2xl">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-glow">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-[0.18em] text-white">SENTINEL</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Multi-Tenant Access</p>
      </div>


      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
          {error}
        </div>
      )}


      {success && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}


      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Email</label>
          <input
            type="email"
            className="input mt-1.5 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operator@northstar.com"
          />
        </div>
       
        <div>
          <label className="text-xs font-medium text-muted-foreground">Password</label>
          <input
            type="password"
            className="input mt-1.5 w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>


        <div className="mt-6 flex flex-col gap-3">
          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={() => handleAuth("login")}
            disabled={isLoading}
          >
            {isLoading && !success ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
          </Button>
         
          <Button
            variant="ghost"
            className="w-full justify-center border border-border"
            onClick={() => handleAuth("signup")}
            disabled={isLoading}
          >
            {isLoading && success ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Account
          </Button>
        </div>
      </div>
    </div>
  );
}


// 2. Wrap the component containing useSearchParams in a Suspense boundary
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0b12] p-4">
      <Suspense fallback={
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-glow">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}


