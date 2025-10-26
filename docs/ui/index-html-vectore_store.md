

# Vector Store Settings and Their Impact on `index.html`

## Overview of Vector Store Modes

The SmartThing application has three different vector store modes that significantly affect how the user interface in `index.html` functions:

1. **User Mode**: Each user has their own isolated vector store
2. **Global Mode**: All documents share a centralized vector store
3. **Knowledge Mode**: Vector stores are organized by knowledge bases/groups

## Impact on `index.html` UI Components

### 1. Mode-Specific UI Elements

The `index.html` file contains conditional UI elements that appear based on the active vector store mode:

```html
{% if vector_store_mode == 'global' %}
<button
    type="button"
    id="knowledgeGlobalSelectBtn"
    class="btn btn-outline-secondary border-0 bg-transparent d-flex align-items-center justify-content-center position-relative query-input-btn text-primary"
    data-bs-toggle="tooltip"
    data-bs-placement="top"
    title="Centralized vector store is active."
    tabindex="0"
>
    <i class="bi bi-globe fs-5"></i>
</button>
{% endif %}

{% if vector_store_mode == 'knowledge' %}
<div class="dropup" style="z-index: 1001;">
  <button type="button"
          class="btn btn-outline-secondary border-0 bg-transparent d-flex align-items-center justify-content-center position-relative query-input-btn"
          id="knowledgeSelectBtn"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          data-bs-placement="top"
          title="Select knowledge to search"
          tabindex="0">
      <i class="bi bi-journal-bookmark fs-5"></i>
  </button>
  <ul class="dropdown-menu dropdown-menu-sm dropdown-menu-center" id="knowledgeSelectDropdown" aria-labelledby="knowledgeSelectBtn">
      <li><a class="dropdown-item active" href="#" data-knowledge-id="">All Knowledge</a></li>
      {% if knowledges %}
          {% for knowledge in knowledges %}
          <li><a class="dropdown-item" href="#" data-knowledge-id="{{ knowledge.id }}" data-knowledge-name="{{ knowledge.name|e }}">{{ knowledge.name }} </a></li>
          {% endfor %}
      {% endif %}
  </ul>
</div>
{% endif %}
```

### 2. JavaScript Configuration

The vector store mode is passed to the JavaScript environment through a configuration object:

```javascript
window.APP_CONFIG = {
    VECTOR_STORE_MODE: {{ vector_store_mode | default('user') | tojson }}
    // Add VECTOR_STORE_PROVIDER here if needed by JS in the future
};
```

This configuration is then used by the JavaScript code to determine UI behavior and search functionality.

### 3. Knowledge-Libraries Mapping

For the Knowledge mode, the interface also passes a mapping of knowledge bases to libraries:

```javascript
window.__FLASK_KNOWLEDGE_LIBRARIES_MAP = {{ knowledge_libraries_map|default({})|tojson }};
```

This mapping enables the dynamic updating of the library dropdown based on which knowledge base is selected.

## Functional Differences by Mode

### Global Mode (Centralized Vector Store)
- Displays a globe icon (`<i class="bi bi-globe fs-5"></i>`)
- Tooltip indicates "Centralized vector store is active"
- No knowledge or library selection is required - all documents are searched
- The library dropdown still allows filtering results by library

### Knowledge Mode
- Displays a journal/bookmark icon (`<i class="bi bi-journal-bookmark fs-5"></i>`)
- Shows a dropdown for selecting specific knowledge bases
- The library dropdown is dynamically updated based on which knowledge is selected
- Allows users to search within specific knowledge domains

### User Mode (Default)
- No special UI elements for vector store mode
- Only shows the library dropdown, which filters documents within the user's personal vector store
- All searches are limited to the user's own uploaded documents

## JavaScript Code Integration

As mentioned in `knowledge_ui_next_stage.md`, the vector store UI logic is modularized in `static/js/vector-store-ui.js`. This JavaScript file:

1. Initializes UI components based on the vector store mode
2. Handles the dynamic updating of dropdowns
3. Manages the selection state and passes it to the query API

## Setting the Vector Store Mode

The vector store mode is set in the admin interface through:
- `/admin/settings/vector_store` route
- The `settings_vector_store.html` template
- It's stored in the `AppSettings` table with the key `vector_store_mode`

## Technical Implementation Notes

1. The `AppSettings` table stores the vector store mode setting
2. The Flask app loads this setting on startup
3. The mode is passed to templates like `index.html` as a context variable
4. JavaScript components adapt their behavior based on this setting
5. API endpoints filter results according to the mode

## Summary of Impact on User Experience

1. **User Mode**: 
   - Simplest interface - just library selection
   - Each user only sees their own documents
   - Best for privacy-focused deployments

2. **Global Mode**:
   - Globe icon indicates shared knowledge
   - All users share the same document store
   - Best for organization-wide knowledge sharing

3. **Knowledge Mode**:
   - Most complex UI with knowledge + library selection
   - Allows organizational categorization of knowledge
   - Best for team or department-based deployments

The vector store mode setting fundamentally changes how documents are stored, retrieved, and presented in the user interface, making it a critical configuration choice that directly impacts the user experience in `index.html`.