document.addEventListener("DOMContentLoaded", function () {
  // Initialize flatpickr for date/time picker
  flatpickr("#scheduled-time", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    allowInput: true,
    time_24hr: true,
  });

  // Enable/disable schedule time input based on background processing checkbox
  const backgroundEnabled = document.getElementById("background-enabled");
  const scheduleTimeGroup = document.getElementById("schedule-time-group");
  backgroundEnabled.addEventListener("change", function () {
    scheduleTimeGroup.style.display = this.checked ? "block" : "none";
  });
  // Set initial state
  scheduleTimeGroup.style.display = backgroundEnabled.checked ? "block" : "none";

  // Visual Grounding OCR Mode Warning Handler
  const visualGroundingCheckbox = document.getElementById("enable-visual-grounding-admin");
  const visualGroundingOcrWarning = document.getElementById("visualGroundingOcrWarningAdmin");

  if (visualGroundingCheckbox && visualGroundingOcrWarning) {
    const ocrMode = visualGroundingCheckbox.dataset.ocrMode || "default";
    const isOcrLocal = ocrMode === "default";

    function updateVisualGroundingWarning() {
      if (visualGroundingCheckbox.checked && !isOcrLocal) {
        visualGroundingOcrWarning.classList.remove("d-none");
      } else {
        visualGroundingOcrWarning.classList.add("d-none");
      }
    }

    visualGroundingCheckbox.addEventListener("change", updateVisualGroundingWarning);
    updateVisualGroundingWarning(); // Check initial state

    console.log("[AdminFolderUpload] Visual Grounding OCR check initialized. OCR mode:", ocrMode);
  }

  function escapeHtml(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.replace(/[&<>"']/g, function (char) {
      const escapeMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return escapeMap[char] || char;
    });
  }

  function deriveFolderLabel(fileList) {
    if (!Array.isArray(fileList) || !fileList.length) {
      return "—";
    }

    const folderSet = new Set();
    const singleFileNames = [];

    fileList.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }
      let candidate = "";
      if (typeof item.filename === "string" && item.filename) {
        candidate = item.filename;
      } else if (typeof item.path === "string" && item.path) {
        const parts = item.path.replace(/\\/g, "/").split("/");
        candidate = parts.pop() || "";
      }

      if (!candidate) {
        return;
      }

      const normalized = candidate.replace(/\\/g, "/");
      const segments = normalized.split("/").filter(Boolean);

      if (segments.length > 1) {
        folderSet.add(segments[0]);
      } else if (segments.length === 1) {
        singleFileNames.push(segments[0]);
      }
    });

    if (folderSet.size === 1) {
      return [...folderSet][0];
    }
    if (folderSet.size > 1) {
      return "Multiple folders";
    }
    if (fileList.length > 1) {
      return "Multiple files";
    }
    if (singleFileNames.length === 1) {
      return singleFileNames[0];
    }
    return "—";
  }

  // Handle form submission
  const form = document.getElementById("folder-upload-form");
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonContent = submitButton ? submitButton.innerHTML : "";
  const loadingButtonContent =
    '<span class="spinner-border spinner-border-sm me-2" role="status" ' +
    'aria-hidden="true"></span>Scheduling...';
  const originalBodyCursor = document.body.style.cursor || "";

  function setLoadingState(isLoading) {
    if (!submitButton) {
      return;
    }

    if (isLoading) {
      submitButton.disabled = true;
      submitButton.innerHTML = loadingButtonContent;
      document.body.style.cursor = "progress";
    } else {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonContent;
      document.body.style.cursor = originalBodyCursor;
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(form);

    // Add library and knowledge parameters from the combined dropdown
    const lkSelect = document.getElementById('library-knowledge-select');
    const lkValue = lkSelect.value;
    if (!lkValue || !lkValue.includes('|')) {
      alert('Please select a valid Library — Knowledge pair.');
      return;
    }
    const [libraryId, knowledgeId] = lkValue.split('|');
    const selectedOption = lkSelect.options[lkSelect.selectedIndex];
    formData.set('library_id', libraryId);
    formData.set('knowledge_id', knowledgeId);
    formData.set('library_name', selectedOption.textContent.trim());

    // Collect checked file types
    const fileTypes = [];
    form.querySelectorAll('input[name="file_types"]:checked').forEach((el) => {
      fileTypes.push(el.value);
    });
    formData.set("file_types", fileTypes.join(","));

    // Set background_enabled explicitly
    formData.set("background_enabled", backgroundEnabled.checked ? "true" : "false");

    // Convert scheduled time to UTC ISO string if provided
    const scheduledTimeInput = document.getElementById("scheduled-time");
    if (scheduledTimeInput.value) {
      try {
        // Flatpickr provides local time; convert it to a Date object
        const localDate = new Date(scheduledTimeInput.value.replace(" ", "T")); // Ensure ISO-like format for parsing
        if (!isNaN(localDate)) {
          // Convert local Date object to UTC ISO string
          formData.set("scheduled_time", localDate.toISOString());
        } else {
          console.error("Invalid date format entered:", scheduledTimeInput.value);
          // Keep original value if parsing fails, backend might handle/reject it
          formData.set("scheduled_time", scheduledTimeInput.value);
        }
      } catch (error) {
        console.error("Error processing scheduled time:", error);
        formData.set("scheduled_time", scheduledTimeInput.value); // Fallback
      }
    } else {
      formData.delete("scheduled_time"); // Ensure it's not sent if empty
    }


    // Debug: log FormData keys and values
    console.log("FormData keys:", [...formData.keys()]);
    for (let key of formData.keys()) {
      console.log("FormData key:", key, "value:", formData.getAll(key));
    }

    setLoadingState(true);

    // AJAX POST to upload endpoint
    fetch("/admin/folder_upload/upload", {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.error || errorJson.message || 'Upload failed');
          } catch {
            throw new Error(errorText || 'Upload failed');
          }
        }
        return response.json();
      })
      .then((data) => {
        alert(`Upload job submitted! Job ID: ${data.job_id}`);
        loadJobsTable();
      })
      .catch((error) => {
        console.error('Upload error:', error);
        alert(`Upload failed: ${error.message}`);
      })
      .finally(() => {
        setLoadingState(false);
      });
  });

  // Function to load jobs table
  function loadJobsTable() {
    fetch("/admin/folder_upload/jobs")
      .then((resp) => resp.json())
      .then((jobs) => {
        const container = document.getElementById("jobs-table-container");
        if (!jobs.length) {
          container.innerHTML = "<div class='text-muted'>No jobs found.</div>";
          return;
        }
        let html = "<table class='table table-sm table-bordered align-middle'><thead><tr>";
        html += "<th>ID</th><th>Folder</th><th>Created</th><th>Status</th><th>Scheduled</th><th>Files</th><th>Actions</th></tr></thead><tbody>";
        jobs.forEach((job) => {
          // Format dates to local time string
          const createdAtLocal = job.created_at ? new Date(job.created_at).toLocaleString() : "";
          const scheduledTimeLocal = job.scheduled_time ? new Date(job.scheduled_time).toLocaleString() : "";

          let parsedFileList = [];
          if (job.file_list) {
            try {
              parsedFileList = JSON.parse(job.file_list) || [];
            } catch (error) {
              console.error("Failed to parse job file list", job.id, error);
              parsedFileList = [];
            }
          }
          const fileCount = Array.isArray(parsedFileList) ? parsedFileList.length : 0;
          const folderLabel = deriveFolderLabel(parsedFileList);

          // Determine if the job is cancellable
          const isCancellable = job.task_id && ["pending", "scheduled", "running"].includes(job.status);
          const cancelButtonHtml = isCancellable
            ? `<button class="btn btn-danger btn-sm" onclick="cancelJob(${job.id})">Cancel</button>`
            : `<button class="btn btn-secondary btn-sm" disabled>Cancel</button>`; // Disabled if not cancellable

          html += "<tr>";
          html += `<td>${job.id}</td>`;
          html += `<td>${escapeHtml(folderLabel)}</td>`;
          html += `<td>${escapeHtml(createdAtLocal)}</td>`;
          html += `<td>${escapeHtml(job.status || "")}</td>`;
          html += `<td>${escapeHtml(scheduledTimeLocal)}</td>`;
          html += `<td>${fileCount}</td>`;
          html += `<td>${cancelButtonHtml}</td>`;
          html += "</tr>";
        });
        html += "</tbody></table>";
        container.innerHTML = html;
      });
  }

  // Function to handle job cancellation
  window.cancelJob = function (jobId) {
    if (!confirm(`Are you sure you want to cancel Job ID ${jobId}?`)) {
      return;
    }

    // Get CSRF token from the form
    const csrfToken = document.querySelector('input[name="csrf_token"]').value;

    fetch(`/admin/folder_upload/job/${jobId}/cancel`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json', // Important for Flask to parse JSON body if needed
        'X-CSRFToken': csrfToken // Send CSRF token in header
      },
      // body: JSON.stringify({}) // No body needed for this request, but set headers
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (data.error) {
          alert("Error cancelling job: " + data.error);
        } else {
          alert(data.message || "Job cancellation requested successfully.");
          loadJobsTable(); // Refresh the table
        }
      })
      .catch((err) => {
        alert("Cancellation request failed: " + err);
      });
  };

  // Remove old showJobLog function if no longer needed
  // window.showJobLog = ...

  // No dynamic filtering needed for single combined dropdown
  // Initial load
  loadJobsTable();
  // Optionally poll every 10s
  setInterval(loadJobsTable, 10000);
});
