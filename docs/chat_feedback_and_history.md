# Chat Feedback & History System – Robust, Scalable Design

## Overview

This document describes the architecture and best practices for enabling robust feedback (like/dislike) on all agent messages in the chat interface, including support for paginated or lazy-loaded chat history. This ensures users can provide feedback on any answer, even after a page reload or when browsing past conversations, while maintaining performance and scalability.

---

## System Goals

- **Feedback on All Messages:** Users can like/dislike any agent answer, not just the latest.
- **Persistence:** Feedback works after reloads and when viewing history.
- **Performance:** Chat history is paginated/lazy-loaded to avoid loading thousands of messages at once.
- **Security:** Feedback is only allowed on messages the user is authorized to see.

---

## Backend: API & Data Structure

### API Endpoint

- **Endpoint:** `/api/history`
- **Method:** `GET`
- **Parameters:** `page`, `per_page` (for pagination)
- **Response:**
  ```json
  {
    "success": true,
    "history": {
      "2025-04-20": [
        {
          "message_id": 123,
          "role": "agent",
          "message_text": "Here is your answer...",
          "timestamp": "2025-04-20T12:34:56Z",
          "citations": [...],
          "usage_metadata": {...},
          "suggested_questions": [...]
        },
        {
          "message_id": 124,
          "role": "user",
          "message_text": "What is VKTR?",
          "timestamp": "2025-04-20T12:34:00Z"
        }
      ],
      ...
    },
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total_pages": 5,
      "total_messages": 100
    }
  }
  ```
- **Key Requirement:** Every agent message must include a unique `message_id`.

### Database

- **Table:** `message_history`
- **Fields:** `message_id`, `user_id`, `role`, `message_text`, `timestamp`, etc.
- **Feedback Table:** `message_feedback` (links `message_id` and `user_id` to feedback type)

---

## Frontend: Rendering & Feedback Logic

### Rendering

- When loading chat history, render each agent message with its `message_id` as a `data-message-id` attribute on the DOM element (e.g., `<li>`).
- Feedback buttons (like/dislike) are attached to each agent message and use the `message_id` for API calls.

### Feedback Submission

- When a user clicks like/dislike, send a POST to `/api/message_feedback` with:
  - `message_id`
  - `feedback_type` ("like" or "dislike")
- The backend records or updates the feedback and returns updated counts.

### Pagination/Lazy Loading

- Only load a limited number of messages at a time (e.g., 20).
- Provide "Load More" or infinite scroll to fetch older messages.
- Each batch includes `message_id` for all agent messages.

---

## Performance & Scalability

- **Pagination:** Always use pagination for chat history APIs.
- **Archiving:** For very large datasets, consider archiving old messages to a separate table or database.
- **Frontend:** Never load the entire history at once; always fetch in batches.

---

## Security & Privacy

- Ensure that `message_id` values cannot be used to access messages from other users (enforce user/session checks on all APIs).
- Do not expose internal or sensitive metadata in API responses.

---

## Example UI Flow

1. User opens chat: latest 20 messages are loaded, each with `message_id`.
2. User scrolls up: next 20 messages are fetched and rendered.
3. User clicks like/dislike on any agent message: feedback is sent using the correct `message_id`.
4. Feedback counts are updated in real time.

---

## FAQ

**Q: What if a message has no `message_id`?**  
A: Feedback will not work for that message. Always ensure the backend includes `message_id` for every agent message.

**Q: How do we handle very large histories?**  
A: Use pagination and/or archiving. Never load all messages at once.

**Q: Is feedback visible to other users?**  
A: Only if designed that way. By default, feedback is per-user, but aggregate counts can be shown.

---

## Change Log

- 2025-04-21: Initial documentation for robust feedback and paginated chat history.
