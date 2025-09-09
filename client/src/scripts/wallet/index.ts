import $ from "jquery";
import { createDropdown } from "../uiHelpers";
import { WalletType, parseJWT, shorten } from "../utils/constants";
import type { Account } from "../account";
import { errorAlert, warningAlert } from "../modal";

const walletPriority = [
    WalletType.MetaMask,
    WalletType.TrustWallet,
    WalletType.CoinbaseWallet,
    WalletType.OKXWallet,
    WalletType.BraveWallet,
    WalletType.RabbyWallet,
];

// Flag to track if the wallet list has been sorted
let isWalletListSorted = false;

// Reusable function to sort and render wallet list
function sortAndRenderWalletList($walletList: JQuery, account: Account): void {
    // Skip if already sorted
    if (isWalletListSorted) return;

    const $walletItems = $walletList.children(".connect-wallet-item").get();

    $walletItems.sort((a, b) => {
        const nameA = a.children[1]?.textContent?.trim() ?? "";
        const nameB = b.children[1]?.textContent?.trim() ?? "";

        // Check if installed
        const isInstalledA = account.eip6963.providers?.some(
            provider => provider?.info?.name === nameA
        );
        const isInstalledB = account.eip6963.providers?.some(
            provider => provider?.info?.name === nameB
        );

        // First: installed wallets > not installed
        if (isInstalledA && !isInstalledB) return -1;
        if (!isInstalledA && isInstalledB) return 1;

        // Second: respect enum priority order
        const indexA = walletPriority.indexOf(nameA as WalletType);
        const indexB = walletPriority.indexOf(nameB as WalletType);

        return indexA - indexB;
    });

    // Clear the current list and append sorted items
    $walletList.empty();
    $walletItems.forEach(item => $walletList.append(item));

    // Set flag to true after sorting
    isWalletListSorted = true;
}

export function onConnectWallet(account: Account): void {
    $("#connect-wallet-btn").on("click", async () => {
        $(".connect-wallet-portal").css("display", "block");

        // Get the wallet list container and sort it
        const $walletList = $(".connect-wallet-list");
        sortAndRenderWalletList($walletList, account);
    });

    // Close connect wallet modal
    $("#close-connect-wallet").on("click", () => {
        $(".connect-wallet-portal").css("display", "none");
    });

    // Handler click to login for each wallet item
    for (const elements of $(".connect-wallet-item")) {
        const paragraphElement = elements.children[1];
        const logoElement = elements.children[0];

        const isExisted = account.eip6963.providers?.find(
            argument => argument?.info?.name === paragraphElement?.textContent
        );

        if (isExisted) {
            $(elements).addClass("wallet-installed");
            elements.onclick = async () => {
                try {
                    // Hide logo to show loading icon
                    $(logoElement).css("display", "none");

                    // Append loading icon
                    const newNode = document.createElement("div");
                    newNode.className = "loading-icon";
                    newNode.style.width = "36px";
                    newNode.style.height = "36px";
                    newNode.style.display = "flex";
                    newNode.style.alignItems = "center";
                    newNode.style.justifyContent = "center";
                    newNode.innerHTML = "<i class=\"fa-duotone fa-solid fa-spinner fa-spin-pulse fa-xl\"></i>";
                    logoElement.after(newNode);

                    return await account.connect(isExisted);
                } catch (error) {
                    console.log(error);
                } finally {
                    $(".loading-icon").css("display", "none");
                    $(logoElement).css("display", "block");
                }
            };
        } else {
            $(paragraphElement).css({ color: "#93C5FD" });
            paragraphElement.insertAdjacentText("afterbegin", "Install ");

            elements.onclick = () => {
                if (paragraphElement?.textContent?.includes(WalletType.MetaMask)) {
                    return window.open("https://metamask.io/download/", "_blank");
                }

                if (paragraphElement?.textContent?.includes(WalletType.CoinbaseWallet)) {
                    return window.open("https://www.coinbase.com/wallet/downloads", "_blank");
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

                if (paragraphElement?.textContent?.includes(WalletType.RabbyWallet)) {
                    return window.open("https://rabby.io/", "_blank");
                }
            };
        }
    }

    if (!account.address) {
        $("#connect-wallet-btn").trigger("click");
    }
};

export function showWallet(account: Account): void {
    // token is expired
    if(account.token) {
        const { exp } = parseJWT(account.token);
        if (new Date().getTime() >= (exp * 1000)) {
            return account.sessionExpired();
        }
    }

    if (!account.address) {
        $("#connect-wallet-btn").trigger("click");
    }

    if (account.eip6963.provider?.provider && account.address?.length) {
        // handler first time you need visible container
        {
            $(".account-wallet-container").css("display", "block");
        }

        // handler placeholder for button
        {
            $(".account-wallet-placeholder").append(shorten(account.address));
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
                    if (navigator.clipboard) {
                        return navigator.clipboard.writeText(String(account.address));
                    }

                    const textArea = document.createElement("textarea");
                    textArea.value = String(account.address);

                    document.body.appendChild(textArea);

                    textArea.focus();
                    textArea.select();

                    // eslint-disable-next-line @typescript-eslint/no-deprecated
                    document.execCommand("copy");
                    document.body.removeChild(textArea);
                }
            },
            {
                key: "connect-discord",
                fieldName: "Connect Discord",
                icon: "./img/socials/discord.svg",
                onClick: async () => {
                    if (!account.token) {
                        errorAlert("Please reconnect your wallet to continue!")
                        return;
                    }

                    const clientId = '1414536940207996928';
                    const redirectUri = encodeURIComponent('https://roles.surviv.fun/discord/callback'); // Updated to match backend route
                    const scope = encodeURIComponent('identify');

                    // Secure nonce using crypto (128 bits entropy)
                    const nonceBytes = new Uint8Array(16);
                    window.crypto.getRandomValues(nonceBytes);
                    const nonce = btoa(String.fromCharCode(...nonceBytes))
                        .replace(/\+/g, "-")
                        .replace(/\//g, "_")
                        .replace(/=/g, ""); // Base64url encoding (URL-safe)


                    // Step 1: Send JWT and nonce to backend to generate signed state
                    try {
                        const response = await fetch('https://roles.surviv.fun/discord/generate-state', { // Updated URL
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: account.token, nonce })
                        });
                        if (!response.ok) {
                            throw new Error('Failed to generate state: ' + response.statusText);
                        }
                        const { signedState } = await response.json();

                        // Step 2: Redirect to Discord with signedState
                        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${encodeURIComponent(signedState)}&prompt=consent`;
                        window.location.href = authUrl;
                    } catch (error) {
                        console.error('Error generating state:', error);
                        alert('Failed to initiate Discord connection');
                    }
                }
            },
            {
                key: "disconnect",
                fieldName: "Disconnect",
                icon: "./img/line/log-out.svg",
                onClick: () => {
                    account.disconnect();
                    $("#connect-wallet-btn").trigger("click");
                }
            },
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