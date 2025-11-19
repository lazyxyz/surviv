import $ from 'jquery';
import type { Account } from "../account";
import { warningAlert } from "../modal";

export async function setupTasks(account: Account) {
    // Open modal
    $("#btn-tasks").off("click").on("click", async () => {
        $("#tasks-menu").show();
        await updateTasksUI(account);
    });

    // Close
    $("#close-tasks, #tasks-menu").off("click").on("click", function (e: any) {
        if (e.target === this || $(e.target).hasClass("fa-xmark")) {
            $("#tasks-menu").hide();
        }
    });

    // Claim buttons (visual only)
    $("#tasks-menu").on("click", ".task-claim-btn.active", function () {
        const reward = $(this).data("reward").split(",");
        warningAlert(`🎉 Claimed ${reward[0]} Crate${reward[0] > 1 ? 's' : ''} + ${reward[1]} Key${reward[1] > 1 ? 's' : ''}!`, 4000);
        $(this).removeClass("active").css("opacity", "0.4");
    });
}


async function updateTasksUI(account: Account) {
    if (!account?.address) {
        // Hide main content and show a message (without overwriting structure)
        $(".tasks-streak-section, .tasks-list, .tasks-footer").hide();
        $("#tasks-loading").html('<div style="text-align:center;padding:50px;color:#f44;">Connect wallet to view tasks</div>').show();
        return;
    }

    try {
        // Show loading, hide main content
        $(".tasks-streak-section, .tasks-list, .tasks-footer").hide();
        $("#tasks-loading").html('<div style="text-align:center;padding:50px;color:#aaa;">Loading tasks...</div>').show();

        const data = await account.getAllTasks();

        console.log("data: ", data);

        // Update each task by ID
        data.tasks.forEach(task => {
            const $task = $(`.task-item[data-task-id="${task.id}"]`);
            if ($task.length === 0) return;

            // Status text
            $task.find(".task-status-text").text(task.status);

            // Completed class
            if (task.completed) {
                $task.addClass("completed");
            } else {
                $task.removeClass("completed");
            }

            // Claim button
            const $btn = $task.find(".task-claim-btn");
            if (task.completed && !task.claimed) {
                $btn.addClass("active");
            } else {
                $btn.removeClass("active");
                if (task.claimed) $btn.css("opacity", "0.4");
            }
        });

        // Update streak (top bar + task 100)
        const streakTask = data.tasks.find(t => t.id === 100);
        if (streakTask) {
            const streak = parseInt(streakTask.status.split("/")[0]);
            $("#current-streak-days").text(streak);

            $(".streak-day").removeClass("completed current");
            for (let i = 0; i < 7; i++) {
                if (i < streak) $(`.streak-day:eq(${i})`).addClass("completed");
                if (i === streak) $(`.streak-day:eq(${i})`).addClass("current");
            }

            $("#claim-streak-reward").toggle(streakTask.completed && !streakTask.claimed);
        }

        // Timer
        let seconds = data.resetInSeconds;
        const timer = () => {
            const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
            const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
            const s = String(seconds % 60).padStart(2, "0");
            $("#daily-reset-timer").text(`${h}:${m}:${s}`);
            if (seconds > 0) seconds--;
        };
        timer();
        setInterval(timer, 1000);

        // After updates, show main content and hide loading
        $(".tasks-streak-section, .tasks-list, .tasks-footer").show();
        $("#tasks-loading").hide();

    } catch (err: any) {
        console.error(err);
        // Show error in loading area
        $("#tasks-loading").html(`
            <div style="text-align:center;padding:50px;color:#f44;">
                Failed to load tasks<br>
                <small>${err.message || "Check console"}</small>
            </div>
        `).show();
        $(".tasks-streak-section, .tasks-list, .tasks-footer").hide();
    }
}