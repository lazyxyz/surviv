import $ from "jquery";
import { successAlert, errorAlert } from "../../modal";
import { ShopCache, updateRewardsTab } from ".";
import type { Account } from "../../account";

interface RewardItem {
    image: string;
    amount: number;
    time: string;
}

interface RewardData {
    validCrates?: Array<{ tokenId: number, amount: number; expiry: number }>;
}


async function getCrateRewards(rewardData: RewardData | undefined): Promise<RewardItem[]> {
    const rewards: RewardItem[] = [];
    const now = Math.floor(Date.now() / 1000);

    if (rewardData?.validCrates) {
        const crateRewards = rewardData.validCrates.map(item => {
            const secondsLeft = item.expiry - now;
            const daysLeft = Math.max(Math.floor(secondsLeft / (60 * 60 * 24)), 0);
            let image = "./img/assets/surviv_kit_crate.webp";
            if (item.tokenId == 1) {
                image = "./img/assets/surviv_kit_key.webp";
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
    const crateRewards = await getCrateRewards(rewardData);
    const rewards = [...crateRewards];

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
            await account.claimRewards();
            successAlert("Crates claimed successfully!");
            await updateRewardsTab(0); // reset rewards count
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