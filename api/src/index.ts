import { TemplatedApp } from "uWebSockets.js";
import { requestNonce, verifySignature } from "./auth";

export function initAuthRoutes(app: TemplatedApp) {
    verifySignature(app);
    requestNonce(app);
}
