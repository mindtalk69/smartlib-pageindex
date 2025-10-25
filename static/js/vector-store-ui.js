// --- Self-Retriever Dynamic UI for 2x3 Boxes, Modern Theming, and Animation ---

document.addEventListener('DOMContentLoaded', function() {
  // --- Dynamic Questions: 2 rows x 3 boxes (6 total) ---
  const DEFAULT_QUESTION_ICONS = [
    "bi bi-lightbulb",
    "bi bi-clock-history",
    "bi bi-tags",
    "bi bi-people",
    "bi bi-translate",
    "bi bi-journal-richtext"
  ];
  const DEFAULT_QUESTIONS = [
    "What is the main content or summary of this knowledge/library?",
    "What are the most recent documents in this knowledge/library?",
    "What are the main topics or categories in this knowledge/library?",
    "Who are the main authors or contributors?",
    "What languages are present in this knowledge/library?",
    "Show me a sample document or excerpt."
  ];

  // --- Helper: Remove all self-retriever preview containers with animation ---
  function removeSelfRetrieverBoxes(animated = true) {
    console.log("[SelfRetriever] removeSelfRetrieverBoxes called. Animated:", animated); // DEBUG
    const containers = document.querySelectorAll('.self-retriever-container');
    containers.forEach(container => {
      if (animated) {
        container.classList.add('self-retriever-fadeout');
        setTimeout(() => { if (container.parentElement) container.parentElement.removeChild(container); }, 400);
      } else {
        container.parentElement.removeChild(container);
      }
    });
  }

  // --- Helper: Render 2x3 preview boxes above the "Start me Ask!" animation ---
  async function showSelfRetrieverBoxes({ knowledgeId, libraryId, userId }) {
    console.log("[SelfRetriever] showSelfRetrieverBoxes START", { knowledgeId, libraryId, userId }); // DEBUG
    removeSelfRetrieverBoxes(false);
    const placeholder = document.getElementById('replacement-placeholder');
    if (!placeholder) return;

    // Fetch dynamic questions from backend
    let questions = [];
    try {
      const resp = await window.fetchWithCsrfRetry('/api/self-retriever-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Ensure these values are correct when sent
          knowledge_id: knowledgeId,
          library_id: libraryId || "",
          user_id: userId || ""
        })
      });
      const data = await resp.json();
      if (data.questions && Array.isArray(data.questions)) {
        console.log("[SelfRetriever] Received questions from API:", data.questions); // DEBUG
        // Clean and trim questions, filter out empty
        questions = data.questions.map(q => (q || "").trim()).filter(q => q);
      } else {
        console.warn("[SelfRetriever] API did not return valid questions array:", data); // DEBUG
      }
    } catch (e) {
      console.error("[SelfRetriever] Error fetching questions:", e); // DEBUG
      questions = [];
    }
    // Always enforce exactly 6 questions
    while (questions.length < 6) {
      questions.push(DEFAULT_QUESTIONS[questions.length]);
    }
    questions = questions.slice(0, 6);

    // Create the main container
    const container = document.createElement('div');
    container.className = 'self-retriever-container self-retriever-fadein';
    console.log("[SelfRetriever] Creating container element:", container); // DEBUG
    container.id = 'self-retriever-container';

    // Create two rows
    for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
      const row = document.createElement('div');
      row.className = 'self-retriever-row';
      for (let colIdx = 0; colIdx < 3; colIdx++) {
        const qIdx = rowIdx * 3 + colIdx;
        const qText = questions[qIdx] || DEFAULT_QUESTIONS[qIdx];
        const icon = DEFAULT_QUESTION_ICONS[qIdx];
        const box = document.createElement('div');
        box.className = 'self-retriever-box stunning-box';
        box.setAttribute('tabindex', '0');
        box.setAttribute('role', 'button');
        box.setAttribute('aria-label', qText);

        // Question header
        const questionDiv = document.createElement('div');
        questionDiv.className = 'self-retriever-question stunning-question';
        questionDiv.innerHTML = `<i class="${icon}" style="font-size:1.5em"></i> ${qText}`;
        box.appendChild(questionDiv);

        // Click handler: send the question as a real user query, remove all boxes with animation
        box.addEventListener('click', function() {
          removeSelfRetrieverBoxes(true);

          // Ensure knowledgeId and libraryId are set for the query
          if (!window.selectedKnowledgeId && window.knowledgeLibrariesMap) {
            const keys = Object.keys(window.knowledgeLibrariesMap);
            if (keys.length > 0) {
              window.selectedKnowledgeId = keys[0];
            }
          }
          if (!window.selectedLibraryId && window.knowledgeLibrariesMap && window.selectedKnowledgeId) {
            const libs = window.knowledgeLibrariesMap[window.selectedKnowledgeId];
            if (libs && libs.length > 0) {
              window.selectedLibraryId = libs[0].library_id;
            }
          }

          const queryInput = document.querySelector("textarea[name='query']");
          const queryForm = document.getElementById("query-form");
          if (queryInput && queryForm) {
            queryInput.value = qText;
            if (typeof window.adjustTextareaHeight === 'function') {
              window.adjustTextareaHeight(queryInput);
            }
            queryForm.requestSubmit();
          }
        });

        // Keyboard accessibility: Enter/Space triggers click
        box.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            box.click();
          }
        });

        row.appendChild(box);
      }
      container.appendChild(row);
    }

    // Insert the container above the placeholder
    placeholder.parentNode.insertBefore(container, placeholder);
    console.log("[SelfRetriever] Inserted container into DOM."); // DEBUG
    setTimeout(() => container.classList.remove('self-retriever-fadein'), 10);

    // Scroll chat to bottom to show the boxes
    if (typeof window.scrollChatToBottom === 'function') {
      window.scrollChatToBottom();
    } else {
      // Fallback: scroll .chat-content to bottom
      const mainScrollContainer = document.querySelector('.chat-content');
      if (mainScrollContainer) {
        requestAnimationFrame(() => {
          mainScrollContainer.scrollTop = mainScrollContainer.scrollHeight;
        });
      }
    }
  }

  // --- Trigger logic for when to show/hide the boxes ---

  // Show on knowledge/library change
  function triggerSelfRetrieverOnDropdown() {
    console.log("[SelfRetriever] triggerSelfRetrieverOnDropdown called. Current state:", { knowledgeId: window.selectedKnowledgeId, libraryId: window.selectedLibraryId }); // DEBUG
    showSelfRetrieverBoxes({
      knowledgeId: window.selectedKnowledgeId,
      libraryId: window.selectedLibraryId || "",
      userId: window.currentUserId || ""
    });
  }

  function generateUUID() {
    // RFC4122 version 4 compliant UUID
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  // Clear chat UI and show placeholder
  function clearChatUI() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';
    
    const placeholder = document.getElementById('replacement-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
  }

  // Show on "new conversation" (clear chat)
  function triggerSelfRetrieverOnNewConversation() {
    // Clear UI first
    clearChatUI();
    
    // Generate new thread_id
    currentThreadId = generateUUID();
    
    // Clear localStorage conversation data if exists
    if (localStorage.getItem('currentThreadId')) {
      localStorage.removeItem('currentThreadId');
    }
    if (localStorage.getItem('chatMessages')) {
      localStorage.removeItem('chatMessages');
    }
    
    // Show self-retriever boxes
    showSelfRetrieverBoxes({
      knowledgeId: window.selectedKnowledgeId,
      libraryId: window.selectedLibraryId || "",
      userId: window.currentUserId || ""
    });
  }

  // Remove on user question (form submit)
  function setupRemoveOnUserQuestion() {
    const queryForm = document.getElementById("query-form");
    if (queryForm) {
      queryForm.addEventListener("submit", function() {
        removeSelfRetrieverBoxes(true);
        
        // Add thread_id to form data if it exists
        if (window.currentThreadId) {
          const threadIdInput = document.createElement('input');
          threadIdInput.type = 'hidden';
          threadIdInput.name = 'thread_id';
          threadIdInput.value = window.currentThreadId;
          queryForm.appendChild(threadIdInput);
        }
      });
    }
  }

  // Remove on suggested question click (delegated)
  function setupRemoveOnSuggestedQuestion() {
    document.body.addEventListener("click", function(e) {
      if (e.target.classList.contains("suggested-question-btn")) {
        removeSelfRetrieverBoxes(true);
      }
    });
  }

  // --- Dynamic library dropdown for knowledge mode ---
  if (window.knowledgeLibrariesMap) {
    const knowledgeSelectBtn = document.getElementById('knowledgeSelectBtn');
    const knowledgeDropdown = document.getElementById('knowledgeSelectDropdown');
    const librarySelectContainer = document.getElementById('library-select-container'); // Get the new container

    if (!knowledgeSelectBtn || !knowledgeDropdown || !librarySelectContainer) {
        console.warn('[VectorStoreUI] Could not find all necessary dropdown containers. Dynamic library select might not work.');
        return;
    }

    // Clear any previous dynamic library dropdown from the container
    librarySelectContainer.innerHTML = '';

    // Create the library button and dropdown menu
    let libraryBtn = document.createElement('button');
    libraryBtn.type = 'button';
    // Match styling of knowledgeSelectBtn
    libraryBtn.className = 'btn btn-xs btn-outline-secondary dropdown-toggle'; 
    libraryBtn.id = 'librarySelectBtn';
    libraryBtn.setAttribute('data-bs-toggle', 'dropdown');
    libraryBtn.setAttribute('aria-expanded', 'false');
    libraryBtn.title = 'Select context library to search';
    libraryBtn.innerHTML = '<i class="bi bi-book me-1"></i> Library: All';

    let libraryDropdown = document.createElement('ul');
    libraryDropdown.className = 'dropdown-menu dropdown-menu-sm dropdown-menu-end';
    libraryDropdown.id = 'librarySelectDropdown';
    libraryDropdown.setAttribute('aria-labelledby', 'librarySelectBtn');

    // Append the new library button and dropdown to their container
    // The container itself is already positioned by the HTML in base.html
    librarySelectContainer.appendChild(libraryBtn);
    librarySelectContainer.appendChild(libraryDropdown);

    console.log('[VectorStoreUI] Dynamically created library dropdown elements.');

    function updateLibraryDropdown(knowledgeId) {
      const libs = window.knowledgeLibrariesMap[knowledgeId] || [];
      libraryDropdown.innerHTML = '';
      if (libs.length === 0) {
        const li = document.createElement('li');
        li.innerHTML = '<span class="dropdown-item disabled text-muted">No libraries available</span>';
        libraryDropdown.appendChild(li);
        libraryBtn.innerHTML = '<i class="bi bi-book me-1"></i> Library: None';
        libraryBtn.disabled = true;
      } else {
        libraryBtn.disabled = false;
        libraryBtn.innerHTML = '<i class="bi bi-book me-1"></i> Library: All';
        const allLi = document.createElement('li');
        allLi.innerHTML = '<a class="dropdown-item active" href="#" data-library-id="">All Libraries</a>';
        libraryDropdown.appendChild(allLi);
        libs.forEach(lib => {
          const li = document.createElement('li');
          li.innerHTML = `<a class="dropdown-item" href="#" data-library-id="${lib.library_id}">${lib.name}</a>`;
          libraryDropdown.appendChild(li);
        });
      }
    }

    knowledgeDropdown.addEventListener('click', function(e) {
      const target = e.target.closest('a[data-knowledge-id]');
      if (target) {
        const knowledgeId = target.getAttribute('data-knowledge-id');
        const knowledgeName = target.textContent.trim();
        window.selectedKnowledgeId = knowledgeId;
        knowledgeSelectBtn.innerHTML = `<i class="bi bi-journal-bookmark me-1"></i> Knowledge: ${knowledgeName}`;
        updateLibraryDropdown(knowledgeId);
        const dropdownInstance = bootstrap.Dropdown.getOrCreateInstance(knowledgeSelectBtn);
        dropdownInstance.hide();
        triggerSelfRetrieverOnDropdown();
      }
    });

    libraryDropdown.addEventListener('click', function(e) {
      const target = e.target.closest('a[data-library-id]');
      if (target) {
        console.log("[SelfRetriever] Library dropdown item clicked:", target.textContent); // DEBUG
        const libraryId = target.getAttribute('data-library-id');
        const libraryName = target.textContent.trim();
        window.selectedLibraryId = libraryId;
        window.selectedLibraryName = libraryName;
        console.log("[SelfRetriever] Updated window.selectedLibraryId:", window.selectedLibraryId); // DEBUG
        libraryBtn.innerHTML = `<i class="bi bi-book me-1"></i> Library: ${libraryName}`;
        libraryDropdown.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('active'));
        console.log("[SelfRetriever] Updated library button text:", libraryBtn.innerHTML); // DEBUG
        target.classList.add('active');
        if (window.selectedKnowledgeId) {
          triggerSelfRetrieverOnDropdown();
        }
      }
    });

    updateLibraryDropdown('');
  }

  // --- Listen for "new conversation" event (clear chat) ---
  // This function is called in text-animations.js or main.js when new conversation is started
  window.showSelfRetrieverBoxesOnNewConversation = triggerSelfRetrieverOnNewConversation;

  // Setup removal triggers
  setupRemoveOnUserQuestion();
  setupRemoveOnSuggestedQuestion();

  // Optionally, you can call showSelfRetrieverBoxesOnNewConversation() in your clearChatAndRestartAnimation or similar function
});
