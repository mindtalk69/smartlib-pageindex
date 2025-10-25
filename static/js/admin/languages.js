/**
 * Languages Management JavaScript
 * Handles CRUD operations for LLM Languages in admin panel
 */
document.addEventListener('DOMContentLoaded', function () {
    // --- Elements & Initialization ---
    const languageModalElement = document.getElementById('languageModal');
    if (!languageModalElement) {
        console.error('Language modal element not found!');
        return;
    }
    const languageModal = new bootstrap.Modal(languageModalElement);
    const languageForm = document.getElementById('languageForm');
    const languageModalLabel = document.getElementById('languageModalLabel');
    const languageIdInput = document.getElementById('languageId');
    const languageCodeInput = document.getElementById('languageCode');
    const languageNameInput = document.getElementById('languageName');
    const languageIsActiveInput = document.getElementById('languageIsActive');
    const saveLangBtn = document.getElementById('saveLanguageBtn');
    const addLanguageBtn = document.getElementById('addLanguageBtn');
    const languagesTableBody = document.querySelector('#languagesTable tbody');
    const formErrorElement = document.getElementById('formError');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    let currentEditId = null;


    // --- Helper Functions ---
    function clearForm() {
        console.log("Clearing form");
        languageForm.reset();
        languageIdInput.value = '';
        currentEditId = null;
        languageIsActiveInput.checked = true;
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
        languageModalLabel.textContent = 'Add Language';
        saveLangBtn.textContent = 'Save Language';
        saveLangBtn.disabled = false;
    }

    function showFormError(message) {
        formErrorElement.textContent = message;
        formErrorElement.style.display = 'block';
    }

    function hideFormError() {
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
    }

    function showFeedback(message, type = 'success') {
        alert(message);
    }

    function createTableRow(lang) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', lang.id);
        const activeBadge = lang.is_active
            ? '<span class="badge bg-success">Yes</span>'
            : '<span class="badge bg-secondary">No</span>';
        const createdAt = lang.created_at ? new Date(lang.created_at).toLocaleString() : 'N/A';

        tr.innerHTML = `
            <td>${lang.id}</td>
            <td class="language-code">${lang.language_code}</td>
            <td class="language-name">${lang.language_name}</td>
            <td class="language-active" data-active="${lang.is_active}">${activeBadge}</td>
            <td>${createdAt}</td>
            <td>${lang.created_by || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-btn" 
                        data-id="${lang.id}" 
                        data-bs-toggle="modal"
                        data-bs-target="#languageModal"
                        title="Edit Language">
                    <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-btn ms-2"
                        data-id="${lang.id}"
                        data-name="${lang.language_name}"
                        title="Delete Language">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        `;
        return tr;
    }

    function updateTableRow(lang) {
        const row = languagesTableBody.querySelector(`tr[data-id="${lang.id}"]`);
        if (row) {
            const activeBadge = lang.is_active
                ? '<span class="badge bg-success">Yes</span>'
                : '<span class="badge bg-secondary">No</span>';
            row.querySelector('.language-code').textContent = lang.language_code;
            row.querySelector('.language-name').textContent = lang.language_name;
            const activeCell = row.querySelector('.language-active');
            activeCell.innerHTML = activeBadge;
            activeCell.setAttribute('data-active', lang.is_active ? '1' : '0');
        }
    }

    function handleAddClick() {
        clearForm();
        languageModal.show();
    }

    async function handleEditClick(event) {
        console.log("Edit button clicked");
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();

        const button = event.target.closest('.edit-btn');
        if (!button) {
            console.error("Edit button not found in event handler.");
            return;
        }
        const id = button.getAttribute('data-id');
        currentEditId = id;

        // Update UI for edit mode
        languageModalLabel.textContent = 'Edit Language';
        saveLangBtn.textContent = 'Update Language';

        try {
            console.log(`Fetching language data for ID: ${id}`);
            const response = await fetch(`/admin/languages/data/${id}`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const languageData = await response.json();
            console.log('Language data received (in handleEditClick):', languageData);

            // Populate form fields BEFORE showing modal
            languageIdInput.value = languageData.id || '';
            languageCodeInput.value = languageData.language_code || '';
            languageNameInput.value = languageData.language_name || '';
            languageIsActiveInput.checked = languageData.is_active === true;

            console.log('Form populated (in handleEditClick):', {
                id: languageIdInput.value,
                code: languageCodeInput.value,
                name: languageNameInput.value,
                active: languageIsActiveInput.checked
            });

            // Now show the modal
            languageModal.show();

        } catch (error) {
            console.error('Error fetching or populating language data:', error);
            showFeedback(`Error loading data: ${error.message}`, 'danger');
        }
    }

    async function handleDeleteClick(event) {
        const button = event.currentTarget;
        const languageId = button.getAttribute('data-id');
        const languageName = button.getAttribute('data-name') || `ID ${languageId}`;

        if (confirm(`Delete language "${languageName}" (ID: ${languageId})?`)) {
            button.disabled = true;
            try {
                const response = await fetch(`/admin/languages/delete/${languageId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    credentials: 'include'
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    const row = button.closest('tr');
                    if (row) row.remove();
                    showFeedback(result.message || 'Deleted successfully');
                    if (languagesTableBody.rows.length === 0) {
                        languagesTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No languages</td></tr>';
                    }
                } else {
                    throw new Error(result.message || 'Failed to delete');
                }
            } catch (error) {
                console.error('Error:', error);
                showFeedback(`Error: ${error.message}`, 'danger');
                button.disabled = false;
            }
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideFormError();

        const languageData = {
            language_code: languageCodeInput.value.trim(),
            language_name: languageNameInput.value.trim(),
            is_active: languageIsActiveInput.checked
        };

        if (!languageData.language_code || !languageData.language_name) {
            showFormError('Language code and name are required');
            return;
        }

        const url = currentEditId ? `/admin/languages/edit/${currentEditId}` : '/admin/languages/add';
        saveLangBtn.disabled = true;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(languageData)
            });
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                languageModal.hide();
                showFeedback(result.message || `Language ${currentEditId ? 'updated' : 'added'}`);

                // Get data to update the table
                const returnedLanguage = result.language || {
                    id: currentEditId || result.id,
                    language_code: languageData.language_code,
                    language_name: languageData.language_name,
                    is_active: languageData.is_active,
                    created_at: new Date().toISOString(),
                    created_by: 'Admin'
                };

                if (currentEditId) {
                    updateTableRow(returnedLanguage);
                } else {
                    const noDataRow = languagesTableBody.querySelector('td[colspan="7"]');
                    if (noDataRow) noDataRow.parentElement.remove();
                    languagesTableBody.appendChild(createTableRow(returnedLanguage));
                }
            } else {
                throw new Error(result.message || `Failed to ${currentEditId ? 'update' : 'add'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            showFormError(`Error: ${error.message}`);
        } finally {
            saveLangBtn.disabled = false;
        }
    }

    // --- Event Listeners ---
    if (addLanguageBtn) addLanguageBtn.addEventListener('click', handleAddClick);
    if (languageForm) languageForm.addEventListener('submit', handleFormSubmit);
    languageModalElement.addEventListener('hidden.bs.modal', clearForm); // Clear form when modal closes

    // Event delegation for table actions
    languagesTableBody.addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-btn');
        const deleteButton = event.target.closest('.delete-btn');
        
        if (editButton) {
            handleEditClick(event);
        } else if (deleteButton) {
            handleDeleteClick(event);
        }
    });
    
});
