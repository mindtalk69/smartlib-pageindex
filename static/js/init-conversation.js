/**
 * Initialize conversation from Flask template data
 */

// Wait for all required components to be loaded
function waitForDependencies() {
  return new Promise((resolve) => {
    const check = () => {
      // Also check if ChatUI has found its container element
      // Check the isReady flag set by ChatUI after container is found
      if (window.ChatCore && window.ChatUI && window.chatUI.isReady) {
        console.log('[InitConversation] Dependencies (ChatCore, ChatUI.isReady) ready.');
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// Initialize chat with conversation data
async function initConversation() {
  try {
    // Wait for required dependencies
    await waitForDependencies();

    // Check chat restoration preference and only proceed if enabled
    const restorePref = localStorage.getItem('restoreLastChatEnabled');
    const shouldRestoreChat = restorePref === null ? true : (restorePref === 'true');

    // Try to load chat history from localStorage if enabled
    let loadedFromLocalStorage = false;
    if (shouldRestoreChat) {
      const localHistory = localStorage.getItem('chatHistory');
      if (localHistory) {
        try {
          const parsedHistory = JSON.parse(localHistory);
          if (Array.isArray(parsedHistory)) {
            parsedHistory.forEach((msg, index) => {
              if (msg.role && msg.content) {
                // Check for incomplete streamed agent messages
                // The typing indicator HTML is: <div class="typing-indicator"><span></span><span></span><span></span></div>
                if (msg.role === 'agent' && msg.content.trim().includes('class="typing-indicator"')) {
                  // More robust check: if the content *only* contains the typing indicator or is very short and contains it.
                  // For simplicity, if it contains the class, we'll assume it might be an interrupted stream.
                  console.log('[InitConversation] Found potentially incomplete streamed agent message in localStorage. Modifying content.');
                  msg.content = '[Response was interrupted or incomplete due to page refresh]';
                }
                window.chatCore.addMessage(msg);
              }
            });
            loadedFromLocalStorage = true;
            console.log('[InitConversation] Restored chat from localStorage.');
          }        } catch (e) {
          console.error('[InitConversation] Failed to parse chatHistory from localStorage:', e);
        }
      }
    }

    // If not loaded from localStorage, fall back to server-provided conversation
    if (!loadedFromLocalStorage) {
      let initialConversation = [];
      try {
        if (window.__FLASK_INITIAL_CONVERSATION_JSON) {
          initialConversation = window.__FLASK_INITIAL_CONVERSATION_JSON;
        }
      } catch (e) {
        console.error('Error parsing conversation JSON:', e);
      }
      if (shouldRestoreChat && Array.isArray(initialConversation)) {
        initialConversation.forEach(msg => {
          if (msg.role && msg.content) {
            window.chatCore.addMessage(msg);
          }
        });
      }
    }

    // Initialize vector store mode if specified
    if (window.__FLASK_VECTOR_STORE_MODE === 'knowledge') {
      try {
        if (window.__FLASK_KNOWLEDGE_LIBRARIES_MAP_JSON) {
          const knowledgeMap = JSON.parse(window.__FLASK_KNOWLEDGE_LIBRARIES_MAP_JSON);
          // Initialize knowledge selection UI here if needed
        }
      } catch (e) {
        console.error('Error parsing knowledge libraries map:', e);
      }
    }

  } catch (error) {
    console.error('Conversation initialization error:', error);
  }

  // UI adjustments based on whether chat has messages after initialization
  // Wait a microtask for chatCore.addMessage calls to fully process and update state
  await new Promise(resolve => setTimeout(resolve, 0));

  const selfRetriever = document.getElementById('self-retriever-context');
  const placeholder = document.getElementById('replacement-placeholder');
  const finalMessageCount = window.chatCore.state.messages.length;

  if (finalMessageCount > 0) {
    if (selfRetriever) selfRetriever.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';
    console.log('[InitConversation] Chat has messages. Self-retriever and placeholder hidden.');
  } else {
    // Chat is empty
    if (selfRetriever) selfRetriever.style.display = 'none';
    // Let text-animations.js handle showing the placeholder and starting its animation
    if (typeof window.startPlaceholderAnimationAndShow === 'function') {
      console.log('[InitConversation] Chat is empty. Calling startPlaceholderAnimationAndShow.');
      window.startPlaceholderAnimationAndShow();
    } else {
      // Fallback if the animation function isn't available
      if (placeholder) placeholder.style.display = 'block';
      console.warn('[InitConversation] window.startPlaceholderAnimationAndShow function not found. Manually showing placeholder.');
    }
  }
  // The call to window.updateSelfRetrieverContextVisibility() has been removed from here.
  // It should not be called on initial load if the goal is to hide self-retriever-context.
}
/**
 * Ensure self-retriever-context only appears when chat is empty and user clicks new-conversation-btn
 * THIS FUNCTION IS BEING REMOVED FROM THIS FILE.
 * Its logic, when needed (i.e., after a "New Conversation" click), should be handled
 * by a function in query-form.js or similar, called by the main new conversation handler.
 */
// window.updateSelfRetrieverContextVisibility = function() { ... }; // REMOVED

// Start initialization when DOM is ready
if (document.readyState === 'complete') {
  initConversation();
} else {
  document.addEventListener('DOMContentLoaded', initConversation);
}
