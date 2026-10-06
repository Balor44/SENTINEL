import { describe, it, expect } from "vitest";
import { evaluatePayment } from "../lib/policy-engine";
import type { Agent } from "../types";


// A perfectly healthy agent baseline with all required fields satisfied
const baseAgent = {
  id: "agent_123",
  name: "Treasury Bot",
  description: "Test agent for vitest",
  status: "active",
  walletAddress: "0x1234567890123456789012345678901234567890",
  transactionLimit: 100,
  txLimit: 100,
  dailyBudget: 1000,
  dailyLimit: 1000,
  spentToday: 0,
  todaySpend: 0,
  balance: 5000,
  approvalThreshold: 500,
  recipientAllowlist: ["0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
  organization_id: "org_1",
} as Agent;


const validAddress = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const unknownAddress = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";


describe("Sentinel Policy Engine", () => {
  it("✓ allows a perfectly valid payment", () => {
    const decision = evaluatePayment(baseAgent, { amount: 50, recipient: validAddress });
    expect(decision.status).toBe("approved");
  });


  it("✓ respects fleet kill switch", () => {
    const decision = evaluatePayment(baseAgent, { 
      amount: 50, 
      recipient: validAddress, 
      fleetFrozen: true 
    });
    expect(decision.status).toBe("blocked");
    expect(decision.reason).toContain("kill switch is active");
  });


  it("✓ blocks inactive agent", () => {
    const inactiveAgent = { ...baseAgent, status: "paused" as const };
    const decision = evaluatePayment(inactiveAgent, { amount: 50, recipient: validAddress });
    expect(decision.status).toBe("blocked");
    expect(decision.reason).toContain("Agent is paused");
  });


  it("✓ blocks negative or zero amount", () => {
    const decisionZero = evaluatePayment(baseAgent, { amount: 0, recipient: validAddress });
    const decisionNeg = evaluatePayment(baseAgent, { amount: -50, recipient: validAddress });
    
    expect(decisionZero.status).toBe("blocked");
    expect(decisionNeg.status).toBe("blocked");
  });


  it("✓ blocks transaction over limit", () => {
    const decision = evaluatePayment(baseAgent, { amount: 150, recipient: validAddress });
    expect(decision.status).toBe("blocked");
    expect(decision.reason).toContain("exceeds the agent transaction limit");
  });


  it("✓ blocks daily limit violation", () => {
    const exhaustedAgent = { ...baseAgent, spentToday: 980 }; // $20 left
    const decision = evaluatePayment(exhaustedAgent, { amount: 50, recipient: validAddress });
    expect(decision.status).toBe("blocked");
    expect(decision.reason).toContain("exceeds the agent daily budget");
  });


  it("✓ blocks unknown recipient", () => {
    const decision = evaluatePayment(baseAgent, { amount: 50, recipient: unknownAddress });
    expect(decision.status).toBe("blocked");
    expect(decision.reason).toContain("not on the agent allowlist");
  });


  it("✓ requires human approval for large transactions", () => {
    const largeAgent = { ...baseAgent, transactionLimit: 1000, approvalThreshold: 200 };
    const decision = evaluatePayment(largeAgent, { amount: 300, recipient: validAddress });
    expect(decision.status).toBe("approval_required");
  });


  it("✓ detects anomalous payment behavior", () => {
    // Mock history: 10 transactions averaging $5 each
    const recentTxs: any[] = Array(10).fill({ 
      agentId: "agent_123", 
      status: "settled", 
      amount: 5 
    });
    
    // Attempting a $40 payment (8x the average)
    const decision = evaluatePayment(baseAgent, { 
      amount: 40, 
      recipient: validAddress,
      transactions: recentTxs
    });
    
    expect(decision.status).toBe("blocked");
    expect(decision.reason).toContain("anomalous");
  });
});


