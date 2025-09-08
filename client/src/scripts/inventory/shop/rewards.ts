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
    validCrates?: Array<{ tokenId: number, amount: number; expiry: number }>;
}

// Constant to enable/disable season rewards
const ENABLE_SEASON_REWARDS = false;

async function getSeasonRewards(account: Account): Promise<RewardItem[]> {
    const rewards: RewardItem[] = [];

    if (!ENABLE_SEASON_REWARDS) {
        return rewards;
    }

    try {
        const seasonRewards = await account.getSeasonRewards();
        if (seasonRewards?.success) {
            let seasonImage = "../img/game/shared/badges/surviv_card.svg";
            if (seasonRewards.tokenIds[1][0] === 1) {
                seasonImage = "../img/game/shared/badges/surviv_s1_gold.svg";
            } else if (seasonRewards.tokenIds[1][0] === 2) {
                seasonImage = "../img/game/shared/badges/surviv_s1_silver.svg";
            } else if (seasonRewards.tokenIds[1][0] === 3) {
                seasonImage = "../img/game/shared/badges/somnia_s1.svg";
            }
            rewards.push({
                image: seasonImage,
                amount: 1,
                time: "Season I Reward",
            });
        }
    } catch (err) {
        console.error(`Failed to fetch season rewards: ${err}`);
    }

    return rewards;
}

async function getCrateRewards(rewardData: RewardData | undefined): Promise<RewardItem[]> {
    const rewards: RewardItem[] = [];
    const now = Math.floor(Date.now() / 1000);

    if (rewardData?.validCrates) {
        const crateRewards = rewardData.validCrates.map(item => {
            const secondsLeft = item.expiry - now;
            const daysLeft = Math.max(Math.floor(secondsLeft / (60 * 60 * 24)), 0);
            let image = "./img/misc/surviv_kit_crate.png";
            if (item.tokenId == 1) {
                image = "./img/misc/surviv_kit_key.png";
            }

            return {
                image,
                amount: item.amount,
                time: `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
            };
        });
        rewards.push(...crateRewards);
    }

    return rewards;
}

async function renderRewardList(account: Account, rewardData: RewardData | undefined): Promise<void> {
    const seasonRewards = await getSeasonRewards(account);
    const crateRewards = await getCrateRewards(rewardData);
    const rewards = [...seasonRewards, ...crateRewards];

    const $rewardGrid = $(".rewards-grid-group");
    const $totalReward = $("#total-reward");
    const $claimButton = $("#claim-btn");
    let isProcessing = false;

    const totalCrates = crateRewards.reduce((sum, item) => sum + item.amount, 0);
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
            if (ENABLE_SEASON_REWARDS && seasonRewards.length > 0) {
                const seasonData = await account.getSeasonRewards();
                await account.claimSeasonRewards(seasonData);
                await account.claimRewards();
                successAlert("Season rewards and crates claimed successfully!");
            } else {
                await account.claimRewards();
                successAlert("Crates claimed successfully!");
            }
            ShopCache.assetsBalance.crate += totalCrates;
            ShopCache.PlayerValidRewards = undefined;
        } catch (err) {
            console.error(`Failed to claim rewards: ${err}`);
        } finally {
            isProcessing = false;
            $claimButton.prop("disabled", false);
            await loadRewards(account);
        }
    });
}

export async function loadRewards(account: Account): Promise<void> {
    await renderRewardList(account, ShopCache.PlayerValidRewards);
}