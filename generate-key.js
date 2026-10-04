"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var accounts_1 = require("viem/accounts");
// Generate a fresh, random private key
var privateKey = (0, accounts_1.generatePrivateKey)();
// Derive the public address from it
var account = (0, accounts_1.privateKeyToAccount)(privateKey);
console.log("Paste these straight into your .env.local:\n");
console.log("TEMPO_PRIVATE_KEY=".concat(privateKey));
console.log("NEXT_PUBLIC_SERVICE_ADDRESS=".concat(account.address));
