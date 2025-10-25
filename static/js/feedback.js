/**
 * Feedback Module - Handles message feedback (like/dislike)
 */

class FeedbackHandler {
  constructor() {
    this._setupEventListeners();
  }

  _setupEventListeners() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      if (button.classList.contains('like-btn')) {
        this._sendFeedback('like', button);
      } else if (button.classList.contains('dislike-btn')) {
        this._sendFeedback('dislike', button);
      } else if (button.classList.contains('copy-btn')) {
        this._handleCopy(button);
      }
    });
    }

  _handleCopy(button) {
    // Find the parent message bubble using the data attribute, which is the most reliable selector.
    const messageBubble = button.closest('[data-message-id]');
    if (!messageBubble) {
      console.error("Copy button clicked, but couldn't find parent message bubble with [data-message-id].");
      return;
    }

    // Find the specific content container within that bubble.
    const contentElement = messageBubble.querySelector('.bubble-content');
    if (!contentElement) {
      console.error("Could not find .bubble-content within the message bubble to copy.");
      return;
    }

    // To get a clean copy, clone the node, remove unwanted elements (like charts/maps), then get textContent.
    const contentClone = contentElement.cloneNode(true);
    contentClone.querySelectorAll('.generated-chart-container, .generated-map-container, .user-message-with-image img').forEach(el => el.remove());

    // Now get the text from the cleaned-up clone.
    const messageText = contentClone.textContent;

    if (!messageText || !messageText.trim()) {
        showToast('Nothing to copy.', 'info');
        return;
    }
    navigator.clipboard.writeText(messageText.trim())
      .then(() => {
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="bi bi-check-lg"></i>';
        setTimeout(() => { button.innerHTML = originalIcon; }, 1500);
        showToast('Copied to clipboard!', 'success');
      })
      .catch(err => {
        console.error('Copy error:', err);
        showToast('Failed to copy text', 'danger');
      });
  }

  _sendFeedback(type, button) {
    const messageId = button.closest('[data-message-id]')?.dataset.messageId;
    if (!messageId) return;

    window.fetchWithCsrfRetry('/api/message_feedback', { // Use fetchWithCsrfRetry
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': window.readCurrentCsrfToken() // Use global reader
      },
      body: JSON.stringify({
        message_id: messageId,
        feedback_type: type
      })
    })
    .then(response => {
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    })
    .then(() => {
      // Visual feedback
      button.classList.add('active');
      button.disabled = true; // Prevent multiple feedbacks
      showToast('Feedback sent!', 'success');
      setTimeout(() => button.classList.remove('active'), 1000);
    })
    .catch(error => {
      console.error('Feedback error:', error);
      showToast(error.message || 'Failed to send feedback', 'danger');
    });
  }

}

// Initialize if not in module system
if (typeof module === 'undefined') {
  window.feedbackHandler = new FeedbackHandler();
}
