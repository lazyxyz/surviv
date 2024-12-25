import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { TemplatedApp } from "uWebSockets.js";

// Secret for signing JWTs (use environment variables in production)
const JWT_SECRET = "your-very-secure-secret";
const TOKEN_DURATION = "7d";

// Store nonces temporarily
const nonces = new Map<string, string>();

export function requestNonce(app: TemplatedApp) {
    app.post("/api/requestNonce", (res) => {
        let aborted = false;
        res.onAborted(() => {
            aborted = true;
        });

        res.onData((data) => {
            if (aborted) return;

            try {
                // Parse JSON body
                const { walletAddress } = JSON.parse(Buffer.from(data).toString());

                // Validate wallet address
                if (!walletAddress || !ethers.isAddress(walletAddress)) {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Invalid wallet address" }));
                    return;
                }

                // Generate and store nonce
                const nonce = uuidv4();
                nonces.set(walletAddress.toLowerCase(), nonce);

                // Respond with success
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: true, nonce }));
            } catch (err) {
                // Handle JSON parsing errors
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Invalid JSON payload" }));
            }
        });
    });
}

export function verifySignature(app: TemplatedApp) {
    app.post("/api/verifySignature", (res) => {
        let aborted = false;
        res.onAborted(() => {
            aborted = true;
        });

        res.onData((data) => {
            if (aborted) return;

            try {
                // Parse JSON body
                const { walletAddress, signature } = JSON.parse(Buffer.from(data).toString());

                // Validate inputs
                if (!walletAddress || !ethers.isAddress(walletAddress) || !signature) {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Invalid input" }));
                    return;
                }

                // Retrieve nonce
                const nonce = nonces.get(walletAddress.toLowerCase());
                if (!nonce) {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Nonce not found" }));
                    return;
                }

                // Verify signature
                const recoveredAddress = ethers.verifyMessage(nonce, signature);
                if (recoveredAddress.toLowerCase() === walletAddress.toLowerCase()) {
                    // Generate JWT with a 7-day expiration
                    const token = jwt.sign(
                        { walletAddress },
                        JWT_SECRET,
                        { expiresIn: TOKEN_DURATION }
                    );
                    nonces.delete(walletAddress.toLowerCase());

                    // Respond with the token
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: true, token }));
                } else {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Signature verification failed" }));
                }
            } catch (err) {
                // Handle JSON parsing errors or signature verification issues
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: false, error: "Invalid signature" }));
            }
        });
    });
}

// Middleware to validate JWT
export function validateJWT(token: string): { walletAddress: string } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { walletAddress: string };
    } catch {
        return null;
    }
}
