// fetchWithCsrfRetry is available globally from csrf-utils.js loaded in base.html

document.addEventListener('DOMContentLoaded', function () {
    const activitiesTable = document.getElementById('visualGroundingActivitiesTable');
    if (activitiesTable && typeof simpleDatatables !== 'undefined') {
        new simpleDatatables.DataTable(activitiesTable, {
            searchable: true,
            fixedHeight: true,
            perPage: 10
        });
    }

    const deleteButtons = document.querySelectorAll('.delete-btn');

    deleteButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const id = button.getAttribute('data-id');
            if (!id) return;

            if (confirm('Are you sure you want to delete this visual grounding activity?')) {
                try {
                    const response = await fetchWithCsrfRetry(`/admin/visual_grounding_activities/delete/${id}`, {
                        method: 'POST'
                    });

                    const result = await response.json();

                    if (response.ok && result.status === 'success') {
                        // Optional: Use SweetAlert if available, otherwise fallback
                        window.location.reload();
                    } else {
                        throw new Error(result.message || 'Failed to delete activity.');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert(`Error deleting activity: ${error.message}`);
                }
            }
        });
    });
});
