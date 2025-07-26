import $ from "jquery";
import type { Game } from "../game";
import { createDropdown } from "../uiHelpers";
import { WalletType, shorten } from "../utils/constants";
import { errorAlert, warningAlert } from "../modal";

// Define Turnstile window interface
interface TurnstileWindow extends Window {
    turnstile: {
        ready: (callback: () => void) => void;
        render: (container: string, options: {
            sitekey: string;
            callback: (token: string) => void;
            "error-callback"?: (error: string) => void;
        }) => void;
        reset: () => void;
    };
    turnstileToken: string | null;
}

declare let window: TurnstileWindow;


// Function to render Turnstile widget and return token
const renderTurnstile = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!window.turnstile) {
            reject("Turnstile script not loaded");
            return;
        }

        window.turnstile.ready(() => {
            window.turnstile.render("#turnstile-widget", {
                sitekey: "0x4AAAAAABksm6I-SBWksH-l", // Your Site Key
                callback: (token: string) => {
                    resolve(token);
                },
                "error-callback": (error: string) => {
                    reject(error);
                },
            });
        });
    });
};


export function onConnectWallet(game: Game): void {
    let turnstileToken: string | null = null;

    $("#connect-wallet-btn").on("click", async () => {
        $(".connect-wallet-portal").css("display", "block");
        turnstileToken = null;
        $("#turnstile-widget").empty();

        await renderTurnstile().then(value => {
            turnstileToken = value;
        }).catch(_ => {
            errorAlert("Could not load bot verification. Please refresh!");
        });
    });

    // Close connect wallet modal
    $("#close-connect-wallet").on("click", () => {
        $(".connect-wallet-portal").css("display", "none");
    });

    // handler click to login...
    for (const elements of $(".connect-wallet-item")) {
        const paragraphElement = elements.children[1];
        const logoElement = elements.children[0];

        const isExisted = game.eip6963.providers?.find(
            argument => argument?.info?.name === paragraphElement?.textContent
        );

        if (isExisted) {
            elements.onclick = async () => {

                // Check if Turnstile token exists
                if (!turnstileToken) {
                    warningAlert("Please complete the bot verification.");
                    return;
                }

                try {
                    // hidden to show loading ICON
                    $(logoElement).css("display", "none");

                    // append loading ICON
                    {
                        const newNode = document.createElement("div");

                        newNode.className = "loading-icon";
                        newNode.style.width = "36px";
                        newNode.style.height = "36px";
                        newNode.style.display = "flex";
                        newNode.style.alignItems = "center";
                        newNode.style.justifyContent = "center";
                        newNode.innerHTML = "<i class=\"fa-duotone fa-solid fa-spinner fa-spin-pulse fa-xl\"></i>";

                        logoElement.after(newNode);
                    }
                    return await game.account.connect(isExisted, turnstileToken);
                } catch (error) {
                    console.log(error);
                } finally {
                    $(".loading-icon").css("display", "none");
                    $(logoElement).css("display", "block");
                }
            };
        }

        if (!isExisted) {
            $(paragraphElement).css({ color: "#93C5FD" });

            paragraphElement.insertAdjacentText("afterbegin", "Install ");

            elements.onclick = () => {
                if (paragraphElement?.textContent?.includes(WalletType.MetaMask)) {
                    return window.open("https://metamask.io/download/", "_blank");
                }

                if (paragraphElement?.textContent?.includes(WalletType.CoinbaseWallet)) {
                    return window.open(
                        "https://www.coinbase.com/wallet/downloads",
                        "_blank"
                    );
                }

                if (paragraphElement?.textContent?.includes(WalletType.TrustWallet)) {
                    return window.open("https://trustwallet.com/download", "_blank");
                }

                if (paragraphElement?.textContent?.includes(WalletType.OKXWallet)) {
                    return window.open("https://www.okx.com/web3", "_blank");
                }

                if (paragraphElement?.textContent?.includes(WalletType.BraveWallet)) {
                    return window.open("https://brave.com/wallet/", "_blank");
                }
            };
        }
    }
};

export function showWallet(game: Game): void {
    if (!game.account.address) $("#connect-wallet-btn").trigger("click");

    if (game?.eip6963.provider?.provider && game.account.address?.length) {
        // handler first time you need visible container
        {
            $(".account-wallet-container").css("display", "block");
        }

        // handler placeholder for button
        {
            $(".account-wallet-placeholder").append(shorten(game.account.address));
        }
    }

    // handler append children to fieldSet
    {
        const ListFieldSet = [
            {
                key: "address",
                fieldName: "Copy Address",
                icon: "./img/line/copy.svg",
                onClick: () => {
                    // https://dev.to/0shuvo0/copy-text-to-clipboard-in-jstwo-ways-1pn1
                    if (navigator.clipboard) {
                        return navigator.clipboard.writeText(String(game.account.address));
                    }

                    const textArea = document.createElement("textarea");
                    textArea.value = String(game.account.address);

                    document.body.appendChild(textArea);

                    textArea.focus();
                    textArea.select();

                    // eslint-disable-next-line @typescript-eslint/no-deprecated
                    document.execCommand("copy");
                    document.body.removeChild(textArea);
                }
            },
            {
                key: "disconnect",
                fieldName: "Disconnect",
                icon: "./img/line/log-out.svg",
                onClick: () => game.account.disconnect()
            }
        ];

        for (const fields of ListFieldSet) {
            $("#account-wallet-fieldset").append(`
                <a id="account-wallet-btn-${fields.key}">
                    <img width="20px" height="20px" src=${fields.icon} />
                    ${fields.fieldName}
                </a>
            `);

            $(`#account-wallet-btn-${fields.key}`).on("click", () => {
                fields.onClick();
            });
        }
    }

    createDropdown(".account-wallet-container");
}
