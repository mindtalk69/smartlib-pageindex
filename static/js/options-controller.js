// options-controller.js
console.log("[Options Controller] Script file loading..."); // ADDED: Check if file is loaded at all

// Try finding crucial elements immediately when script parses
const immediateOptionsToggleBtn = document.getElementById('options-toggle-btn');
const immediateOptionsPanel = document.getElementById('animation-options-panel');
console.log("[Options Controller] Immediate element check:", {
    optionsToggleBtn: !!immediateOptionsToggleBtn,
    optionsPanel: !!immediateOptionsPanel
});
if (immediateOptionsToggleBtn) console.log("[Options Controller] Immediate Toggle button parent:", immediateOptionsToggleBtn.parentElement?.outerHTML);
if (immediateOptionsPanel) console.log("[Options Controller] Immediate Options panel parent:", immediateOptionsPanel.parentElement?.outerHTML);


// Handles the UI interactions for the animation options panel.
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Options Controller] DOMContentLoaded fired."); // Log script start

    // Re-find elements within the listener to ensure they are definitely ready
    // Find elements within the modal
    const optionsModal = document.getElementById('animationOptionsModal'); // Get modal itself
    const optionsToggleBtn = document.getElementById('options-toggle-btn'); // Button that triggers modal
    const enableSwitch = document.getElementById('enable-bg-animation'); // Control inside modal
    const selectDropdown = document.getElementById('select-bg-animation'); // Control inside modal

    // Log element finding results
    console.log("[Options Controller] Finding elements:", {
        optionsModal: !!optionsModal, // Check modal exists
        optionsToggleBtn: !!optionsToggleBtn, // Check trigger button exists
        enableSwitch: !!enableSwitch, // Check control inside modal
        selectDropdown: !!selectDropdown // Check control inside modal
    });


    // Find MMR toggle
    const mmrToggle = document.getElementById('enable-mmr-mode');

    // Check if controls inside the modal exist
    if (!optionsModal || !enableSwitch || !selectDropdown) {
        console.error("[Options Controller] Modal or controls within modal not found. Aborting initialization.");
        if (optionsModal) console.log("[Options Controller] Modal parent:", optionsModal.parentElement?.outerHTML);
        return;
    }
    // Note: optionsToggleBtn is only needed to trigger the modal via Bootstrap attributes, not directly in JS now.

    console.log("[Options Controller] Modal and controls found.");

    // --- REMOVED Event Listener for Navbar Toggle ---
    // Bootstrap handles modal toggling via data attributes now.


    // --- Load Initial Settings from localStorage (Applies to controls inside modal) ---
    const currentEnabled = localStorage.getItem('backgroundAnimationEnabled') ?? 'true'; // Default to true
    const currentSelected = localStorage.getItem('backgroundAnimationSelected') ?? 'particles'; // Default to particles

    enableSwitch.checked = (currentEnabled === 'true');
    selectDropdown.value = currentSelected;

    // --- MMR Toggle: Load from localStorage ---
    if (mmrToggle) {
        const mmrPref = localStorage.getItem('mmrModeEnabled');
        mmrToggle.checked = mmrPref === null ? true : (mmrPref === 'true');
        mmrToggle.addEventListener('change', () => {
            localStorage.setItem('mmrModeEnabled', mmrToggle.checked ? 'true' : 'false');
            console.log(`[Options Controller] MMR mode setting changed: ${mmrToggle.checked}`);
        });
        console.log(`[Options Controller] MMR toggle initialized: ${mmrToggle.checked}`);
    }

    // Restore last chat toggle logic
    const restoreChatToggle = document.getElementById('enable-restore-chat');
    const maxChatMessagesInput = document.getElementById('max-chat-messages');
    if (restoreChatToggle) {
        const restorePref = localStorage.getItem('restoreLastChatEnabled');
        restoreChatToggle.checked = restorePref === null ? true : (restorePref === 'true');

        // Initialize maxChatMessages input
        let maxChatMessages = parseInt(localStorage.getItem('maxChatMessages'), 10);
        if (isNaN(maxChatMessages)) maxChatMessages = 100;
        if (maxChatMessagesInput) {
            maxChatMessagesInput.value = maxChatMessages;
            maxChatMessagesInput.min = 1;
            maxChatMessagesInput.max = 1000;
            maxChatMessagesInput.step = 1;
            maxChatMessagesInput.disabled = !restoreChatToggle.checked;
            maxChatMessagesInput.addEventListener('input', () => {
                let val = parseInt(maxChatMessagesInput.value, 10);
                if (isNaN(val) || val < 1) val = 1;
                if (val > 1000) val = 1000;
                maxChatMessagesInput.value = val;
                localStorage.setItem('maxChatMessages', val);
                console.log(`[Options Controller] maxChatMessages set to: ${val}`);
            });
        }

        // Add clear chat history button handler
        const clearBtn = document.getElementById('clear-chat-history-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                localStorage.removeItem('chatHistory');
                // Optionally show a toast or alert
                if (window.showToast) {
                    window.showToast('Chat history cleared.', 'success');
                } else {
                    alert('Chat history cleared.');
                }
            });
        }

        restoreChatToggle.addEventListener('change', () => {
            localStorage.setItem('restoreLastChatEnabled', restoreChatToggle.checked ? 'true' : 'false');
            if (maxChatMessagesInput) {
                maxChatMessagesInput.disabled = !restoreChatToggle.checked;
            }
            console.log(`[Options Controller] Restore last chat setting changed: ${restoreChatToggle.checked}`);
            console.log("[Options Controller] localStorage['restoreLastChatEnabled'] now:", localStorage.getItem('restoreLastChatEnabled'));
        });
        console.log(`[Options Controller] Restore last chat toggle initialized: ${restoreChatToggle.checked}`);
    }

    // --- Streaming answers toggle logic ---
    // Use MutationObserver for robust persistence across dynamic DOM changes
    function setupStreamTogglePersistence() {
        const observer = new MutationObserver(() => {
            const streamToggle = document.getElementById('enable-stream-answers'); // Corrected ID
            if (streamToggle && !streamToggle._streamToggleInitialized) {
                const streamPref = localStorage.getItem('enableStreamAnswers');
                streamToggle.checked = streamPref === null ? false : (streamPref === 'true');
                streamToggle.addEventListener('change', () => {
                    localStorage.setItem('enableStreamAnswers', streamToggle.checked ? 'true' : 'false');
                    console.log(`[Options Controller] Streaming answers setting changed: ${streamToggle.checked}`);
                });
                streamToggle._streamToggleInitialized = true;
                console.log(`[Options Controller] Streaming answers toggle initialized: ${streamToggle.checked}`);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Initial check in case already present
        const streamToggle = document.getElementById('enable-stream-answers'); // Corrected ID
        if (streamToggle && !streamToggle._streamToggleInitialized) {
            const streamPref = localStorage.getItem('enableStreamAnswers');
            streamToggle.checked = streamPref === null ? false : (streamPref === 'true');
            streamToggle.addEventListener('change', () => {
                localStorage.setItem('enableStreamAnswers', streamToggle.checked ? 'true' : 'false');
                console.log(`[Options Controller] Streaming answers setting changed: ${streamToggle.checked}`);
            });
            streamToggle._streamToggleInitialized = true;
            console.log(`[Options Controller] Streaming answers toggle initialized: ${streamToggle.checked}`);
        }
    }
    setupStreamTogglePersistence();

    // Show/hide dropdown based on initial switch state
    selectDropdown.style.display = enableSwitch.checked ? 'block' : 'none';
    // Or use a class: selectDropdown.closest('.form-group').style.display = enableSwitch.checked ? 'block' : 'none';

    console.log(`[Options Controller] Initial settings loaded: Enabled=${enableSwitch.checked}, Selected=${selectDropdown.value}`);

    // --- Event Listener for Enable Switch ---
    enableSwitch.addEventListener('change', () => {
        const isEnabled = enableSwitch.checked;
        localStorage.setItem('backgroundAnimationEnabled', isEnabled ? 'true' : 'false');
        selectDropdown.style.display = isEnabled ? 'block' : 'none';
        // Or use a class: selectDropdown.closest('.form-group').style.display = isEnabled ? 'block' : 'none';

        console.log(`[Options Controller] Animation enabled setting changed: ${isEnabled}`);
        // Notify the manager that settings have changed
        window.dispatchEvent(new CustomEvent('animationSettingsChanged'));
    });
    console.log("[Options Controller] Change listener added to enable switch.");


    // --- Event Listener for Select Dropdown ---
    selectDropdown.addEventListener('change', () => {
        const selectedValue = selectDropdown.value;
        localStorage.setItem('backgroundAnimationSelected', selectedValue);
        console.log(`[Options Controller] Animation selection changed: ${selectedValue}`);
        // Notify the manager that settings have changed
        window.dispatchEvent(new CustomEvent('animationSettingsChanged'));
    });
    console.log("[Options Controller] Change listener added to select dropdown.");


    console.log("[Options Controller] Initialized Successfully.");
});
