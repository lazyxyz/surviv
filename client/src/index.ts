import "../node_modules/@fortawesome/fontawesome-free/css/brands.css";
import "../node_modules/@fortawesome/fontawesome-free/css/fontawesome.css";
import "../node_modules/@fortawesome/fontawesome-free/css/solid.css";
import { Game } from "./scripts/game";
import "./scss/pages/client.scss";
import { Buffer } from "buffer";

if (typeof window !== "undefined") {
    // Polyfill for Buffer
    if (!window.Buffer) {
        window.Buffer = window?.Buffer || Buffer;
    }
}

void (async() => {
    void Game.init();
})();
