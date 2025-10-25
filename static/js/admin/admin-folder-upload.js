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

  // Handle form submission
  const form = document.getElementById("folder-upload-form");
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
        // Change header from Log to Actions
        html += "<th>ID</th><th>Created</th><th>Status</th><th>Scheduled</th><th>Files</th><th>Actions</th></tr></thead><tbody>";
        jobs.forEach((job) => {
          // Format dates to local time string
          const createdAtLocal = job.created_at ? new Date(job.created_at).toLocaleString() : "";
          const scheduledTimeLocal = job.scheduled_time ? new Date(job.scheduled_time).toLocaleString() : "";

          // Determine if the job is cancellable
          const isCancellable = job.task_id && ['pending', 'scheduled', 'running'].includes(job.status);
          const cancelButtonHtml = isCancellable
            ? `<button class="btn btn-danger btn-sm" onclick="cancelJob(${job.id})">Cancel</button>`
            : `<button class="btn btn-secondary btn-sm" disabled>Cancel</button>`; // Disabled if not cancellable

          html += "<tr>";
          html += `<td>${job.id}</td>`;
          html += `<td>${createdAtLocal}</td>`;
          html += `<td>${job.status || ""}</td>`;
          html += `<td>${scheduledTimeLocal}</td>`;
          html += `<td>${job.file_list ? JSON.parse(job.file_list).length : 0}</td>`;
          // Add Cancel button instead of View Log
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
