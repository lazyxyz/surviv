import $ from "jquery";
import { successAlert, errorAlert } from "../../modal";
import { PlayerValidRewards, ShopCache } from ".";
import type { Account } from "../../account";

interface RewardItem {
    image: string;
    amount: number;
    time: string;
}

interface RewardData {
    validCrates?: Array<{ amount: number; expiry: number }>;
}

function renderRewardList(account: Account, rewardData: RewardData): void {
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

    const $rewardGrid = $(".rewards-grid-group");
    const $totalReward = $("#total-reward");
    const $claimButton = $("#claim-btn");
    let isProcessing = false;

    const totalCrates = rewards.reduce((sum, item) => sum + item.amount, 0);
    $totalReward.text(`You have ${totalCrates} crates to claim`);
    $rewardGrid.empty();
    rewards.forEach(item => {
        $rewardGrid.append(`
            <div class="reward-child">
                <img src="${item.image}" alt="Crates">
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
            successAlert("Rewards claimed successfully!");
            ShopCache.assetsBalance.crate += totalCrates;
        } catch (err) {
            console.error(`Failed to claim rewards: ${err}`);
            errorAlert("No valid crates found");
        } finally {
            isProcessing = false;
            $claimButton.prop("disabled", false);
            await loadRewards(account);
        }
    });
}

export async function loadRewards(account: Account): Promise<void> {
    renderRewardList(account, PlayerValidRewards);
}