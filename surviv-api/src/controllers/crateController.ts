import { Request, Response } from 'express';
import mongoose, { Schema, model } from 'mongoose';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { validateJWT } from './authController';
import { Crate, CrateClaim } from '../types';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const CRATE_DURATION = 604800; // 7 days

const CrateClaimSchema = new Schema<CrateClaim>({
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
    createdAt: { type: Date, default: Date.now, expires: CRATE_DURATION },
});

const CrateClaimModel = mongoose.models.CrateClaim || model<CrateClaim>('CrateClaim', CrateClaimSchema);

async function connectToMongoDB(): Promise<void> {
    if (mongoose.connection.readyState === 1) return;
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/survivfun';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}

export async function saveCrateClaim(
    crate: Crate,
    signature: string,
    rank: number,
    teamMode: boolean,
    gameId: number
): Promise<void> {
    await connectToMongoDB();
    try {
        const claimDoc = new CrateClaimModel({ crate, signature, rank, teamMode, gameId });
        await claimDoc.save();
    } catch (error: any) {
        if (error.code === 11000) {
            throw new Error('Signature already exists in database');
        }
        throw new Error(`Failed to save claim to MongoDB: ${error.message}`);
    }
}

export const getCrates = async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Authorization header missing or invalid' });
        return;
    }

    const token = authHeader.substring(7);
    const payload = validateJWT(token);
    if (!payload || !ethers.isAddress(payload.walletAddress)) {
        res.status(401).json({ success: false, error: 'Invalid or expired JWT' });
        return;
    }

    try {
        await connectToMongoDB();
        const claims = await CrateClaimModel.find({ 'crate.to': payload.walletAddress.toLowerCase() }).exec();

        const formattedClaims = claims.map((claim) => ({
            crate: claim.crate,
            signature: claim.signature,
            rank: claim.rank,
            teamMode: claim.teamMode,
            gameId: claim.gameId,
            createdAt: claim.createdAt,
        }));

        res.json({ success: true, claims: formattedClaims });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch crates' });
    }
};

export const removeCrates = async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Authorization header missing or invalid' });
        return;
    }

    const token = authHeader.substring(7);
    const payload = validateJWT(token);
    if (!payload || !ethers.isAddress(payload.walletAddress)) {
        res.status(401).json({ success: false, error: 'Invalid or expired JWT' });
        return;
    }

    const { signatures } = req.body;
    if (!signatures || !Array.isArray(signatures) || signatures.length === 0 || !signatures.every(sig => typeof sig === 'string')) {
        res.status(400).json({ success: false, error: 'Signatures must be a non-empty array of strings' });
        return;
    }

    try {
        await connectToMongoDB();
        const result = await CrateClaimModel.deleteMany({
            signature: { $in: signatures },
            'crate.to': payload.walletAddress.toLowerCase()
        }).exec();

        if (result.deletedCount === 0) {
            res.status(404).json({ success: false, error: 'No crates found or not owned by user' });
            return;
        }

        res.json({ success: true, message: `${result.deletedCount} crate(s) removed successfully` });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to remove crates' });
    }
};