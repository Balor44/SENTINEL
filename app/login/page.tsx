"use client";


import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


  async function handleAuth(action: "login" | "signup") {
    setIsLoading(true);
    setError(null);


    try {
      const { error: authError } = action === "login" 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });


      if (authError) throw authError;


      // Successful auth automatically sets cookies, middleware will route them
      router.push("/overview");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0b12] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-[#0b0b12] p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-glow">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-[0.18em] text-white">SENTINEL</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Multi-Tenant Access</p>
        </div>


        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-400 border border-red-500/20">
            {error}
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full justify-center border border-border" 
              onClick={() => handleAuth("signup")}
              disabled={isLoading}
            >
              Create Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


