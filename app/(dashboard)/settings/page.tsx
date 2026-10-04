"use client";

import { Bell, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Button, Badge } from "@/components/ui";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="System / Settings" title="Settings" description="Workspace preferences and security configuration." />
      <div className="space-y-4">
        <section className="panel p-5">
          <div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-violet-300" /><div><div className="font-medium text-white">Workspace</div><div className="text-sm text-muted-foreground">Basic organization details.</div></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Organization" value="Northstar Labs" /><Field label="Default token" value="USD" /></div>
        </section>
        <section className="panel p-5">
          <div className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-violet-300" /><div><div className="font-medium text-white">API access</div><div className="text-sm text-muted-foreground">Use these credentials from your agent runtime.</div></div></div>
          <div className="mt-5 rounded-xl border border-border bg-black/10 p-4"><div className="text-xs text-muted-foreground">Demo API key</div><div className="mt-2 font-mono text-sm text-white">sk_sentinel_demo_••••••••</div><Button className="mt-3 h-8 text-xs">Rotate key</Button></div>
        </section>
        <section className="panel p-5">
          <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-violet-300" /><div><div className="font-medium text-white">Notifications</div><div className="text-sm text-muted-foreground">Choose when Sentinel should alert operators.</div></div></div>
          <div className="mt-5 space-y-3">{["Blocked payment attempts", "Approval requests", "Agent budget warnings"].map((x) => <div key={x} className="flex items-center justify-between rounded-xl border border-border bg-black/10 p-3 text-sm text-white"><span>{x}</span><Badge tone="success">Enabled</Badge></div>)}</div>
        </section>
        <section className="panel p-5"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /><div><div className="font-medium text-white">Tempo integration</div><div className="mt-1 text-sm text-muted-foreground">Testnet adapter is mocked in this frontend. Production integration belongs in the backend transaction executor.</div></div></div></section>
        <Button variant="primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>{saved ? "Saved" : "Save settings"}</Button>
      </div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) { return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><input className="input mt-2" defaultValue={value} /></div>; }