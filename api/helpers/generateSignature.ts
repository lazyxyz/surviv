import { ethers } from "ethers";

// Step 1: Generate a new wallet
const wallet = ethers.Wallet.fromPhrase("first front resource can satisfy below potato detail cushion once caught horn");
console.log("Wallet Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);

// Step 2: Message to be signed (Nonce)
const nonce: string = "986d64ca-989e-465f-ba8f-2b52748bc1b2";
console.log("Nonce:", nonce);

// Step 3: Sign the message
(async () => {
    try {
        const signature: string = await wallet.signMessage(nonce);
        console.log("Signature:", signature);
    } catch (error) {
        console.error("Error signing message:", error);
    }
})();
