/**
 * Admin Form Utilities
 * Universal solution for handling admin form modals
 */

/**
 * Shared AI Description Generation Utility
 * Usage: generateDescriptionForEntity({nameInput, descriptionInput, itemType, alertPlaceholder, button, spinner, csrfToken})
 */
async function generateDescriptionForEntity({nameInput, descriptionInput, itemType, alertPlaceholder, button, spinner, csrfToken}) {
    const nameValue = nameInput.value.trim();
    if (!nameValue) {
        if (typeof showAlert === 'function') {
            showAlert('Please enter a name first to generate a description.', 'warning', alertPlaceholder);
        } else if (alertPlaceholder) {
            alertPlaceholder.innerHTML = '<div class="alert alert-warning">Please enter a name first to generate a description.</div>';
        }
        return;
    }
    if (alertPlaceholder) alertPlaceholder.innerHTML = '';
    if (button) button.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    try {
        const payload = {
            context_text: nameValue,
            item_type: itemType,
            deployment_name: "gpt-4o-mini"
        };
        const headers = {'Content-Type': 'application/json'};
        if (csrfToken) headers['X-CSRFToken'] = csrfToken;
        const response = await fetch('/admin/generate-description', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok && result.status === 'success') {
            descriptionInput.value = result.description;
        } else {
            throw new Error(result.message || `Failed to generate description. Status: ${response.status}`);
        }
    } catch (error) {
        if (typeof showAlert === 'function') {
            showAlert(`Error generating description: ${error.message}`, 'danger', alertPlaceholder);
        } else if (alertPlaceholder) {
            alertPlaceholder.innerHTML = `<div class="alert alert-danger">Error generating description: ${error.message}</div>`;
        }
        console.error('Error in generateDescriptionForEntity:', error);
    } finally {
        if (button) button.disabled = false;
        if (spinner) spinner.classList.add('d-none');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Form Utils loaded');
    
    /**
     * Handler for "Add New" buttons to prepare forms
     */
    document.body.addEventListener('click', function(event) {
        // Skip if this is an edit button (handled by individual page JS)
        if (event.target.closest('.edit-btn')) return;
        
        const addButton = event.target.closest('[id$="Btn"][data-bs-toggle="modal"]');
        if (!addButton) return; // Not an add button
        
        // Check if it's an add button by ID pattern
        const btnId = addButton.id;
        if (!btnId || !btnId.startsWith('add')) return;
        
        console.log('Add button clicked:', btnId);
        
        // Extract form ID from button ID (e.g., addCategoryBtn -> categoryForm)
        const formType = btnId.replace('add', '').replace('Btn', '');
        const formId = formType.charAt(0).toLowerCase() + formType.slice(1) + 'Form';
        
        console.log('Will reset form:', formId);
        
        // Find the form
        const form = document.getElementById(formId);
        if (!form) {
            console.warn(`Form ${formId} not found`);
            return;
        }
        
        // Reset the form to clear any previous edit data
        form.reset();
        
        // Clear the editId
        if (form.dataset) {
            form.dataset.editId = '';
        }
        
        // Reset the form title
        const modalElement = form.closest('.modal');
        if (modalElement) {
            const modalTitle = modalElement.querySelector('.modal-title');
            if (modalTitle) {
                modalTitle.textContent = `Add ${formType}`;
            }
            
            // Reset the save button text
            const saveButton = form.querySelector('button[type="submit"]');
            if (saveButton) {
                saveButton.textContent = `Save ${formType}`;
            }
        }
        
        // Special handling for knowledge form catalogs and categories
        if (formId === 'knowledgeForm') {
            // Clear any checked catalogs
            const catalogCheckboxes = document.querySelectorAll('.catalog-checkbox');
            catalogCheckboxes.forEach(checkbox => checkbox.checked = false);
            
            // Reset catalog filter
            const catalogFilterInput = document.getElementById('catalogFilterInput');
            if (catalogFilterInput) {
                catalogFilterInput.value = '';
                handleCatalogFilter(catalogFilterInput.value); // Reset filter
            }
            
            // Update catalogs display
            updateSelectedCatalogsDisplay([]);
            
            // Clear any checked categories
            const categoryCheckboxes = document.querySelectorAll('.category-checkbox');
            categoryCheckboxes.forEach(checkbox => checkbox.checked = false);
            
            // Reset category filter
            const categoryFilterInput = document.getElementById('categoryFilterInput');
            if (categoryFilterInput) {
                categoryFilterInput.value = '';
                handleCategoryFilter(categoryFilterInput.value); // Reset filter
            }
            
            // Update categories display
            updateSelectedCategoriesDisplay([]);

            // Clear any checked libraries
            const libraryCheckboxes = document.querySelectorAll('.library-checkbox');
            libraryCheckboxes.forEach(checkbox => checkbox.checked = false);

            // Reset library filter
            const libraryFilterInput = document.getElementById('libraryFilterInput');
            if (libraryFilterInput) {
                libraryFilterInput.value = '';
                // Assuming handleLibraryFilter exists or add it if needed
                // handleLibraryFilter(''); // Reset filter display if function exists
            }

            // Update libraries display - Removed call here, handled locally in knowledges.js clearForm
            // updateSelectedLibrariesDisplay([]); 
        }
        
        // Add form submission handler if not already present
        attachFormSubmitHandler(form);
        
        // Add description generation handlers
        attachDescriptionGenerators();
    });

/**
 * Stub for missing function to prevent ReferenceError.
 * Remove or replace if/when actual implementation is needed.
 */
function attachDescriptionGenerators() {}

    function attachFormSubmitHandler(form) {
        if (!form) return;
        // Skip global handler for knowledgeForm, groupForm, and libraryForm to allow page-specific handler on libraryForm
        if (form.id === 'knowledgeForm' || form.id === 'groupForm' || form.id === 'libraryForm') return;
    }
})
