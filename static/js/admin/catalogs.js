document.addEventListener('DOMContentLoaded', function () {
    const catalogModalElement = document.getElementById('catalogModal');
    if (!catalogModalElement) {
        console.error('Catalog modal element not found!');
        return;
    }
    const catalogModal = new bootstrap.Modal(catalogModalElement);
    const catalogForm = document.getElementById('catalogForm');
    const catalogModalLabel = document.getElementById('catalogModalLabel');
    const catalogIdInput = document.getElementById('catalogId');
    const catalogNameInput = document.getElementById('catalogName');
    const catalogDescriptionInput = document.getElementById('catalogDescription'); // Already exists
    // Select the button within the specific modal context
    const generateDescBtn = catalogModalElement ? catalogModalElement.querySelector('#generateDescBtn') : null; // Find button inside modal
    const saveCatalogBtn = document.getElementById('saveCatalogBtn');
    const addCatalogBtn = document.getElementById('addCatalogBtn');
    const catalogsTableBody = document.querySelector('#catalogsTable tbody');
    const formErrorElement = document.getElementById('formError');
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    let currentEditId = null; // To store the ID of the catalog being edited


    // --- Helper Functions ---
    function clearForm() {
        catalogForm.reset();
        catalogIdInput.value = '';
        currentEditId = null;
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
        catalogModalLabel.textContent = 'Add Catalog';
        saveCatalogBtn.textContent = 'Save Catalog';
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
        // Simple alert for now, could be replaced with a more sophisticated toast notification
        alert(message);
        // Optionally reload the page to see flashed messages if implemented
        // window.location.reload();
    }

    function createTableRow(catalog) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', catalog.id);
        tr.innerHTML = `
            <td>${catalog.id}</td>
            <td class="catalog-name">${catalog.name}</td>
            <td class="catalog-description">${catalog.description || ''}</td>
            <td>${catalog.created_by_username || 'N/A'}</td>
            <td>${catalog.created_at ? new Date(catalog.created_at).toLocaleString() : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${catalog.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${catalog.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        // Event listeners are now handled by delegation on the table body
        return tr;
    }

    function updateTableRow(catalog) {
        const row = catalogsTableBody.querySelector(`tr[data-id="${catalog.id}"]`);
        if (row) {
            row.querySelector('.catalog-name').textContent = catalog.name;
            row.querySelector('.catalog-description').textContent = catalog.description || '';
            // Note: created_by and created_at usually don't change on edit
        }
    }

    // --- Event Handlers ---
    function handleAddClick() {
        clearForm();
        catalogModal.show();
    }

async function handleEditClick(button) {
    clearForm();
    if (!button) {
        console.error('Edit button element is undefined or null.');
        showFeedback('Failed to load catalog data for editing.', 'danger');
        return;
    }
    currentEditId = button.getAttribute('data-id');
    if (!currentEditId) {
        console.error('Catalog ID is missing on edit button.');
        showFeedback('Failed to load catalog data for editing.', 'danger');
        return;
    }
    catalogModalLabel.textContent = 'Edit Catalog';
    saveCatalogBtn.textContent = 'Update Catalog';

    try {
        const response = await fetch(`/admin/catalogs/data/${currentEditId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const catalog = await response.json();
        catalogIdInput.value = catalog.id;
        catalogNameInput.value = catalog.name;
        catalogDescriptionInput.value = catalog.description || '';
    } catch (error) {
        console.error('Error fetching catalog data:', error);
        showFeedback('Failed to load catalog data for editing.', 'danger');
    } finally {
        // Show modal after populating fields
        catalogModal.show();
    }
}

    async function handleDeleteClick(event) {
        const button = event.currentTarget;
        const catalogId = button.getAttribute('data-id');
        const row = button.closest('tr');
        const catalogName = row.querySelector('.catalog-name').textContent;

        if (confirm(`Are you sure you want to delete the catalog "${catalogName}" (ID: ${catalogId})?`)) {
            try {
                const response = await fetch(`/admin/catalogs/delete/${catalogId}`, {
                    method: 'POST', // Or 'DELETE', ensure backend handles it
                     headers: {
                        'Content-Type': 'application/json', // Though not strictly needed for delete, good practice
                        'X-CSRFToken': csrfToken // Add CSRF token header
                    }
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    row.remove();
                    showFeedback(result.message || 'Catalog deleted successfully.');
                     // Check if table is empty after deletion
                    if (catalogsTableBody.rows.length === 0) {
                        catalogsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No catalogs found.</td></tr>';
                    }
                } else {
                    throw new Error(result.message || 'Failed to delete catalog.');
                }
            } catch (error) {
                console.error('Error deleting catalog:', error);
                showFeedback(`Error: ${error.message}`, 'danger');
            }
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideFormError();

        const catalogData = {
            name: catalogNameInput.value.trim(),
            description: catalogDescriptionInput.value.trim(),
        };

        if (!catalogData.name) {
            showFormError('Catalog name is required.');
            return;
        }

        const url = currentEditId ? `/admin/catalogs/edit/${currentEditId}` : '/admin/catalogs/add';
        const method = 'POST';

        try {
            saveCatalogBtn.disabled = true; // Prevent double submission
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken // Add CSRF token header
                },
                body: JSON.stringify(catalogData),
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                catalogModal.hide();
                showFeedback(result.message || `Catalog ${currentEditId ? 'updated' : 'added'} successfully.`);

                // Update table
                const returnedCatalog = result.catalog; // Backend should return the added/updated item
                if (returnedCatalog) {
                     // Add created_at and created_by_username if backend provides them
                    if (!returnedCatalog.created_at) returnedCatalog.created_at = new Date().toISOString();
                    if (!returnedCatalog.created_by_username) returnedCatalog.created_by_username = 'Current User'; // Placeholder

                    if (currentEditId) {
                        updateTableRow(returnedCatalog);
                    } else {
                         // Remove "No catalogs found" row if it exists
                        const noDataRow = catalogsTableBody.querySelector('td[colspan="6"]');
                        if (noDataRow) noDataRow.parentElement.remove();
                        // Add new row
                        const newRow = createTableRow(returnedCatalog);
                        catalogsTableBody.appendChild(newRow);
                    }
                } else {
                    // Fallback: Reload if backend doesn't return data
                    window.location.reload();
                }

            } else {
                throw new Error(result.message || `Failed to ${currentEditId ? 'update' : 'add'} catalog.`);
            }
        } catch (error) {
            console.error('Error saving catalog:', error);
            showFormError(`Error: ${error.message}`);
        } finally {
             saveCatalogBtn.disabled = false;
        }
    }

    // --- Attach Initial Event Listeners ---
    if (addCatalogBtn) {
        addCatalogBtn.addEventListener('click', handleAddClick);
    }

    if (catalogForm) {
        catalogForm.addEventListener('submit', handleFormSubmit);
    }

    // --- Event Delegation for Table Actions ---
    // Replaces: document.querySelectorAll('.edit-btn').forEach(...)
    // Replaces: document.querySelectorAll('.delete-btn').forEach(...)

    // Robust event delegation: Listen on the catalogsTable itself (tbody can be replaced by DataTables)
    document.getElementById('catalogsTable').addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-btn');
        const deleteButton = event.target.closest('.delete-btn');

        if (editButton) {
            handleEditClick(editButton); // Pass the button element directly
        } else if (deleteButton) {
            handleDeleteClick(deleteButton); // Pass the button element directly
        }
    });

    // Clear form when modal is hidden
    catalogModalElement.addEventListener('hidden.bs.modal', clearForm);

    // --- AI Description Generation ---
    async function handleGenerateDescription() {
        // console.log("handleGenerateDescription called for Catalog."); // Log removed
        const nameValue = catalogNameInput.value.trim(); // Use catalog name input
        if (!nameValue) {
            showFormError('Please enter a catalog name first to generate a description.');
            return;
        }
        hideFormError(); // Clear previous errors

        const button = generateDescBtn; // Already scoped
        if (!button) { // Add check if button exists
            console.error("Generate Description button not found in Catalog modal.");
            return;
        }
        const spinner = button.querySelector('.spinner-border');

        // Show loading state
        button.disabled = true;
        spinner.classList.remove('d-none');

        try {
            // console.log("Attempting fetch for catalog description..."); // Log removed
            const payload = {
                context_text: nameValue,
                item_type: "catalog", // Set item type to "catalog"
                deployment_name: "gpt-4o-mini" // Use the correct deployment
                // No language needed in payload, backend handles it
                // No catalog_names needed for catalog description
            };
            // console.log("Catalog Payload:", JSON.stringify(payload)); // Log removed

            const headers = {
                'Content-Type': 'application/json'
            };
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }

            const response = await fetch('/admin/generate-description', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            // console.log("Catalog Fetch Response Status:", response.status); // Log removed
            const result = await response.json();
            // console.log("Catalog Fetch Response Result:", result); // Log removed

            if (response.ok && result.status === 'success') {
                catalogDescriptionInput.value = result.description; // Update the textarea
                // No confirmation alert needed
            } else {
                throw new Error(result.message || `Failed to generate description. Status: ${response.status}`);
            }

        } catch (error) {
            console.error('Error in Catalog handleGenerateDescription:', error); // Log error specifically
            showFormError(`Error generating description: ${error.message}`);
        } finally {
            // Hide loading state
            if (button && spinner) {
                button.disabled = false;
                spinner.classList.add('d-none');
            }
        }
    }

    // Attach listener directly to the button (scoped)
    if (generateDescBtn) {
        generateDescBtn.addEventListener('click', handleGenerateDescription);
    } else {
        console.warn("Generate Description button not found.");
    }

    // Removed the delegated listener on the modal element

});
