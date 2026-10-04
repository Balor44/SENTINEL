import { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";


// 1. Extend the default button attributes so TS accepts 'disabled', 'type', etc.
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}


export function Button({
  children,
  variant = "secondary",
  className,
  ...props // 2. Collect all other standard HTML button attributes
}: ButtonProps) {
  const styles = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn border-danger/40 bg-danger/10 text-red-200 hover:bg-danger/20",
    ghost: "border-transparent bg-transparent hover:bg-white/[0.05]",
  };
  
  return (
    <button 
      // 3. Optional: Add a disabled class for better UI feedback when the button is inactive
      className={cn(styles[variant], className, props.disabled && "cursor-not-allowed opacity-50")} 
      {...props} // 4. Spread the collected attributes (like disabled, onClick, type) onto the element
    >
      {children}
    </button>
  );
}


export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "purple";
}) {
  const styles = {
    neutral: "border-white/10 bg-white/[0.04] text-muted-foreground",
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    danger: "border-red-400/20 bg-red-400/10 text-red-300",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    purple: "border-primary/25 bg-primary/10 text-violet-300",
  };
  return <span className={cn("badge", styles[tone])}>{children}</span>;
}


export function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="panel panel-hover p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-white">{value}</div>
      {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}


export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}


export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</div>
    </div>
  );
}