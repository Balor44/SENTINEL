import { AppShell } from "@/components/layout";
import { AICopilot } from "@/components/ai-copilot";


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <AICopilot />
    </AppShell>
  );
}


