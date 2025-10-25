document.addEventListener('DOMContentLoaded', function() {

    // Helper function to initialize a chart safely
    function initChartSafe(canvasId, chartType, chartOptions) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            // console.warn(`Chart canvas element '${canvasId}' not found.`); // Optional logging
            return; // Exit if canvas not found
        }
        const chartArea = canvas.parentElement; // Get parent for potential messages

        // Retrieve data from the data attribute
        const jsonData = canvas.getAttribute('data-chart-data');
        if (!jsonData) {
            // This case should ideally not happen now with backend defaults, but good to keep
            console.warn(`No data-chart-data attribute found for chart '${canvasId}'.`);
            if (chartArea) { chartArea.innerHTML = '<p class="text-muted small mt-2">Chart data attribute missing.</p>'; }
            return; // Exit if no data attribute
        }

        try {
            // Log the raw data before parsing for debugging
            console.log(`Attempting to parse data for chart '${canvasId}':`, jsonData);
            // Parse the data - this should now work as backend provides valid JSON string
            const parsedData = JSON.parse(jsonData);
            console.log(`Successfully parsed data for chart '${canvasId}':`, parsedData);

            // Get context
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                 console.error(`Could not get 2D context for canvas '${canvasId}'.`);
                 return; // Exit if context cannot be obtained
            }

            // --- Chart specific data processing and initialization ---
            let finalChartData = {};
            let finalChartOptions = chartOptions || {}; // Use passed options or default to empty object

            // Library Reference Distribution Chart
            if (canvasId === 'libraryPieChart') {
                 // Check if data is a valid, non-empty array of pairs
                if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData.every(item => Array.isArray(item) && item.length === 2)) {
                    const libraryLabels = parsedData.map(item => item[0]);
                    const libraryDataPoints = parsedData.map(item => item[1]);
                    finalChartData = {
                        labels: libraryLabels,
                            datasets: [{
                                label: 'References per Library',
                                data: libraryDataPoints,
                                backgroundColor: [
                                    'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)',
                                    'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)',
                                    'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)',
                                    'rgba(199, 199, 199, 0.7)', 'rgba(83, 102, 255, 0.7)',
                                    'rgba(40, 159, 64, 0.7)', 'rgba(210, 99, 132, 0.7)'
                                ],
                                borderColor: [
                                    'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)',
                                    'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)',
                                    'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
                                    'rgba(199, 199, 199, 1)', 'rgba(83, 102, 255, 1)',
                                    'rgba(40, 159, 64, 1)', 'rgba(210, 99, 132, 1)'
                                ],
                                borderWidth: 1
                            }]
                        };
                        finalChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Library Reference Counts' } } };
                } else { // Data is empty array or invalid format
                    console.warn(`Data for chart '${canvasId}' is empty or not a valid array of [label, value] pairs.`);
                    if (chartArea) { chartArea.innerHTML = '<p class="text-muted small mt-2">No library data available to display chart.</p>'; }
                    return;
                }
            }
            // Users per Library Chart
            else if (canvasId === 'userLibraryPieChart') {
                 // Check if data is a valid, non-empty array of pairs
                 if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData.every(item => Array.isArray(item) && item.length === 2)) {
                    const userLabels = parsedData.map(item => item[0]);
                    const userDataPoints = parsedData.map(item => item[1]);
                    finalChartData = {
                        labels: userLabels,
                            datasets: [{
                                label: 'Users per Library',
                                data: userDataPoints,
                                backgroundColor: [
                                    'rgba(54, 162, 235, 0.7)', 'rgba(255, 99, 132, 0.7)',
                                    'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)',
                                    'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'
                                ],
                            }]
                        };
                        finalChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Users per Library' } } };
                } else { // Data is empty array or invalid format
                     console.warn(`Data for chart '${canvasId}' is empty or not a valid array of [label, value] pairs.`);
                     if (chartArea) { chartArea.innerHTML = '<p class="text-muted small mt-2">No user distribution data available.</p>'; }
                     return;
                }
            }
            // File vs URL References Chart
            else if (canvasId === 'fileUrlPieChart') {
                 // Check if data is a valid object and has *some* data
                if (typeof parsedData === 'object' && parsedData !== null && (parsedData.files > 0 || parsedData.urls > 0)) {
                    const fileDataPoints = [ parsedData.files || 0, parsedData.urls || 0 ];
                    finalChartData = {
                        labels: ['Files', 'URLs'],
                            datasets: [{
                                label: 'Reference Types',
                                data: fileDataPoints,
                                backgroundColor: [
                                    'rgba(75, 192, 192, 0.7)', // Teal for Files
                                    'rgba(255, 159, 64, 0.7)'  // Orange for URLs
                                ]
                            }]
                        };
                        finalChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'File vs URL References' } } };
                } else { // Data is empty object, null, or has no counts > 0
                     console.warn(`Data for chart '${canvasId}' is empty or not a valid object with 'files' or 'urls' properties > 0.`);
                     if (chartArea) { chartArea.innerHTML = '<p class="text-muted small mt-2">No file/URL reference data available.</p>'; }
                     return;
                }
            }
            // Knowledge Statistic Chart
            else if (canvasId === 'knowledgeStatsChart') {
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                    const knowledgeLabels = parsedData.map(item => item.name);
                    const fileCounts = parsedData.map(item => item.file_count);
                    const downloadCounts = parsedData.map(item => item.download_count);
                    const libraryCounts = parsedData.map(item => item.library_count);
                    finalChartData = {
                        labels: knowledgeLabels,
                        datasets: [
                            {
                                label: 'Files',
                                data: fileCounts,
                                backgroundColor: 'rgba(54, 162, 235, 0.7)'
                            },
                            {
                                label: 'Downloads',
                                data: downloadCounts,
                                backgroundColor: 'rgba(255, 206, 86, 0.7)'
                            },
                            {
                                label: 'Libraries',
                                data: libraryCounts,
                                backgroundColor: 'rgba(75, 192, 192, 0.7)'
                            }
                        ]
                    };
                    finalChartOptions = {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: true, text: 'Knowledge Statistic' }
                        },
                        scales: {
                            x: { stacked: false },
                            y: { beginAtZero: true }
                        }
                    };
                } else {
                    console.warn(`Data for chart '${canvasId}' is empty or not a valid array.`);
                    if (chartArea) { chartArea.innerHTML = '<p class="text-muted small mt-2">No knowledge statistic data available.</p>'; }
                    return;
                }
            }
            // Add more 'else if' blocks here for other charts if needed
            else {
                 console.warn(`No specific data processing logic found for chart '${canvasId}'. Chart not initialized.`);
                 return; // Don't initialize if no specific logic matches
            }

            // Initialize the chart if we have valid data and options
            let existingChart = Chart.getChart(canvasId);
            if (existingChart) {
                existingChart.destroy();
            }

            new Chart(ctx, {
                type: chartType,
                data: finalChartData,
                options: finalChartOptions
            });
            console.log(`Chart '${canvasId}' initialized successfully.`);

        } catch (e) {
            console.error(`Error processing or initializing chart '${canvasId}':`, e);
            // Display error message in the chart's container
            if (chartArea) {
                chartArea.innerHTML = `<p class="text-danger small">Error displaying chart '${canvasId}'. Check console for details.</p>`;
            }
        }
    }

    // Initialize all charts found on the page
    initChartSafe('libraryPieChart', 'pie', {});
    initChartSafe('userLibraryPieChart', 'pie', {});
    initChartSafe('fileUrlPieChart', 'pie', {});
    initChartSafe('knowledgeStatsChart', 'bar', {});

});
