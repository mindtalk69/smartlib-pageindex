/**
 * Chat UI Module - Handles chat interface rendering (World-Class Copilot/ChatGPT Style)
 * Supports: theme/palette switching, multimodal (image/video/map), accessibility
 */

class ChatUI {
  constructor(containerSelector = '#chat-container', options = {}) {
    console.log('[ChatUI] Constructor called.'); // Log constructor start
    this.isReady = false; // Add a ready flag
    this.config = {
      bubbleClass: 'chat-bubble',
      userBubbleClass: 'user-bubble',
      agentBubbleClass: 'agent-bubble',
      systemBubbleClass: 'system-bubble',
      typingIndicatorClass: 'typing-indicator',
      ...options
    };
    this.readyPromise = new Promise((resolve) => { // Create a promise
    // Removed this.messageHistory - ChatCore is the source of truth
    
    // Define methods as class properties (arrow functions)
    this._setupStyles = () => {
      const styleId = 'chat-ui-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Base bubble styles */
        .${this.config.bubbleClass} {
          max-width: 85%;
          padding: 16px 22px;
          margin: 12px 0;
          border-radius: 22px;
          position: relative;
          word-wrap: break-word;
          animation: fadeIn 0.3s ease;
          box-shadow: 0 4px 24px rgba(0,0,0,0.1);
          transition: all 0.2s ease;
          backdrop-filter: blur(2.5px);
        }

        .${this.config.bubbleClass}.chunk-pulse {
          animation: chunkPulse 0.25s ease;
        }

        @keyframes chunkPulse {
          0% {
            box-shadow: 0 0 0 rgba(13,110,253,0.0);
          }
          40% {
            box-shadow: 0 0 20px rgba(13,110,253,0.3);
          }
          100% {
            box-shadow: 0 0 0 rgba(13,110,253,0.0);
          }
        }

        .stream-progress {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin-bottom: 8px;
          font-size: 0.75rem;
          color: var(--bs-secondary-color, #6c757d);
        }

        .stream-progress[hidden] {
          display: none !important;
        }

        .stream-progress-bar {
          position: relative;
          flex: 1;
          height: 4px;
          border-radius: 999px;
          background: var(--bs-border-color-translucent, rgba(0,0,0,0.08));
          overflow: hidden;
        }

        .stream-progress-bar::after {
          content: '';
          position: absolute;
          inset: 0;
          width: var(--progress-width, 18%);
          max-width: 100%;
          background: linear-gradient(90deg, var(--bs-primary, #0d6efd), var(--bs-info, #0dcaf0));
          border-radius: inherit;
          transition: width 0.25s ease;
        }

        .stream-progress.stream-progress-complete .stream-progress-bar::after {
          width: 100%;
          background: linear-gradient(90deg, var(--bs-success, #198754), var(--bs-primary, #0d6efd));
        }

        .stream-progress-label {
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        /* Message footer styles */
        .message-footer {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--bs-border-color-translucent);
          font-size: 0.85rem;
        }

        .footer-line-1 {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.2rem;
        }

        .feedback-actions-minimal {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        .icon-btn {
          background: none;
          border: none;
          color: var(--bs-secondary-color, #888);
          font-size: 1.1em;
          padding: 0.15em 0.4em;
          border-radius: 50%;
          transition: background 0.15s, color 0.15s;
          outline: none;
        }
        .icon-btn:focus,
        .icon-btn:hover {
          color: var(--bs-body-color, #222);
          background: var(--bs-border-color-translucent, #eaeaea);
        }

        .footer-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .token-usage-minimal {
          font-size: 0.85em;
          color: var(--bs-secondary-color, #888);
        }
        .token-badge {
          display: inline-block;
          min-width: 28px;
          padding: 0.1em 0.7em;
          border-radius: 1em;
          background: var(--bs-border-color-translucent, #eaeaea);
          color: var(--bs-body-color, #222);
          font-size: 0.85em;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .model-name-badge {
          display: inline-block;
          padding: 0.1em 0.7em;
          border-radius: 1em;
          background: var(--bs-tertiary-bg);
          color: var(--bs-secondary-color);
          font-size: 0.8em;
          margin-right: 0.4em;
          font-family: var(--bs-font-monospace);
        }
        .token-usage-verbose {
          font-family: var(--bs-font-monospace);
          font-size: 0.8em;
          color: var(--bs-secondary-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%; /* Ensure it doesn't overflow its container */
        }

        .evidence-indicator {
          margin-left: 0.2em;
          color: var(--bs-secondary-color, #888);
          font-size: 1.1em;
        }

        /* Citations section */
        .citations-minimal {
          margin-top: 0.1em;
          font-size: 0.78em;
          color: var(--bs-secondary-color, #888);
        }
        .citation-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5em;
        }
        .citation-item {
          display: flex;
          align-items: center;
          gap: 0.2em;
          background: none;
          border-radius: 0.5em;
          padding: 0.1em 0.5em;
          font-size: 0.95em;
        }
        .citation-item i {
          font-size: 1em;
          color: var(--bs-border-color, #bbb);
        }
        .citation-item:hover {
          background: var(--bs-border-color-translucent, #eaeaea);
          color: var(--bs-body-color, #222);
          cursor: pointer;
        }

        /* Visual evidence icon in inline citation */
        .inline-citation.has-visual-evidence {
          /* Optional: further distinguish */
        }
        .visual-evidence-icon {
          color: var(--bs-primary); /* Or another distinct color */
          font-size: 0.9em; /* Adjust size as needed */
          cursor: pointer;
        }

        /* --- ADDED: Citation Popover Styles --- */
        .citation-popover {
            max-width: 640px !important; /* Adjusted to user preference */
            box-shadow: 0 5px 15px rgba(0,0,0,0.15);
            border: 1px solid var(--bs-border-color-translucent);
        }
        .citation-popover .popover-header {
            font-size: 0.9rem;
            font-weight: 600;
            background-color: var(--bs-tertiary-bg);
        }
        .citation-popover .popover-body {
            padding: 0.5rem 0.75rem;
        }
        .citation-popover-content pre {
            font-family: var(--bs-font-monospace);
            font-size: 0.75rem; /* Reduced for readability of long text */
            color: var(--bs-secondary-color);
            margin-bottom: 0;
        }

        /* Suggested questions */
        .suggested-questions-minimal {
          margin-top: 0.1em;
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .suggested-questions-minimal.fade-in {
          opacity: 1;
          transform: translateY(0);
        }
        .suggested-questions-minimal.fade-out {
          opacity: 0;
          transform: translateY(-16px);
          pointer-events: none;
        }
        .suggested-questions-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4em;
        }
        .suggested-question-pill {
          border: 1px solid var(--bs-border-color, #bbb);
          background: none;
          color: var(--bs-body-color, #222);
          border-radius: 1em;
          font-size: 0.85em;
          padding: 0.15em 0.9em;
          margin-bottom: 0.1em;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .suggested-question-pill:focus,
        .suggested-question-pill:hover {
          background: var(--bs-border-color-translucent, #eaeaea);
          color: var(--bs-body-color, #222);
        }

        .chart-actions {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          gap: 5px; /* Keep the gap for buttons */
          background-color: var(--bs-tertiary-bg); /* Use a theme-aware background color */
          padding: 5px;
          border-radius: 5px;
          opacity: 1; /* Always visible */
          transition: opacity 0.2s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    };

    this._setupEventListeners = () => {
      console.log('[ChatUI] Setting up event listeners...'); // Log listener setup start
      window.addEventListener('messageAdded', (e) => {
        // FIX: Extract the actual message object from the event detail
        console.log('[ChatUI] Received messageAdded event detail:', e.detail); // Log received event detail
        if (e.detail && e.detail.message) {
          this.renderSingleMessage(e.detail.message); // Pass e.detail.message
        }
      });
      window.addEventListener('messageUpdated', (e) => {
        console.log('[ChatUI] messageUpdated listener FIRED!'); // Add this line
        console.log('[ChatUI] Received messageUpdated event detail:', e.detail);
        // FIX: Check for e.detail.message and pass that to the update function
        if (e.detail && e.detail.message && e.detail.message.id) {
          this.updateRenderedMessage(e.detail.message); // Pass the message object
      } else {
          console.warn('[ChatUI] Received messageUpdated event, but detail is not a valid message object:', e.detail);
      }
      });
      window.addEventListener('chatCleared', () => {
        if (this.container) {
          this.container.innerHTML = '';
          console.log('[ChatUI] Chat cleared via chatCleared event.');
        }
      });
      console.log('[ChatUI] Event listeners for messageAdded/Updated attached.'); // Log listener setup end
      // Other UI event listeners
      if (this.container) {
        this.container.addEventListener('click', (e) => {
          // --- ADDED: Handle visual evidence icon click via delegation ---
          const visualEvidenceButton = e.target.closest('.visual-evidence-icon');
          if (visualEvidenceButton) {
            console.log('[ChatUI] Delegated click: Visual evidence icon CLICKED. Element:', visualEvidenceButton, 'Dataset:', visualEvidenceButton.dataset);
            e.preventDefault(); // Prevent any default action if the icon were, e.g., an <a>
            e.stopPropagation(); // Stop the click from bubbling further if needed
            
            const documentId = visualEvidenceButton.dataset.documentId;
            const pageNo = visualEvidenceButton.dataset.pageNo;
            const bboxString = visualEvidenceButton.dataset.bbox;

            if (documentId && pageNo !== undefined && bboxString) {
              try {
                const bbox = JSON.parse(bboxString);
                this._showVisualEvidenceModal(documentId, pageNo, bbox);
              } catch (parseError) {
                console.error('[ChatUI] Error parsing bbox for visual evidence:', parseError, "Bbox string was:", bboxString);
                alert('Error processing visual evidence data.');
              }
            } else {
              console.warn('[ChatUI] Missing data attributes on visual evidence icon for modal display.', {documentId, pageNo, bboxString});
              alert('Cannot show visual evidence: data missing from icon.');
            }
            return; // Important: Stop further processing if it was a visual evidence click
          }
          // --- END ADDED ---

          // --- ADDED: Handle citation popover click ---
          const citationLink = e.target.closest('.citation-popover-trigger');
          if (citationLink) {
            e.preventDefault();
            const docId = citationLink.dataset.docId;
            const libraryId = citationLink.dataset.libraryId;
            this._showCitationPopover(citationLink, docId, libraryId);
            return;
          }
          // --- END ADDED ---


          if (e.target.classList.contains('followup-question')) {
            this._handleFollowupQuestion(e.target.dataset.question);
          }

          

          // Handle suggested question pill click
          if (e.target.classList.contains('suggested-question-pill')) {
            // This handles clicks on pills rendered by _renderFooter,
            // which appear INSIDE an agent's chat bubble.
            const originalQuestion = e.target.dataset.question || e.target.textContent.trim(); // Use data-question if available
            
            const prefixes = {
                "English": "Regarding the previous information, ",
                "Indonesian": "Mengenai informasi sebelumnya, "
            };

            const activeLanguage = window.active_language || "English";
            const prefix = prefixes[activeLanguage] || prefixes["English"];

            let dfNameContext = "the previous information"; // Default context
            const suggestionsContainer = e.target.closest('.suggested-questions-minimal');
            const sourceType = suggestionsContainer ? suggestionsContainer.dataset.sourceType : null;

            if (sourceType === 'dataframe') {
                dfNameContext = "the analyzed data";
            } else if (sourceType === 'rag') {
                dfNameContext = "the retrieved documents";
            }
            
            const contextualizedQuestion = `${prefix}${originalQuestion}`;

            const input = document.getElementById('query-input');
            // Fade out the suggestions gracefully
            const suggestions = e.target.closest('.suggested-questions-minimal');
            if (suggestions) {
              suggestions.classList.add('fade-out');
              setTimeout(() => {
                // Check if suggestions still exist and have a parent before trying to remove
                // This prevents errors if the user clicks multiple suggestions rapidly
                if (suggestions && suggestions.parentNode && suggestions.classList.contains('fade-out')) {
                  suggestions.parentNode.removeChild(suggestions);
                }
              }, 400); // match transition duration
            }
            if (input) {
              input.value = contextualizedQuestion; // Use the contextualized question
              // Optionally, trigger send
              const sendBtn = document.getElementById('send-btn');
              if (sendBtn) {
                sendBtn.click();
              }
            }
          }
          // Handle copy chart button click
          if (e.target.closest('.copy-chart-btn')) {
            const button = e.target.closest('.copy-chart-btn');
            const chartContainer = button.closest('.generated-chart-container');
            const imgElement = chartContainer ? chartContainer.querySelector('img') : null;
            if (imgElement) {
              this._copyChartToClipboard(imgElement.src);
            }
          }
          // Handle download chart button click
          if (e.target.closest('.download-chart-btn')) {
             // Similar logic for download if you add it
          }
        });
        // Add listeners for feedback, copy, citations etc. here if needed
      }
    };

    this._loadMessages = () => {
      try {
        const saved = localStorage.getItem('chatMessages');
        if (saved) {
          // This approach is problematic with ChatCore managing state.
          // Prefer initializing messages via ChatCore from init-conversation.js
          console.warn("[ChatUI] _loadMessages from localStorage might conflict with ChatCore state.");
          // const messages = JSON.parse(saved);
          // messages.forEach(msg => this.renderSingleMessage(msg));
        }
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    };


    /**
     * Enhances known map URLs in HTML content to display a preview/icon.
     * @param {string} htmlContent - The HTML content of the message.
     * @returns {string} - HTML content with map links enhanced.
     */
    this._enhanceMapLinks = (htmlContent) => {
      // TODO: Secure API Key - In production, fetch this from backend or config
      const GOOGLE_STATIC_MAPS_API_KEY = 'AIzaSyAYOirmwrAJeXSNg5VGIBnVlr8xZ2VzqFs'; // REPLACE THIS

      console.log("[ChatUI _enhanceMapLinks] Received HTML content:", htmlContent); // DEBUG

      // Regex 1: For external map services (Google, OSM, Bing, Apple) - finds plain URLs
      const externalMapUrlRegex = /(?<!href=")(?<!src=")(?<!">)(https?:\/\/(?:www\.)?(?:maps\.google\.com[^\s<'">]+|google\.com\/maps[^\s<'">]+|openstreetmap\.org[^\s<'">]+|bing\.com\/maps[^\s<'">]+|maps\.apple\.com[^\s<'">]+))/gi;

      // Regex 2: For existing <a> tags pointing to local static maps
      const localStaticMapLinkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?\/static\/maps\/[^"']+?\.(?:html|htm))\1[^>]*>(.*?)<\/a>/gi;
      
      let matchCount = 0;

      // --- Process External Map URLs First ---
      let processedHtml = htmlContent.replace(externalMapUrlRegex, (url) => {
          matchCount++;
          console.log("[ChatUI _enhanceMapLinks] Matched EXTERNAL URL:", url); // DEBUG
          const safeUrl = window.escapeHtml(url); // Use global escapeHtml
          let imageElement = `<i class="bi bi-map fs-1 me-3 text-primary"></i>`; // Default icon

          if (url.includes('maps.google.com') || url.includes('google.com/maps')) {
            if (!GOOGLE_STATIC_MAPS_API_KEY || GOOGLE_STATIC_MAPS_API_KEY === 'YOUR_GOOGLE_STATIC_MAPS_API_KEY') {
              console.warn("[ChatUI _enhanceMapLinks] Google Static Maps API Key not configured. Using default icon.");
            } else {
              let staticMapParams = 'size=300x200&maptype=roadmap';
              try {
                const urlObj = new URL(url);
                const params = urlObj.searchParams;
                let centerOrQuery = '';

                if (params.get('q')) { // Query parameter (e.g., "Eiffel Tower")
                  centerOrQuery = `center=${encodeURIComponent(params.get('q'))}&markers=color:red%7Clabel:S%7C${encodeURIComponent(params.get('q'))}`;
                } else if (params.get('ll')) { // Latitude/Longitude
                  centerOrQuery = `center=${params.get('ll')}&markers=color:red%7C${params.get('ll')}`;
                } else if (url.includes('/@')) { // Path based lat,lng,zoom (e.g., /@34.0522,-118.2437,12z)
                  const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+z)?/);
                  if (match && match[1] && match[2]) {
                    const lat = match[1];
                    const lng = match[2];
                    centerOrQuery = `center=${lat},${lng}&markers=color:red%7C${lat},${lng}`;
                    if (match[3]) { // Zoom level
                      staticMapParams += `&zoom=${parseInt(match[3])}`;
                    } else {
                      staticMapParams += `&zoom=14`; // Default zoom if not present
                    }
                  }
                }

                if (centerOrQuery) {
                  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?${centerOrQuery}&${staticMapParams}&key=${GOOGLE_STATIC_MAPS_API_KEY}`;
                  imageElement = `<img src="${window.escapeHtml(staticMapUrl)}" alt="Map preview" class="me-3" style="width: 100px; height: 100px; border-radius: 0.5rem; object-fit: cover;">`;
                  console.log("[ChatUI _enhanceMapLinks] Generated Static Map URL:", staticMapUrl);
                } else {
                  console.warn("[ChatUI _enhanceMapLinks] Could not extract location for Google Static Map from URL:", url);
                }
              } catch (e) {
                console.error("[ChatUI _enhanceMapLinks] Error parsing Google Maps URL or constructing static map URL:", e);
              }
            }
          }

          return `
              <div class="map-link-container my-2">
                  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="map-preview-link d-flex align-items-center p-2 border rounded text-decoration-none shadow-sm">
                      ${imageElement}
                      <div>
                        <strong class="d-block">View Interactive Map</strong>
                        <span class="map-url-text text-muted small text-break">${safeUrl}</span>
                      </div>
                  </a>
              </div>
          `;
      });

      // --- Process Local Static Map Links ---
      // This will replace existing <a> tags that match the pattern
      processedHtml = processedHtml.replace(localStaticMapLinkRegex, (match, quote, href, linkText) => {
          matchCount++;
          console.log("[ChatUI _enhanceMapLinks] Matched LOCAL STATIC MAP LINK. Href:", href, "Link Text:", linkText); // DEBUG
          const safeHref = window.escapeHtml(href);
          // Use the original linkText or a default if it's empty
          const displayLinkText = linkText.trim() || "View Static Map";

          return `
              <div class="map-link-container my-2">
                  <a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="map-preview-link d-flex align-items-center p-2 border rounded text-decoration-none shadow-sm">
                      <i class="bi bi-filetype-html fs-1 me-3 text-info"></i> <!-- Icon for local HTML map -->
                      <div>
                        <strong class="d-block">View Static Map</strong>
                        <span class="map-url-text text-muted small text-break">${safeHref}</span>
                      </div>
                  </a>
              </div>
          `;
      });

      if (matchCount === 0) {
        console.log("[ChatUI _enhanceMapLinks] No map URLs matched the regex."); // DEBUG
    }
    return processedHtml;
    };



    /**
     * Renders a single message bubble and appends it to the container.
     * @param {object} message - The message object from ChatCore.
     */
    this.renderSingleMessage = (message) => {
      console.log('[ChatUI] renderSingleMessage called with:', message); // Log function call
      // --- Add detailed check for the early return condition ---
      if (!this.container) console.error('[ChatUI] renderSingleMessage: this.container is null or undefined!');
      if (!message) console.error('[ChatUI] renderSingleMessage: message object is null or undefined!');
      if (message && !message.role) console.error('[ChatUI] renderSingleMessage: message.role is missing!');
      if (!this.container || !message || !message.role) return; // Basic validation
      // --- End detailed check ---
      console.log('[ChatUI] Container exists:', this.container); // Log container check
      console.log('[ChatUI] Creating bubble element...'); // Log step
      let bubble; // Declare bubble variable
      try {
        bubble = document.createElement('div');
      } catch (e) {
        console.error('[ChatUI] Error creating bubble element:', e);
        return; // Stop if creation fails
      }
      // const bubble = document.createElement('div'); // REMOVE: Redeclaration error
      // --- IMPORTANT: Add the message ID to the bubble element ---
      bubble.id = message.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; // Assign ID or generate one
      bubble.className = `${this.config.bubbleClass} ${
        message.role === 'user' ? this.config.userBubbleClass :
        message.role === 'agent' ? this.config.agentBubbleClass :
        message.role === 'error' ? 'error-bubble' : // Add error style if needed
        this.config.systemBubbleClass
      }`;
      bubble.dataset.messageId = message.id; // Add data attribute for feedback handler


      // Start with the text content
      let textContentHtml = message.content || '';
      if (message.role !== 'user') { // For agent/system, enhance map links
          textContentHtml = this._enhanceMapLinks(textContentHtml);
      }
      
      // Prepare chart HTML if chart data exists in metadata
      let chartHtml = '';
      if (message.metadata && message.metadata.chart_image_base64 && message.metadata.chart_image_mime_type) {
          console.log('[ChatUI] Chart data found in metadata, preparing chart HTML.');
          chartHtml = `<div class="generated-chart-container my-2" style="position: relative;">
                              <img src="data:${message.metadata.chart_image_mime_type};base64,${message.metadata.chart_image_base64}" alt="Generated chart" style="max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 8px; display: block; margin: 0 auto;">
                              <div class="chart-actions">
                                <button class="icon-btn copy-chart-btn" title="Copy Chart" aria-label="Copy Chart">
                                  <i class="bi bi-clipboard-plus"></i>
                                </button>
                                <!-- Add download button here if desired -->
                              </div>
                            </div>`;
      }

      // --- NEW: Prepare Map Image HTML ---
      let mapImageHtml = '';
      if (message.metadata && message.metadata.map_image_base64 && message.metadata.map_image_mime_type) {
          console.log('[ChatUI] Map image data found in metadata, preparing map image HTML.');
          mapImageHtml = `<div class="generated-map-container my-3 text-center">
                              <img src="data:${message.metadata.map_image_mime_type};base64,${message.metadata.map_image_base64}" 
                                   alt="Map preview" 
                                   style="max-width: 100%; max-height: 400px; height: auto; border: 1px solid #ccc; border-radius: 8px; display: inline-block; margin-bottom: 10px;">
                              <!-- The map link itself will be part of the textContentHtml and handled by _enhanceMapLinks -->
                          </div>`;
      }
      // --- END NEW ---


      

      // Safely render markdown content
      // Combine chart (if any) and text content
      // User messages might already be HTML (for image previews), agent messages are processed text
      let finalHtmlContent;
      if (message.role === 'user') {
        finalHtmlContent = textContentHtml; // User content is already HTML or escaped text
      } else {
        // Enhance agent/system content for citations before combining with chart
        let enhancedTextContent = this._enhanceMapLinks(textContentHtml); // First enhance maps
        if (message.metadata && message.metadata.citations) {
            enhancedTextContent = this._enhanceCitationsWithVisualEvidence(enhancedTextContent, message.metadata.citations);
        }
        // Prepend map image, then chart, then the enhanced text content
        finalHtmlContent = mapImageHtml + chartHtml + enhancedTextContent;
      }

      bubble.innerHTML = `
        ${message.role === 'agent' ? `<div class="stream-progress" data-stream-progress="${bubble.id}" hidden><div class="stream-progress-bar"></div><span class="stream-progress-label">Streaming…</span></div>` : ''}
        <div class="bubble-content">${finalHtmlContent}</div>
        ${message.role === 'agent' ? `<div class="message-footer">${this._renderFooter(message)}</div>` : ''}
      `;

      // --- FIX: Call _appendConfirmationButtons for new messages ---
      // Call this *after* setting innerHTML but *before* appending, or just after appending.
      this._appendConfirmationButtons(bubble, message);

      // Animate fade-in for suggestions if present
      if (message.role === 'agent') {
        const footer = bubble.querySelector('.message-footer');
        if (footer) {
          const suggestionsElement = footer.querySelector('.suggested-questions-minimal');
          if (suggestionsElement) {
            // If 'fade-in' is meant for initial appearance, CSS can handle it,
            // or it can be added here if it's a dynamic effect.
            // For now, let's assume it's for an initial effect.
            suggestionsElement.style.opacity = '0'; // Start transparent
            requestAnimationFrame(() => { // Ensure it's applied after DOM update
              suggestionsElement.style.transition = 'opacity 0.4s ease-in-out';
              suggestionsElement.style.opacity = '1'; // Fade in
            });
          }
        }
      }

      console.log('[ChatUI] Appending bubble to container:', this.container); // Log step
      this.container.appendChild(bubble);
      console.log('[ChatUI] Bubble appended. Scrolling...'); // Log step
      this.scrollToBottom(); // Scroll after adding
    };

    /**
     * Appends confirmation buttons if required by message metadata.
     * @param {HTMLElement} bubble - The message bubble element.
     * @param {object} message - The message object.
     */
    this._appendConfirmationButtons = (bubble, message) => {
        // Check for the new hil_options structure
        if (message.metadata && message.metadata.confirmation_required === true && Array.isArray(message.metadata.hil_options)) {
            console.log(`[ChatUI] Appending HIL confirmation buttons for message ID: ${message.id}`);
            
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'confirmation-buttons mt-3 d-flex flex-wrap gap-2';

            // Dynamically create buttons from the backend response
            message.metadata.hil_options.forEach(option => {
                const button = document.createElement('button');
                // Use the 'confirm-btn' class to match the listener in query-form.js
                button.className = 'btn btn-sm btn-outline-primary confirm-btn'; 
                button.textContent = option.display_text;
                // Set the dataset attributes that resumeQuery in query-form.js expects
                button.dataset.confirmation = option.payload; // 'yes' or 'no'
                button.dataset.threadId = message.metadata.thread_id;
                buttonContainer.appendChild(button);
            });

            const contentElement = bubble.querySelector('.bubble-content');
            if (contentElement) {
                // Place buttons right after the main text content for visibility
                contentElement.insertAdjacentElement('afterend', buttonContainer);
            } else {
                bubble.appendChild(buttonContainer); // Fallback
            }
        }
    };

    /**
     * Updates the content of an already rendered message bubble.
     * Used for streaming responses.
     * @param {object} message - The updated message object from ChatCore.
     */
    this.updateRenderedMessage = (message) => {
      // Check if message object itself is passed directly (as it should be from ChatCore)
      if (!this.container || !message || !message.id) {
          console.warn('[ChatUI] updateRenderedMessage: Invalid arguments', { container: !!this.container, message });
          return;
      }

      
      const bubble = document.getElementById(message.id);
      console.log(`[ChatUI] updateRenderedMessage: Attempting update for ID ${message.id}. Found bubble:`, bubble); // Log attempt and found bubble
      if (bubble && !bubble.dataset.messageId) {
        bubble.dataset.messageId = message.id; // Ensure data attribute is present on update too
      }

      const typewriterStates = window.TYPEWRITER_STATES;
      const typewriterActive = Boolean(typewriterStates && typewriterStates.has(message.id));

      if (bubble) {
        if (typewriterActive) {
          return;
        }
        const contentElement = bubble.querySelector('.bubble-content'); // Find the content area
        if (contentElement) {
          const newContent = message.content || '';
          const rawContent = message.content || ''; // Use rawContent for clarity
          console.log(`[ChatUI] updateRenderedMessage: Updating content for ID ${message.id} to:`, newContent); // Log new content
          // Use DOMPurify if available and configured in ChatCore
          let finalHtmlContent = '';
          try {
            // --- NEW: Prepare Map Image HTML for update ---
            let mapImageHtmlForUpdate = '';
            if (message.metadata && message.metadata.map_image_base64 && message.metadata.map_image_mime_type) {
                console.log('[ChatUI updateRenderedMessage] Map image data found, preparing map image HTML.');
                mapImageHtmlForUpdate = `<div class="generated-map-container my-3 text-center">
                                            <img src="data:${message.metadata.map_image_mime_type};base64,${message.metadata.map_image_base64}" 
                                                 alt="Map preview" 
                                                 style="max-width: 100%; max-height: 400px; height: auto; border: 1px solid #ccc; border-radius: 8px; display: inline-block; margin-bottom: 10px;">
                                        </div>`;
            }
            // --- END NEW ---

            let chartHtmlForUpdate = '';
            if (message.metadata && message.metadata.chart_image_base64 && message.metadata.chart_image_mime_type) {
                chartHtmlForUpdate = `<div class="generated-chart-container my-2" style="position: relative;">
                                        <img src="data:${message.metadata.chart_image_mime_type};base64,${message.metadata.chart_image_base64}" alt="Generated chart" style="max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 8px; display: block; margin: 0 auto;">
                                        <div class="chart-actions"> <button class="icon-btn copy-chart-btn" title="Copy Chart" aria-label="Copy Chart"><i class="bi bi-clipboard-plus"></i></button> </div>
                                      </div>`;
            }

            // For agent/system messages, content from ChatCore is already HTML (Markdown parsed & sanitized)
            if (message.role === 'agent' || message.role === 'system') {
                let enhancedContent = this._enhanceMapLinks(rawContent); // Enhance for maps
                if (message.metadata && message.metadata.citations) {
                    enhancedContent = this._enhanceCitationsWithVisualEvidence(enhancedContent, message.metadata.citations);
                }
                // Combine: map image, then chart, then text
                finalHtmlContent = mapImageHtmlForUpdate + chartHtmlForUpdate + enhancedContent;
            } else { // For user messages, content is typically already HTML or plain text
                finalHtmlContent = rawContent;
            }
            console.log('[ChatUI] updateRenderedMessage: Content parsed and sanitized.');
          } catch (e) {
            console.error('[ChatUI] updateRenderedMessage: Error processing message content:', e);
            finalHtmlContent = 'Error displaying content.'; // Fallback content
          }
          console.log("[ChatUI updateRenderedMessage] finalHtmlContent to be set for bubble content:", finalHtmlContent); // DEBUG
          // FIX 2: Update only the contentElement's innerHTML
          contentElement.innerHTML = finalHtmlContent;
          // FIX 3: Remove incorrect appendChild call
          console.log(`[ChatUI] updateRenderedMessage: Content element updated for ID ${message.id}.`);
        this.scrollToBottom(); // Keep scrolled down during streaming
        // --- ADDED: Update the footer as well ---
        const footerElement = bubble.querySelector('.message-footer');
        if (footerElement && message.metadata) { // Check if footer exists and metadata is available
          console.log(`[ChatUI] updateRenderedMessage: Re-rendering footer for ID ${message.id} with metadata:`, message.metadata);
          // --- ADDED try...catch ---
          try {
            const newFooterHTML = this._renderFooter(message); // Generate footer HTML
            console.log(`[ChatUI] updateRenderedMessage: Generated new footer HTML for ID ${message.id}:`, newFooterHTML); // Log the generated HTML
            footerElement.innerHTML = newFooterHTML; // Apply the new HTML
            console.log(`[ChatUI] updateRenderedMessage: Successfully updated footer HTML DOM for ID ${message.id}.`);
          } catch (renderError) {
            console.error(`[ChatUI] updateRenderedMessage: Error calling _renderFooter or setting innerHTML for ID ${message.id}:`, renderError);
          }
        } else {
            console.log(`[ChatUI] updateRenderedMessage: Footer element not found or no metadata for ID ${message.id}.`);
        }

        // --- ADDED: Check and append confirmation buttons on update too ---
        // This ensures buttons appear even if the HIL message comes via update (less common)
        this._appendConfirmationButtons(bubble, message);
        } else {
          console.warn(`[ChatUI] Could not find .bubble-content in message ID ${message.id} for update.`);
        }
      } else {
         // Bubble might not be rendered yet if update comes too fast, ChatCore handles the state.
         // console.warn(`[ChatUI] Could not find message bubble with ID ${message.id} for update.`);
      }
    };

    /**
     * Scrolls the chat container to the bottom.
     */
    this.scrollToBottom = () => {
      if (this.container) {
        // Simpler, direct scroll for testing
        this.container.scrollTop = this.container.scrollHeight;
        // console.log(`[ChatUI] scrollToBottom: scrollTop set to ${this.container.scrollHeight}`); // Optional debug
      }
    };

    // --- DEPRECATED: Replaced by renderSingleMessage triggered by ChatCore event ---
    /*
    this.addMessage = (message) => {
      this.messageHistory.push(message);
      this._renderMessages();
      return this.messageHistory.length - 1;
    };
    */

    // --- DEPRECATED: Replaced by renderSingleMessage/updateRenderedMessage ---
    /*
    this._renderMessages = () => {
      if (!this.container) return;
      
      // Ensure container has proper dimensions
      this.container.style.minHeight = '400px';
      this.container.style.maxHeight = 'calc(100vh - 200px)';
      this.container.style.overflowY = 'auto';
      
      this.container.innerHTML = '';
      this.messageHistory.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = `${this.config.bubbleClass} ${
          msg.role === 'user' ? this.config.userBubbleClass : 
          msg.role === 'agent' ? this.config.agentBubbleClass : 
          this.config.systemBubbleClass
        }`;
        
        // Safely render markdown content
        const content = msg.content || '';
        bubble.innerHTML = `
          <div class="message-content">${marked.parse(content)}</div>
          ${msg.role === 'agent' ? `<div class="message-footer">${this._renderFooter(msg)}</div>` : ''}
        `;
        
        this.container.appendChild(bubble);
      });
      
      // Scroll to bottom after rendering
      this.container.scrollTop = this.container.scrollHeight;
    };
    */

    // Wait for DOM to be fully ready before querying
    const checkContainer = () => {
      console.log(`[ChatUI] checkContainer: Attempting querySelector('${containerSelector}')`); // Log the attempt
      const element = document.querySelector(containerSelector);
      if (!element) {
        console.log(`[ChatUI] checkContainer: Element NOT found. Retrying...`); // Log failure
        setTimeout(checkContainer, 100); // Retry
      } else {
        this.container = element; // Assign only if found
        this._setupStyles();
        this._setupEventListeners();
        console.log('[ChatUI] Container found, setup complete.'); // Log successful setup
        // _loadMessages is deprecated. Initial messages should be added
        // via chatCore.addMessage in init-conversation.js, which will
        // trigger the 'messageAdded' event listener we set up.
        // this._loadMessages();
        this.isReady = true; // Set ready flag
        resolve(); // Resolve the promise
      }
    };
    checkContainer();
  }); // End of promise definition
  }

  _setupStyles() {
    const styleId = 'chat-ui-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Base bubble styles */
      .${this.config.bubbleClass} {
        max-width: 85%;
        padding: 16px 22px;
        margin: 12px 0;
        border-radius: 22px;
        position: relative;
        word-wrap: break-word;
        animation: fadeIn 0.3s ease;
        box-shadow: 0 4px 24px rgba(0,0,0,0.1);
        transition: all 0.2s ease;
        backdrop-filter: blur(2.5px);
      }

      /* Message footer styles */
      .message-footer {
        margin-top: 16px;
        padding-top: 12px;
         /* --- NEW Styles for Minimalist Layout --- */

      .footer-line-1 {
        /* Uses d-flex justify-content-between align-items-center */
        padding-bottom: 0.5rem; /* Space below the first line */
      }

      .feedback-actions-minimal .btn {
        padding: 0.2rem 0.5rem; /* Smaller padding */
        margin-right: 0.3rem;
        line-height: 1; /* Ensure icon vertical alignment */
        border: none; /* Remove border */
        background-color: transparent !important; /* Ensure no background */
        color: var(--bs-secondary-color); /* Use secondary text color */
      }
      .feedback-actions-minimal .btn:hover {
        color: var(--bs-body-color); /* Darken on hover */
      }

      .token-usage-minimal .badge {
        font-size: 0.8em; /* Smaller badge */
      }

      /* Tokens section */
      .tokens-usage {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .token-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: var(--bs-primary);
      }

      .token-details {
        font-weight: 600;
      }

      .token-breakdown {
        font-size: 0.8em;
        opacity: 0.8;
      }

      /* Feedback buttons */
      .feedback-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .feedback-buttons button {
        padding: 0.5rem 0.9rem;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Ensure feedback buttons look good */
      .feedback-actions .btn {
      /* .feedback-actions .btn {
        font-size: 0.8rem; /* Slightly smaller text */
        padding: 0.3rem 0.7rem; /* Adjust padding */
      }
      .feedback-actions .btn i {
      /* .feedback-actions .btn i {
         margin-right: 4px; /* Space between icon and text */
      }

       /* --- TEMPORARY DEBUG --- Force footer sections visible */
      .message-footer .footer-section,
      .message-footer .badge[title*='evidence'] {
      display: block !important;      
      min-height: 10px !important;
      opacity: 1 !important;
      visibility: visible !important;
      }


      /* Citations section */
      .citation-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: var(--bs-primary);
      }
     
      .citations-minimal .citation-list {
        display: flex; /* Allow items to wrap */
        flex-wrap: wrap;
        gap: 0.5rem; /* Space between items */
      }

      .citation-item {
        display: 8px 12px;
        border-radius: 8px;
        .citations-minimal .citation-item {     
        color: var(--bs-secondary-color); /* Use secondary text color */
        background: rgba(var(--bs-primary-rgb), 0.05);
        padding: 8px 12px;
      }

      /* Follow-up questions */
      .followup-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: var(--bs-primary);
      }

      .followup-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      
      .suggested-questions-minimal .suggested-questions-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem; /* Space between pills */
      }

      .suggested-questions-minimal .suggested-question-pill {
        border: 1px solid var(--bs-border-color); /* Use theme border */
        background-color: var(--bs-body-bg); /* Use theme background */
        color: var(--bs-body-color); /* Use theme text color */
        border-radius: 1rem; /* Pill shape */
        font-size: 0.8rem;
        padding: 0.25rem 0.75rem;
      }

      /* Self-query questions (6 questions) - Blue theme */
      .suggested-questions .followup-question {
        padding: 0.5rem 1rem;
        border-radius: 12px;
        background: rgba(var(--bs-info-rgb), 0.1);
        border: 1px solid rgba(var(--bs-info-rgb), 0.3);
        font-size: 0.85em;
        color: var(--bs-info);
        margin: 0.2rem;
        transition: all 0.2s ease;
      }

      /* Follow-up questions (3 questions) - Purple theme */
      .followups .followup-question {
        padding: 0.5rem 1rem;
        border-radius: 12px;
        background: rgba(111, 66, 193, 0.1); /* Purple shade */
        border: 1px solid rgba(111, 66, 193, 0.3);
        font-size: 0.85em;
        color: rgb(111, 66, 193);
        margin: 0.2rem;
        transition: all 0.2s ease;
      }

      

      .followup-question:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
    `;
    document.head.appendChild(style);
  }

  _renderFooter(message) {
    // Minimalist, themeable, per-message footer for agent answers (streaming supported)
    // 1st line: feedback icons (left), token usage (right), evidence icon (far right)
    // 2nd line: citations, minimal, small font, doc icon
    // 3rd line: suggested questions as pill buttons, minimal, no color

    let footerHTML = '';
    const meta = message.metadata || {};
    // Log the metadata being processed by _renderFooter
    console.log('[ChatUI] _renderFooter: Processing message ID:', message.id, 'with metadata:', JSON.parse(JSON.stringify(meta)));

    // --- Line 1: Feedback, Tokens, Evidence ---
    const usage = meta.usageMetadata || meta.usage_metadata || {};
    let line1HTML = `
      <div class="footer-line-1" style="order:1;">
        <div class="feedback-actions-minimal">
          <button class="icon-btn like-btn" title="Like" aria-label="Like response"><i class="bi bi-hand-thumbs-up"></i></button>
          <button class="icon-btn dislike-btn" title="Dislike" aria-label="Dislike response"><i class="bi bi-hand-thumbs-down"></i></button>
          <button class="icon-btn copy-btn" title="Copy" aria-label="Copy response"><i class="bi bi-clipboard"></i></button>
        </div>
        <div class="footer-right">
    `;

    if (usage && usage.model) {
      const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      line1HTML += `
        <div class="token-usage-minimal" title="model name: ${usage.model}, in: ${inputTokens}, out: ${outputTokens}, Total: ${totalTokens}">
          <span class="token-usage-verbose">
            model name: ${usage.model}, in: ${inputTokens}, out: ${outputTokens}, Total: ${totalTokens}
          </span>
        </div>
      `;
    }
    // Note: The evidence icon is now part of the inline citation link, not a separate badge in the footer.
    line1HTML += `</div></div>`; // Close footer-right and footer-line-1
    footerHTML += line1HTML;

    // --- Line 2: Citations (always on their own line, block-level) ---
    const citations = meta.citations || [];
    if (Array.isArray(citations) && citations.length > 0) {
      footerHTML += `
        <div class="citations-block" style="width:100%;display:block;order:2;">
          <div class="citations-minimal mt-1" style="width:100%;display:block;">
            <div class="citation-list" style="width:100%;display:block;">
              ${citations.map(cite => {
                const sourceText = window.escapeHtml(`${cite.source || 'Source'}${cite.page ? ` (p.${cite.page})` : ''}`);
                // Get library_id from the citation object itself for robustness
                const libraryId = cite.library_id;
                if (cite.document_id && cite.document_id !== 'N/A' && libraryId) {
                  return `<a href="#" class="citation-popover-trigger" data-doc-id="${encodeURIComponent(cite.document_id)}" data-library-id="${libraryId}" data-cite-id="${cite.id}" title="Click to view source text">[${cite.id}] ${sourceText}</a>`;
                } else {
                  // Otherwise, just display the text as a non-clickable span.
                  // The visual evidence icon for inline citations is handled separately by _enhanceCitationsWithVisualEvidence.
                  return `<span>[${cite.id}] ${sourceText}</span>`;
                }
              }).join(', ')}
            </div>
          </div>
        </div>
      `;
    }

    // --- Line 3: Suggested questions (always on their own line, block-level) ---
    const suggestedQuestions = meta.suggestedQuestions || meta.suggested_questions || [];
    if (Array.isArray(suggestedQuestions) && suggestedQuestions.length > 0) {
      // Determine source type for context
      let sourceType = 'unknown';
      if (meta.source_type) { // Explicitly provided by backend
        sourceType = meta.source_type;
      } else if (meta.chart_image_base64) { // Infer from chart presence
        sourceType = 'dataframe';
      } else if (citations.length > 0) { // Infer from citation presence
        sourceType = 'rag';
      }

      footerHTML += `
        <div class="suggested-questions-minimal mt-1" style="order:3;" data-source-type="${sourceType}">
          <div class="suggested-questions-pills">
            ${suggestedQuestions.map(q => `
              <button class="suggested-question-pill" data-question="${q}" title="Ask: ${q}" aria-label="Ask: ${q}">
                ${q}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `<div class="footer-vertical-stack" style="display:flex;flex-direction:column;width:100%;">${footerHTML}</div>`;
  }

  _enhanceCitationsWithVisualEvidence(contentHtml, citations) {
    if (!citations || citations.length === 0) {
        return contentHtml;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHtml;

    const citationRegex = /\[cite:(\d+)\]/g;
    
    const textNodes = [];
    const walk = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while(node = walk.nextNode()) {
        textNodes.push(node);
    }

    textNodes.forEach(textNode => {
        let match;
        let lastIndex = 0;
        const parent = textNode.parentNode;
        if (!parent) return;
        const fragment = document.createDocumentFragment();

        citationRegex.lastIndex = 0; 

        while ((match = citationRegex.exec(textNode.nodeValue)) !== null) {
            const citeNumber = parseInt(match[1], 10);
            const citationData = citations.find(c => c.id === citeNumber);

            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(textNode.nodeValue.substring(lastIndex, match.index)));
            }

            const librarySelect = document.getElementById('library-select');
            const libraryId = librarySelect ? librarySelect.value : null;

            if (citationData && citationData.document_id && citationData.document_id !== 'N/A' && libraryId) {
                const link = document.createElement('a');
                link.href = `/view_document/${libraryId}/${encodeURIComponent(citationData.document_id)}`;
                link.target = '_blank';
                link.className = 'inline-citation-link';
                link.textContent = match[0];

                if (citationData.bbox && citationData.bbox.length > 0) {
                    link.classList.add('has-visual-evidence');
                    const icon = document.createElement('i');
                    icon.className = 'bi bi-image visual-evidence-icon ms-1';
                    icon.setAttribute('aria-hidden', 'true');
                    icon.title = 'Show visual evidence';
                    icon.style.cursor = 'pointer';

                    icon.dataset.documentId = citationData.document_id;
                    icon.dataset.pageNo = citationData.page;
                    icon.dataset.bbox = JSON.stringify(citationData.bbox);
                    
                    // The click event for visual evidence is delegated at the container level
                    link.appendChild(icon);
                }
                fragment.appendChild(link);

            } else {
                const citeSpan = document.createElement('span');
                citeSpan.className = 'inline-citation';
                citeSpan.textContent = match[0];
                fragment.appendChild(citeSpan);
            }

            lastIndex = citationRegex.lastIndex;
        }

        if (lastIndex < textNode.nodeValue.length) {
            fragment.appendChild(document.createTextNode(textNode.nodeValue.substring(lastIndex)));
        }

        if (fragment.childNodes.length > 0) {
            parent.replaceChild(fragment, textNode);
        }
    });
    
    return tempDiv.innerHTML;
}

_showCitationPopover(targetElement, docId, libraryId) {
    // Check if a popover is already shown for this element and destroy it to toggle
    const existingPopover = bootstrap.Popover.getInstance(targetElement);
    if (existingPopover) {
        existingPopover.dispose();
        return;
    }

    // Show a temporary "Loading..." popover
    const loadingPopover = new bootstrap.Popover(targetElement, {
        title: 'Loading Source...',
        content: '<div class="d-flex justify-content-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></div>',
        html: true,
        placement: 'top',
        trigger: 'manual'
    });
    loadingPopover.show();

    // Fetch the content from the backend
    fetch(`/api/get_document_chunk?document_id=${docId}&library_id=${libraryId}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Failed to load source.') });
            }
            return response.json();
        })
        .then(data => {
            loadingPopover.dispose();

            if (data.error) {
                throw new Error(data.error);
            }

            const content = data.content ? window.escapeHtml(data.content) : 'Content not found.';
            const source = data.source ? window.escapeHtml(data.source) : 'Unknown Source';
            const popoverTitle = `Source: ${source}`;
            
            const finalPopover = new bootstrap.Popover(targetElement, {
                title: popoverTitle,
                content: `<div class="citation-popover-content" style="max-height: 480px; overflow-y: auto;"><pre style="white-space: pre-wrap; word-wrap: break-word;">${content}</pre></div>`,
                html: true,
                placement: 'top',
                trigger: 'manual',
                customClass: 'citation-popover'
            });
            finalPopover.show();

            // Hide the popover when clicking outside of it
            const hidePopover = (e) => {
                const popoverElement = document.querySelector('.popover');
                if (popoverElement && !popoverElement.contains(e.target) && targetElement && !targetElement.contains(e.target)) {
                    if (finalPopover && typeof finalPopover.dispose === 'function') {
                        finalPopover.dispose();
                    }
                    document.removeEventListener('click', hidePopover);
                }
            };
            setTimeout(() => document.addEventListener('click', hidePopover), 0);
        })
        .catch(error => {
            console.error('Error fetching citation content:', error);
            loadingPopover.dispose();
            const errorPopover = new bootstrap.Popover(targetElement, { title: 'Error', content: error.message || 'Could not load source text.', html: true, placement: 'top', trigger: 'manual', customClass: 'citation-popover' });
            errorPopover.show();
            setTimeout(() => errorPopover.dispose(), 3000);
        });
}

_showVisualEvidenceModal(documentId, pageNo, bbox) {
    console.log('[ChatUI] _showVisualEvidenceModal called with:', { documentId, pageNo, bbox });
    if (!documentId || pageNo === undefined || !bbox) {
        console.error("Missing data for visual evidence:", { documentId, pageNo, bbox });
        alert("Could not load visual evidence: missing data.");
        return;
    }

    console.log('[ChatUI] Constructing API URL for visual evidence.');
    const bboxParams = `bbox_x=${bbox[0]}&bbox_y=${bbox[1]}&bbox_width=${bbox[2]}&bbox_height=${bbox[3]}`;
    const apiUrl = `/api/visual_evidence?document_id=${documentId}&page_no=${pageNo}&${bboxParams}`;
    console.log('[ChatUI] Visual evidence API URL:', apiUrl);
    
    // Get or create modal elements (ensure IDs match your HTML or create dynamically)
    let modalElement = document.getElementById('visualEvidenceModal');
    if (!modalElement) {
        modalElement = document.createElement('div');
        modalElement.innerHTML = `
            <div class="modal fade" id="visualEvidenceModal" tabindex="-1" aria-labelledby="visualEvidenceModalLabel" aria-hidden="true">
              <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title" id="visualEvidenceModalLabel">Visual Evidence (Page ${pageNo})</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body text-center">
                    <img id="visualEvidenceImage" src="" alt="Loading visual evidence..." style="max-width: 100%; max-height: 80vh; border: 1px solid #dee2e6;">
                    <div id="visualEvidenceLoading" class="spinner-border text-primary" role="status" style="display: none;"><span class="visually-hidden">Loading...</span></div>
                  </div>
                </div>
              </div>
            </div>
        `;
        document.body.appendChild(modalElement.firstElementChild); // Append the actual modal div
        modalElement = document.getElementById('visualEvidenceModal'); // Re-fetch it
        console.log('[ChatUI] Dynamically created and fetched visualEvidenceModal element:', modalElement);
    } else {
        console.log('[ChatUI] Found existing visualEvidenceModal element:', modalElement);
    }

    const modalImage = modalElement.querySelector('#visualEvidenceImage');
    const modalLoading = modalElement.querySelector('#visualEvidenceLoading');
    const modalTitle = modalElement.querySelector('#visualEvidenceModalLabel');

    if (modalTitle) modalTitle.textContent = `Visual Evidence (Page ${pageNo})`;
    else console.warn('[ChatUI] Modal title element not found.');

    if (modalImage) modalImage.src = ''; // Clear previous
    else console.warn('[ChatUI] Modal image element not found.');

    if (modalImage) modalImage.style.display = 'none';
    if (modalLoading) modalLoading.style.display = 'block';
    else console.warn('[ChatUI] Modal loading spinner element not found.');

    console.log('[ChatUI] Attempting to get/create Bootstrap modal instance.');
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    if (bsModal) {
        console.log('[ChatUI] Bootstrap modal instance obtained. Showing modal.');
        bsModal.show();
    } else {
        console.error('[ChatUI] Failed to get or create Bootstrap modal instance. Is Bootstrap JS loaded?');
        return;
    }

    console.log('[ChatUI] Fetching visual evidence from:', apiUrl);
    fetch(apiUrl)
        .then(response => {
            console.log('[ChatUI] Received response from /api/visual_evidence:', response);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status} fetching visual evidence.`);
            }
            return response.blob();
        })
        .then(blob => {
            console.log('[ChatUI] Received blob for visual evidence. Creating object URL.');
            const imageUrl = URL.createObjectURL(blob);
            if (modalImage) {
                modalImage.src = imageUrl;
                modalImage.style.display = 'block';
                modalImage.onload = () => URL.revokeObjectURL(imageUrl); // Revoke after load
            }
            if (modalLoading) modalLoading.style.display = 'none';
        })
        .catch(error => {
            console.error('[ChatUI] Error fetching/displaying visual evidence:', error);
            if (modalImage) modalImage.alt = 'Error loading visual evidence.';
            if (modalLoading) modalLoading.style.display = 'none';
            // You might want to display an error message in the modal body
        });
}

  async _copyChartToClipboard(base64ImageSrc) {
    if (!navigator.clipboard || !navigator.clipboard.write) {
      alert('Copying images to clipboard is not supported by your browser or requires a secure context (HTTPS). Try downloading instead.');
      // Optionally trigger a download here as a fallback
      return;
    }

    try {
      // Convert base64 src to Blob
      const response = await fetch(base64ImageSrc);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      // Simple visual feedback - you can use a more sophisticated toast/notification
      const tempMsg = document.createElement('div');
      tempMsg.textContent = 'Chart copied to clipboard!';
      tempMsg.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background-color:var(--bs-success); color:white; padding:10px 20px; border-radius:5px; z-index:1000;';
      document.body.appendChild(tempMsg);
      setTimeout(() => tempMsg.remove(), 2000);

    } catch (error) {
      console.error('Failed to copy chart to clipboard:', error);
      alert('Failed to copy chart. See console for details. Error: ' + error.message);
    }
  }

  // ... rest of the ChatUI class methods remain unchanged ...
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatUI;
} else {
  window.ChatUI = ChatUI;
}
