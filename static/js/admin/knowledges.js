document.addEventListener('DOMContentLoaded', function () {
    const knowledgeModalElement = document.getElementById('knowledgeModal');
    if (!knowledgeModalElement) {
        console.error('Knowledge modal element not found!');
        return;
    }
    const knowledgeModal = new bootstrap.Modal(knowledgeModalElement);
    const knowledgeForm = document.getElementById('knowledgeForm');
    const knowledgeModalLabel = document.getElementById('knowledgeModalLabel');
    const knowledgeIdInput = document.getElementById('knowledgeId');
    const knowledgeNameInput = document.getElementById('knowledgeName');
    const knowledgeDescriptionInput = document.getElementById('knowledgeDescription');
    // Category elements (similar to catalog)
    const knowledgeCategoriesDiv = document.getElementById('knowledgeCategories'); // Container for category checkboxes
    const categoryFilterInput = document.getElementById('categoryFilterInput'); // Category filter input
    const selectedCategoriesDisplay = document.getElementById('selectedCategoriesDisplay'); // Category display area
    // Catalog elements
    const knowledgeCatalogsDiv = document.getElementById('knowledgeCatalogs'); // Container for catalog checkboxes
    const catalogFilterInput = document.getElementById('catalogFilterInput'); // Catalog filter input - KEEP THIS ONE
    const selectedCatalogsDisplay = document.getElementById('selectedCatalogsDisplay'); // Catalog display area - KEEP THIS ONE
    // Library elements
    const knowledgeLibrariesDiv = document.getElementById('knowledgeLibraries'); // Container for library checkboxes
    const libraryFilterInput = document.getElementById('libraryFilterInput'); // Library filter input
    const selectedLibrariesDisplay = document.getElementById('selectedLibrariesDisplay'); // Library display area
    // Groups elements
    const knowledgeGroupsDiv = document.getElementById('knowledgeGroups'); // Container for group checkboxes
    const groupFilterInput = document.getElementById('groupFilterInput'); // Group filter input
    const selectedGroupsDisplay = document.getElementById('selectedGroupsDisplay'); // Group display area
    // Buttons and other elements
    const saveKnowledgeBtn = document.getElementById('saveKnowledgeBtn');
    const addKnowledgeBtn = document.getElementById('addKnowledgeBtn');
    const knowledgesTableBody = document.querySelector('#knowledgesTable tbody');
    const formErrorElement = document.getElementById('formError');
    // const catalogFilterInput = document.getElementById('catalogFilterInput'); // REMOVE DUPLICATE
    // const selectedCatalogsDisplay = document.getElementById('selectedCatalogsDisplay'); // REMOVE DUPLICATE
    // Select the button within the specific modal context
    const generateDescBtn = knowledgeModalElement ? knowledgeModalElement.querySelector('#generateDescBtn') : null; // Find button inside modal
    // Get CSRF token from meta tag - Ensure this meta tag exists in your base template
    let csrfToken = null;
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
        csrfToken = csrfMeta.getAttribute('content');
    } else {
        console.warn('CSRF token meta tag not found. AJAX requests might fail.');
        // Optionally, try to get it from a cookie if your setup uses that
        // csrfToken = getCookie('csrftoken'); // Example function needed
    }


    let currentEditId = null; // To store the ID of the knowledge being edited

    // --- DataTables initialization is handled globally in admin-datatables.js ---

    // --- Helper Functions ---
    function clearForm() {
        knowledgeForm.reset();
        knowledgeIdInput.value = '';
        currentEditId = null;
        // Uncheck all category checkboxes
        if (knowledgeCategoriesDiv) {
            knowledgeCategoriesDiv.querySelectorAll('.category-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        // Uncheck all catalog checkboxes
        if (knowledgeCatalogsDiv) {
            knowledgeCatalogsDiv.querySelectorAll('.catalog-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        // Uncheck all library checkboxes
        if (knowledgeLibrariesDiv) {
            knowledgeLibrariesDiv.querySelectorAll('.library-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        // Clear selected libraries display explicitly on form clear
        if (selectedLibrariesDisplay) {
            selectedLibrariesDisplay.innerHTML = '<span class="text-muted">Selected: None</span>';
        }
        // Explicitly update displays based on cleared state
        updateSelectedCategoriesDisplay([]); 
        updateSelectedCatalogsDisplay([]); 
        updateSelectedLibrariesDisplay([]); 
        // Uncheck all group checkboxes
        if (knowledgeGroupsDiv) {
            knowledgeGroupsDiv.querySelectorAll('.group-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        // Clear selected groups display explicitly on form clear
        if (selectedGroupsDisplay) {
            selectedGroupsDisplay.innerHTML = '<span class="text-muted">Selected: None</span>';
        }
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
        knowledgeModalLabel.textContent = 'Add Knowledge';
        saveKnowledgeBtn.textContent = 'Save Knowledge';
        saveKnowledgeBtn.disabled = false; // Re-enable button
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
        // Consider implementing a more user-friendly toast notification system
    }

    function getSelectedCatalogIds() {
        const selectedIds = [];
        knowledgeCatalogsDiv.querySelectorAll('.catalog-checkbox:checked').forEach(checkbox => {
            selectedIds.push(checkbox.value);
        });
        return selectedIds;
    }

    function getSelectedCategoryIds() {
        const selectedIds = [];
        if (knowledgeCategoriesDiv) {
            knowledgeCategoriesDiv.querySelectorAll('.category-checkbox:checked').forEach(checkbox => {
                selectedIds.push(checkbox.value);
            });
        }
        return selectedIds;
    }

    function getSelectedGroupIds() {
        const selectedIds = [];
        if (knowledgeGroupsDiv) {
            knowledgeGroupsDiv.querySelectorAll('.group-checkbox:checked').forEach(checkbox => {
                selectedIds.push(checkbox.value);
            });
        }
        return selectedIds;
    }

    function updateSelectedGroupsDisplay() {
        if (!selectedGroupsDisplay || !knowledgeGroupsDiv) return;
        const selectedNames = [];
        knowledgeGroupsDiv.querySelectorAll('.group-checkbox:checked').forEach(checkbox => {
            // Try to find the label using for attribute if .form-check is missing
            let label = null;
            if (checkbox.closest('.form-check')) {
                label = checkbox.closest('.form-check').querySelector('label');
            }
            if (!label) {
                // Fallback: find label by for attribute
                label = document.querySelector('label[for="' + checkbox.id + '"]');
            }
            if (label) {
                selectedNames.push(label.textContent.trim());
            }
        });
        if (selectedNames.length > 0) {
            selectedGroupsDisplay.innerHTML = '<strong>Selected:</strong> ' + selectedNames.map(name =>
                `<span class="badge bg-primary me-1">${name}</span>`
            ).join('');
        } else {
            selectedGroupsDisplay.innerHTML = `<span class="text-muted">Selected: None</span>`;
        }
    }

    function createTableRow(knowledge) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', knowledge.id);
        // Format date safely
        let createdAt = 'N/A';
        if (knowledge.created_at) {
            try {
                // Assuming backend returns ISO string or similar parseable format
                createdAt = new Date(knowledge.created_at).toLocaleString();
            } catch (e) {
                console.warn("Could not parse created_at date:", knowledge.created_at);
            }
        }

        tr.innerHTML = `
            <td class="knowledge-name">${knowledge.name}</td>
            <td class="knowledge-description">${knowledge.description || ''}</td>
            <td class="knowledge-categories">${knowledge.category_names ? knowledge.category_names.join(', ') : 'N/A'}</td>
            <td class="knowledge-libraries">${knowledge.library_names ? knowledge.library_names.join(', ') : 'N/A'}</td>
            <td class="knowledge-groups">${knowledge.group_names ? knowledge.group_names.join(', ') : 'N/A'}</td>
            <td>${knowledge.created_by_username || 'N/A'}</td>
            <td>${createdAt}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${knowledge.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${knowledge.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        // Re-attach event listeners for buttons in the new row
        tr.querySelector('.edit-btn').addEventListener('click', handleEditClick);
        tr.querySelector('.delete-btn').addEventListener('click', handleDeleteClick);
        return tr;
    }

    function updateTableRow(knowledge) {
        const row = knowledgesTableBody.querySelector(`tr[data-id="${knowledge.id}"]`);
        if (row) {
            row.querySelector('.knowledge-name').textContent = knowledge.name;
            row.querySelector('.knowledge-description').textContent = knowledge.description || '';
            // Update category display (assuming a class 'knowledge-categories')
            const categoryCell = row.querySelector('.knowledge-categories');
            if (categoryCell) {
                categoryCell.textContent = knowledge.category_names ? knowledge.category_names.join(', ') : 'N/A';
            }
            // Update library display (assuming a class 'knowledge-libraries')
            const libraryCell = row.querySelector('.knowledge-libraries');
            if (libraryCell) {
                libraryCell.textContent = knowledge.library_names ? knowledge.library_names.join(', ') : 'N/A';
            }
            // Update group display (assuming a class 'knowledge-groups')
            const groupCell = row.querySelector('.knowledge-groups');
            if (groupCell) {
                groupCell.textContent = knowledge.group_names ? knowledge.group_names.join(', ') : 'N/A';
            }
            // Update catalog display (assuming a class 'knowledge-catalogs' if you add it)
            // const catalogCell = row.querySelector('.knowledge-catalogs');
            // if (catalogCell) {
            //     catalogCell.textContent = knowledge.catalog_names ? knowledge.catalog_names.join(', ') : 'N/A';
            // }
            // created_by and created_at typically don't change on edit
        }
    }

    // --- Function to update the selected libraries display ---
    // Moved here from admin-form-utils.js for better scope management
    function updateSelectedLibrariesDisplay() { // Removed libraryIds parameter
        if (!selectedLibrariesDisplay || !knowledgeLibrariesDiv) return; // Exit if elements don't exist

        const libraryNames = [];
        const checkedBoxes = knowledgeLibrariesDiv.querySelectorAll('.library-checkbox:checked');
        console.log('[DEBUG] updateSelectedLibrariesDisplay called. Checked boxes:', checkedBoxes.length);

        checkedBoxes.forEach(checkbox => {
            // Try to find the label using for attribute if .form-check is missing
            let label = null;
            if (checkbox.closest('.form-check')) {
                label = checkbox.closest('.form-check').querySelector('label');
            }
            if (!label) {
                // Fallback: find label by for attribute
                label = document.querySelector('label[for="' + checkbox.id + '"]');
            }
            if (label) {
                console.log('[DEBUG] Found label for library:', label.textContent.trim());
                libraryNames.push(label.textContent.trim());
            } else {
                console.warn('[DEBUG] No label found for library checkbox with id:', checkbox.id);
            }
        });
            
        if (libraryNames.length > 0) {
                selectedLibrariesDisplay.style.display = 'block';
                selectedLibrariesDisplay.innerHTML = '<strong>Selected:</strong> ' + libraryNames.map(name => 
                    `<span class="badge bg-primary me-1">${name}</span>`
                ).join('');
            } else {
                // This single else handles the case where libraryNames is empty (meaning no checked boxes were found or labels couldn't be retrieved)
                selectedLibrariesDisplay.style.display = 'block';
                selectedLibrariesDisplay.innerHTML = '<span class="text-muted">Selected: None</span>';
            }
        // Removed the extra 'else' block here
    } // Correct placement for function closing brace

    // --- Function to update the selected catalogs display ---
    function updateSelectedCatalogsDisplay() {
        if (!selectedCatalogsDisplay || !knowledgeCatalogsDiv) return;
        const selectedNames = [];
        knowledgeCatalogsDiv.querySelectorAll('.catalog-checkbox:checked').forEach(checkbox => {
            let label = null;
            if (checkbox.closest('.form-check')) {
                label = checkbox.closest('.form-check').querySelector('label');
            }
            if (!label) {
                label = document.querySelector('label[for="' + checkbox.id + '"]');
            }
            if (label) {
                selectedNames.push(label.textContent.trim());
            }
        });
        if (selectedNames.length > 0) {
            selectedCatalogsDisplay.innerHTML = '<strong>Selected:</strong> ' + selectedNames.map(name =>
                `<span class="badge bg-primary me-1">${name}</span>`
            ).join('');
        } else {
            selectedCatalogsDisplay.innerHTML = `<span class="text-muted">Selected: None</span>`;
        }
    }


    // --- Event Handlers ---
    function handleAddClick() {
        clearForm();
        // Reset filter when adding new
        if (categoryFilterInput) {
            categoryFilterInput.value = '';
            handleCategoryFilter(); // Also reset category filter
        }
        if (catalogFilterInput) {
            catalogFilterInput.value = '';
            handleCatalogFilter(); // Reset catalog filter
        }
        if (libraryFilterInput) {
            libraryFilterInput.value = '';
            handleLibraryFilter(); // Reset library filter
        }
        knowledgeModal.show();
    }

    // Modified to accept the button element directly
    async function handleEditClick(button) {
        clearForm();
        // Reset filter when opening for edit
        if (catalogFilterInput) {
            catalogFilterInput.value = '';
            handleCatalogFilter();
        }
        if (libraryFilterInput) {
            libraryFilterInput.value = '';
            handleLibraryFilter();
        }
        // const button = event.currentTarget; // Removed: button is now passed directly
        currentEditId = button.getAttribute('data-id');
        if (!currentEditId) {
            console.error("Edit button clicked but data-id attribute is missing or empty.");
            showFeedback("Could not get ID for editing.", "danger");
            return;
        }
        knowledgeModalLabel.textContent = 'Edit Knowledge';
        saveKnowledgeBtn.textContent = 'Update Knowledge';

        try {
            saveKnowledgeBtn.disabled = true; // Disable while loading
            const response = await fetch(`/admin/knowledges/data/${currentEditId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to get error message
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const knowledge = data.knowledge;
            const selectedCatalogs = data.selected_catalogs || [];
            const selectedCategories = data.selected_categories || []; // Get selected categories
            const selectedLibraries = data.selected_libraries || []; // Get selected libraries
            const selectedGroups = data.selected_groups || []; // Get selected groups

            knowledgeIdInput.value = knowledge.id;
            knowledgeNameInput.value = knowledge.name;
            knowledgeDescriptionInput.value = knowledge.description || '';

            // Check the corresponding category checkboxes
            if (knowledgeCategoriesDiv) {
                knowledgeCategoriesDiv.querySelectorAll('.category-checkbox').forEach(checkbox => {
                    checkbox.checked = selectedCategories.includes(parseInt(checkbox.value));
                });
            }
            updateSelectedCategoriesDisplay(); // Update category display

            // Check the corresponding catalog checkboxes
            if (knowledgeCatalogsDiv) {
                knowledgeCatalogsDiv.querySelectorAll('.catalog-checkbox').forEach(checkbox => {
                    checkbox.checked = selectedCatalogs.includes(parseInt(checkbox.value));
                });
            }
            updateSelectedCatalogsDisplay(); // Update catalog display

            // Check the corresponding library checkboxes
            if (knowledgeLibrariesDiv) {
                knowledgeLibrariesDiv.querySelectorAll('.library-checkbox').forEach(checkbox => {
                    // Use string comparison for robustness (checkbox.value is string)
                    checkbox.checked = selectedLibraries.map(String).includes(checkbox.value);
                });
            }
            updateSelectedLibrariesDisplay(); // Update library display

            // Check the corresponding group checkboxes
            if (knowledgeGroupsDiv) {
                knowledgeGroupsDiv.querySelectorAll('.group-checkbox').forEach(checkbox => {
                    // Use string comparison for robustness (checkbox.value is string)
                    checkbox.checked = selectedGroups.map(String).includes(checkbox.value);
                });
            }
            updateSelectedGroupsDisplay(); // Update group display

            // Set active tab to Libraries if any libraries are selected, else default to Categories
            if (selectedLibraries.length > 0) {
                sessionStorage.setItem('activeKnowledgeTab', 'libraries-tab');
            } else if (selectedGroups.length > 0) {
                sessionStorage.setItem('activeKnowledgeTab', 'groups-tab');
            } else {
                sessionStorage.setItem('activeKnowledgeTab', 'categories-tab');
            }

            knowledgeModal.show(); // Show modal after populating
        } catch (error) {
            console.error('Error fetching knowledge data:', error);
            showFeedback(`Failed to load knowledge data for editing: ${error.message}`, 'danger');
            currentEditId = null; // Reset edit state on error
        } finally {
             saveKnowledgeBtn.disabled = false; // Re-enable button
        }
    }

    // Modified to accept the button element directly
    async function handleDeleteClick(button) {
        // const button = event.currentTarget; // Removed: button is now passed directly
        const knowledgeId = button.getAttribute('data-id');
        if (!knowledgeId) {
             console.error("Delete button clicked but data-id attribute is missing or empty.");
             showFeedback("Could not get ID for deletion.", "danger");
             return;
        }
        const row = button.closest('tr');
        const knowledgeName = row ? row.querySelector('.knowledge-name').textContent : `ID ${knowledgeId}`; // Fallback name

        if (confirm(`Are you sure you want to delete the knowledge "${knowledgeName}" (ID: ${knowledgeId})?`)) {
            // Disable button to prevent double clicks
            button.disabled = true;
            try {
                const headers = {
                    'Content-Type': 'application/json' // Optional for delete, but good practice
                };
                if (csrfToken) {
                    headers['X-CSRFToken'] = csrfToken;
                }

                const response = await fetch(`/admin/knowledges/delete/${knowledgeId}`, {
                    method: 'POST', // Or 'DELETE', ensure backend handles it
                    headers: headers,
                    credentials: 'same-origin'
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    row.remove();
                    showFeedback(result.message || 'Knowledge deleted successfully.');
                     // Check if table is empty after deletion
                    if (knowledgesTableBody && knowledgesTableBody.rows.length === 0) {
                        knowledgesTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No knowledge entries found.</td></tr>';
                    }
                } else {
                    throw new Error(result.message || 'Failed to delete knowledge.');
                }
            } catch (error) {
                console.error('Error deleting knowledge:', error);
                showFeedback(`Error: ${error.message}`, 'danger');
                 button.disabled = false; // Re-enable button on error
            }
            // No finally block needed here as button is removed on success
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideFormError();

        const knowledgeData = {
            name: knowledgeNameInput.value.trim(),
            description: knowledgeDescriptionInput.value.trim(),
            category_ids: getSelectedCategoryIds(), // Get list of category IDs
            catalog_ids: getSelectedCatalogIds(),
            library_ids: Array.from(document.querySelectorAll('.library-checkbox:checked')).map(cb => cb.value),
            group_ids: Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.value)
        };
        console.log('DEBUG: Form submit, selected library_ids:', knowledgeData.library_ids);
        console.log('DEBUG: Form submit, selected group_ids:', knowledgeData.group_ids);

        if (!knowledgeData.name) {
            showFormError('Knowledge name is required.');
            return;
        }

        const url = currentEditId ? `/admin/knowledges/edit/${currentEditId}` : '/admin/knowledges/add';
        const method = 'POST';

        try {
            saveKnowledgeBtn.disabled = true; // Prevent double submission
            const headers = {
                'Content-Type': 'application/json'
            };
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
                headers['X-CSRF-Token'] = csrfToken;
            }

            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(knowledgeData),
                credentials: 'same-origin',
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                console.log('DEBUG: server returned library_ids:', result.sent_library_ids);
                console.log('DEBUG: server returned group_ids:', result.sent_group_ids);
                knowledgeModal.hide(); // Hide modal first
                // showFeedback(result.message || `Knowledge ${currentEditId ? 'updated' : 'added'} successfully.`);

                // Update table
                const returnedKnowledge = result.knowledge; // Backend should return the added/updated item
                if (returnedKnowledge) {
                    if (currentEditId) {
                        updateTableRow(returnedKnowledge);
                    } else {
                         // Remove "No knowledge entries found" row if it exists
                        const noDataRow = knowledgesTableBody ? knowledgesTableBody.querySelector('td[colspan="7"]') : null;
                        if (noDataRow) noDataRow.parentElement.remove();
                        // Add new row
                        const newRow = createTableRow(returnedKnowledge);
                        if (knowledgesTableBody) {
                            knowledgesTableBody.appendChild(newRow);
                        } else {
                             console.error("Table body not found for adding new row.");
                        }
                    }
                } else {
                    // Fallback: Reload if backend doesn't return data (less ideal)
                    console.warn("Backend did not return knowledge data, reloading page.");
                    window.location.reload();
                }

            } else {
                 // Use error message from backend if available
                throw new Error(result.message || `Failed to ${currentEditId ? 'update' : 'add'} knowledge. Status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error saving knowledge:', error);
            showFormError(`Error: ${error.message}`);
        } finally {
             saveKnowledgeBtn.disabled = false; // Re-enable button after request finishes
        }
    }

    // --- Attach Initial Event Listeners ---
    if (addKnowledgeBtn) {
        addKnowledgeBtn.addEventListener('click', handleAddClick);
    } else {
        console.warn("Add Knowledge button not found.");
    }

    if (knowledgeForm) {
        knowledgeForm.addEventListener('submit', handleFormSubmit);
    } else {
         console.error("Knowledge form not found.");
    }

    // Debug: Check if jQuery and table/buttons are present
    console.log('[DEBUG] DOMContentLoaded: jQuery present?', !!window.jQuery);
    const $table = $('#knowledgesTable');

    // Use jQuery event delegation for edit/delete buttons (DataTables compatible)
    if (window.jQuery) {
        $('#knowledgesTable').on('click', '.edit-btn', function (event) {
            handleEditClick(this);
        });
        $('#knowledgesTable').on('click', '.delete-btn', function (event) {
            handleDeleteClick(this);
        });
    } else {
        // Fallback: native event delegation (should not be needed with DataTables)
        const knowledgesTable = document.getElementById('knowledgesTable');
        if (knowledgesTable) {
            knowledgesTable.addEventListener('click', function(event) {
                const editButton = event.target.closest('.edit-btn');
                const deleteButton = event.target.closest('.delete-btn');

                if (editButton) {
                    handleEditClick(editButton); // Pass the specific button element
                } else if (deleteButton) {
                    handleDeleteClick(deleteButton); // Pass the specific button element
                }
            });
        } else {
            console.error("Knowledges table not found for event delegation.");
        }
    }


    // Clear form when modal is hidden
    knowledgeModalElement.addEventListener('hidden.bs.modal', clearForm);

    // --- Catalog Filter Logic ---
    function handleCatalogFilter() {
        const filterValue = catalogFilterInput.value.toLowerCase().trim();
        const catalogCheckboxes = knowledgeCatalogsDiv.querySelectorAll('.form-check');

        catalogCheckboxes.forEach(div => {
            const label = div.querySelector('label');
            const labelText = label ? label.textContent.toLowerCase() : '';
            if (labelText.includes(filterValue)) {
                div.style.display = ''; // Show if matches
            } else {
                div.style.display = 'none'; // Hide if doesn't match
            }
        });
    }

    // Attach filter listener
    if (catalogFilterInput) {
        catalogFilterInput.addEventListener('input', handleCatalogFilter);
    } else {
        console.warn("Catalog filter input not found.");
    }

    // Also clear filter and update display when modal is hidden
    knowledgeModalElement.addEventListener('hidden.bs.modal', () => {
        clearForm(); // This now also calls updateSelectedCatalogsDisplay
        if (categoryFilterInput) {
            categoryFilterInput.value = ''; // Clear category filter
            handleCategoryFilter(); // Reset category filter display
        }
        if (catalogFilterInput) {
            catalogFilterInput.value = ''; // Clear catalog filter
            handleCatalogFilter(); // Reset catalog filter display
        }
        if (libraryFilterInput) {
            libraryFilterInput.value = ''; // Clear library filter
            handleLibraryFilter(); // Reset library filter display
        }
    });

    // Add event listener to the container holding the checkboxes
    if (knowledgeCatalogsDiv) {
        knowledgeCatalogsDiv.addEventListener('change', function(event) {
            // Check if the changed element is one of our catalog checkboxes
            if (event.target.classList.contains('catalog-checkbox')) {
                updateSelectedCatalogsDisplay();
            }
        });
    } else {
        console.warn("Catalog checkboxes container not found.");
    }

    // Add event listener to the container holding the library checkboxes
    // Moved back here from admin-form-utils.js
    if (knowledgeLibrariesDiv) {
        // Fallback: Attach event listener to the document for event delegation
        document.addEventListener('change', function(event) {
            if (
                event.target.classList &&
                event.target.classList.contains('library-checkbox')
            ) {
                setTimeout(() => {
                    updateSelectedLibrariesDisplay();
                }, 0);
            }
        });
    } else {
    }

    // --- Library Filter Logic ---
    function handleLibraryFilter() {
        if (!libraryFilterInput || !knowledgeLibrariesDiv) return;
        const filterValue = libraryFilterInput.value.toLowerCase().trim();
        const libraryItems = knowledgeLibrariesDiv.querySelectorAll('.library-item');
        libraryItems.forEach(item => {
            const label = item.querySelector('label');
            if (!label) return;
            const text = label.textContent.toLowerCase();
            if (text.includes(filterValue)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // --- Category Filter Logic ---
    function handleCategoryFilter() {
        if (!categoryFilterInput || !knowledgeCategoriesDiv) return; // Exit if elements don't exist
        const filterValue = categoryFilterInput.value.toLowerCase().trim();
        const categoryCheckboxes = knowledgeCategoriesDiv.querySelectorAll('.form-check');

        categoryCheckboxes.forEach(div => {
            const label = div.querySelector('label');
            const labelText = label ? label.textContent.toLowerCase() : '';
            if (labelText.includes(filterValue)) {
                div.style.display = ''; // Show if matches
            } else {
                div.style.display = 'none'; // Hide if doesn't match
            }
        });
    }

    // Attach category filter listener
    if (categoryFilterInput) {
        categoryFilterInput.addEventListener('input', handleCategoryFilter);
    } else {
        console.warn("Category filter input not found.");
    }

    // --- Function to update the selected categories display ---
    function updateSelectedCategoriesDisplay() {
        if (!selectedCategoriesDisplay || !knowledgeCategoriesDiv) return;
        const selectedNames = [];
        knowledgeCategoriesDiv.querySelectorAll('.category-checkbox:checked').forEach(checkbox => {
            let label = null;
            if (checkbox.closest('.form-check')) {
                label = checkbox.closest('.form-check').querySelector('label');
            }
            if (!label) {
                label = document.querySelector('label[for="' + checkbox.id + '"]');
            }
            if (label) {
                selectedNames.push(label.textContent.trim());
            }
        });
        if (selectedNames.length > 0) {
            selectedCategoriesDisplay.innerHTML = '<strong>Selected:</strong> ' + selectedNames.map(name =>
                `<span class="badge bg-primary me-1">${name}</span>`
            ).join('');
        } else {
            selectedCategoriesDisplay.innerHTML = `<span class="text-muted">Selected: None</span>`;
        }
    }

    // Add event listener to the container holding the category checkboxes
    if (knowledgeCategoriesDiv) {
        knowledgeCategoriesDiv.addEventListener('change', function(event) {
            // Check if the changed element is one of our category checkboxes
            if (event.target.classList.contains('category-checkbox')) {
                updateSelectedCategoriesDisplay();
            }
        });
    } else {
        console.warn("Catalog checkboxes container not found.");
    }

    // --- Group Filter Logic ---
    function handleGroupFilter() {
        if (!groupFilterInput || !knowledgeGroupsDiv) return;
        const filterValue = groupFilterInput.value.toLowerCase().trim();
        const groupItems = knowledgeGroupsDiv.querySelectorAll('.group-item');
        groupItems.forEach(div => {
            const label = div.querySelector('label');
            const labelText = label ? label.textContent.toLowerCase() : '';
            if (labelText.includes(filterValue)) {
                div.style.display = '';
            } else {
                div.style.display = 'none';
            }
        });
    }

    // Attach group filter listener
    if (groupFilterInput) {
        groupFilterInput.addEventListener('input', handleGroupFilter);
    }

    // Add event listener to the container holding the group checkboxes
    if (knowledgeGroupsDiv) {
        knowledgeGroupsDiv.addEventListener('change', function(event) {
            if (event.target.classList.contains('group-checkbox')) {
                updateSelectedGroupsDisplay();
            }
        });
    }

    // --- AI Description Generation ---
    async function handleGenerateDescription() {
        const nameValue = knowledgeNameInput.value.trim();
        if (!nameValue) {
            showFormError('Please enter a name first to generate a description.');
            return;
        }
        hideFormError(); // Clear previous errors

        const button = generateDescBtn; // Already scoped
        if (!button) {
            console.error("Generate Description button not found in Knowledge modal.");
            return;
        }
        const spinner = button.querySelector('.spinner-border');

        // Show loading state
        button.disabled = true;
        spinner.classList.remove('d-none');

        try {
            // Get selected catalog names
            const selectedCatalogNames = [];
            knowledgeCatalogsDiv.querySelectorAll('.catalog-checkbox:checked').forEach(checkbox => {
                let label = null;
                if (checkbox.closest('.form-check')) {
                    label = checkbox.closest('.form-check').querySelector('label');
                }
                if (!label) {
                    label = document.querySelector('label[for="' + checkbox.id + '"]');
                }
                if (label) {
                    selectedCatalogNames.push(label.textContent.trim());
                }
            });

            const payload = {
                context_text: nameValue,
                item_type: "knowledge base item", // Specific to this page
                deployment_name: "gpt-4o-mini", // Updated deployment name
                catalog_names: selectedCatalogNames // Add selected catalog names
                // No language needed in payload, backend handles it
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
                knowledgeDescriptionInput.value = result.description; // Update the textarea
                // showFeedback('Description generated successfully!', 'success'); // Removed confirmation alert
            } else {
                throw new Error(result.message || `Failed to generate description. Status: ${response.status}`);
            }

        } catch (error) {
            console.error('Error in Knowledge handleGenerateDescription:', error);
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
