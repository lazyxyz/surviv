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

    console.log("info: ", info);

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
            <div class="reward-child">TimePlay: ${formatTimePlay(info.totalTimeAlive)}</div>
        </div>`
    );
    profileContent.append(statsDisplay);

    // NFTs list - only show if user has any NFTs
    if (info.ownedTokens.length > 0) {
        const nftsList = $<HTMLDivElement>(html`<div class="nfts-list badges-list" style="margin-top: 24px;"></div>`); // Bigger gap

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

        profileContent.append(nftsList);

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
                successAlert("Profile successfully updated!")
            }
        });
        updateButtonWrapper.append(updateButton);
        profileContent.append(updateButtonWrapper);
    }
}

