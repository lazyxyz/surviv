import $ from "jquery";
import type { Game } from "../game";
import { createDropdown } from "../uiHelpers";
import { WalletType, shorten } from "../utils/constants";

export function visibleConnectWallet(game: Game): void {
    // handler what conditions to open modal?
    // if (!localStorage.getItem(SELECTOR_WALLET)?.length) {
    //     $(".connect-wallet-portal").css("display", "block");
    // }
    // check inactive state
    // $("#btn-play-solo").attr("disabled", "true").css("opacity", "0.5");
    // $("#btn-play-squad").attr("disabled", "true").css("opacity", "0.5");
    // $("#btn-join-team").attr("disabled", "true").css("opacity", "0.5");
    // $("#btn-create-team").attr("disabled", "true").css("opacity", "0.5");

    $("#connect-wallet-btn").on("click", () => {
        $(".connect-wallet-portal").css("display", "block");
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

                    return await game.account.connect(isExisted, game);
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
                if (paragraphElement?.textContent?.includes(WalletType.METAMASK)) {
                    return window.open("https://metamask.io/download/", "_blank");
                }
                if (paragraphElement?.textContent?.includes(WalletType.COINBASEWALLET)) {
                    return window.open(
                        "https://www.coinbase.com/wallet/downloads",
                        "_blank"
                    );
                }

                if (paragraphElement?.textContent?.includes(WalletType.TRUSTWALLET)) {
                    return window.open("https://trustwallet.com/download", "_blank");
                }
            };
        }
    }
};

export function visibleWallet(game: Game): void {
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
