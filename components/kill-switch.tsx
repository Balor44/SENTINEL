"use client";


import { useState } from "react";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";


export function KillSwitch({ isFrozen, canEdit }: { isFrozen: boolean; canEdit: boolean }) {
  const [frozen, setFrozen] = useState(isFrozen);
  const [isLoading, setIsLoading] = useState(false);


  if (!canEdit) return null; // Hide from viewers


  const handleToggle = async () => {
    if (!frozen && !confirm("EMERGENCY PROTOCOL: This will instantly freeze all autonomous agent spending across the entire organization. Are you sure?")) {
      return;
    }


    setIsLoading(true);
    try {
      const res = await fetch("/api/fleet/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeze: !frozen }),
      });
      
      if (res.ok) {
        setFrozen(!frozen);
        window.location.reload(); // Refresh dashboard data securely
      } else {
        alert("Failed to toggle kill switch");
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Button 
      variant={frozen ? "secondary" : "danger"} 
      onClick={handleToggle}
      disabled={isLoading}
      className={frozen ? "border-emerald-500/50 text-emerald-400" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : frozen ? (
        <ShieldCheck className="mr-2 h-4 w-4" />
      ) : (
        <ShieldAlert className="mr-2 h-4 w-4" />
      )}
      {frozen ? "Unfreeze Fleet" : "EMERGENCY: Freeze Fleet"}
    </Button>
  );
}


