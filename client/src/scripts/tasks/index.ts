import $ from 'jquery';
import type { Account } from "../account";
import { warningAlert } from "../modal";

// ==== TASKS SYSTEM – HARDCODED VERSION (for testing & demo) ====
export async function setupTasks(account: Account) {
    // Open Tasks modal
    $("#btn-tasks").off("click").on("click", () => {
        $("#tasks-menu").show();
        updateTasksUI(); // refresh with fake data every time
    });

    // Close button
    $("#close-tasks").off("click").on("click", () => {
        $("#tasks-menu").hide();
    });

    // Click outside to close
    $("#tasks-menu").off("click").on("click", function (e) {
        if (e.target === this) $("#tasks-menu").hide();
    });

    // Make individual task claim buttons clickable when active
    $("#tasks-menu").on("click", ".task-claim-btn.active", function () {
        const reward = $(this).data("reward").split(",");
        warningAlert(`🎉 Claimed ${reward[0]} Crate${reward[0] > 1 ? 's' : ''} + ${reward[1]} Key${reward[1] > 1 ? 's' : ''}!`, 4000);
        $(this).removeClass("active").css("opacity", "0.4");
    });

    // Fake "Claim Reward" button (just for show + success message)
    $("#claim-streak-reward").off("click").on("click", () => {
        if (!account?.address) {
            warningAlert("Please connect your wallet first!", 3000);
            return;
        }

        warningAlert("🎉 Congratulations! You claimed 10 Crates + 10 Keys!", 5000);

        // Simulate claim: reset streak to 0 and hide button
        $("#current-streak-days").text("0");
        $(".streak-day").removeClass("completed current");
        $("#claim-streak-reward").hide();
    });
}

// Hard-coded fake data – change these numbers to test different states!
function updateTasksUI() {
    // === CHANGE THESE VALUES TO TEST DIFFERENT SCENARIOS ===
    const fakeData = {
        warmup: 1,   // 0 or 1
        hunter: 8,   // 0–10
        champion: 0,   // 0 or 1
        streak: 6,   // 0–7
        canClaim: true // only matters when streak === 7
    };
    // ======================================================

    // Update daily tasks
    $(`[data-task="warmup"] .task-progress-text`).text(`${fakeData.warmup}/1`);
    $(`[data-task="hunter"] .task-progress-text`).text(`${fakeData.hunter}/10`);
    $(`[data-task="champion"] .task-progress-text`).text(`${fakeData.champion}/1`);

    // Mark completed tasks
    $("[data-task]").removeClass("completed");
    if (fakeData.warmup >= 1) $(`[data-task="warmup"]`).addClass("completed");
    if (fakeData.hunter >= 10) $(`[data-task="hunter"]`).addClass("completed");
    if (fakeData.champion >= 1) $(`[data-task="champion"]`).addClass("completed");

    // Update streak visuals
    $("#current-streak-days").text(fakeData.streak);

    $(".streak-day").removeClass("completed current");
    for (let i = 0; i < 7; i++) {
        if (i < fakeData.streak) {
            $(`.streak-day:eq(${i})`).addClass("completed");
        }
        if (i === fakeData.streak) {
            $(`.streak-day:eq(${i})`).addClass("current");
        }
    }

    // Show claim button only on day 7 (or if you want to test it early)
    const showClaimButton = (fakeData.streak >= 7) || (fakeData.streak === 6 && fakeData.canClaim);
    $("#claim-streak-reward").toggle(showClaimButton);

    // Live daily reset timer (UTC-based)
    const updateTimer = () => {
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const diff = tomorrow.getTime() - now.getTime();

        const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
        const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
        const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");

        $("#daily-reset-timer").text(`${h}:${m}:${s}`);
    };
    updateTimer();
    setInterval(updateTimer, 1000);
}