// tasks/index.ts
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

        // Update each task by ID
        data.tasks.forEach(task => {
            const $task = $(`.task-item[data-task-id="${task.id}"]`);
            if ($task.length === 0) return;

            // Title and description from API
            $task.find(".task-title").text(task.name);
            $task.find(".task-desc").text(task.description);

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

            // Weekday labels: left start of streak, right future
            const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            const today = new Date();
            const startDaysAgo = streak > 0 ? streak - 1 : 0;
            const startDate = new Date(today.getTime() - startDaysAgo * 86400000);

            $(".streak-day").removeClass("completed current");
            for (let k = 0; k < 7; k++) {
                const dayDate = new Date(startDate.getTime() + k * 86400000);
                let label = days[dayDate.getDay()];
                $(`.streak-day:eq(${k})`).html(label);

                if (k < streak) {
                    $(`.streak-day:eq(${k})`).addClass("completed");
                }
                if (streak < 7 && k === streak) {
                    $(`.streak-day:eq(${k})`).addClass("current");
                }
            }

            // Streak notice
            let notice = "";
            if (streak === 0) {
                notice = "Complete at least 3 daily tasks today to start your streak!";
            } else if (streak < 7) {
                notice = "Today's streak is complete! Come back tomorrow to continue.";
            } else {
                notice = "Congratulations! Your 7-day streak is complete.";
            }
            $("#streak-notice").text(notice);
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