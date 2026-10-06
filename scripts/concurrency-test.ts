// scripts/concurrency-test.ts
import crypto from "crypto";


const API_URL = "http://localhost:3000/api/payment-intents";
// Grab a real session cookie from your browser network tab for testing
const AUTH_COOKIE = "your_local_session_cookie_here"; 


async function runConcurrencyTest() {
  console.log("🚀 Starting Sentinel Concurrency Test...");
  console.log("Goal: Fire 50 simultaneous $10 requests against a $100 limit.");


  // Create 50 simultaneous payment intents
  const requests = Array.from({ length: 50 }).map((_, i) => {
    return fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": AUTH_COOKIE,
      },
      body: JSON.stringify({
        agentId: "your_test_agent_id", 
        amount: 10,
        recipient: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        idempotencyKey: crypto.randomUUID(), // Unique key for each distinct request
      }),
    });
  });


  console.log(`Firing ${requests.length} parallel requests...`);
  const responses = await Promise.all(requests);
  
  let settled = 0;
  let blocked = 0;
  let failed = 0;


  for (const res of responses) {
    if (res.status === 200) settled++;
    else if (res.status === 403) blocked++;
    else failed++;
  }


  console.log("\n📊 Results:");
  console.log(`✅ Settled: ${settled} (Total: $${settled * 10})`);
  console.log(`🛡️ Blocked by Policy Engine: ${blocked}`);
  console.log(`❌ Failed/Errored: ${failed}`);


  if (settled * 10 <= 100) {
    console.log("\n🏆 TEST PASSED: Sentinel successfully prevented a double-spend race condition.");
  } else {
    console.log("\n⚠️ TEST FAILED: Agent overspent its daily limit.");
  }
}


runConcurrencyTest();


