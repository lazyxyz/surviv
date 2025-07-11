import { random } from "@common/utils/random";
import $ from "jquery";

const ALERT_DURATION = 2000;

const alertDiv = document.createElement('div');
alertDiv.className = "modal-alert";

// Success modal
export function successAlert(message: string, duration: number = ALERT_DURATION) {
    // Create alert element
    const idRandom = Math.floor(Math.random() * 10000000);

    const alertChild = $(
        `
        <div class="modal-success" id="${idRandom}">
            <div class="modal-success-body">
                <i class="fa-solid fa-circle-check"></i>
                <p>${message}</p>
            </div>
            <span class="dialog-close-btn fa-solid fa-xmark close-popup" id="close-customize"></span>
        </div>
    `)


    alertDiv.append(alertChild[0]);

    document.body.appendChild(alertDiv);

    //close popup
    $(".close-popup").on("click", (event) => {
        event.target.parentElement?.remove();
    });

    // Auto-remove after specified duration
    setTimeout(() => {
        alertChild.css("opacity", "0");
        setTimeout(() => {
            alertChild.remove();
            if (!alertDiv.children.length) {
                alertDiv.remove();
            }

        }, 300)

    }, duration);

}

// Warning modal
export function warningAlert(message: string, duration: number = ALERT_DURATION) {
    // Create alert element
    const idRandom = Math.floor(Math.random() * 10000000);

    const alertChild = $(
        `
        <div class="modal-warning" id="${idRandom}">
            <div class="modal-warning-body">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>${message}</p>
            </div>
            <span class="dialog-close-btn fa-solid fa-xmark close-popup" id="close-customize"></span>
        </div>
    `)


    alertDiv.append(alertChild[0]);

    document.body.appendChild(alertDiv);

    //close popup
    $(".close-popup").on("click", (event) => {
        event.target.parentElement?.remove();
    });

    // Auto-remove after specified duration
    setTimeout(() => {
        alertChild.css("opacity", "0");
        setTimeout(() => {
            alertChild.remove();
            if (!alertDiv.children.length) {
                alertDiv.remove();
            }

        }, 300)

    }, duration);

}

// Error modal
export function errorAlert(message: string, duration: number = ALERT_DURATION) {
    // Create alert element
    const idRandom = Math.floor(Math.random() * 10000000);

    const alertChild = $(
        `
        <div class="modal-error" id="${idRandom}">
            <div class="modal-error-body">
                <i class="fa-solid fa-circle-xmark"></i>
                <p>${message}</p>
            </div>
            <span class="dialog-close-btn fa-solid fa-xmark close-popup" id="close-customize"></span>
        </div>
    `)


    alertDiv.append(alertChild[0]);

    document.body.appendChild(alertDiv);

    //close popup
    $(".close-popup").on("click", (event) => {
        event.target.parentElement?.remove();
    });

    // Auto-remove after specified duration
    setTimeout(() => {
        alertChild.css("opacity", "0");
        setTimeout(() => {
            alertChild.remove();
            if (!alertDiv.children.length) {
                alertDiv.remove();
            }

        }, 300)

    }, duration);

}