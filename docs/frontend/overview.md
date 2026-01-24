# Frontend Overview

The frontend is a single-page React app with a primary `App.tsx` and supporting components.

## Structure
- `App.tsx`: main UI, viewer logic, workspace, auth
- `App.css`: global styles and animations
- `components/ChatSidebar.tsx`: chat drawer
- `components/ChatPanel.tsx`: full chat view

## Environment variables
- `VITE_API_BASE_URL`
- `VITE_AUTH_BASE_URL`
- `VITE_AUTH_REQUIRED`

## Main UI sections
- Model selection
- Upload and preview
- Segmentation run and results
- 2D/3D viewer
- Report analysis panel
- Chatbot sidebar

## Auth gating
When auth is required, the app blocks access until:
- Token is valid
- Email is verified

## Chat UI behavior
- The sidebar chat opens as a slide-in drawer with a canned welcome message.
- The chat panel provides a full-page chat layout with a larger welcome state and richer styling.
- Both use the same `/api/chat` endpoint and send a short history window (last 6 messages).
- The frontend always requests `top_k=4` and renders citations when returned.
- Sources are expandable per response and shown with score and file path.
- Suggested questions appear when the chat history is empty.

### Chat request details
- Payload includes `query`, `history`, and `top_k`.
- Each history entry includes `{ role, content }`.
- Errors are rendered inline as assistant messages.
