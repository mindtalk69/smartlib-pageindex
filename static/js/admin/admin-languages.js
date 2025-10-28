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

    function toBoolean(value, fallback = false) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value === 1;
        }
        if (typeof value === 'string') {
            const normalized = value.toLowerCase();
            if (normalized === 'true' || normalized === '1') {
                return true;
            }
            if (normalized === 'false' || normalized === '0') {
                return false;
            }
        }
        if (value === null || value === undefined) {
            return fallback;
        }
        return Boolean(value);
    }

    function formatDate(dateValue) {
        if (!dateValue) {
            return 'N/A';
        }
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) {
            return typeof dateValue === 'string' ? dateValue : 'N/A';
        }
        return date.toLocaleString();
    }

    function normalizeLanguage(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const resolvedActive = raw.is_active !== undefined ? raw.is_active : raw.active;
        return {
            id: raw.id,
            language_code: raw.language_code || raw.code || '',
            language_name: raw.language_name || raw.name || '',
            is_active: toBoolean(resolvedActive, false),
            created_by: raw.created_by || raw.created_by_username || raw.createdBy || 'N/A',
            created_at: raw.created_at || raw.createdAt || null,
        };
    }

    function renderActiveBadge(isActive) {
        return isActive
            ? '<span class="badge bg-success">Yes</span>'
            : '<span class="badge bg-secondary">No</span>';
    }

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
        const normalized = normalizeLanguage(language);
        if (!normalized) {
            return document.createElement('tr');
        }

        const tr = document.createElement('tr');
        tr.setAttribute('data-id', normalized.id);

        const numberCell = document.createElement('td');
        numberCell.classList.add('row-number');
        tr.appendChild(numberCell);

        const codeCell = document.createElement('td');
        codeCell.classList.add('language-code');
        codeCell.textContent = normalized.language_code;
        tr.appendChild(codeCell);

        const nameCell = document.createElement('td');
        nameCell.classList.add('language-name');
        nameCell.textContent = normalized.language_name;
        tr.appendChild(nameCell);

        const activeCell = document.createElement('td');
        activeCell.classList.add('language-active');
        activeCell.dataset.active = normalized.is_active ? 'true' : 'false';
        activeCell.innerHTML = renderActiveBadge(normalized.is_active);
        tr.appendChild(activeCell);

        const createdByCell = document.createElement('td');
        createdByCell.classList.add('language-created-by');
        createdByCell.textContent = normalized.created_by || 'N/A';
        tr.appendChild(createdByCell);

        const createdAtCell = document.createElement('td');
        createdAtCell.classList.add('language-created-at');
        createdAtCell.textContent = formatDate(normalized.created_at);
        tr.appendChild(createdAtCell);

        const actionsCell = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.classList.add('action-buttons');

        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-warning edit-btn';
        editButton.setAttribute('data-id', normalized.id);
        editButton.title = 'Edit Language';
        editButton.innerHTML = '<i class="bi bi-pencil-fill"></i>';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm btn-danger delete-btn';
        deleteButton.setAttribute('data-id', normalized.id);
        deleteButton.setAttribute('data-name', normalized.language_name);
        deleteButton.title = 'Delete Language';
        deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>';

        actionWrapper.appendChild(editButton);
        actionWrapper.appendChild(deleteButton);
        actionsCell.appendChild(actionWrapper);
        tr.appendChild(actionsCell);

        return tr;
    }

    function updateTableRow(language) {
        const normalized = normalizeLanguage(language);
        if (!normalized) {
            return;
        }
        const row = languagesTableBody.querySelector(`tr[data-id="${normalized.id}"]`);
        if (!row) {
            return;
        }
        const codeCell = row.querySelector('.language-code');
        if (codeCell) {
            codeCell.textContent = normalized.language_code;
        }
        const nameCell = row.querySelector('.language-name');
        if (nameCell) {
            nameCell.textContent = normalized.language_name;
        }
        const activeCell = row.querySelector('.language-active');
        if (activeCell) {
            activeCell.dataset.active = normalized.is_active ? 'true' : 'false';
            activeCell.innerHTML = renderActiveBadge(normalized.is_active);
        }
        const createdByCell = row.querySelector('.language-created-by');
        if (createdByCell) {
            createdByCell.textContent = normalized.created_by || 'N/A';
        }
        const createdAtCell = row.querySelector('.language-created-at');
        if (createdAtCell) {
            createdAtCell.textContent = formatDate(normalized.created_at);
        }
    }

    function refreshRowNumbers() {
        const dataRows = Array.from(languagesTableBody.querySelectorAll('tr[data-id]'));
        dataRows.forEach((row, index) => {
            const numberCell = row.querySelector('.row-number') || row.querySelector('td');
            if (numberCell) {
                numberCell.textContent = index + 1;
            }
        });
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
                    const remainingRows = languagesTableBody.querySelectorAll('tr[data-id]').length;
                    if (remainingRows === 0) {
                        languagesTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No languages found.</td></tr>';
                    } else {
                        refreshRowNumbers();
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
                    if (currentEditId) {
                        updateTableRow(returnedLanguage);
                    } else {
                        const placeholderRow = languagesTableBody.querySelector('td[colspan="7"]');
                        if (placeholderRow) {
                            placeholderRow.parentElement.remove();
                        }
                        const newRow = createTableRow(returnedLanguage);
                        languagesTableBody.appendChild(newRow);
                    }
                    refreshRowNumbers();
                    clearForm();
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

    refreshRowNumbers();
});
