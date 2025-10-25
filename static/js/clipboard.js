/**
 * Clipboard Module - Handles copying text to clipboard
 */

class ClipboardHandler {
  constructor() {
    this._setupEventListeners();
  }

  _setupEventListeners() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('.copy-btn');
      if (button) {
        this._handleCopy(button);
      }
    });
  }

  _handleCopy(button) {
    const messageText = button.closest('.chat-message')?.querySelector('.chat-bubble')?.textContent;
    if (!messageText) return;

    navigator.clipboard.writeText(messageText.trim())
      .then(() => {
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="bi bi-check-lg"></i>';
        setTimeout(() => { button.innerHTML = originalIcon; }, 1500);
      })
      .catch(err => {
        console.error('Copy error:', err);
        showToast('Failed to copy text', 'danger');
      });
  }
}

// Initialize if not in module system
if (typeof module === 'undefined') {
  window.clipboardHandler = new ClipboardHandler();
}
