import $ from "jquery";

// Success modal
export function successAlert(message: any, duration: any) {
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