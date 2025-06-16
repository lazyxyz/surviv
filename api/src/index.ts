import { TemplatedApp } from "uWebSockets.js";
import { requestNonce, verifySignature } from "./auth";
import {getCrates} from "./crate";

export function initAuthRoutes(app: TemplatedApp) {
    verifySignature(app);
    requestNonce(app);
    getCrates(app);
}
