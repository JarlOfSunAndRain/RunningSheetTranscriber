/**
 * Modal Component
 * Simple reusable modal dialog system.
 */
const Modal = (() => {
    const overlay = () => document.getElementById('modal-overlay');
    const container = () => document.getElementById('modal-container');

    /**
     * Show a modal with the given options
     * @param {Object} options
     * @param {string} options.title - Modal title
     * @param {string|HTMLElement} options.body - HTML string or DOM element for the body
     * @param {Array} options.buttons - Array of { label, class, onClick }
     * @param {Function} options.onClose - Called when modal is closed
     */
    function show({ title, body, buttons = [], onClose = null, width = null }) {
        const modalContainer = container();
        if (width) {
            modalContainer.style.maxWidth = width;
        } else {
            modalContainer.style.maxWidth = '560px';
        }

        let html = `
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body" id="modal-body-content">
        ${typeof body === 'string' ? body : ''}
      </div>
    `;

        if (buttons.length > 0) {
            html += `<div class="modal-footer" id="modal-footer">`;
            buttons.forEach((btn, i) => {
                html += `<button class="btn ${btn.class || btn.className || 'btn-secondary'}" id="modal-btn-${i}">${btn.label}</button>`;
            });
            html += `</div>`;
        }

        modalContainer.innerHTML = html;

        // If body is a DOM element, append it
        if (typeof body !== 'string' && body instanceof HTMLElement) {
            document.getElementById('modal-body-content').appendChild(body);
        }

        // Bind close button
        document.getElementById('modal-close-btn').addEventListener('click', () => {
            hide();
            if (onClose) onClose();
        });

        // Bind action buttons
        buttons.forEach((btn, i) => {
            document.getElementById(`modal-btn-${i}`).addEventListener('click', () => {
                if (btn.onClick) btn.onClick();
            });
        });

        // Modal stays open until a button is used — no click-outside-to-close

        // Escape key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                hide();
                if (onClose) onClose();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        overlay().classList.remove('hidden');
    }

    /**
     * Hide the modal
     */
    function hide() {
        overlay().classList.add('hidden');
        container().innerHTML = '';
    }

    /**
     * Show a confirmation dialog
     */
    function confirm({ title, message, confirmLabel = 'Confirm', confirmClass = 'btn-primary', onConfirm }) {
        show({
            title,
            body: `<p style="color: var(--text-secondary); line-height: 1.6;">${message}</p>`,
            buttons: [
                { label: 'Cancel', class: 'btn-secondary', onClick: () => hide() },
                {
                    label: confirmLabel,
                    class: confirmClass,
                    onClick: () => {
                        hide();
                        if (onConfirm) onConfirm();
                    },
                },
            ],
        });
    }

    return { show, hide, close: hide, confirm };
})();
