import $ from "jquery";
import type { Game } from "../game";

interface RewardItem {
    image: string;
    amount: number;
    time: string;
}

interface RewardData {
    validCrates?: Array<{ amount: number; expiry: number }>;
}

function renderRewardList(game: Game, rewardData: RewardData): void {
    const now = Math.floor(Date.now() / 1000);
    const rewards: RewardItem[] = rewardData?.validCrates?.map(item => {
        const secondsLeft = item.expiry - now;
        const daysLeft = Math.max(Math.floor(secondsLeft / (60 * 60 * 24)), 0);
        return {
            image: "./img/misc/crate.png",
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
                <h3>Amount: ${item.amount}</h3>
                <h3>${item.time}</h3>
            </div>
        `);
    });

    $claimButton.off("click").on("click", async () => {
        if (isProcessing) return;
        isProcessing = true;
        $claimButton.prop("disabled", true);
        try {
            await game.account.claimRewards();
            alert("Rewards claimed successfully!");
        } catch (err) {
            console.error(`Failed to claim rewards: ${err}`);
            alert(`Failed to claim rewards: ${err}`);
        } finally {
            isProcessing = false;
            $claimButton.prop("disabled", false);
            await loadRewards(game);
        }
    });
}

export async function loadRewards(game: Game): Promise<void> {
    const rewardData = await game.account.getValidRewards().catch(err => {
        console.error(`Failed to load rewards: ${err}`);
        return { validCrates: [] };
    });
    renderRewardList(game, rewardData);
}