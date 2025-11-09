# Modal Stacking Order Fix

## Problem
Modal content is overlapped by `.self-retriever-context` and `.self-retriever-questions-grid` due to stacking context issues, even with high z-index values.

## Solution

**Update CSS as follows:**

```css
/* Ensure modal and its overlay are always on top */
.modal-content, .modal-body, .modal-backdrop {
  position: fixed !important;
  z-index: 9999 !important;
}

/* Self-retriever elements should have lower z-index */
.self-retriever-context,
.self-retriever-questions-grid {
  position: relative !important;
  z-index: 2000 !important;
}
```

**Notes:**
- If `.self-retriever-context` or its parent uses `position: fixed` or `absolute`, consider changing to `relative` or ensure its z-index is lower than the modal.
- If using Bootstrap, `.modal-backdrop` may need `z-index: 9998` to ensure it sits just below `.modal-content`.

## Implementation Steps
1. Apply the above CSS changes in `static/css/chat.css` and any other relevant CSS files.
2. Test by rendering both modal and self-retriever elements to confirm modal is always on top.
