// check-address.js
const { privateKeyToAccount } = require('viem/accounts');


const pk = process.env.TEMPO_PRIVATE_KEY;


if (!pk) {
    console.error("No private key found in .env.local!");
    process.exit(1);
}


const account = privateKeyToAccount(pk);
console.log("\n========================================");
console.log("Your Agent's Public Address is:");
console.log(account.address);
console.log("========================================\n");