document.addEventListener('DOMContentLoaded', function () {
    const languageModalElement = document.getElementById('languageModal');
    if (!languageModalElement) {
        console.error('Language modal element not found!');
        return;
    }
    const languageModal = new bootstrap.Modal(languageModalElement);
    const languageForm = document.getElementById('languageForm');
    const languageModalLabel = document.getElementById('languageModalLabel');
    const languageIdInput = document.getElementById('languageId');
    const languageNameInput = document.getElementById('languageName');
    const languageCodeInput = document.getElementById('languageCode');
    const languageActiveInput = document.getElementById('languageIsActive');
    const saveLanguageBtn = document.getElementById('saveLanguageBtn');
    const addLanguageBtn = document.getElementById('addLanguageBtn');
    const languagesTableBody = document.querySelector('#languagesTable tbody');
    const formErrorElement = document.getElementById('formError');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    let currentEditId = null;

    function clearForm() {
        languageForm.reset();
        languageIdInput.value = '';
        currentEditId = null;
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
        languageModalLabel.textContent = 'Add Language';
        saveLanguageBtn.textContent = 'Save Language';
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

    function createTableRow(language) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', language.id);
        tr.innerHTML = `
            <td class="language-code">${language.code}</td>
            <td class="language-name">${language.name}</td>
            <td>${language.active ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
            <td>${language.created_by_username || 'N/A'}</td>
            <td>${language.created_at ? new Date(language.created_at).toLocaleString() : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-btn" data-id="${language.id}" title="Edit Language">
                    <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${language.id}" data-name="${language.name}" title="Delete Language">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        `;
        return tr;
    }

    function updateTableRow(language) {
        const row = languagesTableBody.querySelector(`tr[data-id="${language.id}"]`);
        if (row) {
            row.querySelector('.language-code').textContent = language.code;
            row.querySelector('.language-name').textContent = language.name;
            row.querySelector('td:nth-child(3)').innerHTML = language.active ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>';
        }
    }

    function handleAddClick() {
        clearForm();
        languageModal.show();
    }

    async function handleEditClick(button) {
        clearForm();
        if (!button) {
            console.error('Edit button element is undefined or null.');
            showFeedback('Failed to load language data for editing.', 'danger');
            return;
        }
        currentEditId = button.getAttribute('data-id');
        if (!currentEditId) {
            console.error('Language ID is missing on edit button.');
            showFeedback('Failed to load language data for editing.', 'danger');
            return;
        }
        languageModalLabel.textContent = 'Edit Language';
        saveLanguageBtn.textContent = 'Update Language';

        try {
            const response = await fetch(`/admin/languages/data/${currentEditId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const language = await response.json();
            console.log('Received language data for population:', language);
            console.log('--- DEBUG: Reached point after receiving data ---');
            // Add specific logs before setting values
            console.log(`Setting ID: ${language.id}`);
            languageIdInput.value = language.id;
            languageNameInput.value = language.language_name || language.name;
            const nameToSet = language.language_name || language.name;
            console.log(`Attempting to set Name: ${nameToSet} (from language_name: ${language.language_name}, name: ${language.name})`);
            languageCodeInput.value = language.language_code || language.code;
            const codeToSet = language.language_code || language.code;
            console.log(`Attempting to set Code: ${codeToSet} (from language_code: ${language.language_code}, code: ${language.code})`);
            languageActiveInput.checked = language.is_active !== undefined ? language.is_active : language.active;
            const activeToSet = language.is_active !== undefined ? language.is_active : language.active;
            console.log(`Attempting to set Active: ${activeToSet} (from is_active: ${language.is_active}, active: ${language.active})`);
            console.log('Showing language modal after data population.');
            // Check if values were actually set
            console.log(`Form values after setting: ID=${languageIdInput.value}, Name=${languageNameInput.value}, Code=${languageCodeInput.value}, Active=${languageActiveInput.checked}`);
            setTimeout(() => {
                languageModal.show();

                // Additional debug: check modal visibility and backdrop
                const modalElement = document.getElementById('languageModal');
                if (modalElement) {
                    const style = window.getComputedStyle(modalElement);
                    console.log('Modal display style:', style.display);
                    console.log('Modal visibility style:', style.visibility);
                    console.log('Modal opacity:', style.opacity);
                }
                const backdrop = document.querySelector('.modal-backdrop');
                console.log('Modal backdrop present:', !!backdrop);
            }, 100);
        } catch (error) {
            console.error('Error fetching language data:', error);
            showFeedback('Failed to load language data for editing.', 'danger');
            return;
        }
    }

    async function handleDeleteClick(event) {
        const button = event.currentTarget;
        const languageId = button.getAttribute('data-id');
        const row = button.closest('tr');
        const languageName = row.querySelector('.language-name').textContent;

        if (confirm(`Are you sure you want to delete the language "${languageName}"?`)) {
            try {
                const response = await fetch(`/admin/languages/delete/${languageId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    }
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    row.remove();
                    showFeedback(result.message || 'Language deleted successfully.');
                    if (languagesTableBody.rows.length === 0) {
                        languagesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No languages found.</td></tr>';
                    }
                } else {
                    throw new Error(result.message || 'Failed to delete language.');
                }
            } catch (error) {
                console.error('Error deleting language:', error);
                showFeedback(`Error: ${error.message}`, 'danger');
            }
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideFormError();

        const languageData = {
            language_code: languageCodeInput.value.trim(),
            language_name: languageNameInput.value.trim(),
            is_active: languageActiveInput.checked
        };

        if (!languageData.language_code) {
            showFormError('Language code is required.');
            return;
        }
        if (!languageData.language_name) {
            showFormError('Language name is required.');
            return;
        }

        const url = currentEditId ? `/admin/languages/edit/${currentEditId}` : '/admin/languages/add';

        try {
            saveLanguageBtn.disabled = true;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(languageData)
            });

            // Robustly check if response is JSON or HTML (error page)
            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                // Try to read as text and check for HTML error page
                const text = await response.text();
                if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    showFormError('Session expired or CSRF error. Please refresh the page and try again.');
                    return;
                } else {
                    // Try to parse as JSON anyway (may throw)
                    try {
                        result = JSON.parse(text);
                    } catch (e) {
                        showFormError('Unexpected server response. Please try again or contact support.');
                        return;
                    }
                }
            }

            if (response.ok && result.status === 'success') {
                languageModal.hide();
                showFeedback(result.message || `Language ${currentEditId ? 'updated' : 'added'} successfully.`);

                const returnedLanguage = result.language;
                if (returnedLanguage) {
                    if (!returnedLanguage.created_at) returnedLanguage.created_at = new Date().toISOString();
                    if (!returnedLanguage.created_by_username) returnedLanguage.created_by_username = 'Current User';

                    if (currentEditId) {
                        updateTableRow(returnedLanguage);
                    } else {
                        const noDataRow = languagesTableBody.querySelector('td[colspan="6"]');
                        if (noDataRow) noDataRow.parentElement.remove();
                        const newRow = createTableRow(returnedLanguage);
                        languagesTableBody.appendChild(newRow);
                    }
                } else {
                    window.location.reload();
                }
            } else {
                throw new Error(result.message || `Failed to ${currentEditId ? 'update' : 'add'} language.`);
            }
        } catch (error) {
            console.error('Error saving language:', error);
            showFormError(`Error: ${error.message}`);
        } finally {
            saveLanguageBtn.disabled = false;
        }
    }

    if (addLanguageBtn) {
        addLanguageBtn.addEventListener('click', handleAddClick);
    }

    if (languageForm) {
        languageForm.addEventListener('submit', handleFormSubmit);
    }

    document.getElementById('languagesTable').addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-btn');
        const deleteButton = event.target.closest('.delete-btn');

        if (editButton) {
            handleEditClick(editButton);
        } else if (deleteButton) {
            handleDeleteClick(deleteButton);
        }
    });
});
