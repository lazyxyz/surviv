import $ from "jquery";
import { ExtendedMap } from "@common/utils/misc";
import { GAME_CONSOLE } from "../..";

export function setupRangeInputs(): void {
    const wrapperCache = new ExtendedMap<HTMLElement, JQuery>();

    function updateRangeInput(element: HTMLInputElement): void {
        const value = +element.value;
        const min = +element.min;
        const max = +element.max;
        const x = ((value - min) / (max - min)) * 100;

        wrapperCache.getAndGetDefaultIfAbsent(element, () => $(element))
            .css(
                "--background",
                `linear-gradient(to right, #ff7500 0%, #ff7500 ${x}%, #f8f9fa ${x}%, #f8f9fa 100%)`
            )
            .siblings(".range-input-value")
            .text(
                element.id !== "slider-joystick-size" && element.id !== "slider-gyro-angle"
                    ? `${Math.round(value * 100)}%`
                    : value
            );
    }

    $<HTMLInputElement>("input[type=range]")
        .on("input", ({ target }) => {
            updateRangeInput(target);
        })
        .each((_, element) => {
            updateRangeInput(element);
        });
}

export function setupTabNavigation(): void {
    const wrapperCache = new ExtendedMap<HTMLElement, JQuery>();
    $(".tab").on("click", ({ target }) => {
        const tab = wrapperCache.getAndGetDefaultIfAbsent(target, () => $(target));

        tab.addClass("active");
        tab.siblings().removeClass("active");

        const tabContent = $(`#${target.id}-content`);

        tabContent.siblings().removeClass("active");
        tabContent.siblings().hide();

        tabContent.addClass("active");
        tabContent.show();
    });
}

export function setupConsoleListener(): void {
    GAME_CONSOLE.variables.addChangeListener(
        "cv_console_open",
        (_, val) => GAME_CONSOLE.isOpen = val
    );
}

export
    function setupSettingsImportExport(): void {
    $("#import-settings-btn").on("click", () => {
        if (!confirm("This option will overwrite all settings and reload the page. Continue?")) return;
        const error = (): void => { alert("Invalid config."); };

        try {
            const input = prompt("Enter a config:");
            if (!input) {
                error();
                return;
            }

            const config: unknown = JSON.parse(input);
            if (typeof config !== "object" || config === null || !("variables" in config)) {
                error();
                return;
            }

            localStorage.setItem("surviv_config", input);
            alert("Settings loaded successfully.");
            window.location.reload();
        } catch (_) {
            error();
        }
    });

    $("#export-settings-btn").on("click", () => {
        const exportedSettings = localStorage.getItem("surviv_config");
        const error = (): void => {
            alert(
                "Unable to copy settings. To export settings manually, open the dev tools with Ctrl+Shift+I (Cmd+Opt+I on Mac) "
                + "and, after typing in the following, copy the result manually: localStorage.getItem(\"surviv_config\")"
            );
        };
        if (exportedSettings === null) {
            error();
            return;
        }
        navigator.clipboard
            .writeText(exportedSettings)
            .then(() => {
                alert("Settings copied to clipboard.");
            })
            .catch(error);
    });

    $("#reset-settings-btn").on("click", () => {
        if (!confirm("This option will reset all settings and reload the page. Continue?")) return;
        if (!confirm("Are you sure? This action cannot be undone.")) return;
        localStorage.removeItem("surviv_config");
        window.location.reload();
    });
}
