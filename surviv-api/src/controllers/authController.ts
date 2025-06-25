import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'SURVIV.FUN';
const TOKEN_DURATION = '2d'; // JWT expires in 2 days
const NONCE_VALIDITY = 24 * 60 * 60 * 1000; // 1 day in milliseconds

// Nonce and expiration management
let NONCE = uuidv4(); // Initialize with a UUID
let nonceExpiration = Date.now() + NONCE_VALIDITY; // Set initial expiration

// Function to check and renew nonce if expired
function renewNonceIfExpired(): void {
    const now = Date.now();
    if (now >= nonceExpiration) {
        NONCE = uuidv4(); // Generate new UUID
        nonceExpiration = now + NONCE_VALIDITY; // Set new expiration
    }
}

// Generate the current nonce
export const requestNonce = (req: Request, res: Response): void => {
    res.json({ success: true, nonce: NONCE });
};

interface VerifyRequestBody {
    walletAddress: string;
    signature: string;
}

export const verifySignature = (req: Request<{}, {}, VerifyRequestBody>, res: Response): void => {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
        res.status(400).json({ success: false, error: 'Invalid wallet address' });
        return;
    }

    if (!signature) {
        res.status(400).json({ success: false, error: 'Signature is required' });
        return;
    }

    if (NONCE.length !== 36) {
        res.status(400).json({ success: false, error: 'Invalid nonce length' });
        return;
    }

    try {
        const recoveredAddress = ethers.verifyMessage(NONCE, signature);
        if (recoveredAddress.toLowerCase() === walletAddress.toLowerCase()) {
            const token = jwt.sign(
                { walletAddress, jti: uuidv4() }, // Include jti for token uniqueness
                JWT_SECRET,
                { expiresIn: TOKEN_DURATION, issuer: 'surviv.fun' }
            );
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, error: 'Signature verification failed' });
        }
    } catch (err) {
        res.status(400).json({ success: false, error: 'Invalid request payload' });
    }
};

export const validateJWT = (token: string): { walletAddress: string; jti: string } | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as { walletAddress: string; jti: string };
    } catch {
        return null;
    }
};

// Periodically check for nonce expiration (every day)
setInterval(renewNonceIfExpired, 24 * 60 * 60 * 1000);