# Contributing to SupportOps AI

Follow the local setup in [README.md](README.md). Use a separate PostgreSQL database for development. Generate Prisma Client after changing the schema and include a migration for changes that affect stored data.

Keep customer queries scoped to the signed-in customer and staff endpoints scoped to current permissions. Use the existing logger, pagination, and request-validation helpers when extending an API. Update the OpenAPI route when changing an API contract.

Run `npm run lint` and `npm run build` before submitting a change. Keep local environment files and development data outside version control.
