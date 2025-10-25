/**
 * Main Application Entry Point - Integrates Chat Modules
 */

// Global state references
let chatCore;
let chatUI;

document.addEventListener("DOMContentLoaded", function() {
  console.log("Main.js loaded - Initializing chat modules");

  // Check if we're in the authenticated view
  const isAuthenticatedView = document.getElementById("query-form") !== null;
  if (!isAuthenticatedView) {
    console.log("Skipping chat initialization in non-authenticated view");
    return;
  }

  // Initialize chat modules
  initializeChatModules();

  // ChatUI is initialized in chat-init.js
  if (window.chatUI) {
    console.log('ChatUI already initialized');
  } else {
    console.warn('ChatUI not initialized - check chat-init.js');
  }

  // Initialize history panel
  initializeHistoryPanel();

  // Refresh counters
  refreshCounters();
});

function initializeChatModules() {
  // Use globally initialized chat modules
  chatCore = window.chatCore;
  chatUI = window.chatUI;
}

function initializeHistoryPanel() {
  const historyOffcanvasBody = document.getElementById('historyOffcanvasBody');
  if (!historyOffcanvasBody) return;

  historyOffcanvasBody.addEventListener('click', function(e) {
    if (e.target.closest('.history-item span')) {
      const queryInput = document.querySelector("textarea[name='query']");
      if (queryInput) {
        queryInput.value = e.target.closest('.history-item span').getAttribute('title').split(' - ')[1];
        queryInput.focus();
      }
    }
  });
}

function refreshCounters() {
  fetch("/api/counters", { method: "GET", credentials: "include" })
    .then(response => {
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    })
    .catch(error => {
      console.error('Error:', error);
      showToast(error.message || 'An error occurred', 'danger');
    });
}

// Make functions globally accessible
window.appendMessage = function(role, text, citations, usage_metadata, suggested_questions, messageId) {
  console.log('appendMessage called:', {role, text, messageId});
  
  if (window.chatCore) {
    console.log('chatCore available');
    
    // Hide self-retriever context when sending questions
    if (role === 'user') {
      const selfRetriever = document.getElementById('self-retriever-context');
      console.log('Hiding self-retriever:', selfRetriever);
      if (selfRetriever) {
        selfRetriever.style.display = 'none';
        console.log('Self-retriever hidden');
      }
    }

    // Handle user messages
    if (role === 'user') {
      // First add the user message
      const userMessage = {
        role: 'user',
        content: text,
        metadata: {},
        messageId: 'user-' + Date.now(),
        options: {
          bubbleClass: 'user-bubble' // Explicitly set user bubble class
        }
      };
      
      // Add to both chatCore and chatUI
      window.chatCore.addMessage(userMessage);
      if (window.chatUI) {
        window.chatUI.addMessage(userMessage);
      } else {
        console.error('chatUI not available for user message');
      }

      // Hide self-retriever and clear input
      const selfRetriever = document.getElementById('self-retriever-context');
      const queryInput = document.querySelector('#query-input');
      
      if (selfRetriever) {
        selfRetriever.style.display = 'none';
        console.log('Self-retriever hidden');
      }
      
      if (queryInput) {
        queryInput.value = '';
        console.log('Input cleared');
      }

      // Update self-retriever context visibility after user message
      if (typeof window.updateSelfRetrieverContextVisibility === "function") {
        window.updateSelfRetrieverContextVisibility();
      }
      
      return; // Don't process further for user messages
    }

    // For agent messages, ensure we have the last user message
    if (role === 'agent') {
      const lastUserMessage = document.querySelector('.user-bubble:last-child');
      if (!lastUserMessage) {
        const queryText = document.querySelector('#query-input')?.value;
        if (queryText) {
          const tempUserMessage = {
            role: 'user',
            content: queryText,
            metadata: {},
            messageId: 'temp-user-' + Date.now(),
            options: {
              bubbleClass: 'user-bubble' // Explicitly set user bubble class
            }
          };
          window.chatCore.addMessage(tempUserMessage);
          if (window.chatUI) window.chatUI.addMessage(tempUserMessage);
        }
      }
    }

    // Add the new message
    console.log('Adding message:', {role, text});
    const message = {
      role: role,
      content: text,
      metadata: {
        citations: citations,
        suggestedQuestions: suggested_questions || [],
        usageMetadata: usage_metadata || {}
      },
      messageId: messageId
    };

    // Add to both chatCore and chatUI
    window.chatCore.addMessage(message);
    if (window.chatUI) {
      window.chatUI.addMessage(message);
    } else {
      console.error('chatUI not available');
    }

    // Update self-retriever context visibility after agent message
    if (typeof window.updateSelfRetrieverContextVisibility === "function") {
      window.updateSelfRetrieverContextVisibility();
    }
  } else {
    console.error('chatCore not available');
  }
};

window.showLoading = function() {
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
  }
};

window.hideLoading = function() {
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
};

window.refreshCounters = refreshCounters;

// "New Conversation" button clears chat bubbles
// document.addEventListener("DOMContentLoaded", function() {
//   const newConversationBtn = document.getElementById("new-conversation-btn");
//   if (newConversationBtn) {
//     newConversationBtn.addEventListener("click", async function() { // Made async for potential await calls
//       console.log('[MainJS] "New Conversation" button clicked.');

//       // Clear chat container
//       const chatContainer = document.getElementById("chat-container");
//       if (chatContainer) {
//         while (chatContainer.firstChild) {
//           chatContainer.removeChild(chatContainer.firstChild);
//         }
//         console.log('[MainJS] Chat container DOM cleared directly.');
//       }

//       // Reset chatCore state (this clears messages and should also clear localStorage via chatCore)
//       if (window.chatCore && typeof window.chatCore.clearMessages === "function") {
//         await window.chatCore.clearMessages(); // Use await if clearMessages becomes async
//         console.log('[MainJS] window.chatCore.clearMessages() called.');
//       }

//       // Optionally reset chatUI state directly if needed (might be redundant if ChatUI listens to chatCore events)
//       if (window.chatUI && typeof window.chatUI.clearMessages === "function") {
//         window.chatUI.clearMessages();
//         console.log('[MainJS] window.chatUI.clearMessages() called.');
//       }

//       // Explicitly hide the replacement-placeholder
//       const placeholder = document.getElementById('replacement-placeholder');
//       if (placeholder) {
//         placeholder.style.display = 'none';
//         console.log('[MainJS] replacement-placeholder hidden.');
//       }

//       // Call the global function to show self-retriever context (and fetch its questions)
//       if (typeof window.updateSelfRetrieverContextVisibility === "function") {
//         await window.updateSelfRetrieverContextVisibility(); // Use await if it's async (e.g., fetches questions)
//         console.log('[MainJS] window.updateSelfRetrieverContextVisibility() called to show self-retriever.');
//       } else {
//         // Fallback: If the global function isn't defined, try to show self-retriever directly.
//         // This part might be less ideal as it wouldn't fetch dynamic questions.
//         const selfRetriever = document.getElementById('self-retriever-context');
//         if (selfRetriever) selfRetriever.style.display = 'block'; // Or 'flex'
//         console.warn('[MainJS] window.updateSelfRetrieverContextVisibility is not defined. Attempted to show self-retriever directly.');
//       }
//     });
//   }
// });

// Restore "Capture Screen" feature
document.addEventListener("DOMContentLoaded", function() {
  const captureScreenLink = document.getElementById("capture-screen-link");
  if (captureScreenLink) {
    captureScreenLink.addEventListener("click", async function(e) {
      e.preventDefault();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("Screen capture is not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();

        // Draw the bitmap to a canvas
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

        // Convert canvas to data URL and set as attached image (like attach-file-link)
        canvas.toBlob(function(blob) {
          const reader = new FileReader();
          reader.onloadend = function() {
            // reader.result is a data URL: "data:image/png;base64,...."
            const dataUrl = reader.result;
            // Set preview and global vars as in query-form.js
            const imagePreview = document.getElementById('image-preview');
            const imagePreviewContainer = document.getElementById('image-preview-container');
            if (imagePreview && imagePreviewContainer) {
              imagePreview.src = dataUrl;
              imagePreviewContainer.style.display = 'block';
            }
            // Set global vars for query-form.js
            const parts = dataUrl.split(',');
            // Always set window-scoped variables for compatibility with query-form.js
            window.currentImageMimeType = parts[0].match(/:(.*?);/)[1];
            window.currentImageBase64 = parts[1];
            console.log("[Capture Screen] Set window.currentImageMimeType:", window.currentImageMimeType);
            console.log("[Capture Screen] Set window.currentImageBase64 (first 100 chars):", window.currentImageBase64?.slice(0, 100));
            // Focus query input and set placeholder if empty
            const queryInput = document.getElementById('query-input');
            if (queryInput) {
              queryInput.focus();
              if (!queryInput.value.trim()) {
                queryInput.value = "Screenshot attached";
              }
            }
            // Note: clearing of image preview and variables after sending is handled in query-form.js
          };
          reader.readAsDataURL(blob);
        }, "image/png");

        // Stop the video track to release the screen
        track.stop();
      } catch (err) {
        alert("Screen capture failed: " + (err.message || err));
      }
    });
  }
});
