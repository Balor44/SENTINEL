import { isAddress, getAddress } from "viem";
import { Agent, PaymentIntent, Transaction } from "@/types/backend";


// Security: Convert JS floats to atomic minor units (cents) to prevent rounding exploits
const toCents = (amount: number): bigint => {
  if (!Number.isFinite(amount) || isNaN(amount)) return 0n;
  return BigInt(Math.round(amount * 100));
};


export function evaluatePayment(
  agent: Agent,
  input: Pick<PaymentIntent, "amount" | "recipient"> & {
    transactions?: Transaction[];
    fleetFrozen?: boolean;
  }
) {
  const trace: string[] = [];


  // 1. Fleet Kill Switch
  if (input.fleetFrozen) {
    return {
      status: "blocked" as const,
      reason: "Sentinel fleet kill switch is active.",
      trace: ["Fleet frozen", "No payment submitted to Tempo"]
    };
  }


  // 2. Agent Status
  if (agent.status !== "active") {
    return {
      status: "blocked" as const,
      reason: `Agent is ${agent.status}.`,
      trace: [`Agent status: ${agent.status}`, "No payment submitted to Tempo"]
    };
  }
  trace.push("Agent active");


  // 3. Amount Limits (Evaluated purely in BigInt cents)
  const inputCents = toCents(input.amount);
  
  if (inputCents <= 0n) {
    return {
      status: "blocked" as const,
      reason: "Payment amount must be greater than zero.",
      trace: [...trace, "Invalid amount", "No payment submitted to Tempo"]
    };
  }


  const txLimitCents = toCents(agent.transactionLimit);
  if (inputCents > txLimitCents) {
    return {
      status: "blocked" as const,
      reason: `Amount exceeds the agent transaction limit of $${agent.transactionLimit}.`,
      trace: [...trace, `Amount $${input.amount} exceeds $${agent.transactionLimit} transaction limit`, `No payment submitted to Tempo`]
    };
  }


  const spentTodayCents = toCents(agent.spentToday);
  const dailyBudgetCents = toCents(agent.dailyBudget);
  if (spentTodayCents + inputCents > dailyBudgetCents) {
    return {
      status: "blocked" as const,
      reason: `Payment would exceed the agent daily budget of $${agent.dailyBudget}.`,
      trace: [...trace, `Daily budget would exceed $${agent.dailyBudget}`, "No payment submitted to Tempo"]
    };
  }


  // 4. Cryptographic Recipient Validation
  if (!isAddress(input.recipient)) {
    return {
      status: "blocked" as const,
      reason: "Invalid recipient wallet address format.",
      trace: [...trace, "Invalid EVM address", "No payment submitted to Tempo"]
    };
  }
  
  const normalizedInputRecipient = getAddress(input.recipient);
  const isAllowed = agent.recipientAllowlist.some(r => 
    isAddress(r) && getAddress(r) === normalizedInputRecipient
  );


  if (!isAllowed) {
    return {
      status: "blocked" as const,
      reason: "Recipient is not on the agent allowlist.",
      trace: [...trace, "Recipient not authorized", "No payment submitted to Tempo"]
    };
  }
  
  trace.push("Recipient authorized", `Within $${agent.transactionLimit} transaction limit`, `Within $${agent.dailyBudget} daily budget`);


  // 5. Anomaly Detection
  const settled = (input.transactions ?? [])
    .filter(t => t.agentId === agent.id && t.status === "settled" && t.amount > 0)
    .slice(0, 20);
    
  if (settled.length > 0) {
    const totalSettledCents = settled.reduce((sum, t) => sum + toCents(t.amount), 0n);
    const averageCents = totalSettledCents / BigInt(settled.length);
    const approvalThresholdCents = toCents(agent.approvalThreshold);
    
    const anomalyThresholdCents = approvalThresholdCents * 150n / 100n > averageCents * 5n 
      ? approvalThresholdCents * 150n / 100n 
      : averageCents * 5n;


    if (inputCents >= anomalyThresholdCents) {
      return {
        status: "blocked" as const,
        reason: "Payment is anomalous for this agent's recent spending behavior.",
        trace: [...trace, `Amount is materially above recent ${settled.length}-payment average`, `Behavioral anomaly detected`, `No payment submitted to Tempo`]
      };
    }
  }


  // 6. Human Approval Gate
  const approvalThresholdCents = toCents(agent.approvalThreshold);
  if (inputCents > approvalThresholdCents) {
    return {
      status: "approval_required" as const,
      reason: `Payment exceeds the autonomous approval threshold of $${agent.approvalThreshold}.`,
      trace: [...trace, `Human approval required above $${agent.approvalThreshold}`]
    };
  }


  return {
    status: "approved" as const,
    reason: "Payment satisfies the agent's active policy.",
    trace: [...trace, "Policy satisfied", "Ready for Tempo settlement"]
  };
}


