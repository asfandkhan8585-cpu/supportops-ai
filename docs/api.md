# SupportOps AI API

Download the OpenAPI definition from `/api/openapi.json`. The staff dashboard also includes an **API Reference** page.

| Route | Purpose |
| --- | --- |
| `/api/auth` | First-administrator setup, staff sign-in, and session status |
| `/api/customer/auth` | Customer session management |
| `/api/customer/chat` | Saved conversations, customer messages, and human handoff |
| `/api/customer/orders` | Customer-scoped order history and approval requests |
| `/api/orders` | Staff order and delivery search |
| `/api/admin/order-approvals` | Staff administrator approval queue |
| `/api/admin/order-approvals/{id}` | Approve or reject a pending request |
| `/api/knowledge/test` | Preview the AI answer and supporting knowledge entries |
| `/api/health` | Database and AI provider status |

Use the staff session cookie for dashboard routes. Routes that support service credentials accept the `X-API-Key` header. The customer portal uses its own session cookie.

Existing installations must sign in again after the session cookie name changes. Update external integrations to load `/widget/supportops-chat.js` and read the `X-SupportOps-Signature` header on signed webhooks.
