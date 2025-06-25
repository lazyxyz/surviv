import { randomBytes } from "crypto";
import { ethers } from "ethers";

import * as dotenv from 'dotenv';
import { CRATE_DURATION, saveCrateClaim } from "./crateController";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CrateTier = { Tactical: 0 };

const TOTAL_WEIGHT = 10000;

// Configuration for crate amounts based on rank
const AMOUNT_CONFIG: { [key: number]: { amount: number; probability: number }[] } = {
  1: [
    { amount: 3, probability: 5000 }, // 50%
    { amount: 5, probability: 5000 }, // 50%
  ],
  2: [{ amount: 2, probability: 10000 }], // 100%
  3: [
    { amount: 1, probability: 5000 }, // 50%
    { amount: 2, probability: 5000 }, // 50%
  ],
  4: [{ amount: 1, probability: 10000 }], // 100%
  5: [{ amount: 1, probability: 5000 }], // 50%
};

export async function saveRanks(address: string, rank: number, teamMode: boolean, gameId: number) {

  rank = 1; // For testing
  // Testnet top 5 receive rewards
  if (rank > 5) {
    throw new Error("Only top #5 receives crates");
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
  if (!process.env.CHAIN_ID || !process.env.SURVIV_REWARDS) {
    throw new Error("CHAIN_ID or SURVIV_REWARDS not set in environment variables");
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
    verifyingContract: process.env.SURVIV_REWARDS,
  };

  // Set tier to Tactical
  const selectedTier = CrateTier.Tactical;

  // Determine amount based on rank configuration
  const rankConfig = AMOUNT_CONFIG[rank];
  const randomAmount = Math.floor(Math.random() * TOTAL_WEIGHT);
  let cumulativeAmount = 0;
  let amount = 1; // Default to 1 if no config found
  for (let config of rankConfig) {
    if (randomAmount < (cumulativeAmount += config.probability)) {
      amount = config.amount;
      break;
    }
  }

  const expiry = Math.floor(Date.now() / 1000) + CRATE_DURATION;

  // Generate random salt
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