import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { HttpResponse, TemplatedApp } from "uWebSockets.js";

import dotenv from "dotenv";
import { resolve } from "path";
const envPath = resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

const JWT_SECRET = process.env.JWT_SECRET || "SURVIV.FUN";
const TOKEN_DURATION = "7d";

function setCORSHeaders(res: HttpResponse) {
    res.writeHeader("Access-Control-Allow-Origin", "*");
    res.writeHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.writeHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function requestNonce(app: TemplatedApp) {
    app.get("/api/requestNonce", (res) => {
        setCORSHeaders(res);

        const nonce = uuidv4(); // Generate a new nonce
        res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: true, nonce }));
    });
}

export function verifySignature(app: TemplatedApp) {
    app.post("/api/verifySignature", (res) => {
        setCORSHeaders(res);

        let aborted = false;
        res.onAborted(() => {
            aborted = true;
        });

        res.onData((data) => {
            if (aborted) return;

            try {
                const { walletAddress, signature, nonce } = JSON.parse(Buffer.from(data).toString());

                // Validate inputs
                if (!walletAddress || !ethers.isAddress(walletAddress)) {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Invalid wallet address" }));
                    return;
                }

                if (!signature || !nonce) {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Signature and nonce are required" }));
                    return;
                }

                if (nonce.length < 36) {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Invalid nonce length" }));
                    return;
                }

                // Verify signature
                const recoveredAddress = ethers.verifyMessage(nonce, signature);
                if (recoveredAddress.toLowerCase() === walletAddress.toLowerCase()) {
                    // Generate JWT
                    const token = jwt.sign(
                        { walletAddress },
                        JWT_SECRET,
                        { expiresIn: TOKEN_DURATION }
                    );

                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: true, token }));
                } else {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Signature verification failed" }));
                }
            } catch (err) {
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Invalid request payload" }));
            }
        });
    });
}

export function validateJWT(token: string): { walletAddress: string } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { walletAddress: string };
    } catch {
        return null;
    }
}