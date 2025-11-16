// Initialize chat modules
async function initChat() { // Make initChat async
    try {
    // Initialize ChatCore
    // Read maxMessages from localStorage (default 100, clamp 1-1000)
    let maxMessages = parseInt(localStorage.getItem('maxChatMessages'), 10);
    if (isNaN(maxMessages) || maxMessages < 1) maxMessages = 100;
    if (maxMessages > 1000) maxMessages = 1000;

    const ChatCoreClass = window.ChatCore;
    const ChatUIClass = window.ChatUI;

    if (!ChatCoreClass) {
      throw new Error('ChatCore global is not available. Ensure chat-core.js ran before chat-init.js.');
    }
    if (!ChatUIClass) {
      throw new Error('ChatUI global is not available. Ensure chat-ui.js ran before chat-init.js.');
    }

    window.chatCore = new ChatCoreClass({
      markdown: true,
      sanitize: true,
      maxMessages: maxMessages
    });
    console.log('[ChatInit] ChatCore initialized:', window.chatCore); // Log Core init
    
    // Initialize ChatUI
    window.chatUI = new ChatUIClass('#chat-container', {
      bubbleClass: 'chat-bubble',
      userBubbleClass: 'user-bubble',
      agentBubbleClass: 'agent-bubble'
    });
    // Wait for ChatUI to be fully ready (container found)
    await window.chatUI.readyPromise;
    console.log('[ChatInit] ChatUI initialized:', window.chatUI); // Log UI init
    console.log('[ChatInit] ChatUI is fully ready (container found).');

    // Hide placeholder if exists
    const placeholder = document.getElementById('replacement-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    // Initialize main app if available
    if (typeof initializeApp === 'function') initializeApp();
  } catch (e) {
    console.error('Chat initialization error:', e);
  }
}

// Start initialization when ready
if (document.readyState === 'complete') {
  initChat();
} else {
  document.addEventListener('DOMContentLoaded', initChat);
}
