import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { saveCrateClaim } from "@api/crate";

import * as dotenv from 'dotenv';
dotenv.config();

const CrateTier = { Drop: 0, Tactical: 1, Immortal: 2 };

// Probability weights (out of 10000 for 2 decimal precision)
const CRATE_PROBABILITIES = {
  Drop: 6000, // 60%
  Tactical: 3800, // 38%
  Immortal: 200, // 2%
};
const TOTAL_WEIGHT = 10000;
const AMOUNT_PROBABILITIES = {
  One: 9000, // 90% for 1 crate
  Two: 1000, // 10% for 2 crates
};

export async function saveRanks(address: string, rank: number, teamMode: boolean, gameId: number) {
  // Only process for top 1 player
  if (rank !== 1) {
    throw new Error("Only top 1 player receives crates");
  }

  // Validate address
  if (!ethers.isAddress(address)) {
    throw new Error("Invalid Ethereum address");
  }

  // Load admin private key from environment
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!adminPrivateKey) {
    throw new Error("ADMIN_PRIVATE_KEY not set in environment variables");
  }
  const admin = new ethers.Wallet(adminPrivateKey);

  // Ensure environment variables are set
  if (!process.env.CHAIN_ID || !process.env.SURVIV_CRATE_BASE) {
    throw new Error("CHAIN_ID or SURVIV_CRATE_BASE not set in environment variables");
  }

  const TYPES = {
    CrateClaim: [
      { name: "to", type: "address" },
      { name: "tier", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "salt", type: "bytes32" },
      { name: "expiry", type: "uint256" },
    ],
  };

  const DOMAIN = {
    name: "SurvivFun",
    version: "1",
    chainId: Number(process.env.CHAIN_ID),
    verifyingContract: process.env.SURVIV_CRATE_BASE,
  };

  // Generate random number for crate tier selection
  const randomTier = Math.floor(Math.random() * TOTAL_WEIGHT);
  let selectedTier: number;
  let cumulative = 0;

  if (randomTier < (cumulative += CRATE_PROBABILITIES.Drop)) {
    selectedTier = CrateTier.Drop;
  } else if (randomTier < (cumulative += CRATE_PROBABILITIES.Tactical)) {
    selectedTier = CrateTier.Tactical;
  } else {
    selectedTier = CrateTier.Immortal;
  }

  // Generate random number for amount selection
  const randomAmount = Math.floor(Math.random() * TOTAL_WEIGHT);
  const amount = randomAmount < AMOUNT_PROBABILITIES.One ? 1 : 2;
  const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

  // Generate salt
  const salt = "0x" + randomBytes(32).toString("hex");

  const crate = {
    to: address,
    tier: selectedTier,
    amount,
    salt,
    expiry,
  };

  // Sign the typed data
  const signature = await admin.signTypedData(DOMAIN, TYPES, crate);

  // Save to MongoDB via @api/crate
  await saveCrateClaim(crate, signature, rank, teamMode, gameId);

  return { crate, signature };
}

// export async function saveRanks(address: string, rank: number, teamMode: boolean, gameId: number) {
//   await saveCrateClaim({
//     "to": "0x1234567890abcdef1234567890abcdef12345678",
//     "tier": 0,
//     "amount": 1,
//     "salt": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
//     "expiry": 1745080080
//   },
//     "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f",
//     1,
//     false,
//     1001,
//   ).catch(err => {
//     console.log("Err: ", err);
//   })
// };