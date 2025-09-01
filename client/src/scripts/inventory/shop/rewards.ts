import $ from "jquery";
import { successAlert, errorAlert } from "../../modal";
import { ShopCache } from ".";
import type { Account } from "../../account";

interface RewardItem {
    image: string;
    amount: number;
    time: string;
}

interface RewardData {
    validCrates?: Array<{ amount: number; expiry: number }>;
}

async function renderRewardList(account: Account, rewardData: RewardData | undefined): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const rewards: RewardItem[] = rewardData?.validCrates?.map(item => {
        const secondsLeft = item.expiry - now;
        const daysLeft = Math.max(Math.floor(secondsLeft / (60 * 60 * 24)), 0);
        return {
            image: "./img/misc/surviv_kit_crate.png",
            amount: item.amount,
            time: `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        };
    }) || [];

    // Check for season rewards
    const hasSeasonRewards = (await account.getSeasonRewards()).success;
    if (hasSeasonRewards) {
        rewards.push({
            image: "../img/game/shared/badges/surviv_s1_gold.svg",
            amount: 1,
            time: "Season I Reward",
        });
    }

    const $rewardGrid = $(".rewards-grid-group");
    const $totalReward = $("#total-reward");
    const $claimButton = $("#claim-btn");
    let isProcessing = false;

    const totalCrates = rewards.reduce((sum, item) => sum + (item.image.includes("surviv_kit_crate.png") ? item.amount : 0), 0);
    $totalReward.text(`You have ${totalCrates} crates${hasSeasonRewards ? " and season rewards" : ""} to claim`);
    $rewardGrid.empty();
    rewards.forEach(item => {
        $rewardGrid.append(`
            <div class="reward-child">
                <img src="${item.image}" alt="${item.image.includes("surviv_s1_gold.svg") ? "Season I Badge" : "Crates"}" class="${item.image.includes("surviv_s1_gold.svg") ? "w-16 h-16 filter drop-shadow-[0_0_2px_#facc15a6]" : ""}">
                <h5>${item.time}</h5>
                <h3>Amount: ${item.amount}</h3>
            </div>
        `);
    });

    $claimButton.off("click").on("click", async () => {
        if (isProcessing) return;
        isProcessing = true;
        $claimButton.prop("disabled", true);
        try {
            if (hasSeasonRewards) {
                // Claim season rewards first (one-time claim)
                const seasonRewards = await account.getSeasonRewards();
                // Then claim crates
                const tx = await account.claimSeasonRewards(seasonRewards);
                console.log("tx: ", tx.hash);
                successAlert("Season rewards and crates claimed successfully!");
            } else {
                // Only claim crates if no season rewards
                await account.claimRewards();
                successAlert("Crates claimed successfully!");
            }
            ShopCache.assetsBalance.crate += totalCrates;
            ShopCache.PlayerValidRewards = undefined;
        } catch (err) {
            console.error(`Failed to claim rewards: ${err}`);
            errorAlert(hasSeasonRewards ? "Failed to claim season rewards or crates" : "No valid crates found");
        } finally {
            isProcessing = false;
            $claimButton.prop("disabled", false);
            await loadRewards(account);
        }
    });
}

export async function loadRewards(account: Account): Promise<void> {
    renderRewardList(account, ShopCache.PlayerValidRewards);
}