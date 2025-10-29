(function() { // Using an IIFE to keep scope clean
  //const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'); // Use optional chaining

  // --- File Upload Elements ---
  const librarySelectFile = document.getElementById('librarySelectFile');
  const fileUploadForm = document.getElementById('fileUploadForm'); // Use form ID
  const fileSubmitBtn = document.getElementById('uploadFileBtn'); // Use button ID
  const libraryNameFile = document.getElementById('libraryNameFile');
  const fileStatus = document.getElementById('file-status');
  const fileInput = document.getElementById('fileInput');

  // --- URL Download Elements (Multi-URL) ---
  const urlTextarea = document.getElementById('url-textarea'); // Changed from urlInput
  const librarySelectUrl = document.getElementById('librarySelectUrl');
  const addUrlsBtn = document.getElementById('add-urls-btn'); // Changed from validateUrlBtn
  const urlListDisplay = document.getElementById('url-list-display'); // New element
  const processUrlsBtn = document.getElementById('process-urls-btn'); // Changed from processUrlBtn
  const urlStatus = document.getElementById('url-status');

  // --- Batch Upload Elements ---
  const librarySelectBatch = document.getElementById('librarySelectBatch');
  const batchUploadForm = document.getElementById('batchUploadForm');
  const batchFileInput = document.getElementById('batchFileInput');
  const uploadBatchBtn = document.getElementById('uploadBatchBtn');
  const batchFileList = document.getElementById('batch-file-list');
  const batchStatus = document.getElementById('batch-status');
  const batchProgressBar = document.getElementById('batch-progress-bar'); // Added progress bar element

  // --- Vector Store Mode ---
  const vectorModeSource = document.querySelector('.upload-page-container');
  const vectorStoreMode = vectorModeSource?.dataset?.vectorStoreMode || 'user';
  const knowledgeRequired = vectorStoreMode === 'knowledge';
  console.log('[Upload Debug] vectorStoreMode:', vectorStoreMode, 'knowledgeRequired:', knowledgeRequired);

  // --- Modal Progress Text Element ---
  const modalProgressText = document.getElementById('modalProgressText');


  // --- State Variables ---
  let isFileUploading = false; // Flag to prevent double submission for files
  let isUrlProcessing = false; // Flag to prevent double submission for URLs (now for multiple)
  let isBatchUploading = false; // Flag for batch uploads
  let urlsToProcess = []; // Array to hold URLs to be processed
  let batchFilesArray = []; // Array to hold File objects for batch upload

  // --- Tooltip Initialization ---
  const bootstrapAvailable = typeof window.bootstrap !== 'undefined';
  // Initialize all tooltips on the page if Bootstrap JS is present
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  console.log('[Upload Page] bootstrapAvailable =', bootstrapAvailable);
  const tooltipList = bootstrapAvailable
      ? tooltipTriggerList.map(function (tooltipTriggerEl) {
          return new window.bootstrap.Tooltip(tooltipTriggerEl);
        })
      : [];
  if (!bootstrapAvailable && tooltipTriggerList.length > 0) {
      console.warn('[Upload Page] Bootstrap JS not detected; skipping tooltip initialization.');
  }

  // --- Toast Helper Function ---
  function showToast(message, type = 'info') {
      const toastContainer = document.querySelector('.toast-container');
      if (!toastContainer) {
          console.error('Toast container not found!');
          return;
      }

      const toastId = `toast-${Date.now()}`; // Unique ID for each toast
      const toastClass = {
          info: 'toast-info-translucent',
          success: 'toast-success-translucent',
          warning: 'toast-warning-translucent',
          danger: 'toast-danger-translucent'
      }[type] || '';

      const toastHTML = `
          <div id="${toastId}" class="toast align-items-center custom-toast ${toastClass} border-0" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="5000">
              <div class="d-flex">
                  <div class="toast-body">
                      ${message}
                  </div>
                  <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
              </div>
          </div>
      `;

      toastContainer.insertAdjacentHTML('beforeend', toastHTML);
      const toastElement = document.getElementById(toastId);
      if (!toastElement) {
          console.error('Toast element not found after insertion!');
          return;
      }

      if (!bootstrapAvailable || !window.bootstrap?.Toast) {
          console.warn('[Upload Page] Bootstrap Toast not available; toast message:', message);
          return;
      }

      const existingInstance = window.bootstrap.Toast.getInstance(toastElement);
      if (existingInstance) {
          existingInstance.dispose();
      }

      const toast = new window.bootstrap.Toast(toastElement);
      toastElement.addEventListener('hidden.bs.toast', function () {
          toastElement.remove();
      });

      toast.show();
  }

  // --- Helper Function to Format File Size ---
  function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // --- Library Details Display Logic ---
  function updateLibraryDetails(selectElement, detailsDivId, popoverButtonId) {
      const detailsDiv = detailsDivId ? document.getElementById(detailsDivId) : null;
      const popoverButton = popoverButtonId ? document.getElementById(popoverButtonId) : null;
      const resetPopover = () => {
          if (popoverButton) {
              const existingPopover = window.bootstrap?.Popover?.getInstance(popoverButton);
              if (existingPopover) {
                  existingPopover.dispose();
              }
              popoverButton.classList.add('d-none');
              popoverButton.removeAttribute('data-bs-content');
          }
      };

      if (detailsDiv) {
          detailsDiv.innerHTML = '';
      }

      if (!selectElement || selectElement.selectedIndex < 0) {
          resetPopover();
          return;
      }

      const selectedOption = selectElement.options[selectElement.selectedIndex];
      const knowledgeName = selectedOption?.dataset?.knowledgeName || '';
      const catalogNames = selectedOption?.dataset?.catalogs || '';
      const categoryNames = selectedOption?.dataset?.categories || '';
      const groupNames = selectedOption?.dataset?.groupNames || '';

      const summaryParts = [];
      if (knowledgeName) {
          summaryParts.push(`<strong>Knowledge:</strong> ${knowledgeName}`);
      }
      if (catalogNames) {
          summaryParts.push(`<strong>Catalogs:</strong> ${catalogNames}`);
      }
      if (categoryNames) {
          summaryParts.push(`<strong>Categories:</strong> ${categoryNames}`);
      }
      if (groupNames) {
          summaryParts.push(`<strong>Groups:</strong> ${groupNames}`);
      }
      if (knowledgeRequired && summaryParts.length > 0) {
          summaryParts.push('<span class="text-muted small d-block mt-2">Metadata follows the knowledge configuration.</span>');
      }

      const summaryHtml = summaryParts.length
          ? summaryParts.join('<br>')
          : '<em>No metadata assigned.</em>';

      if (detailsDiv) {
          detailsDiv.innerHTML = summaryHtml;
      }

      if (popoverButton) {
          const existingPopover = window.bootstrap?.Popover?.getInstance(popoverButton);
          if (summaryParts.length > 0) {
              if (existingPopover) {
                  existingPopover.dispose();
              }
              popoverButton.setAttribute('data-bs-content', summaryHtml);
              popoverButton.classList.remove('d-none');
              if (window.bootstrap?.Popover) {
                  new window.bootstrap.Popover(popoverButton);
              }
          } else {
              resetPopover();
          }
      }
  }

  // --- File Upload Logic ---
  if (librarySelectFile && fileSubmitBtn && libraryNameFile) {
      // Disable file submit button initially
      fileSubmitBtn.disabled = true;

      // Enable file submit button only when a library is selected AND update hidden name input
      librarySelectFile.addEventListener('change', function() {
        fileSubmitBtn.disabled = !this.value; // Enable if value is not empty
        const selectedOption = this.options[this.selectedIndex];
        libraryNameFile.value = selectedOption ? selectedOption.text : '';
      });
  }

  // File Upload Listener
  if (fileUploadForm && fileSubmitBtn && fileStatus && fileInput) {
      // Check if listener already attached
      if (!fileUploadForm.dataset.listenerAttached) {
          fileUploadForm.dataset.listenerAttached = 'true'; // Set flag
          fileUploadForm.addEventListener('submit', function(event) {
              event.preventDefault(); // Prevent default form submission
              const submitButton = fileSubmitBtn; // Get button reference earlier
          submitButton.disabled = true; // Disable button immediately

          if (isFileUploading) {
              // console.log("Upload already in progress. Preventing new submission."); // Debug log removed
              return; // Don't submit again if already uploading
          }

          const formData = new FormData(fileUploadForm);
          // const submitButton = fileSubmitBtn; // Moved up
          const originalButtonText = "Upload File to Library";

          // Show loading state and set flag
          isFileUploading = true;
          // submitButton.disabled = true; // Already disabled above
          submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading & Processing...';
          fileStatus.innerHTML = '<div class="alert alert-info" role="alert">File uploaded. Processing content (this may take a while for large files)...</div>';

        //   const headers = {};
        //   if (csrfToken) {
        //        headers['X-CSRFToken'] = csrfToken;
        //   }

            const headers = {
                // FormData sets Content-Type automatically, don't set it here.
                'X-CSRFToken': window.readCurrentCsrfToken()
            };

          // Use absolute path for fetch URL as it's now in a separate file
          //fetch('/upload', {
            window.fetchWithCsrfRetry('/upload', { // Use fetchWithCsrfRetry
              method: 'POST',
              body: formData,
              headers: headers
          })
          .then(response => {
              if (!response.ok) {
                  return response.json().catch(() => null).then(errData => {
                      throw new Error(errData?.message || response.statusText || 'Upload failed');
                  });
              }
              return response.json();
          })
          .then(data => {
              if (data.success) {
                  let message = `<div class="alert alert-success">${data.message}`;
                  if (data.warning) {
                      message += ` <span class="text-warning">(${data.warning})</span>`;
                  }
                  message += `</div>`;
                  fileStatus.innerHTML = message;
                  fileInput.value = '';
                  librarySelectFile.value = '';
                  libraryNameFile.value = '';
                  submitButton.disabled = true;
              } else {
                  fileStatus.innerHTML = `<div class="alert alert-danger">${data.message || 'An unknown error occurred.'}</div>`;
              }
          })
          .catch(error => {
              console.error('Error uploading file:', error);
              fileStatus.innerHTML = `<div class="alert alert-danger">An error occurred during upload: ${error.message}</div>`;
          })
          .finally(() => {
              isFileUploading = false;
              submitButton.disabled = !librarySelectFile.value;
              submitButton.textContent = originalButtonText;
          });
        });
      } // End listener attachment check
  }

  // --- URL Download Logic (Multi-URL) ---
  if (urlTextarea && librarySelectUrl && addUrlsBtn && urlListDisplay && processUrlsBtn && urlStatus) {

      // Basic URL validation (reusable)
      function isValidUrl(url) {
          if (!url || typeof url !== 'string') return false;
          try {
              const parsedUrl = new URL(url.trim()); // Trim whitespace before parsing
              return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
          } catch (e) {
              return false;
          }
      }

      // Function to render the list of URLs to be processed
      function renderUrlList() {
          urlListDisplay.innerHTML = ''; // Clear previous list
          if (urlsToProcess.length > 0) {
              const list = document.createElement('ul');
              list.className = 'list-unstyled mb-0';
              urlsToProcess.forEach((url, index) => {
                  const item = document.createElement('li');
                  item.className = 'd-flex justify-content-between align-items-center mb-1';

                  const urlSpan = document.createElement('span');
                  urlSpan.textContent = url;
                  urlSpan.className = 'me-2 text-truncate'; // Allow truncation
                  // Add tooltip to list item to show full URL on hover
                  urlSpan.setAttribute('data-bs-toggle', 'tooltip');
                  urlSpan.setAttribute('data-bs-placement', 'top');
                  urlSpan.setAttribute('title', url);
                  if (bootstrapAvailable && window.bootstrap?.Tooltip) {
                      new window.bootstrap.Tooltip(urlSpan);
                  }
                  item.appendChild(urlSpan);

                  const removeBtn = document.createElement('button');
                  removeBtn.type = 'button';
                  // Use the new consistent style class
                  removeBtn.className = 'btn remove-list-item-btn flex-shrink-0'; // Removed btn-sm, btn-outline-danger
                  removeBtn.setAttribute('data-index', index); // Use index for removal
                  removeBtn.setAttribute('aria-label', `Remove ${url}`);
                  removeBtn.innerHTML = '<i class="bi bi-x-circle"></i>';
                  item.appendChild(removeBtn);

                  list.appendChild(item);
              });
              urlListDisplay.appendChild(list);
          } else {
              urlListDisplay.innerHTML = '<p class="text-muted small mb-0">No URLs added yet.</p>';
          }
          checkUrlFormState(); // Update button states
      }

      // Function to check button states for the URL tab
      function checkUrlFormState(triggerSource = 'unknown') {
          const librarySelected = !!librarySelectUrl.value;
          const selectedOption = librarySelectUrl.selectedIndex >= 0
              ? librarySelectUrl.options[librarySelectUrl.selectedIndex]
              : null;
          const knowledgeHiddenField = document.getElementById('knowledgeIdUrl');
          const knowledgeId = knowledgeHiddenField?.value || selectedOption?.dataset?.knowledgeId || '';
          const urlsInList = urlsToProcess.length > 0;
          const textInArea = urlTextarea.value.trim().length > 0;
          const libraryReady = librarySelected && (!knowledgeRequired || knowledgeId);

          addUrlsBtn.disabled = !(libraryReady && textInArea);
          processUrlsBtn.disabled = !(libraryReady && urlsInList);

          console.log('[Upload Debug][URL] State update', {
              triggerSource,
              librarySelected,
              knowledgeId,
              knowledgeRequired,
              textLength: urlTextarea.value.trim().length,
              urlsInList,
              addUrlsDisabled: addUrlsBtn.disabled,
              processDisabled: processUrlsBtn.disabled,
          });
      }

      // Initial state check
      renderUrlList(); // Show "No URLs added yet" initially
      checkUrlFormState('initial');

      // Event listeners
      librarySelectUrl.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const knowledgeField = document.getElementById('knowledgeIdUrl');
        if (knowledgeField) {
            knowledgeField.value = selectedOption?.dataset?.knowledgeId || '';
        }
          updateLibraryDetails(this, null, 'libraryMetadataInfoUrl');

        checkUrlFormState('library-change');
      });
      urlTextarea.addEventListener('input', () => checkUrlFormState('url-text-input'));

      // Add URLs from textarea to the list after backend validation
      addUrlsBtn.addEventListener('click', async function() { // Make async
          const urlsRaw = urlTextarea.value.trim();
          if (!urlsRaw) return;

          addUrlsBtn.disabled = true; // Disable button during validation
          addUrlsBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validating URLs...';
          // urlStatus.innerHTML = '<div class="alert alert-info" role="alert">Validating URLs...</div>'; // Replaced with toast below if needed, or just rely on button text

          const potentialUrls = urlsRaw.split(/[\n,]+/)
                                     .map(url => url.trim())
                                     .filter(url => url);

          const formatValidUrls = potentialUrls.filter(url => isValidUrl(url));

          const validationPromises = formatValidUrls.map(url => {
              const headers = {
                  'Content-Type': 'application/json',
                  'X-CSRFToken': window.readCurrentCsrfToken() // Ensure CSRF token is added
              };
              // Wrap with fetchWithCsrfRetry
              return window.fetchWithCsrfRetry('/validate_url', {
                  method: 'POST',
                  headers: headers,
                  body: JSON.stringify({ url: url })
              })
              .then(response => response.json())
              .then(data => ({ url: url, valid: data.valid, message: data.message }))
              .catch(error => ({ url: url, valid: false, message: `Fetch error: ${error.message}` }));
          });

          const formatInvalidCount = potentialUrls.length - formatValidUrls.length;
          const results = await Promise.allSettled(validationPromises);

          let backendValidatedCount = 0;
          let backendFailedCount = 0;
          const newlyValidatedUrls = [];

          results.forEach(result => {
                if (result.status === 'fulfilled' && result.value && result.value.valid) {
                  // Add only if valid AND not already in the main list
                  if (!urlsToProcess.includes(result.value.url)) {
                      newlyValidatedUrls.push(result.value.url);
                      //backendValidatedCount++;
                      if (result.value.url) backendValidatedCount++; // Ensure URL exists
                  }
              } else {
                  backendFailedCount++;
                  // Optionally log failed validation reason:
                  // console.warn(`Validation failed for ${result.value?.url || 'unknown URL'}: ${result.value?.message || result.reason}`);
              }
          });

          // Add the newly validated URLs to the main list
          urlsToProcess.push(...newlyValidatedUrls);

          // Update UI
          if (backendValidatedCount > 0) {
              urlTextarea.value = ''; // Clear textarea only if URLs were added
              renderUrlList(); // Update the displayed list
          }

          // Construct status message
          let statusMsg = '';
          if (backendValidatedCount > 0) {
              statusMsg += `Added ${backendValidatedCount} valid & accessible URL(s) to the list. `;
           } else if (potentialUrls.length > 0) { // Only say "no new" if some were attempted
              statusMsg += `No new valid & accessible URLs added. `;
          }
          //const totalFailed = formatInvalidCount + backendFailedCount;
          // Ensure result.value exists before accessing properties
          const actualBackendFailedCount = results.filter(r => r.status === 'fulfilled' && r.value && !r.value.valid).length;
          const totalFailed = formatInvalidCount + actualBackendFailedCount;
          if (totalFailed > 0) {
              statusMsg += `Skipped ${totalFailed} invalid or inaccessible entries.`;
          }

          // Use toast for feedback instead of urlStatus div
          const toastType = backendValidatedCount > 0 ? 'info' : 'warning';
          console.log(`[DEBUG] Calling showToast. Type: ${toastType}, Message: "${statusMsg}"`); // Add log
          //showToast(statusMsg, toastType);
          if (statusMsg.trim()) { // Only show toast if there's a message
            showToast(statusMsg, toastType);
          }
          // urlStatus.innerHTML = ''; // Clear any old status messages if desired

          addUrlsBtn.innerHTML = 'Add URLs to List'; // Restore button text
          checkUrlFormState(); // Re-check button states (including enabling addUrlsBtn if textarea still has content)
      });


      // Event delegation for remove buttons in the URL list
      urlListDisplay.addEventListener('click', function(event) {
          // Use the new consistent class selector
          const removeButton = event.target.closest('.remove-list-item-btn'); 
          if (removeButton) {
              const indexToRemove = parseInt(removeButton.getAttribute('data-index'), 10);
              if (!isNaN(indexToRemove) && indexToRemove >= 0 && indexToRemove < urlsToProcess.length) {
                  urlsToProcess.splice(indexToRemove, 1); // Remove from our array
                  renderUrlList(); // Re-render the list display
              }
          }
      });

      // Process URLs Button Listener
      if (!processUrlsBtn.dataset.listenerAttached) {
          processUrlsBtn.dataset.listenerAttached = 'true';
          processUrlsBtn.addEventListener('click', async function() { // Make async for await
              processUrlsBtn.disabled = true; // Disable button immediately

              if (isUrlProcessing) {
                  console.log("URL processing already in progress.");
                  return;
              }

              const selectedLibraryOption = librarySelectUrl.options[librarySelectUrl.selectedIndex];
              const selectedLibraryId = selectedLibraryOption.value;
              const selectedLibraryName = selectedLibraryOption ? selectedLibraryOption.text : '';

              if (!selectedLibraryId) {
                  urlStatus.innerHTML = '<div class="alert alert-warning">Please select a library first.</div>';
                  processUrlsBtn.disabled = false; // Re-enable
                  return;
              }
              const knowledgeIdUrlField = document.getElementById('knowledgeIdUrl');
              const knowledgeIdValue = knowledgeIdUrlField ? knowledgeIdUrlField.value : (selectedLibraryOption?.dataset?.knowledgeId || '');
              if (knowledgeRequired && !knowledgeIdValue) {
                  urlStatus.innerHTML = '<div class="alert alert-warning">Please select a knowledge base for this library before processing URLs.</div>';
                  processUrlsBtn.disabled = false;
                  return;
              }
              if (urlsToProcess.length === 0) {
                  urlStatus.innerHTML = '<div class="alert alert-warning">No URLs in the list to process.</div>';
                  processUrlsBtn.disabled = false; // Re-enable
                  return;
              }

              isUrlProcessing = true;
              processUrlsBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing ${urlsToProcess.length} URLs...`;
              urlStatus.innerHTML = ''; // Clear previous status
              const urlProgressBar = document.getElementById('url-progress-bar'); // Get URL progress bar
              const progressBarInnerUrl = urlProgressBar ? urlProgressBar.querySelector('.progress-bar') : null;
              console.log('[URL Upload] urlProgressBar found:', !!urlProgressBar, 'progressBarInnerUrl found:', !!progressBarInnerUrl);
              // --- Initialize Progress Bar ---
              if (urlProgressBar && progressBarInnerUrl) {
                  urlProgressBar.style.display = 'block'; // Show progress bar
                  progressBarInnerUrl.style.width = '0%';
                  progressBarInnerUrl.setAttribute('aria-valuenow', '0');
                  progressBarInnerUrl.textContent = 'Starting...';
                  console.log('[URL Upload] Progress bar initialized and shown.');
                  progressBarInnerUrl.classList.remove('bg-success', 'bg-warning', 'bg-danger'); // Ensure default color
              }
              // --- End Initialize ---


              let successCount = 0;
              let errorCount = 0;
              const statusMessages = []; // Store individual messages

              // Process URLs one by one (could be parallelized with Promise.all if backend supports it well)
              for (let i = 0; i < urlsToProcess.length; i++) {
                  const url = urlsToProcess[i];

                  // --- Update Progress Bar ---
                  const percent = Math.round(((i + 1) / urlsToProcess.length) * 100);
                  if (progressBarInnerUrl) {
                      console.log(`[URL Upload] Updating progress for URL ${i+1}: ${percent}% - ${url}`);
                      progressBarInnerUrl.style.width = percent + '%';
                      progressBarInnerUrl.setAttribute('aria-valuenow', percent);
                      progressBarInnerUrl.textContent = `Processing ${i + 1} of ${urlsToProcess.length}: ${url}`;

                  }
                  // --- End Progress Update ---

                //   const headers = {'Content-Type': 'application/json'};
                //   if (csrfToken) {
                //       headers['X-CSRFToken'] = csrfToken;
                //   }

                  try {
                      // Get knowledge_id from hidden input
                      const knowledgeIdUrl = document.getElementById('knowledgeIdUrl');
                      const knowledgeId = knowledgeIdUrl ? knowledgeIdUrl.value : '';
                      const headers = {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': window.readCurrentCsrfToken()
                    }; 
                    
                    // Wrap with fetchWithCsrfRetry
                    const response = await window.fetchWithCsrfRetry('/process_url', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            url: url,
                            library_id: selectedLibraryId,
                            library_name: selectedLibraryName,
                            knowledge_id: knowledgeId
                        })
                    });
                      const data = await response.json();

                      if (response.ok && data.success) {
                          successCount++;
                          const messageText = data.message || data.warning || '';
                          const successHTML = `<p class="small text-body-secondary mb-1">Success: ${url} ${messageText}</p>`;
                          urlStatus.insertAdjacentHTML('beforeend', successHTML);
                      } else {
                          errorCount++;
                          // Append error message
                          const errorHTML = `<p class="small text-danger mb-1">Error: ${url} - ${data.message || 'Unknown error'}</p>`;
                          urlStatus.insertAdjacentHTML('beforeend', errorHTML);
                      }
                  } catch (error) {
                      errorCount++;
                      console.error(`Error processing URL ${url}:`, error);
                      // Append fetch error message
                      const fetchErrorHTML = `<p class="small text-danger mb-1">Error: ${url} - ${error.message}</p>`;
                      urlStatus.insertAdjacentHTML('beforeend', fetchErrorHTML);
                  }
                  // Scroll status div
                  urlStatus.scrollTop = urlStatus.scrollHeight;
              }

              // Final status update - Append summary
              if (progressBarInnerUrl) { // Update progress bar on completion
                  progressBarInnerUrl.style.width = '100%';
                  console.log('[URL Upload] Progress bar complete.');
                  progressBarInnerUrl.textContent = 'Complete';
                  progressBarInnerUrl.classList.add(errorCount > 0 ? 'bg-warning' : 'bg-success');
              }
              // Append final summary
              const summaryHTML = `<p class="small text-body-secondary mt-2"><strong>Processing complete. Success: ${successCount}, Errors: ${errorCount}.</strong></p>`;
              urlStatus.insertAdjacentHTML('beforeend', summaryHTML);
              urlStatus.scrollTop = urlStatus.scrollHeight; // Scroll to bottom

              // Hide progress bar after a short delay
              if (urlProgressBar) {
                  setTimeout(() => {
                      console.log('[URL Upload] Hiding progress bar.');
                      urlProgressBar.style.display = 'none';
                  }, 2000);
              }

              isUrlProcessing = false;
              processUrlsBtn.innerHTML = 'Download & Process URLs';
              urlsToProcess = []; // Clear the list after processing
              renderUrlList(); // Update display to show empty list
              checkUrlFormState(); // Disable buttons
          });
      } // End listener attachment check
  } // End URL Download Logic block


  // --- Batch Upload Logic ---
  if (librarySelectBatch && uploadBatchBtn && batchFileInput && batchFileList && batchStatus) {
      // Disable batch submit button initially
      uploadBatchBtn.disabled = true;

      // Enable batch submit button only when a library AND files are selected
      function checkBatchFormState(triggerSource = 'unknown') {
          const filesSelected = batchFilesArray.length > 0; // Check our array
          const librarySelected = !!librarySelectBatch.value;
          const selectedOption = librarySelectBatch.selectedIndex >= 0
              ? librarySelectBatch.options[librarySelectBatch.selectedIndex]
              : null;
          const knowledgeHiddenField = document.getElementById('knowledgeIdBatch');
          const knowledgeId = knowledgeHiddenField?.value || selectedOption?.dataset?.knowledgeId || '';
          const libraryReady = librarySelected && (!knowledgeRequired || knowledgeId);
          uploadBatchBtn.disabled = !(filesSelected && libraryReady);

          console.log('[Upload Debug][Batch] State update', {
              triggerSource,
              librarySelected,
              filesSelected,
              knowledgeId,
              knowledgeRequired,
              uploadDisabled: uploadBatchBtn.disabled,
              batchFilesArrayLength: batchFilesArray.length,
          });
      }

      // Function to render the list of selected batch files with remove buttons
      function renderBatchFileList() {
          batchFileList.innerHTML = ''; // Clear previous list
          if (batchFilesArray.length > 0) {
              const list = document.createElement('ul');
              list.className = 'list-unstyled mb-0';
              batchFilesArray.forEach((file, index) => {
                  const item = document.createElement('li');
                  item.className = 'd-flex justify-content-between align-items-center mb-1'; // Use flex for layout

                  const fileInfoSpan = document.createElement('span'); // Container for name and size
                  fileInfoSpan.className = 'me-2 text-truncate'; // Allow truncation
                  // Display filename and formatted size
                  fileInfoSpan.textContent = `${file.name} (${formatFileSize(file.size)})`;
                  item.appendChild(fileInfoSpan);


                  const removeBtn = document.createElement('button');
                  removeBtn.type = 'button';
                  // Use the new consistent style class
                  removeBtn.className = 'btn remove-list-item-btn flex-shrink-0'; // Removed btn-sm, btn-outline-danger
                  removeBtn.setAttribute('data-index', index); // Use index for removal
                  removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
                  removeBtn.innerHTML = '<i class="bi bi-x-circle"></i>'; // Use Bootstrap Icon
                  item.appendChild(removeBtn);

                  list.appendChild(item);
              });
              batchFileList.appendChild(list);
          }
          checkBatchFormState('render-list'); // Update button state after rendering
      }

      // Update the FileList on the input element based on batchFilesArray
      function updateFileInputFiles() {
          const dataTransfer = new DataTransfer();
          batchFilesArray.forEach(file => dataTransfer.items.add(file));
          batchFileInput.files = dataTransfer.files;
      }


      librarySelectBatch.addEventListener('change', () => {
          updateLibraryDetails(librarySelectBatch, null, 'libraryMetadataInfoBatch');
          checkBatchFormState('library-change');
      });

      batchFileInput.addEventListener('change', function() {
          // Populate our array from the input's FileList
          batchFilesArray = Array.from(batchFileInput.files);
          renderBatchFileList(); // Render the list with remove buttons
          checkBatchFormState('file-input-change');
      });

      // Event delegation for remove buttons
      batchFileList.addEventListener('click', function(event) {
          // Use the new consistent class selector
          const removeButton = event.target.closest('.remove-list-item-btn'); 
          if (removeButton) {
              const indexToRemove = parseInt(removeButton.getAttribute('data-index'), 10);
              if (!isNaN(indexToRemove) && indexToRemove >= 0 && indexToRemove < batchFilesArray.length) {
                  batchFilesArray.splice(indexToRemove, 1); // Remove from our array
                  updateFileInputFiles(); // Update the actual input's FileList
                  renderBatchFileList(); // Re-render the list display
              }
          }
      });


      // Batch Upload Listener
      if (!batchUploadForm.dataset.listenerAttached) { // Prevent duplicate listener
          batchUploadForm.dataset.listenerAttached = 'true';
          batchUploadForm.addEventListener('submit', async function(event) {
              event.preventDefault();
              // Debug: log the knowledge_id value at submit time
              const knowledgeIdBatch = document.getElementById('knowledgeIdBatch');
              console.log('[Upload Debug] Submitting batch upload. knowledge_id:', knowledgeIdBatch ? knowledgeIdBatch.value : '(not found)');
              uploadBatchBtn.disabled = true; // Disable button immediately

              if (isBatchUploading) {
                  console.log("Batch upload already in progress.");
                  return;
              }

              // Use our managed array which reflects removals
              const filesToUpload = batchFilesArray; // Use the array we've managed
              const selectedLibraryOption = librarySelectBatch.options[librarySelectBatch.selectedIndex];
              const libraryId = selectedLibraryOption.value;
              const libraryName = selectedLibraryOption ? selectedLibraryOption.text : 'Unknown Library'; // Get library name

              if (filesToUpload.length === 0) { // Check our array
                  batchStatus.innerHTML = '<div class="alert alert-warning">No files selected for batch upload.</div>';
                  // Button state is handled by checkBatchFormState, no need to re-enable here
                  return;
              }
              if (!libraryId) {
                  batchStatus.innerHTML = '<div class="alert alert-warning">Please select a library for the batch.</div>';
                  uploadBatchBtn.disabled = false; // Re-enable button
                  return;
              }
              const knowledgeIdValue = knowledgeIdBatch ? knowledgeIdBatch.value : (selectedLibraryOption?.dataset?.knowledgeId || '');
              if (knowledgeRequired && !knowledgeIdValue) {
                  batchStatus.innerHTML = '<div class="alert alert-warning">Please select a knowledge base for this library before uploading.</div>';
                  uploadBatchBtn.disabled = false;
                  return;
              }

              isBatchUploading = true;
              uploadBatchBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading ${filesToUpload.length} files...`; // Use array length
              batchStatus.innerHTML = ''; // Clear previous status
              batchProgressBar.style.display = 'block'; // Show progress bar
              console.log('[Batch Upload] batchProgressBar found:', !!batchProgressBar);
              // --- Initialize Progress Bar ---
              const progressBarInnerBatch = batchProgressBar.querySelector('.progress-bar');
              if (progressBarInnerBatch) {
                  progressBarInnerBatch.style.width = '0%';
                  progressBarInnerBatch.setAttribute('aria-valuenow', '0');
                  progressBarInnerBatch.textContent = 'Starting...';
                  console.log('[Batch Upload] Progress bar initialized and shown.');
                  progressBarInnerBatch.classList.remove('bg-success', 'bg-warning', 'bg-danger'); // Ensure default color
              }
              // --- End Initialize ---

              const uploadPromises = [];
              let successCount = 0;
              let errorCount = 0;

              // Get reference to the checkbox BEFORE the loop
              const groundingCheckbox = document.getElementById('enableVisualGroundingBatch');

              // Iterate over our managed array
              for (let i = 0; i < filesToUpload.length; i++) {
                  const file = filesToUpload[i]; // Get file from our array

                  // --- Update Progress Bar ---
                  const percent = Math.round(((i + 1) / filesToUpload.length) * 100);
                  if (progressBarInnerBatch) {
                      console.log(`[Batch Upload] Updating progress for File ${i+1}: ${percent}% - ${file.name}`);
                      progressBarInnerBatch.style.width = percent + '%';
                      progressBarInnerBatch.setAttribute('aria-valuenow', percent);
                      progressBarInnerBatch.textContent = `Processing ${i + 1} of ${filesToUpload.length}: ${file.name}`;
                  }
                  // --- End Progress Update ---

                  // --- Create FormData for EACH file ---
                  const fileFormData = new FormData();
                  fileFormData.append('library_id', libraryId);
                  fileFormData.append('library_name', libraryName);
                  fileFormData.append('file', file, file.name); // Add the current file
                  // Append knowledge_id from hidden input
                   if (knowledgeIdValue) {
                       fileFormData.append('knowledge_id', knowledgeIdValue);
                   }


                   // --- Manually add checkbox state if checked ---

                  if (groundingCheckbox && groundingCheckbox.checked) {
                      // Backend checks for key presence, value doesn't strictly matter but 'true' is clear
                      fileFormData.append('enable_visual_grounding', 'true');
                  }
                  // --- End manual checkbox check ---

                //   const headers = {};
                //   if (csrfToken) {
                //       headers['X-CSRFToken'] = csrfToken;
                //   }

                const headers = {
                    // FormData sets Content-Type automatically
                    'X-CSRFToken': window.readCurrentCsrfToken()
                  };

                  // Create a promise for each file upload using the specific file's FormData
                  //const uploadPromise = fetch('/upload', { // Reusing the single upload endpoint
                  const uploadPromise = window.fetchWithCsrfRetry('/upload', { // Reusing the single upload endpoint
                      method: 'POST',
                      body: fileFormData, // Send the FormData specific to this file
                      headers: headers
                  })
                  .then(response => response.json().then(data => ({ ok: response.ok, data: data, fileName: file.name }))) // Pass filename along
                  .then(({ ok, data, fileName }) => { // Receive fileName here
                      // Use text-body-secondary for success (brighter than muted), text-danger for errors
                      const messageClass = ok && data.success ? 'text-body-secondary' : 'text-danger';
                      const statusPrefix = ok && data.success ? 'uploaded' : 'error';
                      // Ensure filename is used correctly in messageText
                      const messageText = ok && data.success ? `${fileName}` : `${fileName}: ${data.message || 'Unknown error'}`;

                      // Append status message instead of replacing
                      const statusHTML = `<p class="small ${messageClass} mb-1">${statusPrefix} ${i + 1} of ${filesToUpload.length} - ${messageText}</p>`;
              batchStatus.insertAdjacentHTML('beforeend', statusHTML);
              // Scroll to the bottom of the status div
              batchStatus.scrollTop = batchStatus.scrollHeight;

              // Update modal progress text
              if (modalProgressText) {
                  modalProgressText.textContent = `Uploaded ${i + 1} of ${filesToUpload.length} - ${file.name}`;
              }

              if (ok && data.success) {
                  successCount++;
              } else {
                  errorCount++;
              }
          })
          .catch(error => {
              errorCount++;
              console.error(`Error uploading file ${file.name}:`, error);
              // Append error status message
              const errorHTML = `<p class="small text-danger mb-1">error ${i + 1} of ${filesToUpload.length} - ${file.name}: ${error.message}</p>`;
              batchStatus.insertAdjacentHTML('beforeend', errorHTML);
              // Scroll to the bottom of the status div
              batchStatus.scrollTop = batchStatus.scrollHeight;

              // Update modal progress text on error
              if (modalProgressText) {
                  modalProgressText.textContent = `Error uploading ${file.name}`;
              }
          });
          uploadPromises.push(uploadPromise);
      }

              // Wait for all uploads to settle
              await Promise.allSettled(uploadPromises);

              // Final status update - Append summary message
              if (progressBarInnerBatch) { // Update progress bar on completion
                  progressBarInnerBatch.style.width = '100%';
                  console.log('[Batch Upload] Progress bar complete.');
                  progressBarInnerBatch.textContent = 'Complete';
                  progressBarInnerBatch.classList.add(errorCount > 0 ? 'bg-warning' : 'bg-success'); // Indicate success/partial success
              }
              // Append final summary
              const summaryHTML = `<p class="small text-body-secondary mt-2"><strong>Batch complete. Success: ${successCount}, Errors: ${errorCount}.</strong></p>`;
              batchStatus.insertAdjacentHTML('beforeend', summaryHTML);
              batchStatus.scrollTop = batchStatus.scrollHeight; // Scroll to bottom

              // Hide progress bar after a short delay (e.g., 2 seconds)
              setTimeout(() => {
                  console.log('[Batch Upload] Hiding progress bar.');
                  batchProgressBar.style.display = 'none';
              }, 2000);

              isBatchUploading = false;
              uploadBatchBtn.innerHTML = 'Upload Batch to Library';
              // Reset our array, the input, and the display
              batchFilesArray = [];
              batchFileInput.value = ''; // Clear file input
              renderBatchFileList(); // Clear file list display via render
              // librarySelectBatch.value = ''; // DO NOT Reset library selection
              checkBatchFormState(); // Ensure button is disabled after completion
          });
      } // End listener attachment check
      checkBatchFormState('initial');
  } // End Batch Upload Logic

  // --- Add Event Listeners for Library Details ---
  // --- Knowledge Mode Only: Attach listeners if knowledge selection fields exist ---
  if (librarySelectUrl && document.getElementById('knowledgeIdUrl')) {
      librarySelectUrl.addEventListener('change', function() {
        updateLibraryDetails(this, null, 'libraryMetadataInfoUrl');

          // Set knowledge_id hidden input based on selected library
          const selectedOption = this.options[this.selectedIndex];
          const knowledgeIdUrl = document.getElementById('knowledgeIdUrl');
          if (knowledgeIdUrl) {
              const knowledgeId = selectedOption?.dataset?.knowledgeId || '';
              knowledgeIdUrl.value = knowledgeId;
              console.log('[Upload Debug] Selected knowledge_id (URL):', knowledgeId);
          }
          checkUrlFormState();
      });
      // Initial call in case a library is pre-selected
      updateLibraryDetails(librarySelectUrl, null, 'libraryMetadataInfoUrl');
      // Also set knowledge_id on initial load
      const selectedOption = librarySelectUrl.selectedIndex >= 0
          ? librarySelectUrl.options[librarySelectUrl.selectedIndex]
          : null;
      const knowledgeIdUrl = document.getElementById('knowledgeIdUrl');
      if (knowledgeIdUrl) {
          const knowledgeId = selectedOption?.dataset?.knowledgeId || '';
          knowledgeIdUrl.value = knowledgeId;
      }
      checkUrlFormState();
  }

  if (librarySelectBatch && document.getElementById('knowledgeIdBatch')) {
      librarySelectBatch.addEventListener('change', function() {
          updateLibraryDetails(this, null, 'libraryMetadataInfoBatch');
          // Set knowledge_id hidden input based on selected library
          const selectedOption = this.options[this.selectedIndex];
          const knowledgeIdBatch = document.getElementById('knowledgeIdBatch');
          if (knowledgeIdBatch) {
              const knowledgeId = selectedOption?.dataset?.knowledgeId || '';
              knowledgeIdBatch.value = knowledgeId;
              console.log('[Upload Debug] Selected knowledge_id (Batch):', knowledgeId);
          }
          checkBatchFormState();
      });
      // Initial call
       updateLibraryDetails(librarySelectBatch, null, 'libraryMetadataInfoBatch');
       // Also set knowledge_id on initial load

      const selectedOption = librarySelectBatch.selectedIndex >= 0
          ? librarySelectBatch.options[librarySelectBatch.selectedIndex]
          : null;
      const knowledgeIdBatch = document.getElementById('knowledgeIdBatch');
      if (knowledgeIdBatch) {
          const knowledgeId = selectedOption?.dataset?.knowledgeId || '';
          knowledgeIdBatch.value = knowledgeId;
      }
      checkBatchFormState();
  }
  if (librarySelectFile) {
      librarySelectFile.addEventListener('change', function() {
          updateLibraryDetails(this, null, 'libraryMetadataInfoFile');
      });
      // Initial call
       updateLibraryDetails(librarySelectFile, null, 'libraryMetadataInfoFile');

  }


})(); // End IIFE
