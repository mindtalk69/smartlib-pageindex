/**
 * Chat Core Module - Handles core chat functionality
 */

class ChatCore {
  constructor(options = {}) {
    // Configuration
    this.config = {
      markdown: true,
      sanitize: true,
      maxMessages: 1000,
      ...options
    };

    // State
    this.state = {
      messages: [],
      activeMessageId: null,
      isProcessing: false
    };

    // Event system
    this.events = {
      messageAdded: new CustomEvent('messageAdded'),
      messageUpdated: new CustomEvent('messageUpdated'),
      stateChanged: new CustomEvent('stateChanged')
    };

    // Initialize
    this._setupMarkdown();
    this._setupEventListeners();
  }

  // Initialize markdown and sanitization
  _setupMarkdown() {
    if (this.config.markdown && typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
        // Additional markdown options can be added here
      });
    }
  }

  // Set up core event listeners
  _setupEventListeners() {
    document.addEventListener('messageAdded', (e) => this._onMessageAdded(e));
    document.addEventListener('messageUpdated', (e) => this._onMessageUpdated(e));
  }

  // Add a new message to chat
  addMessage(message) {
    if (!message || !message.content) return false;

    const newMessage = {
      id: message.id || Date.now().toString(),
      role: message.role || 'user',
      content: message.content,
      timestamp: message.timestamp || new Date().toISOString(),
      metadata: message.metadata || {},
      status: 'pending'
    };

    // Process markdown if enabled
    if (this.config.markdown && newMessage.role === 'agent') {
      newMessage.content = this._processMarkdown(newMessage.content);
    }

    this.state.messages.push(newMessage);
    // Persist only the most recent maxMessages messages to localStorage for chat restoration
    try {
      const max = this.config.maxMessages || 1000;
      const trimmed = this.state.messages.slice(-max);
      localStorage.setItem('chatHistory', JSON.stringify(trimmed));
    } catch (e) {
      console.error('[ChatCore] Failed to persist chat history to localStorage:', e);
    }
    this._triggerEvent('messageAdded', { message: newMessage });
    return newMessage.id;
  }

  // Update an existing message
  updateMessage(messageId, updates) {
    console.log(`[ChatCore] updateMessage called for ID: ${messageId}, Updates:`, updates); // Log entry
    const messageIndex = this.state.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return false;

    // Log state *before* update and the updates object itself
    console.log(`[ChatCore] State BEFORE update for ${messageId}:`, JSON.stringify(this.state.messages[messageIndex]));
    console.log(`[ChatCore] Updates object received for ${messageId}:`, JSON.stringify(updates));

    const updatedMessage = {
      ...this.state.messages[messageIndex],
      ...updates
    };

    // Reprocess markdown if content changed
    if (updates.content && this.config.markdown && updatedMessage.role === 'agent') {
      updatedMessage.content = this._processMarkdown(updatedMessage.content);
    }

    this.state.messages[messageIndex] = updatedMessage;
     // Log the *complete* state of the message AFTER the update, stringified for clarity
    console.log(`[ChatCore] Message ${messageId} updated in internal state:`, JSON.stringify(updatedMessage));

    try {
      const max = this.config.maxMessages || 1000;
      const trimmed = this.state.messages.slice(-max);
      localStorage.setItem('chatHistory', JSON.stringify(trimmed));
    } catch (e) {
      console.error('[ChatCore] Failed to persist updated chat history to localStorage:', e);
    }

    this._triggerEvent('messageUpdated', { 
      message: updatedMessage,
      previous: this.state.messages[messageIndex]
    });
    return true;
  }

  // Process markdown content
  _processMarkdown(content) {
    if (!this.config.markdown) return content;
    
    try {
      let processed = marked.parse(content);
      if (this.config.sanitize && typeof DOMPurify !== 'undefined') {
        processed = DOMPurify.sanitize(processed);
      }
      return processed;
    } catch (e) {
      console.error('Markdown processing error:', e);
      return content;
    }
  }

  // Event trigger helper
  _triggerEvent(eventName, detail) {
    console.log(`[ChatCore] Triggering event: Event='${eventName}', Detail=`, detail); // Log before dispatch
    const event = new CustomEvent(eventName, { detail });
    window.dispatchEvent(event); // Dispatch on window instead of document
    console.log(`[ChatCore] Dispatched event: '${eventName}'`); // Log after dispatch
  }

  // Event handlers
  _onMessageAdded(event) {
    // Trim messages if over limit
    if (this.state.messages.length > this.config.maxMessages) {
      this.state.messages.shift();
    }
    this.state.activeMessageId = event.detail.message.id;
    this._triggerEvent('stateChanged', { state: this.state });
  }

  _onMessageUpdated(event) {
    this._triggerEvent('stateChanged', { state: this.state });
  }

  // Clear all messages
  clearMessages() {
    this.state.messages = [];
    this.state.activeMessageId = null;
    try {
      localStorage.removeItem('chatHistory');
    } catch (e) {
      console.error('[ChatCore] Failed to remove chat history from localStorage:', e);
    }
    this._triggerEvent('stateChanged', { state: this.state }); // Notify about state change
    this._triggerEvent('chatCleared', {}); // Specific event for chat clearing
  } 

   // Start a new conversation
  async startNewConversation() {
    console.log('[ChatCore] Starting new conversation...');
    this.clearMessages(); // This clears internal state, localStorage, and triggers 'chatCleared'
    console.log('[ChatCore] Messages cleared. State message count:', this.state.messages.length);

    // ChatUI should listen to 'chatCleared' and clear its display.
    // The placeholder logic is handled by init-conversation.js on load,
    // and by updateSelfRetrieverContextVisibility on new conversation.

    // Now, update the UI to show the self-retriever context
    if (typeof window.updateSelfRetrieverContextVisibility === 'function') {
        try {
            // updateSelfRetrieverContextVisibility (from query-form.js) will hide placeholder
            // and fetch/show self-retriever questions.
            await window.updateSelfRetrieverContextVisibility();
            console.log('[ChatCore] Self-retriever context visibility updated for new conversation.');
        } catch (error) {
            console.error('[ChatCore] Error updating self-retriever context visibility:', error);
        }
    } else {
        console.warn('[ChatCore] window.updateSelfRetrieverContextVisibility is not defined.');
    }

    // Optional: Clear and focus the query input field
    const queryInput = document.getElementById('query-input');
    if (queryInput) {
        queryInput.value = '';
        queryInput.focus();
    }
  }

}




// Export for module system if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatCore;
} else {
  // Make available globally
  window.ChatCore = ChatCore;
}
