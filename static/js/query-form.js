// /home/mlk/flaskrag3/static/js/query-form.js
// Handles chat query submission, response display, HIL confirmation, self-retriever context, and knowledge-library linkage.

let currentConversationId = null;

const TYPEWRITER_STATES = new Map();
const TYPEWRITER_CHAR_INTERVAL = 18;
if (typeof window !== 'undefined') {
    window.TYPEWRITER_STATES = TYPEWRITER_STATES;
}

function getConversationId() {
    let convId = localStorage.getItem('chatConversationId');
    // console.log('[QueryFormJS] getConversationId: Tried loading from localStorage, found:', convId);

    if (!convId) {
        convId = self.crypto.randomUUID();
        localStorage.setItem('chatConversationId', convId);
        console.log('[QueryFormJS] New conversation ID generated and stored in localStorage:', convId);
    }
    // Update the global variable as well, though localStorage is the primary source now.
    currentConversationId = convId;
    // console.log('[QueryFormJS] getConversationId: Using conversationId:', currentConversationId);
    return currentConversationId;
}

// Ensure initializeQueryForm is defined as a function declaration
function initializeQueryForm() {
    console.log('Initializing Query Form...');
    const queryForm = document.getElementById('query-form');
    const queryInput = document.getElementById('query-input');
    const sendBtn = document.getElementById('send-btn');
    const newConversationBtn = document.getElementById('new-conversation-btn');

    if (!queryForm || !queryInput || !sendBtn) {
        console.warn('Query form essential elements (query-form, query-input, send-btn) not found. Aborting full initialization.');
        return;
    }

    sendBtn.addEventListener('click', () => {
        if (window.chatCore && typeof window.chatCore.submitQuery === 'function') {
            window.chatCore.submitQuery();
        } else {
            console.warn('chatCore.submitQuery is not available on sendBtn click.');
        }
    });

    queryInput.addEventListener('input', function () { // Auto-resize textarea
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    }, false);

    queryInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (window.chatCore && typeof window.chatCore.submitQuery === 'function') {
                window.chatCore.submitQuery();
            } else {
                console.warn('chatCore.submitQuery is not available on Enter keypress.');
            }
        }
    });

    if (newConversationBtn) {
    newConversationBtn.addEventListener('click', async function(event) { // Listener is async
        event.preventDefault(); // If the button is a link or submit type
        console.log('[QueryFormJS] New Conversation button clicked, calling chatCore.startNewConversation.');
        const chatContainer = document.getElementById('chat-container'); // Get chat container here for logging
        console.log('[QueryFormJS] Before startNewConversation - chatCore message count:', window.chatCore ? window.chatCore.state.messages.length : 'N/A');
        console.log('[QueryFormJS] Before startNewConversation - chatContainer child count:', chatContainer ? chatContainer.children.length : 'N/A');
        if (window.chatCore && typeof window.chatCore.startNewConversation === 'function') {
            try {
                localStorage.removeItem('chatConversationId'); // Clear stored ID
                currentConversationId = null; // Reset current ID variable
                getConversationId(); // Generate and store a new one
                await window.chatCore.startNewConversation(); // Await the async function
            } catch (error) {
                console.error('[QueryFormJS] Error during startNewConversation:', error);
            }
        } else {
            console.warn('[QueryFormJS] chatCore.startNewConversation is not available.');
            // Fallback: Manually clear UI and try to show self-retriever if chatCore is missing
            const chatContainer = document.getElementById('chat-container');
            console.log('[QueryFormJS] Fallback: Manually clearing chat.');
            console.log('[QueryFormJS] Fallback: Before manual clear - chatCore message count:', window.chatCore ? window.chatCore.state.messages.length : 'N/A');
            console.log('[QueryFormJS] Fallback: Before manual clear - chatContainer child count:', chatContainer ? chatContainer.children.length : 'N/A');
            if (chatContainer) chatContainer.innerHTML = '';
            localStorage.removeItem('chatConversationId'); // Clear stored ID
            currentConversationId = null; // Reset current ID variable
            getConversationId(); // Generate and store a new one
            localStorage.removeItem('chatHistory');
            if (typeof window.updateSelfRetrieverContextVisibility === 'function') {
                await window.updateSelfRetrieverContextVisibility();
            }
        }
    });
}
    console.log('Query Form event listeners attached.');
}

// Function to initialize Bootstrap tooltips
function initializeTooltips() {
    console.log('Initializing Tooltips...');
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    console.log(`Tooltips initialized for ${tooltipTriggerList.length} elements.`);
}

// Placeholder for setupLibrarySelect
function setupLibrarySelect() {
    console.log('Initializing Library Select...');
    const libraryDropdown = document.getElementById('librarySelectDropdown');
    const libraryBtn = document.getElementById('libraryBtn');
    const hiddenInput = document.getElementById('selected-library-id');

    if (!libraryDropdown || !hiddenInput) {
        console.warn('Library select dropdown or hidden input not found. Skipping setup.');
        return;
    }

    const alreadyInitialized = libraryDropdown.dataset.initialized === 'true';

    const STORAGE_KEY = 'selectedLibraryId';

    const getOptions = () => Array.from(libraryDropdown.querySelectorAll('a[data-library-id]'));
    if (getOptions().length === 0) {
        console.warn('Library dropdown has no selectable options.');
        return;
    }

    function applySelection(libraryId, libraryName) {
        const normalizedId = libraryId || '';
        hiddenInput.value = normalizedId;
        window.selectedLibraryId = normalizedId || null;
        window.selectedLibraryName = libraryName || 'All Libraries';
        try {
            localStorage.setItem(STORAGE_KEY, normalizedId);
        } catch (error) {
            console.warn('Unable to persist library selection:', error);
        }

        const options = getOptions();
        options.forEach(option => {
            const optionId = option.dataset.libraryId || '';
            option.classList.toggle('active', optionId === normalizedId);
        });

        if (libraryBtn) {

            const titleText = libraryName
                ? `Current library: ${libraryName}`
                : 'All Libraries';
            libraryBtn.setAttribute('title', titleText);
            libraryBtn.setAttribute('aria-label', titleText);
            if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip && libraryBtn.getAttribute('data-bs-toggle') === 'tooltip') {
                const tooltipInstance = bootstrap.Tooltip.getOrCreateInstance(libraryBtn);
                tooltipInstance.setContent({ '.tooltip-inner': titleText });
                libraryBtn._tooltipInstance = tooltipInstance;
            }
        }
    }

    const storedLibraryId = (() => {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            console.warn('Unable to read stored library selection:', error);
            return null;
        }
    })();

    const initialOptions = getOptions();
    if (storedLibraryId && initialOptions.some(option => option.dataset.libraryId === storedLibraryId)) {
        const storedOption = initialOptions.find(option => option.dataset.libraryId === storedLibraryId);
        applySelection(storedLibraryId, storedOption ? storedOption.textContent.trim() : '');
    } else {
        const defaultOption = initialOptions[0];
        applySelection(defaultOption.dataset.libraryId || '', defaultOption.textContent.trim());
    }

    if (!alreadyInitialized) {
        libraryDropdown.addEventListener('click', (event) => {
            const link = event.target.closest('a[data-library-id]');
            if (!link) {
                return;
            }
            event.preventDefault();
            const libraryId = link.dataset.libraryId || '';
            const libraryName = link.textContent.trim();
            applySelection(libraryId, libraryName);

            if (typeof window.updateSelfRetrieverContextVisibility === 'function') {
                try {
                    window.updateSelfRetrieverContextVisibility();
                } catch (error) {
                    console.warn('updateSelfRetrieverContextVisibility failed after library change:', error);
                }
            }
        });
    }

    libraryDropdown.dataset.initialized = 'true';
}

// Placeholder for setupKnowledgeSelect
function setupKnowledgeSelect() {
    console.log('Initializing Knowledge Select...');
    // Add logic for knowledge select dropdown here
}

// Placeholder for setupMMRToggle
function setupMMRToggle() {
    console.log('Initializing MMR Toggle...');
    // Add logic for MMR toggle here
}

// Placeholder for setupImageHandling (most of its logic is already in DOMContentLoaded)
function setupImageHandling() {
    console.log('Setup for Image Handling (event listeners are in DOMContentLoaded)...');
    // Specific setup logic for image handling can go here if not covered by direct listeners
}

let currentMessageContainer = null; // To hold the container for streaming response
let currentStreamPreference = false; // Store stream preference for resume
let currentController = null; // To hold the AbortController for fetch requests

/**
 * Checks if chat is empty and updates self-retriever-context visibility accordingly.
 * If chat is empty, shows self-retriever-context; otherwise, hides it.
 * Optionally, can be called after chat init, message send, or chat clear.
 */
async function updateSelfRetrieverContextVisibility() {
    console.log('[UpdateSelfRetriever] Called.');
    const chatContainer = document.getElementById('chat-container'); // Get chat container here for logging
    console.log('[UpdateSelfRetriever] Initial chatCore message count:', window.chatCore ? window.chatCore.state.messages.length : 'N/A');
    const selfRetrieverPanel = document.getElementById('self-retriever-context');
    const placeholder = document.getElementById('replacement-placeholder');
    
    
   if (!selfRetrieverPanel || !placeholder || !chatContainer) {
        console.warn('[UpdateSelfRetriever] Essential UI elements (self-retriever-context, replacement-placeholder, chat-container) not found.');
        return;
    }

    console.log('[UpdateSelfRetriever] Checking chat emptiness...');
    // Use chatCore.state.messages.length for a more reliable check of emptiness
    const isChatEmpty = window.chatCore && window.chatCore.state.messages.length === 0;

    if (isChatEmpty) {
        // Scenario: New conversation started, or initial load results in an empty chat.
        // init-conversation.js handles the very initial load placeholder visibility.
        // This function is more for when "New Conversation" is clicked.
        console.log('[UpdateSelfRetriever] Chat is empty. Attempting to show self-retriever, hiding placeholder.');

        if (placeholder) {
            console.log('[UpdateSelfRetriever] Hiding placeholder initially, as self-retriever will be attempted.')
            placeholder.style.display = 'none';
        }

        // Fetch and display self-retriever context.
        // fetchSelfRetrieverContext handles showing/hiding the selfRetrieverPanel based on content.
        // Optionally, fetch context for current library/knowledge selection
        const libraryHiddenInput = document.getElementById('selected-library-id');
        const libraryId = libraryHiddenInput ? (libraryHiddenInput.value || null) : null; 
        const knowledgeId = window.selectedKnowledgeId || null;
        console.log('[UpdateSelfRetriever] Calling fetchSelfRetrieverContext...');
        try {
            const hasContent = await fetchSelfRetrieverContext(libraryId, knowledgeId); // Await the fetch
            if (hasContent) {
                // Only show if content was successfully fetched and populated
                console.log('[UpdateSelfRetriever] hasContent is true. Showing self-retriever panel.');
                if (selfRetrieverPanel) selfRetrieverPanel.style.display = 'block'; // Or use '' for default display
                if (placeholder) placeholder.style.display = 'none'; // Ensure placeholder is hidden
            } else {
                // No content, ensure panel is hidden
                if (selfRetrieverPanel) selfRetrieverPanel.style.display = 'none';
                // If chat is empty and no suggestions, placeholder should ideally be visible.
                if (typeof window.startPlaceholderAnimationAndShow === 'function') {
                    console.log('[UpdateSelfRetriever] Chat empty, no self-retriever content, showing placeholder.');
                    window.startPlaceholderAnimationAndShow();
                } else {
                    if (placeholder) placeholder.style.display = 'block';
                    console.warn('[UpdateSelfRetriever] window.startPlaceholderAnimationAndShow not found. Manually showing placeholder.');
                }
            }
        } catch (error) {
            console.error('[UpdateSelfRetriever] Error calling fetchSelfRetrieverContext:', error);
            console.log('[UpdateSelfRetriever] Hiding self-retriever, showing placeholder on error.');
            if (selfRetrieverPanel) selfRetrieverPanel.style.display = 'none'; // Hide on error
            // Show placeholder on error if chat is empty
            if (typeof window.startPlaceholderAnimationAndShow === 'function') {
                window.startPlaceholderAnimationAndShow();
            } else {
                if (placeholder) placeholder.style.display = 'block';
                console.warn('[UpdateSelfRetriever] window.startPlaceholderAnimationAndShow not found. Manually showing placeholder on error.');
            }
        }
    }
    else {
        // Scenario: Chat has messages (e.g., after a query is submitted).
        console.log('[UpdateSelfRetriever] Chat not empty. Hiding self-retriever and placeholder.');
        if (selfRetrieverPanel) 
            {
            selfRetrieverPanel.style.display = 'none';
            }
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }
}

// --- Self-Retriever Context Logic ---
// Populates the panel and returns true if content was added, false otherwise. Does NOT control visibility.
function populateSelfRetrieverPanel(contextText) {
    const panel = document.getElementById('self-retriever-context');
    if (panel) {
        if (contextText && contextText.trim()) {
            // Directly set the innerHTML to the contextText (which is the questions grid)
            panel.innerHTML = contextText;
            return true; // Content was populated
        } else {
            panel.innerHTML = '';
            // Visibility is controlled by updateSelfRetrieverContextVisibility
        }
    }
    return false; // No content populated or panel not found
}

// Fetch/generate self-retriever questions from backend
// Make it return the promise for await
function fetchSelfRetrieverContext(libraryId, knowledgeId) { 
    // CRITICAL: Ensure the promise chain is returned
    return window.fetchWithCsrfRetry('/api/self-retriever-questions', { // Use fetchWithCsrfRetry
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.readCurrentCsrfToken() // Use global reader
        },
        body: JSON.stringify({
            library_id: libraryId || null,
            knowledge_id: knowledgeId || null
        })
    })
    .then(res => res.json())
    .then(data => { // This callback now returns the boolean from populateSelfRetrieverPanel
        console.log('[fetchSelfRetrieverContext] Fetch successful. Processing data:', data);
        if (Array.isArray(data.questions) && data.questions.length > 0) {
            // Render as 2 rows x 3 columns grid of subtle boxes
            const questionsHtml = `
                <div class="self-retriever-questions-grid">
                    ${data.questions.map(q => `<div class="question-box">${q}</div>`).join('')}
                </div>
            `;
           // Hide title of Suggested questions: 
            //const contentAdded = populateSelfRetrieverPanel(`Suggested questions:${questionsHtml}`);
            const contentAdded = populateSelfRetrieverPanel(questionsHtml);
            // Add click/keyboard event listeners to each box
            setTimeout(() => {
                const boxes = document.querySelectorAll('.self-retriever-questions-grid .question-box');
                const queryInput = document.getElementById('query-input');
                const sendBtn = document.getElementById('send-btn');
                boxes.forEach(box => {
                    box.setAttribute('tabindex', '0');
                    box.setAttribute('role', 'button');
                    box.setAttribute('aria-label', box.textContent);
                    box.addEventListener('click', () => {
                        if (queryInput) {
                            queryInput.value = box.textContent;
                            queryInput.focus();
                            // Trigger submit
                            if (typeof submitQuery === 'function') submitQuery();
                        }
                    });
                    box.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            box.click();
                        }
                    });
                });
            }, 0);
            console.log('[fetchSelfRetrieverContext] Questions found. Populating panel.');
            return contentAdded; // Return true if content was added
        } else {
            console.log('[fetchSelfRetrieverContext] No questions found. Populating panel with "No questions" message.');
            return populateSelfRetrieverPanel('No suggested questions available.'); // Return true/false
        }
    })
    .catch(err => {
        console.error('[fetchSelfRetrieverContext] Fetch failed:', err);
        populateSelfRetrieverPanel('Failed to load suggested questions.'); // Populate with error message
        console.error('Error fetching self-retriever questions:', err);
        throw err; // Re-throw so await can catch it
    }); // This whole chain returns a Promise that resolves to true/false
}

// --- Knowledge-Library Linkage ---
function updateKnowledgeDropdown(knowledges) {
    const knowledgeDropdown = document.getElementById('knowledgeSelectDropdown');
    if (!knowledgeDropdown) return;

    // Clear existing options
    knowledgeDropdown.innerHTML = '';

    // Add "All Knowledge" option manually at the beginning
    const allLi = document.createElement('li');
    const allA = document.createElement('a');
    allA.className = 'dropdown-item active'; // Make it active by default
    allA.href = '#';
    allA.dataset.knowledgeId = ""; // Represents 'null' or 'all'
    allA.textContent = 'All Knowledge';
    allLi.appendChild(allA);
    knowledgeDropdown.appendChild(allLi);

    // Add knowledge options from the passed object
    if (knowledges) {
        for (const knowledge of knowledges) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.className = 'dropdown-item';
            a.href = '#';
            a.dataset.knowledgeId = knowledge.id;
            a.textContent = knowledge.name;
            li.appendChild(a);
            knowledgeDropdown.appendChild(li);
        }
    }
}

function updateLibraryDropdown(knowledgeId) {
    if (!window.APP_CONFIG || window.APP_CONFIG.VECTOR_STORE_MODE !== 'knowledge') {
        return; // In user mode the dropdown is static and handled by setupLibrarySelect
    }
    const libraryDropdown = document.getElementById('librarySelectDropdown');
    if (!libraryDropdown) return;

    // Clear existing library options
    libraryDropdown.innerHTML = '';

    // Add "All Library" option
    const allLi = document.createElement('li');
    const allA = document.createElement('a');
    allA.className = 'dropdown-item active';
    allA.href = '#';
    allA.dataset.libraryId = ""; // Represents 'null' or 'all'
    allA.textContent = 'All Library';
    allLi.appendChild(allA);
    libraryDropdown.appendChild(allLi);

    let libraries = [];
    if (!knowledgeId) {
        // If no knowledge is selected, show all libraries from all knowledges
        for (const kId in window.__FLASK_KNOWLEDGE_LIBRARIES_MAP) {
            libraries.push(...window.__FLASK_KNOWLEDGE_LIBRARIES_MAP[kId].libraries);
        }
        // Remove duplicates
        const uniqueLibraries = [];
        const libraryIds = new Set();
        for (const lib of libraries) {
            if (!libraryIds.has(lib.library_id)) {
                uniqueLibraries.push(lib);
                libraryIds.add(lib.library_id);
            }
        }
        libraries = uniqueLibraries;

    } else {
        // If a knowledge is selected, show only its libraries
        if (window.__FLASK_KNOWLEDGE_LIBRARIES_MAP[knowledgeId]) {
            libraries = window.__FLASK_KNOWLEDGE_LIBRARIES_MAP[knowledgeId].libraries;
        }
    }

    // Populate the dropdown
    libraries.forEach(library => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'dropdown-item';
        a.href = '#';
        a.dataset.libraryId = library.library_id;
        a.textContent = library.name;
        li.appendChild(a);
        libraryDropdown.appendChild(li);
    });
}

window.currentImageBase64 = null;
window.currentImageMimeType = null;
// New global variables for data file handling
window.currentDataFileContent = null;
window.currentDataFileType = null;
window.currentDataFileName = null;
let pastedTextForDataFrame = null; // To store text pasted into queryInput for potential DF use

// --- Event Handlers ---
document.addEventListener('DOMContentLoaded', function() {
    // Check if the core query form element exists before initializing query
    const queryFormElement = document.getElementById('query-form');
    if (queryFormElement) {
        initializeQueryForm();
        initializeTooltips(); // Tooltips might be on other elements too, but often related to form
        setupLibrarySelect();
        setupKnowledgeSelect();
        setupMMRToggle();
        setupImageHandling();
    } else {
        console.log("Query form not found on this page. Skipping query form related initializations.");
    }
    
    
    // Image handling elements
    const imageInput = document.getElementById('image-input');
    const imagePreview = document.getElementById('image-preview');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const removeImageBadge  = document.getElementById('remove-image-badge');
    const attachFileLink = document.getElementById('attach-file-link'); // Link that triggers imageInput
    // Get references to data file preview elements
    const dataFilePreviewContainer = document.getElementById('data-file-preview-container');
    const dataFileNameDisplay = document.getElementById('data-file-name-display');
    const removeDataFileBadge = document.getElementById('remove-data-file-badge'); // Already declared, ensure it's used

    // Image input handler
    if (imageInput) {
        imageInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                window.currentImageBase64 = null; // Reset
                window.currentImageMimeType = null;
                window.currentDataFileContent = null;
                window.currentDataFileType = null;
                window.currentDataFileName = null;

                // Hide both previews initially
                if (imagePreviewContainer) {
                    imagePreviewContainer.style.display = 'none';
                    if (imagePreview) imagePreview.src = ''; // Clear previous image src
                }
                if (dataFilePreviewContainer) {
                    dataFilePreviewContainer.style.display = 'none';
                    if (dataFileNameDisplay) dataFileNameDisplay.textContent = ''; // Clear previous data file name
                }

                const reader = new FileReader();
                const fileName = file.name.toLowerCase();
                const fileType = file.type;

                if (fileType.startsWith('image/')) {
                    reader.onload = function(e) {
                        console.log("File identified as image:", fileName);
                        if (imagePreview) imagePreview.src = e.target.result;
                        if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
                        window.currentImageBase64 = e.target.result.split(',')[1]; // Store base64 part
                        window.currentImageMimeType = file.type; // Store MIME type
                    };
                    reader.readAsDataURL(file);
                } else if (fileName.endsWith('.csv') || fileName.endsWith('.tsv')) {
                    console.log("File identified as CSV/TSV:", fileName);
                    window.currentDataFileType = fileName.endsWith('.csv') ? 'csv' : 'tsv';
                    reader.onload = function(e) {
                        window.currentDataFileContent = e.target.result;
                        window.currentDataFileName = file.name;
                        if (dataFileNameDisplay) dataFileNameDisplay.textContent = file.name;
                        if (dataFilePreviewContainer) dataFilePreviewContainer.style.display = 'block';
                        console.log("CSV/TSV loaded and preview shown for:", file.name);
                    };
                    reader.readAsText(file);
                } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                    console.log("File identified as Excel:", fileName);
                    window.currentDataFileType = 'excel_base64';
                    reader.onload = function(e) {
                        window.currentDataFileContent = e.target.result.split(',')[1]; // Get base64 part
                        window.currentDataFileName = file.name;
                        if (dataFileNameDisplay) dataFileNameDisplay.textContent = file.name;
                        if (dataFilePreviewContainer) dataFilePreviewContainer.style.display = 'block';
                        console.log("Excel loaded and preview shown for:", file.name);
                    };
                    reader.readAsDataURL(file); // Reads as base64-encoded data URL
                } else {
                    console.log("Unsupported file type:", fileName, "Type:", fileType);
                    alert('Unsupported file type. Please upload an image, CSV, TSV, XLSX, or XLS file.');
                    imageInput.value = ''; // Clear the input
                    // Ensure previews remain hidden
                    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
                    if (dataFilePreviewContainer) dataFilePreviewContainer.style.display = 'none';
                }
            }
        });
    } else {
        console.warn("Element with ID 'image-input' not found. Image attachment via file input will be disabled.");
    }

    if (removeImageBadge) {
        removeImageBadge.addEventListener('click', () => {
            if (imageInput) imageInput.value = ''; // Clear the file input
            if (imagePreview) imagePreview.src = '';
            if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
            window.currentImageBase64 = null;
            window.currentImageMimeType = null;
        });
    } else {
        console.warn("Element with ID 'remove-image-badge' not found.");
    }

    // Connect attach file dropdown item to image input
    if (attachFileLink) {
        attachFileLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (imageInput) { // Check if imageInput exists before trying to click it
                imageInput.click(); // Trigger the hidden file input
            } else {
                console.warn("Cannot trigger image input: element with ID 'image-input' not found.");
            }
        });
    } else {
        console.warn("Element with ID 'attach-file-link' not found.");
    }

    if (removeDataFileBadge) {
        removeDataFileBadge.addEventListener('click', () => {
            // If imageInput was used for data file, clear its value too
            if (imageInput && window.currentDataFileName) imageInput.value = '';
            if (dataFileNameDisplay) dataFileNameDisplay.textContent = '';
            if (dataFilePreviewContainer) dataFilePreviewContainer.style.display = 'none';
            window.currentDataFileContent = null;
            window.currentDataFileType = null;
            window.currentDataFileName = null;
        });
    }

    const queryInput = document.getElementById('query-input');
    const submitButton = document.getElementById('send-btn');
    const streamToggle = document.getElementById('stream-toggle');
    const chatMessagesContainer = document.getElementById('chat-container');
    const libraryInputHidden = document.getElementById('selected-library-id');
    const knowledgeSelectBtn = document.getElementById('knowledgeSelectBtn');
    const knowledgeDropdown = document.getElementById('knowledgeSelectDropdown');
    // Use a global variable for selectedKnowledgeId so submitQuery can access it
    window.selectedKnowledgeId = null;

    // --- Set initial state of Knowledge Button based on VECTOR_STORE_MODE ---
    if (knowledgeSelectBtn && window.APP_CONFIG) {
        if (window.APP_CONFIG.VECTOR_STORE_MODE === 'knowledge') {
            knowledgeSelectBtn.title = "Select a Knowledge Base";
            // Ensure innerHTML reflects "Select" if no default is picked by updateKnowledgeDropdown
            // This might be overwritten if updateKnowledgeDropdown selects a first item.
        } else {
            knowledgeSelectBtn.title = "All Knowledge"; // Default if "All Knowledge" option is available
            // If "All Knowledge" is the first item, updateKnowledgeDropdown might trigger a click simulation or default selection
        }
    }
    // Initial population of knowledge dropdown (might select "ALL Knowledge" if available and first)
    updateKnowledgeDropdown(window.knowledges);
    updateLibraryDropdown(null); // Initially load all libraries (no-op in user mode)
    setupLibrarySelect(); // Re-apply selection in case dropdown content changed
 
    // --- Self-Retriever: Initial fetch ---
    fetchSelfRetrieverContext(libraryInputHidden ? (libraryInputHidden.value || null) : null, window.selectedKnowledgeId);
 
    // --- Knowledge Dropdown Selection ---

    if (knowledgeDropdown && knowledgeSelectBtn) {
        knowledgeDropdown.addEventListener('click', function(e) {
            if (e.target && e.target.matches('.dropdown-item')) {
                e.preventDefault();
                const selectedId = e.target.dataset.knowledgeId;
                // Treat empty string from "ALL Knowledge" as null
                window.selectedKnowledgeId = selectedId === "" ? null : selectedId;
                console.log('[QueryFormJS] Knowledge selected. ID:', window.selectedKnowledgeId, 'Text:', e.target.textContent);

                // Keep icon-only, update tooltip to selected knowledge
                knowledgeSelectBtn.innerHTML = `<i class="bi bi-journal-bookmark fs-5"></i>`;
                knowledgeSelectBtn.title = e.target.textContent;
                // Update Bootstrap tooltip if present
                if (knowledgeSelectBtn._tooltip) {
                    knowledgeSelectBtn._tooltip.setContent({ '.tooltip-inner': e.target.textContent });
                } else if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
                    if (knowledgeSelectBtn.getAttribute('data-bs-toggle') === 'tooltip') {
                        if (knowledgeSelectBtn._tooltipInstance) {
                            knowledgeSelectBtn._tooltipInstance.setContent({ '.tooltip-inner': e.target.textContent });
                        } else {
                            knowledgeSelectBtn._tooltipInstance = bootstrap.Tooltip.getOrCreateInstance(knowledgeSelectBtn);
                            knowledgeSelectBtn._tooltipInstance.setContent({ '.tooltip-inner': e.target.textContent });
                        }
                    }
                }
                const currentLibraryId = libraryInputHidden ? (libraryInputHidden.value || null) : null;
                fetchSelfRetrieverContext(currentLibraryId, window.selectedKnowledgeId);
                updateLibraryDropdown(window.selectedKnowledgeId);
                setupLibrarySelect();
            }
        });
    }

    // --- Event Listeners for Query Submission ---

    if (submitButton) {
        submitButton.addEventListener('click', submitQuery);
    }
    if (queryInput) {
        queryInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                if (event.shiftKey) {
                    // Allow newline
                    return;
                } else {
                    event.preventDefault();
                    submitQuery();
                }
            }
        });

        // Clipboard image paste support
        queryInput.addEventListener('paste', function(e) {
            const items = e.clipboardData && e.clipboardData.items;
            let isImagePasted = false;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        imagePreview.src = event.target.result;
                        imagePreviewContainer.style.display = 'block';
                        const parts = event.target.result.split(',');
                        window.currentImageMimeType = parts[0].match(/:(.*?);/)[1];
                        window.currentImageBase64 = parts[1];
                    };
                    reader.readAsDataURL(file);
                    e.preventDefault(); // Prevent default paste
                    // Optionally set placeholder if input is empty
                    // Only set placeholder if query input is truly empty
                    if (queryInput && !queryInput.value.trim()) {
                        queryInput.value = "Image pasted from clipboard"; // Placeholder text
                    }
                    isImagePasted = true;
                    pastedTextForDataFrame = null; // Clear any potential TSV data if an image is pasted
                    break;
                }
            }
            // If not an image, consider it as text for DataFrame (TSV)
            if (!isImagePasted && e.clipboardData && e.clipboardData.getData) {
                const pastedText = e.clipboardData.getData('text/plain');
                 // Unescape common sequences like literal "\t" to actual tab "\t"
                // and literal "\n" to actual newline "\n", etc.
                let processedPastedText = pastedText
                    .replace(/\\t/g, '\t')
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r');
                // Note: if \r\n is common, handle it before individual \r and \n or handle \r\n -> \n

                console.log("Pasted text (raw from clipboard):", pastedText);
                console.log("Pasted text (after unescaping for analysis):", processedPastedText);

                let charCodes = [];
                for (let i = 0; i < processedPastedText.length; i++) {
                        charCodes.push(processedPastedText.charCodeAt(i));
                    }
                console.log("Pasted text character codes:", charCodes.join(', '));


                // Simpler check for now: just see if there's any tab after unescaping
                const hasAnyTab = processedPastedText.includes('\t');
                console.log(`Simple Tab Check: hasAnyTab = ${hasAnyTab}`);

                if (hasAnyTab) {
                    // If TSV is detected, and an image wasn't, ensure the "Image pasted" placeholder isn't there
                    if (queryInput && queryInput.value === "Image pasted from clipboard") {
                        queryInput.value = ""; // Clear the image placeholder if we're actually processing TSV
                    }
                    pastedTextForDataFrame = processedPastedText; // Store the unescaped version
                    console.log("Tab detected, data stored for DataFrame analysis (using simple check).");
                        if (dataFileNameDisplay) {
                          dataFileNameDisplay.textContent = "Clipboard data ready for analysis";
                        } else {
                           console.error("dataFileNameDisplay element NOT FOUND when trying to update UI for TSV paste!");
                        }
                        if (dataFilePreviewContainer) {
                            dataFilePreviewContainer.style.display = 'block';                        
                        } else {
                             console.error("dataFilePreviewContainer element NOT FOUND when trying to update UI for TSV paste!"); 
                        }
               }
            }
        });
    }

    // --- Dynamic Questions (if any) ---
    const dynamicQuestionsContainer = document.getElementById('dynamic-questions');
    if (dynamicQuestionsContainer) {
        dynamicQuestionsContainer.addEventListener('click', function(event) {
            if (event.target.tagName === 'BUTTON' && event.target.dataset.question) {
                queryInput.value = event.target.dataset.question;
                submitQuery();
            }
        });
    }

    // --- Confirmation Buttons in Chat ---
    if (chatMessagesContainer) {
        chatMessagesContainer.addEventListener('click', function(event) {
            if (event.target.classList.contains('confirm-btn')) {
                const threadId = event.target.dataset.threadId;
                const confirmation = event.target.dataset.confirmation;
                const buttonContainer = event.target.closest('.confirmation-buttons');

                // Disable buttons after click
                buttonContainer?.querySelectorAll('button').forEach(btn => btn.disabled = true);

                if (buttonContainer) buttonContainer.remove();

                // Add a small message indicating the choice (optional)
                if (window.chatCore) {
                    window.chatCore.addMessage({ role: 'system', content: `User chose: ${confirmation}` });
                }
                resumeQuery(threadId, confirmation);
            }
        });
    }

    // --- MMR Toggle, Stream Toggle, etc. (existing logic can go here) ---

    // --- Initial load of dynamic questions (if needed) ---
    fetchDynamicQuestions();
});

// --- Core Query Submission (unchanged, but pass selectedKnowledgeId) ---
async function submitQuery() {
    const queryInput = document.getElementById('query-input');
    const submitButton = document.getElementById('send-btn');
    const libraryInput = document.getElementById('selected-library-id');
    // Correctly get the stream toggle using its actual ID from base.html
    // Ensure getConversationId() is called to initialize if null
    const streamToggle = document.getElementById('enable-stream-answers');
    const knowledgeSelectBtn = document.getElementById('knowledgeSelectBtn');
    // Always use the global window.selectedKnowledgeId
    const knowledgeId = window.selectedKnowledgeId || null;

    let query = queryInput.value.trim();
    const libraryId = libraryInput ? (libraryInput.value || null) : null;
    const streamEnabled = streamToggle ? streamToggle.checked : false;

    // If query is empty BUT a data file or pasted data is present, set a default "analyze" query
    if (!query && (window.currentDataFileContent || pastedTextForDataFrame)) {
        const fileName = window.currentDataFileName || "pasted data";
        query = `Analyze the ${fileName} and provide a summary.`;
        console.log(`[QueryFormJS] Empty query with data file/paste. Defaulting query to: "${query}"`);
    }

    // --- Validation for 'knowledge' mode ---
    if (window.APP_CONFIG && window.APP_CONFIG.VECTOR_STORE_MODE === 'knowledge' && !window.selectedKnowledgeId) {
        alert("When 'Knowledge' store mode is active, please select a specific knowledge base from the dropdown before submitting your query.");
        console.warn("[QueryFormJS] Submission blocked: In 'knowledge' mode, but no specific knowledge_id selected.");
        return; // Stop submission
    }
    // --- End Validation ---

    if (!query) { // If still no query (e.g., no file attached either)
        console.warn("Query is empty and no data file attached. Not submitting.");
        // Optionally, provide user feedback here (e.g., shake input box, show small message)
        return;
    }

    // Directly use chatCore to add the user message
    if (window.chatCore) {
        let userContent;
        if (window.currentImageBase64 && window.currentImageMimeType) {
            userContent = `
                <div class="user-message-with-image">
                    <img src="data:${window.currentImageMimeType};base64,${window.currentImageBase64}" alt="Attached image" class="chat-user-image mb-2" style="width: 100%; max-width: 400px; border-radius: 12px; display: block; margin-bottom: 12px;">
                    <div>${escapeHtml(query)}</div>
                </div>
            `;
        } else {
            userContent = escapeHtml(query);
        }
        window.chatCore.addMessage({ role: 'user', content: userContent });
    // Removed the check for window.appendMessage
    } else {
        console.error("ChatCore not initialized when trying to add user message.");
    }

    queryInput.value = ''; // Clear input field immediately after sending

    // Hide self-retriever context and placeholder immediately after user message is added
    if (typeof updateSelfRetrieverContextVisibility === 'function') {
        console.log('[SubmitQuery] Calling updateSelfRetrieverContextVisibility immediately after adding user message.');
        await updateSelfRetrieverContextVisibility();
    }

    currentStreamPreference = streamEnabled;
    queryInput.disabled = true;
    submitButton.disabled = true;
    addSpinner(submitButton);

    let streamingMessageId = null; // To store the ID for the streaming bubble

    if (streamEnabled) {
        // STREAMING ON: Immediately add placeholder bubble with typing indicator
        streamingMessageId = `streaming-${Date.now()}`;
        if (window.chatCore) {
            window.chatCore.addMessage({
                role: 'agent',
                content: '<div class="typing-indicator"><span></span><span></span><span></span></div>', // Typing animation placeholder
                id: streamingMessageId // Assign ID for targeting by readStream
            });
            initializeTypewriterState(streamingMessageId);
        }
    } else {
        // STREAMING OFF: Show the main loading animation
        window.showLoading();
    }
    if (currentController) {
        currentController.abort();
    }
    currentController = new AbortController();
    const signal = currentController.signal;

    const apiUrl = '/api/query';
    let requestBody = {
        query: query,
        stream: streamEnabled,
        library_id: libraryId,
        knowledge_id: knowledgeId,
        conversation_id: getConversationId() // Add conversation_id to the request
    };
    // Add MMR mode from localStorage
    const mmrPref = localStorage.getItem('mmrModeEnabled');
    requestBody.mmr = mmrPref === null ? true : (mmrPref === 'true');
    if (window.currentImageBase64 && window.currentImageMimeType) {
        requestBody.image_base64 = window.currentImageBase64;
        requestBody.image_mime_type = window.currentImageMimeType;
    }
    // Add data file content if available
    if (window.currentDataFileContent && window.currentDataFileType) {
        requestBody.uploaded_file_content = window.currentDataFileContent;
        requestBody.uploaded_file_type = window.currentDataFileType;
        requestBody.uploaded_file_name = window.currentDataFileName; // <<< ADD THIS
    }
    // Add pasted text if available (and not an image was pasted)
    if (pastedTextForDataFrame) {
        requestBody.clipboard_data_tsv = pastedTextForDataFrame;
        // Note: backend logic in query.py prioritizes clipboard_data_tsv if uploaded_file_content is also present from a file.
    }

    let errorOccurred = false; // Flag to track if an error happened during fetch

    window.fetchWithCsrfRetry(apiUrl, { // Use fetchWithCsrfRetry
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.readCurrentCsrfToken(), // Use global reader
            'Accept': streamEnabled ? 'text/plain' : 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: signal
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errData => {
                throw new Error(errData.error || `HTTP error! status: ${response.status}`);
            }).catch(() => {
                throw new Error(`HTTP error! status: ${response.status}`);
            });
        }
        if (streamEnabled) {
            // REMOVE: Don't create a new ID here
            // const streamingMessageId = `streaming-${Date.now()}`;
            readStream(response, streamingMessageId); // Pass the ORIGINAL ID created earlier
        } else {
            return response.text();
        }
    })
    .then(text => {
        if (!streamEnabled && text) {
            handleJsonResponse(text, currentMessageContainer);
            // Loading indicator is hidden in the finally block for non-streaming
        }
    })
    .catch(error => {
        if (error.name === 'AbortError') {
            errorOccurred = true; // Treat abort as an error for UI update purposes
            console.log('Fetch aborted');
        } else {
            console.error('Error submitting query:', error);
            if (window.chatCore) {
                window.chatCore.addMessage({ role: 'error', content: `Error: ${error.message}` });
            }
            // Loading indicator is hidden in the finally block
            errorOccurred = true;
        }
        if (streamEnabled && streamingMessageId) {
            resetTypewriterEffect(streamingMessageId);
        }
    })
    .finally(async () => { // Make finally async to await
        queryInput.disabled = false;
        submitButton.disabled = false;
        removeSpinner(submitButton);
        // queryInput.value = ''; // Moved up to happen immediately after sending

        // Hide loading indicator only if it might have been shown (non-streaming)
        if (!currentStreamPreference && typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
        currentController = null;
         // Update self-retriever context visibility (will hide it as chat is no longer empty)
        // Also handles placeholder.
        await updateSelfRetrieverContextVisibility();
        
        if (streamEnabled && streamingMessageId) {
            const lingeringState = TYPEWRITER_STATES.get(streamingMessageId);
            if (lingeringState && !lingeringState.streamComplete) {
                resetTypewriterEffect(streamingMessageId);
            }
        }
        // Automatically clear image attachment after sending
        const removeImageButton = document.getElementById('remove-image-badge');
        if (removeImageButton && (window.currentImageBase64 || window.currentImageMimeType)) {
            removeImageButton.click();
        }
        // Clear data file attachment after sending (triggered by its own remove badge)
        const removeDataFileButton = document.getElementById('remove-data-file-badge'); // Get it here
        if (window.currentDataFileContent || window.currentDataFileType || window.currentDataFileName) {
            if (removeDataFileButton) removeDataFileButton.click(); // Triggers clearing logic
        }
        // Clear pasted text variable
        pastedTextForDataFrame = null;

        // Ensure query input is re-enabled and spinner removed even if errors occurred before finally
        queryInput.disabled = false;
        if (submitButton) removeSpinner(submitButton);
    });
}

/**
 * Reads and processes the streaming response from the backend.
 * @param {Response} response - The fetch Response object.
 * @param {string} messageId - The ID of the placeholder message bubble.
 */
async function readStream(response, messageId) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = ''; // Buffer for incomplete SSE messages
    let accumulatedTextContent = ''; // Accumulates text from 'text_chunk'

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break; // Exit loop if stream is finished
            
            sseBuffer += decoder.decode(value, { stream: true }); // Add incoming chunk to SSE buffer

            let boundary = sseBuffer.indexOf('\n\n'); // SSE messages are separated by double newlines
            while (boundary !== -1) {
                const rawSseMessage = sseBuffer.substring(0, boundary);
                sseBuffer = sseBuffer.substring(boundary + 2); // Remove processed message from buffer

                if (rawSseMessage.startsWith('data: ')) {
                    const jsonData = rawSseMessage.substring(6).trim(); // Remove 'data: ' prefix and trim
                    if (jsonData) { // Ensure jsonData is not empty
                        try {
                            const eventData = JSON.parse(jsonData);
                            console.log("[QueryForm readStream] Received SSE event:", JSON.stringify(eventData));

                            if (eventData.type === 'text_chunk' && typeof eventData.content === 'string') {
                                accumulatedTextContent += eventData.content;
                                initializeTypewriterState(messageId);
                                registerChunkProgress(messageId, eventData);
                                applyTypewriterEffect(messageId, accumulatedTextContent);
                            } else if (eventData.type === 'metadata_update' && eventData.metadata) {
                                console.log("[QueryForm readStream] Processing metadata_update:", eventData.metadata);
                                mergeTypewriterMetadata(messageId, eventData.metadata);
                            } else if (eventData.type === 'end_of_stream' && eventData.data) {
                                console.log("[QueryForm readStream] Processing end_of_stream:", eventData.data);
                                
                                let finalContent = accumulatedTextContent; // Default to accumulated text
                                const finalPayload = eventData.data;

                                // Check for the nested agent_output structure first
                                if (finalPayload && finalPayload.agent_output && typeof finalPayload.agent_output.answer === 'string') {
                                    finalContent = finalPayload.agent_output.answer;
                                    console.log("[QueryForm readStream] Using answer from end_of_stream.data.agent_output:", finalContent);
                                } else if (finalPayload && typeof finalPayload.answer === 'string') {
                                    // Fallback to top-level answer if agent_output.answer is not found
                                    finalContent = finalPayload.answer;
                                    console.log("[QueryForm readStream] Using answer from end_of_stream.data.answer:", finalContent);
                                }

                                accumulatedTextContent = finalContent;
                                completeTypewriterStream(messageId, finalContent, finalPayload);
                                console.log("[QueryForm readStream] End of stream event fully processed.");
                            }
                        } catch (e) {
                            console.error("[QueryForm readStream] Error parsing SSE JSON data:", e, "Data was:", jsonData);
                        }
                    }
                }
                boundary = sseBuffer.indexOf('\n\n'); // Look for next message boundary
            }
        }
    } catch (error) {
        console.error("Error reading stream:", error);
        resetTypewriterEffect(messageId);
        if (window.chatCore) {
            // Update the bubble with an error message
            window.chatCore.updateMessage(messageId, { content: "Error receiving response." });
        }
    } finally {
        const lingeringState = TYPEWRITER_STATES.get(messageId);
        if (lingeringState && !lingeringState.streamComplete) {
            resetTypewriterEffect(messageId);
        }
        // Optional: Finalize message state in chatCore if needed
        if (window.chatCore && typeof window.chatCore.finalizeMessage === 'function') {
            window.chatCore.finalizeMessage(messageId);
        }
        console.log("Stream finished for message:", messageId);
    }
}

function initializeTypewriterState(messageId) {
    if (!messageId) {
        return;
    }
    if (!TYPEWRITER_STATES.has(messageId)) {
        TYPEWRITER_STATES.set(messageId, {
            displayedText: '',
            targetText: '',
            queue: '',
            timer: null,
            metadata: {},
            streamComplete: false,
            finalContent: null,
            chunkCount: 0,
            chunkTotal: null
        });
    }
}

function registerChunkProgress(messageId, chunkMeta = {}) {
    initializeTypewriterState(messageId);
    const state = TYPEWRITER_STATES.get(messageId);
    if (!state) {
        return;
    }
    if (typeof chunkMeta.chunk_index === 'number') {
        state.chunkCount = chunkMeta.chunk_index + 1;
    } else {
        state.chunkCount = (state.chunkCount || 0) + 1;
    }
    if (typeof chunkMeta.total_chunks === 'number') {
        state.chunkTotal = chunkMeta.total_chunks;
    }
    updateChunkProgressUI(messageId);
    triggerChunkPulse(messageId);
}

function triggerChunkPulse(messageId) {
    window.requestAnimationFrame(() => {
        let bubble = document.getElementById(messageId);
        if (!bubble) {
            bubble = document.querySelector(`[data-message-id="${messageId}"]`);
        }
        if (!bubble) {
            return;
        }
        bubble.classList.remove('chunk-pulse');
        // Force reflow to restart animation
        void bubble.offsetWidth;
        bubble.classList.add('chunk-pulse');
        setTimeout(() => bubble.classList.remove('chunk-pulse'), 260);
    });
}

function updateChunkProgressUI(messageId, options = {}) {
    const state = TYPEWRITER_STATES.get(messageId);
    const chunkCount = options.chunkCount ?? state?.chunkCount ?? 0;
    const chunkTotal = options.chunkTotal ?? state?.chunkTotal ?? null;

    window.requestAnimationFrame(() => {
        let bubble = document.getElementById(messageId);
        if (!bubble) {
            bubble = document.querySelector(`[data-message-id="${messageId}"]`);
        }
        if (!bubble) {
            return;
        }
        const progressEl = bubble.querySelector('.stream-progress');
        if (!progressEl) {
            return;
        }
        progressEl.removeAttribute('hidden');
        const labelEl = progressEl.querySelector('.stream-progress-label');
        const barEl = progressEl.querySelector('.stream-progress-bar');

        if (labelEl) {
            if (options.complete) {
                const summary = chunkTotal ? `${chunkCount}/${chunkTotal}` : chunkCount;
                labelEl.textContent = `Completed (${summary})`;
            } else {
                labelEl.textContent = chunkTotal ? `Streaming… ${chunkCount}/${chunkTotal}` : `Streaming… ${chunkCount}`;
            }
        }

        if (barEl) {
            let percent;
            if (options.complete) {
                percent = 100;
            } else if (chunkTotal && chunkTotal > 0) {
                percent = Math.min(100, Math.max(5, Math.round((chunkCount / chunkTotal) * 100)));
            } else {
                // Cycle through values to give a sense of motion when total unknown
                const step = (chunkCount % 6) + 1;
                percent = Math.min(95, step * 14);
            }
            barEl.style.setProperty('--progress-width', `${percent}%`);
            barEl.style.width = `${percent}%`;
        }

        if (options.complete) {
            progressEl.classList.add('stream-progress-complete');
            setTimeout(() => {
                progressEl.setAttribute('hidden', 'true');
                progressEl.classList.remove('stream-progress-complete');
            }, 1200);
        } else {
            progressEl.classList.remove('stream-progress-complete');
        }
    });
}

function markChunkProgressComplete(messageId, chunkCount, chunkTotal) {
    updateChunkProgressUI(messageId, {
        complete: true,
        chunkCount,
        chunkTotal
    });
}

function hideChunkProgress(messageId) {
    window.requestAnimationFrame(() => {
        let bubble = document.getElementById(messageId);
        if (!bubble) {
            bubble = document.querySelector(`[data-message-id="${messageId}"]`);
        }
        if (!bubble) {
            return;
        }
        const progressEl = bubble.querySelector('.stream-progress');
        if (progressEl) {
            progressEl.setAttribute('hidden', 'true');
            progressEl.classList.remove('stream-progress-complete');
        }
    });
}

function mergeTypewriterMetadata(messageId, metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return;
    }
    initializeTypewriterState(messageId);
    const state = TYPEWRITER_STATES.get(messageId);
    state.metadata = { ...state.metadata, ...metadata };
}

function applyTypewriterEffect(messageId, targetText) {
    if (!messageId) {
        return;
    }
    initializeTypewriterState(messageId);
    const state = TYPEWRITER_STATES.get(messageId);
    const safeTarget = targetText || '';
    if (safeTarget === state.targetText && !state.streamComplete) {
        return;
    }
    const addition = safeTarget.slice(state.targetText.length);
    state.targetText = safeTarget;
    if (state.displayedText.length > safeTarget.length) {
        state.displayedText = safeTarget.slice(0, state.displayedText.length);
        renderTypewriterFrame(messageId, state.displayedText, true);
    }
    if (addition.length > 0) {
        state.queue += addition;
    }
    if (!state.timer) {
        typewriterStep(messageId);
    }
    if (state.streamComplete && state.queue.length === 0 && !state.timer) {
        finalizeTypewriter(messageId);
    }
}

function completeTypewriterStream(messageId, finalContent, finalMetadata) {
    initializeTypewriterState(messageId);
    const state = TYPEWRITER_STATES.get(messageId);
    state.streamComplete = true;
    if (finalMetadata && typeof finalMetadata === 'object') {
        state.metadata = { ...state.metadata, ...finalMetadata };
        const possibleTotal = typeof finalMetadata.total_chunks === 'number'
            ? finalMetadata.total_chunks
            : (finalMetadata.agent_output && typeof finalMetadata.agent_output.total_chunks === 'number'
                ? finalMetadata.agent_output.total_chunks
                : null);
        if (possibleTotal !== null) {
            state.chunkTotal = possibleTotal;
        }
    }
    state.finalContent = typeof finalContent === 'string' ? finalContent : '';
    if (state.chunkCount > 0 || state.chunkTotal) {
        updateChunkProgressUI(messageId);
    }
    applyTypewriterEffect(messageId, state.finalContent);
    if (state.queue.length === 0) {
        finalizeTypewriter(messageId);
    }
}

function typewriterStep(messageId) {
    const state = TYPEWRITER_STATES.get(messageId);
    if (!state) {
        return;
    }
    if (state.streamComplete) {
        if (state.queue.length > 0) {
            state.displayedText += state.queue;
            state.queue = '';
            renderTypewriterFrame(messageId, state.displayedText, false);
        }
        state.timer = null;
        finalizeTypewriter(messageId);
        return;
    }

    if (state.queue.length === 0) {
        state.timer = null;
        renderTypewriterFrame(messageId, state.displayedText, true);
        return;
    }

    const nextChar = state.queue.charAt(0);
    state.queue = state.queue.slice(1);
    state.displayedText += nextChar;
    if (state.displayedText.length % 25 === 1) {
        console.debug(`[Typewriter] ${messageId} progress: ${state.displayedText.length} chars, remaining: ${state.queue.length}`);
    }
    renderTypewriterFrame(messageId, state.displayedText, true);

    state.timer = setTimeout(() => typewriterStep(messageId), TYPEWRITER_CHAR_INTERVAL);
}

function renderTypewriterFrame(messageId, text, showCaret) {
    if (!TYPEWRITER_STATES.has(messageId)) {
        return;
    }
    const escape = window.escapeHtml || ((value) => value);
    window.requestAnimationFrame(() => {
        if (!TYPEWRITER_STATES.has(messageId)) {
            return;
        }
        let bubble = document.getElementById(messageId);
        if (!bubble) {
            bubble = document.querySelector(`[data-message-id="${messageId}"]`);
        }
        if (!bubble) {
            setTimeout(() => renderTypewriterFrame(messageId, text, showCaret), 16);
            return;
        }
        bubble.classList.add('typewriter-active');
        let contentElement = bubble.querySelector('.bubble-content');
        if (!contentElement && bubble.classList.contains('bubble-content')) {
            contentElement = bubble;
        }
        if (!contentElement) {
            setTimeout(() => renderTypewriterFrame(messageId, text, showCaret), 16);
            return;
        }
        const safeText = escape(text || '');
        const caretHtml = showCaret ? '<span class="typewriter-caret"></span>' : '';
        contentElement.innerHTML = `<span class="typewriter-text">${safeText}</span>${caretHtml}`;
    });
}

function finalizeTypewriter(messageId) {
    const state = TYPEWRITER_STATES.get(messageId);
    if (!state) {
        return;
    }
    const finalContent = state.finalContent !== null ? state.finalContent : state.targetText;
    const finalMetadata = state.metadata || {};
    const chunkCount = state.chunkCount ?? 0;
    const chunkTotal = state.chunkTotal ?? null;
    if (chunkCount > 0 || chunkTotal) {
        markChunkProgressComplete(messageId, chunkCount, chunkTotal);
    } else {
        hideChunkProgress(messageId);
    }
    TYPEWRITER_STATES.delete(messageId);
    window.chatCore.updateMessage(messageId, {
        content: finalContent,
        metadata: finalMetadata
    });
    window.requestAnimationFrame(() => {
        let bubble = document.getElementById(messageId);
        if (!bubble) {
            bubble = document.querySelector(`[data-message-id="${messageId}"]`);
        }
        if (!bubble) {
            return;
        }
        bubble.classList.remove('typewriter-active');
        const caret = bubble.querySelector('.typewriter-caret');
        if (caret && caret.parentNode) {
            caret.parentNode.removeChild(caret);
        }
    });
}

function resetTypewriterEffect(messageId) {
    const state = TYPEWRITER_STATES.get(messageId);
    if (state && state.timer) {
        clearTimeout(state.timer);
    }
    TYPEWRITER_STATES.delete(messageId);
    hideChunkProgress(messageId);
    window.requestAnimationFrame(() => {
        let bubble = document.getElementById(messageId);
        if (!bubble) {
            bubble = document.querySelector(`[data-message-id="${messageId}"]`);
        }
        if (bubble) {
            bubble.classList.remove('typewriter-active');
            const caret = bubble.querySelector('.typewriter-caret');
            if (caret && caret.parentNode) {
                caret.parentNode.removeChild(caret);
            }
        }
    });
}

/**
 * Utility: Show a spinner in a button (used during async actions)
 */
function addSpinner(button) {
    if (button) {
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    }
}

/**
 * Utility: Restore button content after spinner
 */
function removeSpinner(button) {
    if (button) {
        button.innerHTML = '<i class="bi bi-send fs-5 send-icon-rotated"></i>';
    }
}

/**
 * Handles non-streaming JSON responses from the backend.
 * Adds the agent message to the chat.
 */
function handleJsonResponse(responseText, currentMessageContainer) {
    try {
        const data = JSON.parse(responseText);
        console.log('[QueryFormJS] handleJsonResponse: Parsed API response data:', data);

        if (window.chatCore) {
            // Manually construct the metadata object to ensure all required fields, 
            // including HIL (Human-in-the-Loop) options, are preserved.
            const messageData = {
                role: 'agent',
                content: data.answer || "Sorry, I couldn't get a response.",
                id: data.message_id,
                metadata: {
                    // Standard metadata fields
                    usageMetadata: data.usage_metadata,
                    citations: data.citations,
                    suggestedQuestions: data.follow_up_questions || data.suggested_questions || [],
                    chart_image_base64: data.chart_image_base64,
                    chart_image_mime_type: data.chart_image_mime_type,
                    map_image_base64: data.map_image_base64,
                    map_image_mime_type: data.map_image_mime_type,
                    html_map_url: data.html_map_url,
                    
                    // Explicitly include HIL fields to prevent them from being lost
                    confirmation_required: data.confirmation_required,
                    hil_options: data.hil_options,
                    thread_id: data.thread_id
                }
            };
            
            console.log('[QueryFormJS] Calling window.chatCore.addMessage with:', messageData);
            window.chatCore.addMessage(messageData);
        } else {
            console.error('[QueryFormJS] window.chatCore is NOT available when trying to add agent message.');
        }
    } catch (error) {
        console.error("Error parsing JSON response:", error);
        if (window.chatCore) {
            window.chatCore.addMessage({ role: 'error', content: "Error processing response." });
        }
    }
}

/**
 * Handles resuming a query after HIL confirmation.
 * @param {string} threadId - The thread ID for the interrupted graph execution.
 * @param {string} confirmation - 'yes' or 'no'.
 */
function resumeQuery(threadId, confirmation) {
    console.log(`[QueryForm] Resuming query for thread ${threadId} with confirmation: ${confirmation}`);

    if (confirmation === 'no') {
        // If user says no, maybe add a final message and stop.
        if (window.chatCore) {
            window.chatCore.addMessage({ role: 'agent', content: "Okay, I will not proceed with that action." });
        }
        // Re-enable input maybe? Or just leave it as is.
        return;
    }

    // If 'yes', proceed to call /api/resume_rag
    const submitButton = document.getElementById('send-btn'); // To show loading state
    addSpinner(submitButton); // Indicate processing
    submitButton.disabled = true;

    let streamingMessageId = null;
    if (currentStreamPreference) {
        // Add a placeholder for the resumed response stream
        streamingMessageId = `streaming-resume-${Date.now()}`;
        if (window.chatCore) {
            window.chatCore.addMessage({
                role: 'agent',
                content: '<div class="typing-indicator"><span></span><span></span><span></span></div>', // Typing animation
                id: streamingMessageId
            });
            initializeTypewriterState(streamingMessageId);
        }
    } else {
        window.showLoading();
    }

    // Abort previous request if any (less likely here, but good practice)
    if (currentController) {
        currentController.abort();
    }
    currentController = new AbortController();
    const signal = currentController.signal;

    window.fetchWithCsrfRetry('/api/resume_rag', { // Use fetchWithCsrfRetry
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.readCurrentCsrfToken(), // Use global reader
            'Accept': currentStreamPreference ? 'text/plain' : 'application/json'
        },
        body: JSON.stringify({
            thread_id: threadId,
            confirmation: confirmation // Send 'yes'
        }),
        signal: signal
    })
    .then(response => {
        if (!response.ok) {
             return response.json().then(errData => {
                throw new Error(errData.error || `HTTP error! status: ${response.status}`);
            }).catch(() => {
                throw new Error(`HTTP error! status: ${response.status}`);
            });
        }
        if (currentStreamPreference) {
            readStream(response, streamingMessageId); // Process the resumed stream
        } else {
            return response.text(); // Get JSON text for non-streaming
        }
    })
    .then(text => {
        if (!currentStreamPreference && text) {
            handleJsonResponse(text); // Handle the final JSON response
        }
    })
    .catch(error => {
        if (error.name !== 'AbortError') {
            console.error('Error resuming query:', error);
            if (window.chatCore) {
                window.chatCore.addMessage({ role: 'error', content: `Error resuming: ${error.message}` });
            }
        }
        if (currentStreamPreference && streamingMessageId) {
            resetTypewriterEffect(streamingMessageId);
        }
    })
    .finally(() => {
        if (currentStreamPreference && streamingMessageId) {
            const lingeringState = TYPEWRITER_STATES.get(streamingMessageId);
            if (lingeringState && !lingeringState.streamComplete) {
                resetTypewriterEffect(streamingMessageId);
            }
        }
        removeSpinner(submitButton);
        submitButton.disabled = false; // Re-enable button
        if (!currentStreamPreference) window.hideLoading();
        currentController = null;
    });
}

// --- Placeholder for functions assumed to exist ---
function fetchDynamicQuestions() {
    // Implement as needed or leave as placeholder
}