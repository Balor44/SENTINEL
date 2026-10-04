import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";


// Generate a fresh, random private key
const privateKey = generatePrivateKey();


// Derive the public address from it
const account = privateKeyToAccount(privateKey);


console.log("Paste these straight into your .env.local:\n");
console.log(`TEMPO_PRIVATE_KEY=${privateKey}`);
console.log(`NEXT_PUBLIC_SERVICE_ADDRESS=${account.address}`);


