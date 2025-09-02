import $ from "jquery";
import { successAlert, errorAlert } from "../../modal";
import { ShopCache } from ".";
import type { Account, SeasonRewardsData } from "../../account";

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
    const rewards: RewardItem[] = [];

    let seasonRewards: SeasonRewardsData | undefined;
    try {
        seasonRewards = await account.getSeasonRewards();
    } catch (err) {
        console.error(`Failed to fetch season rewards: ${err}`);
    }
    if (seasonRewards && seasonRewards.success) {
        let seasonImage = "../img/game/shared/badges/surviv_card.svg";
        if (seasonRewards.tokenIds[1][0] == 1) {
            seasonImage = "../img/game/shared/badges/surviv_s1_gold.svg";
        } else if (seasonRewards.tokenIds[1][0] == 2) {
            seasonImage = "../img/game/shared/badges/surviv_s1_silver.svg";
        } else if (seasonRewards.tokenIds[1][0] == 3) {
            seasonImage = "../img/game/shared/badges/somnia_s1.svg";
        }
        rewards.push({
            image: seasonImage,
            amount: 1,
            time: "Season I Reward",
        });
    }

    if (rewardData?.validCrates) {
        const crateRewards = rewardData.validCrates.map(item => {
            const secondsLeft = item.expiry - now;
            const daysLeft = Math.max(Math.floor(secondsLeft / (60 * 60 * 24)), 0);
            return {
                image: "./img/misc/surviv_kit_crate.png",
                amount: item.amount,
                time: `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
            };
        });
        rewards.push(...crateRewards);
    }

    const $rewardGrid = $(".rewards-grid-group");
    const $totalReward = $("#total-reward");
    const $claimButton = $("#claim-btn");
    let isProcessing = false;

    const totalCrates = rewards.reduce((sum, item) => sum + (item.image.includes("surviv_kit_crate.png") ? item.amount : 0), 0);
    $totalReward.text(`You have ${totalCrates} crates to claim`);
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
            if (seasonRewards && seasonRewards.success) {
                // Claim season rewards first (one-time claim)
                const seasonRewards = await account.getSeasonRewards();
                // Then claim crates
                await account.claimSeasonRewards(seasonRewards);
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
            errorAlert("No valid rewards found");
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