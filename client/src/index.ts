import "../node_modules/@fortawesome/fontawesome-free/css/brands.css";
import "../node_modules/@fortawesome/fontawesome-free/css/fontawesome.css";
import "../node_modules/@fortawesome/fontawesome-free/css/solid.css";
import { Account } from "./scripts/account";
import { Game } from "./scripts/game";
import { showInventory } from "./scripts/inventory";
import { setupGame } from "./scripts/ui/game";
import { setupHome } from "./scripts/ui/home";
import { setupPlay } from "./scripts/ui/play";
import { GameConsole } from "./scripts/utils/console/gameConsole";
import { onConnectWallet, showWallet } from "./scripts/wallet";
import "./scss/pages/client.scss";
import { Buffer } from "buffer";
import { initTranslation } from "./translations";
import { setupConsoleListener, setupRangeInputs, setupSettingsImportExport, setupTabNavigation } from "./scripts/ui/setup";

if (typeof window !== "undefined") {
    // Polyfill for Buffer
    if (!window.Buffer) {
        window.Buffer = window?.Buffer || Buffer;
    }
}

export let GAME_CONSOLE = new GameConsole();

void (async () => {
    await initTranslation();

    const account = new Account();
    const game = await Game.init();

    void Promise.all([
        showWallet(account),
        onConnectWallet(account),
    ]).then(() => {
        setupHome(account);
        showInventory(account);
        setupGame(game);
        setupPlay(game, account);
    });

    setupConsoleListener();
    setupRangeInputs();
    setupTabNavigation();
    setupSettingsImportExport();

})();
