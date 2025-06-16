import mongoose, { Schema, model, Document } from 'mongoose';
import { HttpResponse, TemplatedApp } from "uWebSockets.js";
import * as dotenv from 'dotenv';
import { ethers } from "ethers";
import { validateJWT } from './auth';
dotenv.config();

// Interface for CrateClaim document
interface ICrateClaim extends Document {
  crate: {
    to: string;
    tier: number;
    amount: number;
    salt: string;
    expiry: number;
  };
  signature: string;
  rank: number;
  teamMode: boolean;
  gameId: number;
  createdAt: Date;
}

// MongoDB Schema for CrateClaim
const CrateClaimSchema = new Schema<ICrateClaim>({
  crate: {
    to: { type: String, required: true, lowercase: true, index: true },
    tier: { type: Number, required: true, enum: [0, 1, 2] },
    amount: { type: Number, required: true, min: 1 },
    salt: { type: String, required: true },
    expiry: { type: Number, required: true },
  },
  signature: { type: String, required: true, unique: true },
  rank: { type: Number, required: true },
  teamMode: { type: Boolean, required: true },
  gameId: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // TTL index: delete after 24 hours
});

// Create or reuse model
const CrateClaimModel = mongoose.models.CrateClaim || model<ICrateClaim>('CrateClaim', CrateClaimSchema);

// Initialize MongoDB connection
async function connectToMongoDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return; // Already connected
  }
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/survivfun";
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
}

// Save a CrateClaim to MongoDB
export async function saveCrateClaim(
  crate: { to: string; tier: number; amount: number; salt: string; expiry: number },
  signature: string,
  rank: number,
  teamMode: boolean,
  gameId: number
): Promise<void> {
  await connectToMongoDB();

  try {
    const claimDoc = new CrateClaimModel({
      crate,
      signature,
      rank,
      teamMode,
      gameId,
    });
    await claimDoc.save();
  } catch (error: any) {
    if (error.code === 11000) {
      throw new Error("Signature already exists in database");
    }
    throw new Error(`Failed to save claim to MongoDB: ${error.message}`);
  }
}


// Retrieve CrateClaims by address
export async function getCrateClaimsByAddress(address: string): Promise<ICrateClaim[]> {
  await connectToMongoDB();
  return CrateClaimModel.find({ 'crate.to': address }).exec();
}

function setCORSHeaders(res: HttpResponse) {
  res.writeHeader("Access-Control-Allow-Origin", "*");
  res.writeHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.writeHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function getCrates(app: TemplatedApp) {
  app.get("/api/getCrates", (res, req) => {
    setCORSHeaders(res);

    let aborted = false;
    res.onAborted(() => {
      aborted = true;
    });

    const authHeader = req.getHeader("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      if (!aborted) {
        res.writeHeader("Content-Type", "application/json").end(
          JSON.stringify({ success: false, error: "Authorization header missing or invalid" })
        );
      }
      return;
    }

    const token = authHeader.substring(7);
    const payload = validateJWT(token);

    if (!payload || !ethers.isAddress(payload.walletAddress)) {
      if (!aborted) {
        res.writeHeader("Content-Type", "application/json").end(
          JSON.stringify({ success: false, error: "Invalid or expired JWT" })
        );
      }
      return;
    }

    // Async work should be in a separate function
    (async () => {
      try {
        const claims = await getCrateClaimsByAddress(payload.walletAddress);
        const formattedClaims = claims.map((claim) => ({
          crate: claim.crate,
          signature: claim.signature,
          rank: claim.rank,
          teamMode: claim.teamMode,
          gameId: claim.gameId,
          createdAt: claim.createdAt,
        }));

        if (!aborted) {
          res.writeHeader("Content-Type", "application/json").end(
            JSON.stringify({ success: true, claims: formattedClaims })
          );
        }
      } catch (err) {
        if (!aborted) {
          res.writeHeader("Content-Type", "application/json").end(
            JSON.stringify({ success: false, error: "Failed to fetch crates" })
          );
        }
      }
    })();
  });
}
