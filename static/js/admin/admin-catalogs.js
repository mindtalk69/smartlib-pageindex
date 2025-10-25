document.addEventListener('DOMContentLoaded', function () {
    // Catalogs JS - Removed DataTable initialization to avoid duplicate init
    // All DataTable initialization handled centrally in admin-datatables.js

    // Modal and form elements
    const catalogModalElement = document.getElementById('catalogModal');
    if (!catalogModalElement) {
        console.error("Catalog modal element not found!");
        return;
    }
    const catalogModal = new bootstrap.Modal(catalogModalElement);
    const catalogForm = document.getElementById('catalogForm');
    const catalogModalLabel = document.getElementById('catalogModalLabel');
    const catalogIdInput = document.getElementById('catalogId');
    const catalogNameInput = document.getElementById('catalogName');
    const catalogDescriptionInput = document.getElementById('catalogDescription');
    const saveCatalogBtn = document.getElementById('saveCatalogBtn');
    const addCatalogBtn = document.getElementById('addCatalogBtn');
    const catalogsTableBody = document.querySelector('#catalogsTable tbody');
    const formErrorElement = document.getElementById('formError');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    let currentEditId = null;

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
        alert(message);
    }

    function createTableRow(catalog) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', catalog.id);
        tr.innerHTML = `
            <td>${catalog.name}</td>
            <td>${catalog.description || ''}</td>
            <td>${catalog.created_by_username || 'N/A'}</td>
            <td>${catalog.created_at ? new Date(catalog.created_at).toLocaleString() : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-btn" data-id="${catalog.id}">
                    <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${catalog.id}" data-name="${catalog.name}">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        `;
        return tr;
    }

    function updateTableRow(catalog) {
        const row = catalogsTableBody.querySelector(`tr[data-id="${catalog.id}"]`);
        if (row) {
            row.querySelector('td:nth-child(1)').textContent = catalog.name;
            row.querySelector('td:nth-child(2)').textContent = catalog.description || '';
        }
    }

    function handleAddClick() {
        clearForm();
        catalogModal.show();
    }

async function handleEditClick(event) {
    clearForm();
    const button = event.target.closest('.edit-btn') || event.currentTarget;
    const row = button.closest('tr');
    const catalogId = row.getAttribute('data-id');
    currentEditId = catalogId;
    catalogModalLabel.textContent = 'Edit Catalog';
    saveCatalogBtn.textContent = 'Update Catalog';

    try {
        const response = await fetch(`/admin/catalogs/data/${currentEditId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const catalog = await response.json();
        catalogIdInput.value = catalog.id;
        catalogNameInput.value = catalog.name;
        catalogDescriptionInput.value = catalog.description || '';
    } catch (error) {
        console.error('Error fetching catalog data:', error);
        showFeedback('Failed to load catalog data for editing.', 'danger');
    } finally {
        catalogModal.show();
    }
}

    async function handleDeleteClick(event) {
        const button = event.currentTarget;
        const catalogId = button.getAttribute('data-id');
        const row = button.closest('tr');
        const catalogName = row.querySelector('td').textContent;

        if (confirm(`Are you sure you want to delete the catalog "${catalogName}"?`)) {
            try {
                const response = await fetch(`/admin/catalogs/delete/${catalogId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    }
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    row.remove();
                    showFeedback(result.message || 'Catalog deleted successfully.');
                    if (catalogsTableBody.rows.length === 0) {
                        catalogsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No catalogs found.</td></tr>';
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
            description: catalogDescriptionInput.value.trim()
        };

        if (!catalogData.name) {
            showFormError('Catalog name is required.');
            return;
        }

        const url = currentEditId ? `/admin/catalogs/edit/${currentEditId}` : '/admin/catalogs/add';

        try {
            saveCatalogBtn.disabled = true;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(catalogData)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                catalogModal.hide();
                showFeedback(result.message || `Catalog ${currentEditId ? 'updated' : 'added'} successfully.`);

                const returnedCatalog = result.catalog;
                if (returnedCatalog) {
                    if (!returnedCatalog.created_at) returnedCatalog.created_at = new Date().toISOString();
                    if (!returnedCatalog.created_by_username) returnedCatalog.created_by_username = 'Current User';

                    if (currentEditId) {
                        updateTableRow(returnedCatalog);
                    } else {
                        const noDataRow = catalogsTableBody.querySelector('td[colspan="5"]');
                        if (noDataRow) noDataRow.parentElement.remove();
                        const newRow = createTableRow(returnedCatalog);
                        catalogsTableBody.appendChild(newRow);
                    }
                } else {
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

    if (addCatalogBtn) {
        addCatalogBtn.addEventListener('click', handleAddClick);
    }

    if (catalogForm) {
        catalogForm.addEventListener('submit', handleFormSubmit);
    }

    document.getElementById('catalogsTable').addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-btn');
        if (editButton) {
            handleEditClick(event);
            return;
        }
        const deleteButton = event.target.closest('.delete-btn');
        if (deleteButton) {
            handleDeleteClick(event);
        }
    });

    // --- Generate Description Wizard Button ---
    const generateDescBtn = document.getElementById('generateDescBtn');
    if (generateDescBtn) {
        generateDescBtn.addEventListener('click', async function () {
            const spinner = generateDescBtn.querySelector('.spinner-border');
            const name = catalogNameInput.value.trim();
            if (!name) {
                showFormError('Please enter a catalog name before generating a description.');
                return;
            }
            hideFormError();
            generateDescBtn.disabled = true;
            if (spinner) spinner.classList.remove('d-none');
            try {
                const response = await fetch('/admin/generate-description', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({
                        context_text: name,
                        item_type: 'catalog',
                        deployment_name: 'gpt-4o-mini', // before that default Set to your valid deployment name
                        catalog_names: [] // Optionally pass related catalogs
                    })
                });
                const result = await response.json();
                if (response.ok && result.status === 'success' && result.description) {
                    catalogDescriptionInput.value = result.description;
                } else {
                    throw new Error(result.message || 'Failed to generate description.');
                }
            } catch (error) {
                showFormError('Error generating description: ' + error.message);
            } finally {
                generateDescBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
            }
        });
    }
});
