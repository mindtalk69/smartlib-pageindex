document.addEventListener('DOMContentLoaded', function () {
    const activitiesTable = document.getElementById('visualGroundingActivitiesTable');
    const deleteButtons = activitiesTable ? activitiesTable.querySelectorAll('.delete-btn') : [];

    function showFeedback(message, type = 'success') {
        alert(message);
    }

    deleteButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const id = button.getAttribute('data-id');
            if (!id) return;
            if (confirm('Are you sure you want to delete this visual grounding activity?')) {
                try {
                    const response = await fetch(`/admin/visual_grounding_activities/delete/${id}`, { method: 'POST' });
                    const result = await response.json();
                    if (response.ok && result.status === 'success') {
                        alert(result.message || 'Activity deleted successfully.');
                        window.location.reload();
                    } else {
                        throw new Error(result.message || 'Failed to delete activity.');
                    }
                } catch (error) {
                    alert(`Error deleting activity: ${error.message}`);
                }
            }
        });
    });
});
