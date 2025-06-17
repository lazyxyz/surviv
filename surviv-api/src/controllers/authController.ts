import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'SURVIV.FUN';
const TOKEN_DURATION = '7d';

interface NonceRequestBody {
    walletAddress: string;
    signature: string;
    nonce: string;
}

export const requestNonce = (req: Request, res: Response): void => {
    const nonce = uuidv4();
    res.json({ success: true, nonce });
};

export const verifySignature = (req: Request<{}, {}, NonceRequestBody>, res: Response): void => {
    const { walletAddress, signature, nonce } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
        res.status(400).json({ success: false, error: 'Invalid wallet address' });
        return;
    }

    if (!signature || !nonce) {
        res.status(400).json({ success: false, error: 'Signature and nonce are required' });
        return;
    }

    if (nonce.length < 36) {
        res.status(400).json({ success: false, error: 'Invalid nonce length' });
        return;
    }

    try {
        const recoveredAddress = ethers.verifyMessage(nonce, signature);
        if (recoveredAddress.toLowerCase() === walletAddress.toLowerCase()) {
            const token = jwt.sign({ walletAddress }, JWT_SECRET, { expiresIn: TOKEN_DURATION });
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, error: 'Signature verification failed' });
        }
    } catch (err) {
        res.status(400).json({ success: false, error: 'Invalid request payload' });
    }
};

export const validateJWT = (token: string): { walletAddress: string } | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as { walletAddress: string };
    } catch {
        return null;
    }
};