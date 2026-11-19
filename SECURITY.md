# SupportOps AI security

Report suspected security problems privately to the repository owner. GitHub private vulnerability reporting can be enabled by the owner.

Keep database credentials, signing secrets, and provider keys in the server environment or a deployment secret store. Serve production traffic over HTTPS. Restrict access to PostgreSQL and complete first-administrator setup before exposing a new installation.

Outgoing production webhooks can be signed with HMAC-SHA256. Configure `WEBHOOK_SECRET` and validate the `X-SupportOps-Signature` header at the receiving service.
