document.addEventListener('DOMContentLoaded', function () {
    const categoryModalElement = document.getElementById('categoryModal');
    if (!categoryModalElement) {
        console.error('Category modal element not found!');
        return;
    }
    const categoryModal = new bootstrap.Modal(categoryModalElement);
    const categoryForm = document.getElementById('categoryForm');
    const categoryModalLabel = document.getElementById('categoryModalLabel');
    const categoryIdInput = document.getElementById('categoryId');
    const categoryNameInput = document.getElementById('categoryName');
    const categoryDescriptionInput = document.getElementById('categoryDescription'); // Already exists
    // Select the button within the specific modal context
    const generateDescBtn = categoryModalElement ? categoryModalElement.querySelector('#generateDescBtn') : null; // Find button inside modal
    const saveCategoryBtn = document.getElementById('saveCategoryBtn');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoriesTableBody = document.querySelector('#categoriesTable tbody');
    const formErrorElement = document.getElementById('formError'); // Assuming same ID in category modal
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    let currentEditId = null; // To store the ID of the category being edited


    // --- Helper Functions ---
    function clearForm() {
        categoryForm.reset();
        categoryIdInput.value = '';
        currentEditId = null;
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
        categoryModalLabel.textContent = 'Add Category';
        saveCategoryBtn.textContent = 'Save Category';
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
        // Simple alert for now
        alert(message);
    }

    function createTableRow(category) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', category.id);
        tr.innerHTML = `
            <td>${category.id}</td>
            <td class="category-name">${category.name}</td>
            <td class="category-description">${category.description || ''}</td>
            <td>${category.created_by_username || 'N/A'}</td>
            <td>${category.created_at ? new Date(category.created_at).toLocaleString() : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${category.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${category.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        // Event listeners are now handled by delegation on the table body
        return tr;
    }

    function updateTableRow(category) {
        const row = categoriesTableBody.querySelector(`tr[data-id="${category.id}"]`);
        if (row) {
            row.querySelector('.category-name').textContent = category.name;
            row.querySelector('.category-description').textContent = category.description || '';
        }
    }

    // --- Event Handlers ---
    function handleAddClick() {
        clearForm();
        categoryModal.show();
    }

    async function handleEditClick(button) {
        clearForm();
        if (!button) {
            console.error('Edit button element is undefined or null.');
            showFeedback('Failed to load category data for editing.', 'danger');
            return;
        }
        currentEditId = button.getAttribute('data-id');
        if (!currentEditId) {
            console.error('Category ID is missing on edit button.');
            showFeedback('Failed to load category data for editing.', 'danger');
            return;
        }
        categoryModalLabel.textContent = 'Edit Category';
        saveCategoryBtn.textContent = 'Update Category';

        try {
            const response = await fetch(`/admin/categories/data/${currentEditId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const category = await response.json();
            categoryIdInput.value = category.id;
            categoryNameInput.value = category.name;
            categoryDescriptionInput.value = category.description || '';
            // Show modal explicitly after loading data
            categoryModal.show();
        } catch (error) {
            console.error('Error fetching category data:', error);
            showFeedback('Failed to load category data for editing.', 'danger');
        }
    }

    async function handleDeleteClick(event) {
        const button = event.currentTarget;
        const categoryId = button.getAttribute('data-id');
        const row = button.closest('tr');
        const categoryName = row.querySelector('.category-name').textContent;

        if (confirm(`Are you sure you want to delete the category "${categoryName}" (ID: ${categoryId})?`)) {
            try {
                const response = await fetch(`/admin/categories/delete/${categoryId}`, {
                    method: 'POST', // Or 'DELETE'
                     headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken // Add CSRF token header
                    }
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    row.remove();
                    showFeedback(result.message || 'Category deleted successfully.');
                    if (categoriesTableBody.rows.length === 0) {
                        categoriesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No categories found.</td></tr>';
                    }
                } else {
                    throw new Error(result.message || 'Failed to delete category.');
                }
            } catch (error) {
                console.error('Error deleting category:', error);
                showFeedback(`Error: ${error.message}`, 'danger');
            }
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideFormError();

        const categoryData = {
            name: categoryNameInput.value.trim(),
            description: categoryDescriptionInput.value.trim(),
        };

        if (!categoryData.name) {
            showFormError('Category name is required.');
            return;
        }

        const url = currentEditId ? `/admin/categories/edit/${currentEditId}` : '/admin/categories/add';
        const method = 'POST';

        try {
            saveCategoryBtn.disabled = true;
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken // Add CSRF token header
                },
                body: JSON.stringify(categoryData),
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                categoryModal.hide();
                showFeedback(result.message || `Category ${currentEditId ? 'updated' : 'added'} successfully.`);

                const returnedCategory = result.category;
                if (returnedCategory) {
                    if (!returnedCategory.created_at) returnedCategory.created_at = new Date().toISOString();
                    if (!returnedCategory.created_by_username) returnedCategory.created_by_username = 'Current User'; // Placeholder

                    if (currentEditId) {
                        updateTableRow(returnedCategory);
                    } else {
                        const noDataRow = categoriesTableBody.querySelector('td[colspan="6"]');
                        if (noDataRow) noDataRow.parentElement.remove();
                        const newRow = createTableRow(returnedCategory);
                        categoriesTableBody.appendChild(newRow);
                    }
                } else {
                    window.location.reload(); // Fallback
                }

            } else {
                throw new Error(result.message || `Failed to ${currentEditId ? 'update' : 'add'} category.`);
            }
        } catch (error) {
            console.error('Error saving category:', error);
            showFormError(`Error: ${error.message}`);
        } finally {
             saveCategoryBtn.disabled = false;
        }
    }

    // --- Attach Initial Event Listeners ---
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', handleAddClick);
    }

    if (categoryForm) {
        categoryForm.addEventListener('submit', handleFormSubmit);
    }

    // --- Event Delegation for Table Actions ---
    // Replaces: document.querySelectorAll('#categoriesTable .edit-btn').forEach(...)
    // Replaces: document.querySelectorAll('#categoriesTable .delete-btn').forEach(...)

    categoriesTableBody.addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-btn');
        const deleteButton = event.target.closest('.delete-btn');

        if (editButton) {
            handleEditClick(editButton); // Pass the button element directly
        } else if (deleteButton) {
            handleDeleteClick(deleteButton); // Pass the button element directly
        }
    });

    // Clear form when modal is hidden
    categoryModalElement.addEventListener('hidden.bs.modal', clearForm);

    // --- AI Description Generation ---
    async function handleGenerateDescription() {
        const nameValue = categoryNameInput.value.trim(); // Use category name input
        if (!nameValue) {
            showFormError('Please enter a category name first to generate a description.');
            return;
        }
        hideFormError(); // Clear previous errors

        const button = generateDescBtn; // Already scoped
        if (!button) {
            console.error("Generate Description button not found in Category modal.");
            return;
        }
        const spinner = button.querySelector('.spinner-border');

        // Show loading state
        button.disabled = true;
        spinner.classList.remove('d-none');

        try {
            const payload = {
                context_text: nameValue,
                item_type: "category", // Set item type to "category"
                deployment_name: "gpt-4o-mini" // Use the correct deployment
                // No language needed in payload, backend handles it
                // No catalog_names needed for category description
            };

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

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                categoryDescriptionInput.value = result.description; // Update the textarea
                // No confirmation alert needed
            } else {
                throw new Error(result.message || `Failed to generate description. Status: ${response.status}`);
            }

        } catch (error) {
            console.error('Error in Category handleGenerateDescription:', error);
            showFormError(`Error generating description: ${error.message}`);
        } finally {
            // Hide loading state
            button.disabled = false;
            spinner.classList.add('d-none');
        }
    }

    // Attach listener directly to the button (scoped)
    if (generateDescBtn) {
        generateDescBtn.addEventListener('click', handleGenerateDescription);
    } else {
        console.warn("Generate Description button not found.");
    }

});
