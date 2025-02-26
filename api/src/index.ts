import { TemplatedApp } from "uWebSockets.js";
import { requestNonce, verifySignature } from "./auth";
import { getSkinBalances, getMeleeBalances} from "./items";

export function initAuthRoutes(app: TemplatedApp) {
    verifySignature(app);
    requestNonce(app);
    getSkinBalances(app);
    getMeleeBalances(app);
}
