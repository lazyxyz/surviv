import $ from "jquery";

const ALERT_DURATION = 2000;

// Success modal
export function successAlert(message: string, duration: number = ALERT_DURATION) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.innerHTML =
        `
        <div class="modal-success">
            <div class="modal-success-body">
                <i class="fa-solid fa-circle-check"></i>
                 <p>${message}</p>
            </div>
            <span class="dialog-close-btn fa-solid fa-xmark close-popup" id="close-customize"></span>
        </div>
    `;

    document.body.appendChild(alertDiv);

    //close popup
    $(".close-popup").on("click", () => {
        alertDiv.remove();
    });

    // Auto-remove after specified duration
    setTimeout(() => {
        alertDiv.remove();
    }, duration);
}

// Warning modal
export function warningAlert(message: string, duration: number = ALERT_DURATION) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.innerHTML =
        `
        <div class="warning-error">
            <div class="modal-error-body">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>${message}</p>
            </div>
            <span class="dialog-close-btn fa-solid fa-xmark close-popup" id="close-customize"></span>
        </div>
    `;

    document.body.appendChild(alertDiv);

    //close popup
    $(".close-popup").on("click", () => {
        alertDiv.remove();
    });

    // Auto-remove after specified duration
    setTimeout(() => {
        alertDiv.remove();
    }, duration);
}

// Error modal
export function errorAlert(message: string, duration: number = ALERT_DURATION) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.innerHTML =
        `
        <div class="modal-error">
            <div class="modal-error-body">
                <i class="fa-solid fa-circle-xmark"></i>
                <p>${message}</p>
            </div>
            <span class="dialog-close-btn fa-solid fa-xmark close-popup" id="close-customize"></span>
        </div>
    `;

    document.body.appendChild(alertDiv);

    //close popup
    $(".close-popup").on("click", () => {
        alertDiv.remove();
    });

    // Auto-remove after specified duration
    setTimeout(() => {
        alertDiv.remove();
    }, duration);
}