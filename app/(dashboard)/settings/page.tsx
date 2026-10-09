"use client";


import { useState, useEffect } from "react";
import { 
  Bell, 
  KeyRound, 
  ShieldCheck, 
  UserRound, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Activity
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { createBrowserClient } from "@supabase/ssr";


interface NotificationSettings {
  blockedPayments: boolean;
  approvalRequests: boolean;
  budgetWarnings: boolean;
}


export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);


  // Profile & Workspace state
  const [orgName, setOrgName] = useState("");
  const [defaultToken, setDefaultToken] = useState("pathUSD");
  const [controllerEmail, setControllerEmail] = useState("Loading...");


  // API Key state
  const [apiKey, setApiKey] = useState("sk_sentinel_live_79a2f48c1e90b4d5");


  // Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>({
    blockedPayments: true,
    approvalRequests: true,
    budgetWarnings: false,
  });


  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


  // Fetch real user data and load saved preferences on mount
  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setControllerEmail(user.email);
      } else {
        setControllerEmail("Unknown User");
      }
    }
    fetchUser();


    const cachedOrg = localStorage.getItem("sentinel_org");
    const cachedToken = localStorage.getItem("sentinel_token");
    const cachedKey = localStorage.getItem("sentinel_api_key");
    const cachedNotifs = localStorage.getItem("sentinel_notifs");


    if (cachedOrg) {
      setOrgName(cachedOrg);
    } else {
      setOrgName("My Workspace"); // Drops the generic Northstar Labs
    }
    
    if (cachedToken) setDefaultToken(cachedToken);
    if (cachedKey) setApiKey(cachedKey);
    if (cachedNotifs) {
      try {
        setNotifications(JSON.parse(cachedNotifs));
      } catch {}
    }
  }, [supabase.auth]);


  const handleRotateKey = () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const newKey = `sk_sentinel_live_${randomHex}`;
    setApiKey(newKey);
    localStorage.setItem("sentinel_api_key", newKey);
  };


  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("sentinel_notifs", JSON.stringify(next));
      return next;
    });
  };


  const handleSave = () => {
    localStorage.setItem("sentinel_org", orgName);
    localStorage.setItem("sentinel_token", defaultToken);
    localStorage.setItem("sentinel_api_key", apiKey);
    localStorage.setItem("sentinel_notifs", JSON.stringify(notifications));


    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };


  const maskedKey = apiKey.slice(0, 16) + "•".repeat(16);


  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="eyebrow mb-2">System / Settings</div>
          <h1 className="page-title">Settings & Profile</h1>
          <p className="subtle mt-2 max-w-2xl">Operator profile, workspace preferences, and real-time security configuration.</p>
        </div>
      </div>


      <div className="space-y-4">
        {/* Operator Profile Section */}
        <section className="panel p-5">
          <div className="flex items-center gap-3">
            <UserRound className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="font-medium text-white">Financial Controller Profile</div>
              <div className="text-sm text-muted-foreground">Authenticated operator credentials and access tier.</div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Operator Email</label>
              <input 
                className="input mt-2 bg-black/40 text-muted-foreground cursor-not-allowed" 
                value={controllerEmail}
                readOnly
                title="Email is locked to your authenticated session"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Role Clearance</label>
              <div className="mt-2 flex h-10 items-center px-3 rounded-lg border border-border bg-black/20 text-sm text-emerald-400 font-mono">
                Fleet Lead Commander
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Security Clearance</label>
              <div className="mt-2 flex h-10 items-center justify-between px-3 rounded-lg border border-border bg-black/20 text-sm">
                <span className="text-white">Tier 3 (Automated Execution)</span>
                <Badge tone="success">Verified</Badge>
              </div>
            </div>
          </div>
        </section>


        {/* Workspace Preferences */}
        <section className="panel p-5">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-violet-300" />
            <div>
              <div className="font-medium text-white">Workspace Configuration</div>
              <div className="text-sm text-muted-foreground">Settlement token and organization defaults.</div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Organization</label>
              <input 
                className="input mt-2" 
                value={orgName} 
                onChange={(e) => setOrgName(e.target.value)} 
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Settlement Currency</label>
              <input 
                className="input mt-2 font-mono" 
                value={defaultToken} 
                onChange={(e) => setDefaultToken(e.target.value)} 
              />
            </div>
          </div>
        </section>


        {/* Dynamic API Key Section */}
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-violet-300" />
              <div>
                <div className="font-medium text-white">Sentinel API Access</div>
                <div className="text-sm text-muted-foreground">Use this credential to command agents via external webhooks or bots.</div>
              </div>
            </div>
            <Badge tone="success">Active</Badge>
          </div>


          <div className="mt-5 rounded-xl border border-border bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Live Secret Key</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showKey ? "Hide" : "Reveal"}
                </button>
              </div>
            </div>


            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-black/40 px-3 py-2">
              <span className="font-mono text-sm text-white select-all">
                {showKey ? apiKey : maskedKey}
              </span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>


            <div className="mt-4 flex items-center gap-3">
              <Button onClick={handleRotateKey} className="h-8 gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" />
                Rotate key
              </Button>
              <span className="text-xs text-muted-foreground">
                Rotating invalidates any external bots using the previous key.
              </span>
            </div>
          </div>
        </section>


        {/* Notification Preferences */}
        <section className="panel p-5">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-violet-300" />
            <div>
              <div className="font-medium text-white">Trigger Notifications</div>
              <div className="text-sm text-muted-foreground">Choose what fleet events alert the controller dashboard.</div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div 
              onClick={() => toggleNotification("blockedPayments")}
              className="flex items-center justify-between rounded-xl border border-border bg-black/10 p-3 text-sm text-white cursor-pointer hover:bg-black/20 transition-colors"
            >
              <span>Blocked payment attempts</span>
              <Badge tone={notifications.blockedPayments ? "success" : "neutral"}>
                {notifications.blockedPayments ? "Enabled" : "Disabled"}
              </Badge>
            </div>


            <div 
              onClick={() => toggleNotification("approvalRequests")}
              className="flex items-center justify-between rounded-xl border border-border bg-black/10 p-3 text-sm text-white cursor-pointer hover:bg-black/20 transition-colors"
            >
              <span>Approval requests</span>
              <Badge tone={notifications.approvalRequests ? "success" : "neutral"}>
                {notifications.approvalRequests ? "Enabled" : "Disabled"}
              </Badge>
            </div>


            <div 
              onClick={() => toggleNotification("budgetWarnings")}
              className="flex items-center justify-between rounded-xl border border-border bg-black/10 p-3 text-sm text-white cursor-pointer hover:bg-black/20 transition-colors"
            >
              <span>Agent budget warnings</span>
              <Badge tone={notifications.budgetWarnings ? "success" : "neutral"}>
                {notifications.budgetWarnings ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </section>


        {/* Settlement Layer Integration */}
        <section className="panel p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400 mt-0.5" />
            <div className="w-full">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white">Tempo Moderato Integration</div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Testnet Connected (Chain ID 42431)
                </div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Autonomous agent policy breaches and escrow creations settle via the Moderato execution adapter.
              </div>
            </div>
          </div>
        </section>


        {/* Save Bar */}
        <div className="flex items-center gap-4 pt-2 pb-6">
          <Button 
            variant="primary" 
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white min-w-[120px]"
          >
            {saved ? "Saved" : "Save settings"}
          </Button>
          {saved && (
            <span className="text-xs text-emerald-400 animate-fade-in flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Workspace preferences updated
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


