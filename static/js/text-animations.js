// --- Global Scope Variables ---
let animationTimer = null;
let currentMovementAnimation = null;
let currentGradientClass = null;
let textElement = null; // Will be assigned in DOMContentLoaded

// --- Constants ---
// Available movement animations
const movementAnimations = [
    'floating-animation',
    'bounce-animation',
    'shake-animation',
    'pulse-animation'
];
// Available gradient classes
const gradientClasses = [
    'gradient-1',
    'gradient-2',
    'gradient-3',
    'gradient-4'
];

// --- Functions ---

// Function to start/restart the random animation cycle
function startRandomCycle() {
    if (!textElement) return; // Exit if element not found

    // Function to apply the next set of classes with smooth transitions
    const applyNextCycle = () => {
        if (!textElement) return; // Check again inside timeout

        // Pick random movement animation
        const movementIndex = Math.floor(Math.random() * movementAnimations.length);
        const newMovement = movementAnimations[movementIndex];
        
        // Pick random gradient class (ensure it's different from current)
        let gradientIndex;
        let newGradient;
        do {
            gradientIndex = Math.floor(Math.random() * gradientClasses.length);
            newGradient = gradientClasses[gradientIndex];
        } while (newGradient === currentGradientClass && gradientClasses.length > 1);

        // Apply transition class first
        textElement.style.transition = 'all 0.8s ease-in-out';
        
        // Remove old classes after a micro delay
        requestAnimationFrame(() => {
            if (currentMovementAnimation) {
                textElement.classList.remove(currentMovementAnimation);
            }
            if (currentGradientClass) {
                textElement.classList.remove(currentGradientClass);
            }
            
            // Apply new classes in next frame
            requestAnimationFrame(() => {
                currentMovementAnimation = newMovement;
                currentGradientClass = newGradient;
                textElement.classList.add(newMovement, newGradient);
                console.log("DEBUG: Smoothly applied movement:", newMovement, "Gradient:", newGradient);
            });
        });

        // Set random duration for the next cycle (increased minimum for smoother transitions)
        const randomDuration = Math.random() * (12000 - 4000) + 4000; // 4-12 seconds
        
        // Clear existing timer
        if (animationTimer) {
            clearTimeout(animationTimer);
        }

        // Schedule the next cycle
        animationTimer = setTimeout(startRandomCycle, randomDuration);
    };

    // Remove previous classes first
    if (currentMovementAnimation) {
        textElement.classList.remove(currentMovementAnimation);
    }
    if (currentGradientClass) {
        textElement.classList.remove(currentGradientClass);
    }

    // Use a small timeout to allow DOM to update after class removal
    setTimeout(applyNextCycle, 50); 
}

// Function to stop the animation cycle (e.g., on input focus)
function stopAnimationCycle() {
    if (!textElement) return;
    console.log("Input event: Stopping animation cycle.");
    if (animationTimer) {
        clearTimeout(animationTimer);
        animationTimer = null;
    }
}

// Function to hide the placeholder element (e.g., on actual input or when other content appears)
function hidePlaceholderElement() {
    if (!textElement) return; // textElement implies placeholder is somewhat initialized
    console.log("Hiding placeholder element.");
    // Clear animation timer
    if (animationTimer) {
        clearTimeout(animationTimer);
        animationTimer = null;
    }
    // Remove current movement and gradient classes
    if (currentMovementAnimation) {
        textElement.classList.remove(currentMovementAnimation);
        currentMovementAnimation = null;
    }
    if (currentGradientClass) {
        textElement.classList.remove(currentGradientClass);
        currentGradientClass = null;
    }

    // Get the main placeholder container
    const replacementPlaceholder = document.getElementById('replacement-placeholder');
    if (!replacementPlaceholder) {
        console.error("Cannot hide placeholder: #replacement-placeholder not found.");
        return;
    }

    // Add fade out using Animate.css if available, otherwise just hide
    if (typeof AnimateCSS === 'function') {
        AnimateCSS(replacementPlaceholder, 'fadeOut').then(() => {
            replacementPlaceholder.style.display = 'none'; // Hide after fade
        });
    } else {
        // Fallback to simple hide after a delay
        replacementPlaceholder.style.opacity = '0';
        replacementPlaceholder.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
            replacementPlaceholder.style.display = 'none';
            replacementPlaceholder.style.opacity = '1'; // Reset for next time
        }, 500);
    }
}

// Function to clear chat messages and show the existing placeholder animation
function clearChatAndRestartAnimation() {
    console.log("DEBUG: >>> clearChatAndRestartAnimation function CALLED <<<");
    // This function might be largely redundant if its 'new-conversation-btn' listener
    // has been removed or modified to not directly control placeholder visibility.
    console.log("Clearing chat and showing placeholder animation...");

    // 1. Clear chat messages container
    const chatMessagesContainer = document.getElementById('chat-container');
    if (chatMessagesContainer) {
        chatMessagesContainer.innerHTML = ''; // Remove all message elements
    } else {
        console.error("Chat messages container (#chat-messages) not found!");
        return;
    }

    // 2. Find the existing placeholder structure
    const replacementPlaceholder = document.getElementById('replacement-placeholder');
    if (!replacementPlaceholder) {
        console.error("Existing placeholder container (#replacement-placeholder) not found!");
        return;
    }
    const placeholderSpan = replacementPlaceholder.querySelector('.ai-text-animation');
    if (!placeholderSpan) {
        console.error("Placeholder text span (.ai-text-animation) not found within #replacement-placeholder!");
        return;
    }

    // 3. Re-assign the global textElement variable
    textElement = placeholderSpan;

    // 4. Make the placeholder visible again
    replacementPlaceholder.style.display = 'flex'; // Use flex as defined in index.html
    textElement.style.display = 'inline-block'; // Ensure span is visible
    textElement.classList.remove('animate__fadeOutUp', 'animate__animated'); // Remove hiding classes if any

    // 5. Restart the animation cycle
    if (animationTimer) {
        clearTimeout(animationTimer);
    }
    // Remove any existing animation classes before starting new cycle
    if (currentMovementAnimation) textElement.classList.remove(currentMovementAnimation);
    if (currentGradientClass) textElement.classList.remove(currentGradientClass);
    currentMovementAnimation = null;
    currentGradientClass = null;
    
    startRandomCycle(); // Start the cycle immediately

    // Show self-retriever boxes above the placeholder
    if (typeof window.showSelfRetrieverBoxesOnNewConversation === 'function') {
        window.showSelfRetrieverBoxesOnNewConversation();
    }
}

// --- Global Control Functions ---

/**
 * Shows the replacement placeholder and starts its animation cycle.
 * This function can be called from other scripts.
 */
function startPlaceholderAnimationAndShow() {
    const replacementPlaceholder = document.getElementById('replacement-placeholder');
    if (!replacementPlaceholder) {
        console.error("Cannot start placeholder animation: #replacement-placeholder not found.");
        return;
    }
    // Ensure textElement is assigned if not already
    if (!textElement) {
        textElement = replacementPlaceholder.querySelector('.ai-text-animation');
    }
    if (!textElement) {
        console.error("Cannot start placeholder animation: .ai-text-animation span not found within #replacement-placeholder.");
        return;
    }

    replacementPlaceholder.style.display = 'flex'; // Or 'block' if that's your preferred display
    startRandomCycle(); // This function already handles clearing previous timers and classes
}
window.startPlaceholderAnimationAndShow = startPlaceholderAnimationAndShow; // Expose globally

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded. Initializing animations and listeners.");

    // Helper to initialize animation if placeholder is present
    function tryInitAnimation() {
        var replacementPlaceholder = document.getElementById('replacement-placeholder');
        if (!replacementPlaceholder) return false;

        // textElement will be assigned by startPlaceholderAnimationAndShow if needed

        // Check if the placeholder should be visible initially
        // This check is now primarily handled by init-conversation.js.
        // init-conversation.js will call window.startPlaceholderAnimationAndShow if chat is empty.
        // However, we can keep a fallback here for robustness or if text-animations.js is loaded standalone.
        const chatContainer = document.getElementById('chat-container'); // Use chat-container for consistency
        const isChatEmptyInitially = !chatContainer || chatContainer.children.length === 0;

        if (isChatEmptyInitially && (replacementPlaceholder.style.display === 'block' || replacementPlaceholder.style.display === 'flex')) {
            console.log("[TextAnimations] Initial DOMContentLoaded: Chat is empty and placeholder is visible, ensuring animation starts.");
            startPlaceholderAnimationAndShow(); // Call the global function
            return true;
        }
        return false;
    }

    // Try to initialize immediately
    if (!tryInitAnimation()) {
        // If not found, observe the chat-content for the placeholder being added
        var chatContent = document.querySelector('.chat-content');
        if (chatContent) {
            var observer = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var mutation = mutations[i];
                    if (mutation.type === 'childList') {
                        if (tryInitAnimation()) {
                            observer.disconnect();
                            break;
                        }
                    }
                }
            });
            observer.observe(chatContent, { childList: true, subtree: true });
        }
    }

    // Add listener for input focus to stop animation
    const queryInput = document.getElementById('query-input');
    if (queryInput) {
        queryInput.addEventListener('focus', function() {
            console.log("Input focused.");
            stopAnimationCycle(); // Stop animation cycle on focus
        });
        queryInput.addEventListener('input', function() { // Hide element on actual input
            console.log("Input event detected (user is typing).");
            const replacementPlaceholder = document.getElementById('replacement-placeholder');
            if (replacementPlaceholder && (replacementPlaceholder.style.display === 'block' || replacementPlaceholder.style.display === 'flex')) {
                hidePlaceholderElement();
            }
        });
    }

    // Wait for Bootstrap to initialize dropdowns and try multiple methods
    // setTimeout(() => {
    //     // Try direct access by ID first
    //     let newConversationButton = document.getElementById('new-conversation-btn');
        
    //     // If ID fails, try alternate selectors
    //     if (!newConversationButton) {
    //         newConversationButton = document.querySelector('.dropup ul li:first-child a.dropdown-item');
    //         console.log("DEBUG: Using fallback selector for New Conversation button");
    //     }
        
    //     if (newConversationButton) {
    //         console.log("DEBUG: Found New Conversation button, adding click listener");
    //         newConversationButton.addEventListener('click', function(event) {
    //             console.log("DEBUG: New Conversation button CLICKED!"); 
    //             event.preventDefault(); 
    //             clearChatAndRestartAnimation(); 
    //         });
            
    //         // Also add click handler to the dropdown toggle button as backup
    //         const dropdownToggle = document.getElementById('add-context-btn');
    //         if (dropdownToggle) {
    //             dropdownToggle.addEventListener('click', function(event) {
    //                 console.log("DEBUG: Dropdown toggle clicked, checking first item");
    //                 // Small delay to let dropdown open
    //                 setTimeout(() => {
    //                     const firstItem = document.querySelector('.dropup ul li:first-child a.dropdown-item');
    //                     if (firstItem) {
    //                         console.log("DEBUG: Found first dropdown item after toggle click");
    //                     }
    //                 }, 100);
    //             });
    //         }
    //     } else {
    //         console.error("DEBUG: Could not find New Conversation button with any method"); 
    //         // Detailed debug info
    //         console.log("DEBUG: Dropdown structure:", {
    //             dropupExists: !!document.querySelector('.dropup'),
    //             menuExists: !!document.querySelector('.dropdown-menu'),
    //             itemsCount: document.querySelectorAll('.dropdown-item').length,
    //             menuHTML: document.querySelector('.dropdown-menu')?.innerHTML
    //         });
    //     }
    // }, 500); // Ensure Bootstrap is ready
});
