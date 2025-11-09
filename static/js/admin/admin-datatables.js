$(document).ready(function() {
    console.log('Admin DataTables loaded');

    // Detect current theme
    const isDarkMode = document.body.getAttribute('data-bs-theme') === 'dark';

    // Standard DataTable configuration
    const standardConfig = {
        responsive: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        language: {
            search: "Search:",
            lengthMenu: "Show _MENU_ entries",
            info: "Showing _START_ to _END_ of _TOTAL_ entries",
            emptyTable: "No data available",
            zeroRecords: "No matching records found",
            paginate: {
                first: "First",
                last: "Last",
                next: "Next",
                previous: "Previous"
            }
        },
        stateSave: true,
        dom: '<"row"<"col-sm-6"l><"col-sm-6"f>>' +
             '<"row"<"col-sm-12"tr>>' +
             '<"row"<"col-sm-5"i><"col-sm-7"p>>',
        columnDefs: [
            { targets: 0, visible: false, searchable: false }, // Hide auto-generated No. column
            { orderable: false, targets: -1 } // Disable sorting on Actions column
        ],
        order: [[1, 'asc']], // Sort by Name column (now index 1 after hiding No. column)
        initComplete: function() {
            // Handle empty tables
            const api = this.api();
            if (api.data().length === 0) {
                api.rows().invalidate();
            }
        }
    };

    // Initialize all admin tables with standardized config
    function initializeAdminTables(baseConfig) {
        console.log("Attempting to initialize admin tables...");
        // Common table selectors
        const tables = [
            '#languagesTable',
            // Removed #librariesTable - using basic HTML table instead
            '#catalogsTable',
            '#categoriesTable',
            '#knowledgesTable',
            '#filesTable',
            '#downloadsTable',
            '#messagesTable',
            '#aggFeedbackTable',
            '#userFeedbackTable',
            // Removed #groupsTable - using basic HTML table instead
        ];

        tables.forEach(tableSelector => {
            const table = $(tableSelector);
            
            // Skip initialization for specific tables
            if (tableSelector === '#groupsTable' || tableSelector === '#librariesTable' || 
                tableSelector === '#catalogsTable' || tableSelector === '#categoriesTable' ||
                tableSelector === '#knowledgesTable' || tableSelector === '#languagesTable') {
                console.log(`Skipping DataTable initialization for ${tableSelector}`);
                return;
            }

            if (table.length) {
                // Check if the table is ALREADY a DataTable
                if ($.fn.DataTable.isDataTable(tableSelector)) {
                    console.warn(`DataTable already initialized for ${tableSelector}. Skipping.`);
                } else {
                    // Only initialize if it's not already a DataTable
                    console.log(`Initializing DataTable for ${tableSelector}...`);
                    // Create a copy of the standard config
                    const config = {...baseConfig};

                    // Table-specific customizations
                    if (tableSelector === '#groupsTable') {
                        // Robust configuration with error handling
                        config.deferRender = true;
                        config.destroy = true; // Force clean initialization
                        config.initComplete = function() {
                            const api = this.api();
                            api.rows().invalidate(); // Force rebuild indexes
                        };
                    } else if (tableSelector === '#languagesTable') {
                        config.columnDefs.push({ targets: 2, orderable: true });
                    } else if (tableSelector === '#knowledgesTable') {
                        config.columnDefs.push({ targets: 4, render: data => data ? data : 'N/A' });
                    } else if (tableSelector === '#filesTable') {
                        config.order = [[6, 'desc']];
                    } else if (tableSelector === '#downloadsTable') {
                        config.order = [[8, 'desc']];
                    } else if (tableSelector === '#messagesTable') {
                        config.order = [[2, 'desc']];
                    }

                    // Apply DataTable to the table
                    try {
                        table.DataTable(config);
                        console.log(`Successfully initialized DataTable for ${tableSelector}`);
                    } catch (err) {
                        console.error(`Error initializing DataTable for ${tableSelector}:`, err);
                    }
                }
            } else {
                 // console.log(`Table ${tableSelector} not found on this page.`); // Optional: Log if table doesn't exist
            }
        });
    }

    // Initialize all admin tables with standardized config
    initializeAdminTables(standardConfig);

    // Hook into theme toggle to refresh tables when theme changes
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function() {
            // Wait for theme change to complete
            setTimeout(function() {
                // Destroy all existing DataTables instances before reinitializing
                $('.dataTable').each(function() {
                    if ($.fn.DataTable.isDataTable(this)) {
                        $(this).DataTable().destroy();
                    }
                });
                initializeAdminTables(standardConfig);
            }, 300);
        });
    }
});
