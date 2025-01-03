import "../node_modules/@fortawesome/fontawesome-free/css/brands.css";
import "../node_modules/@fortawesome/fontawesome-free/css/fontawesome.css";
import "../node_modules/@fortawesome/fontawesome-free/css/solid.css";
import { Game } from "./scripts/game";
import "./scss/pages/client.scss";
<<<<<<< HEAD
=======
import { Buffer } from "buffer";

if (typeof window !== "undefined") {
    // Polyfill for Buffer
    if (!window.Buffer) {
        window.Buffer = window?.Buffer || Buffer;
    }
}
>>>>>>> grindy/main

void (async() => {
    void Game.init();
})();
