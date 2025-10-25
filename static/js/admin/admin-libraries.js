document.addEventListener('DOMContentLoaded', function () {
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    const libraryModalElement = document.getElementById('libraryModal'); // Get modal element
    if (!libraryModalElement) {
        console.error("Library modal element not found!");
        return;
    }
    const libraryModal = new bootstrap.Modal(libraryModalElement);
    const libraryForm = document.getElementById('libraryForm');
    const modalTitle = document.getElementById('libraryModalLabel');
    const libraryIdInput = document.getElementById('library_id');
    const libraryNameInput = document.getElementById('libraryName');
    const libraryDescriptionInput = document.getElementById('libraryDescription'); // Already exists
    // Select the button globally (to match working pattern in catalogs)
    const generateDescBtn = document.getElementById('generateDescBtn');
    // const knowledgeIdInput = document.getElementById('libraryKnowledge'); // Not used since knowledge input removed

    // Removed all references to knowledgeIdInput since knowledge input element is not used
    const saveLibraryBtn = document.getElementById('saveLibraryBtn');
    const modalAlertPlaceholder = document.getElementById('modalAlertPlaceholder');
    const librariesTableBody = document.querySelector('#librariesTable tbody');

    // --- DataTables Initialization Removed ---
    // Using basic HTML table instead to prevent initialization errors
    // All CRUD operations remain functional

    // --- Helper Functions ---
    function showAlert(message, type = 'danger', container = modalAlertPlaceholder) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = [
            `<div class="alert alert-${type} alert-dismissible" role="alert">`,
            `   <div>${message}</div>`,
            '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
            '</div>'
        ].join('');
        container.innerHTML = ''; // Clear previous alerts
        container.append(wrapper);
    }

    function clearModalForm() {
        libraryForm.reset();
        libraryIdInput.value = '';
        modalTitle.textContent = 'Add Library';
        modalAlertPlaceholder.innerHTML = ''; // Clear alerts
        // Reset validation states if Bootstrap validation was used
        libraryForm.classList.remove('was-validated');
    }

    // --- Event Listeners ---

    // 1. Open Modal for Adding
    document.getElementById('addLibraryBtn').addEventListener('click', () => {
        clearModalForm();
    });

    // 2. Open Modal for Editing
    $(document).on('click', '#librariesTable .edit-btn', async function () {
        clearModalForm();
        const libraryId = $(this).data('id');
        modalTitle.textContent = 'Edit Library';
        if (libraryIdInput) {
            libraryIdInput.value = libraryId;
            console.log('Edit modal opened, libraryIdInput.value set to:', libraryIdInput.value);
        } else {
            console.error('libraryIdInput not found in edit modal!');
        }
        saveLibraryBtn.disabled = true;
        try {
            const response = await fetch(`/admin/libraries/data/${libraryId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (libraryNameInput) {
                libraryNameInput.value = data.name || '';
            } else {
                console.error('libraryNameInput not found!');
            }
            if (libraryDescriptionInput) {
                libraryDescriptionInput.value = data.description || '';
            } else {
                console.error('libraryDescriptionInput not found!');
            }
            // All references to knowledgeIdInput removed
        } catch (error) {
            console.error('Error fetching library data:', error);
            showAlert(`Error loading library data: ${error.message}`, 'danger');
        } finally {
            saveLibraryBtn.disabled = false;
            libraryModal.show();
        }
    });


    // 3. Handle Form Submission (Add/Edit)
    libraryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Basic validation (Bootstrap validation can enhance this)
        if (!libraryForm.checkValidity()) {
            libraryForm.classList.add('was-validated');
            return;
        }

        const libraryId = libraryIdInput.value;
        // Debug: log the libraryId value
        console.log('Form submit handler triggered with libraryId:', libraryId);

        // Only treat as edit mode if libraryId is a non-empty string and a valid integer > 0
        const isEditMode = libraryId && !isNaN(libraryId) && Number(libraryId) > 0;
        const url = isEditMode ? `/admin/libraries/edit/${libraryId}` : '/admin/libraries/add';
        const method = 'POST'; // Using POST for both add and edit

        if (!libraryNameInput) {
            console.error('libraryNameInput is null in form submit handler!');
            showAlert('Library name input not found. Please check the form markup.', 'danger');
            saveLibraryBtn.disabled = false;
            return;
        }
        if (!libraryDescriptionInput) {
            console.error('libraryDescriptionInput is null in form submit handler!');
            showAlert('Library description input not found. Please check the form markup.', 'danger');
            saveLibraryBtn.disabled = false;
            return;
        }
        const formData = {
            name: libraryNameInput.value.trim(),
            description: libraryDescriptionInput.value.trim()
            // knowledge_id removed since knowledge input element is not used
            // knowledge_id: knowledgeIdInput ? knowledgeIdInput.value.trim() || null : null
        };

        saveLibraryBtn.disabled = true;
        modalAlertPlaceholder.innerHTML = ''; // Clear previous alerts

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken // Add CSRF token header
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                libraryModal.hide();
                // Simple page reload to show changes. Dynamic update is more complex.
                location.reload();
                // Optionally show flash message (requires backend setup for flash messages via JS)
                // showGlobalAlert(result.message, 'success');
            } else {
                showAlert(result.message || 'An unknown error occurred.', 'danger');
            }
        } catch (error) {
            console.error('Error saving library:', error);
            showAlert(`An error occurred: ${error.message}`, 'danger');
        } finally {
            saveLibraryBtn.disabled = false;
        }
    });

    // 4. Handle Delete Button Click (using event delegation)
    librariesTableBody.addEventListener('click', async (event) => {
        const deleteButton = event.target.closest('.delete-btn');
        if (deleteButton) {
            const libraryId = deleteButton.dataset.id;
            const libraryName = deleteButton.dataset.name;

            if (confirm(`Are you sure you want to delete the library "${libraryName}"?`)) {
                try {
                    const response = await fetch(`/admin/libraries/delete/${libraryId}`, {
                        method: 'POST', // Or 'DELETE', ensure backend route accepts it
                         headers: {
                            'Content-Type': 'application/json', // Good practice
                            'X-CSRFToken': csrfToken // Add CSRF token header
                        }
                    });

                    const result = await response.json();

                    if (response.ok && result.status === 'success') {
                        // Remove row from table
                        const row = document.getElementById(`libraryRow-${libraryId}`);
                        if (row) {
                            row.remove();
                        }
                        // Optionally show a global success message
                        // showGlobalAlert(result.message, 'success');
                         // Simple reload if dynamic removal fails or is complex
                         // location.reload();
                    } else {
                        alert(`Error deleting library: ${result.message || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Error deleting library:', error);
                    alert(`An error occurred: ${error.message}`);
                }
            }
        }
    });

    // --- AI Description Generation (now uses shared utility) ---
    if (generateDescBtn) {
        generateDescBtn.addEventListener('click', function () {
            const spinner = generateDescBtn.querySelector('.spinner-border');
            generateDescriptionForEntity({
                nameInput: libraryNameInput,
                descriptionInput: libraryDescriptionInput,
                itemType: "library",
                alertPlaceholder: modalAlertPlaceholder,
                button: generateDescBtn,
                spinner: spinner,
                csrfToken: csrfToken
            });
        });
    } else {
        console.warn("Generate Description button not found.");
    }

}); // End DOMContentLoaded
