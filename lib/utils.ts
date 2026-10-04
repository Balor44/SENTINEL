export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function money(value: number | undefined | null, digits = 2) {
  const safe = Number(value ?? 0);
  return `$${safe.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function shortenAddress(value: string) {
  if (!value) return "";
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

export function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}