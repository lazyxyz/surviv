// profile.ts
import $ from "jquery";
import { html } from "../utils/misc";
import { Account } from "../account";
import { successAlert } from "../modal";

// Updated interface to include avatarTokenId (assuming it's part of the profile data)
interface UserInfo {
    address: string;
    name: string;
    image: string;
    ownedTokens: { tokenId: string; imageUrl: string }[];
    totalKills: number;
    totalBotKills: number;
    totalTimeAlive: number;
    totalGames: number;
    avatarTokenId?: string; // Add this if it's missing from the actual return type
}

// Handler to select and save avatar
function selectNft(tokenId: string, account: Account): void {
    // Remove previous selected
    $(".nft-item-container").removeClass("selected");

    // Add directly without timeout
    $(`#nft-${tokenId}`).addClass("selected");

    // Show update button
    $("#update-profile-btn").css("display", "block");
}

// Function to format time in seconds to readable hours
function formatTimePlay(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hours`;
}

export async function showProfile(account: Account) {
    const profileContent = $<HTMLDivElement>("#tab-profile-content"); // Use the tab content div ID matching the pattern
    profileContent.css("position", "relative"); // Ensure positioned ancestor
    profileContent.empty(); // Clear previous items

    let info = await account.profile();

    // If no info found, call updatePlayerInfo via updateProfile
    if (info === null) {
        await account.updateProfile(); // Call without tokenId to init and set first
        info = await account.profile(); // Refetch updated info
    }

    // Fallback if still null after update (though unlikely)
    if (info === null) {
        info = {
            address: account.address || '',
            name: account.address || '',
            image: '',
            ownedTokens: [],
            totalKills: 0,
            totalBotKills: 0,
            totalTimeAlive: 0,
            totalGames: 0
        };
    }

    // Display player name with similar styling to other elements
    const nameDisplay = $<HTMLDivElement>(
        html`<div class="profile-name-display badges-boost-display">
            Player Name: <span>${info.name}</span>
        </div>`
    );
    profileContent.append(nameDisplay);

    // Display stats with grid or flex similar to rewards
    const statsDisplay = $<HTMLDivElement>(
        html`<div class="profile-stats-display rewards-grid-group">
            <div class="reward-child">Total Games: ${info.totalGames}</div>
            <div class="reward-child">Total Kills: ${info.totalKills}</div>
            <div class="reward-child">Total Bot Kills: ${info.totalBotKills}</div>
            <div class="reward-child">Time Play: ${formatTimePlay(info.totalTimeAlive)}</div>
        </div>`
    );
    profileContent.append(statsDisplay);

    // NFTs header with refresh button
    const nftsHeader = $<HTMLDivElement>(
        html`<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; margin-bottom: 12px;">
            <h3 style="color: white; margin: 0;">My Surviv Soldiers</h3>
            <button id="refresh-nfts-btn" class="btn btn-alert btn-darken" style="width: auto; padding: 8px 16px;">Refresh</button>
        </div>`
    );
    profileContent.append(nftsHeader);

    // NFTs container
    const nftsContainer = $<HTMLDivElement>(html`<div id="nfts-container"></div>`);
    profileContent.append(nftsContainer);

    // Function to render NFTs or no NFTs message
    const renderNfts = (info: UserInfo) => {
        nftsContainer.empty();

        if (info.ownedTokens.length > 0) {
            const nftsList = $<HTMLDivElement>(html`<div class="nfts-list badges-list"></div>`);

            for (const token of info.ownedTokens) {
                const isSelected = token.tokenId === info.avatarTokenId;
                const nftItem = $<HTMLDivElement>(
                    html`<div id="nft-${token.tokenId}" class="nft-item-container badges-list-item-container${isSelected ? " selected" : ""}">
                        <div class="badges-list-item">
                            <img class="nft-image badge-image" src="${token.imageUrl}" alt="NFT #${token.tokenId}" style="width: 120px; height: 120px; object-fit: cover;" />
                        </div>
                        <span class="nft-token-id badge-name">#${token.tokenId}</span>
                    </div>`
                );

                nftItem.on("click", () => {
                    selectNft(token.tokenId, account);
                });

                nftsList.append(nftItem);
            }

            nftsContainer.append(nftsList);

            // Add Update button, initially hidden, centered with clean styling
            const updateButtonWrapper = $<HTMLDivElement>(html`<div style="display: flex; justify-content: center; margin-top: 16px;"></div>`);
            const updateButton = $<HTMLButtonElement>(
                html`<button id="update-profile-btn" class="btn btn-alert btn-darken" style="display: none; width: auto; padding: 8px 16px;">
                    Update
                </button>`
            );
            updateButton.on("click", async () => {
                const selectedTokenId = $(".nft-item-container.selected").attr("id")?.split("-")[1];
                if (selectedTokenId) {
                    await account.updateProfile(selectedTokenId);
                    updateButton.css("display", "none");
                    // Optional: refetch and re-render after update
                    info = await account.profile();
                    renderNfts(info);
                    successAlert("Profile successfully updated!");
                }
            });
            updateButtonWrapper.append(updateButton);
            nftsContainer.append(updateButtonWrapper);
        } else {
            // Display no NFTs message with link
            const noNftsMessage = $<HTMLDivElement>(
                html`<div class="no-nfts-message" style="text-align: center; color: white; font-size: 16px;">
                    No Soldier found, grab one here: <a href="https://opensea.io/collection/surviv-army" target="_blank" style="color: #ffd700; text-decoration: underline;">https://opensea.io/collection/surviv-army</a>
                </div>`
            );
            nftsContainer.append(noNftsMessage);
        }
    };

    // Initial render
    renderNfts(info);

    // Refresh button handler
    $("#refresh-nfts-btn").on("click", async () => {
        await account.updateProfile(); // Call without tokenId
        info = await account.profile();

        // Fallback if null
        if (info === null) {
            info = {
                address: account.address || '',
                name: account.address || '',
                image: '',
                ownedTokens: [],
                totalKills: 0,
                totalBotKills: 0,
                totalTimeAlive: 0,
                totalGames: 0
            };
        }
        $("#refresh-nfts-btn").css("display", "none");
        successAlert("Profile refresh successfully!");
        renderNfts(info);
    });
}