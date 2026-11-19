# SupportOps AI

SupportOps AI is the NovaCart customer support workspace. Customers sign in to check orders and deliveries, chat with the AI assistant, request a human, and submit refund or cancellation requests. Staff use the dashboard to manage customers, conversations, tickets, knowledge, and approvals.

## Start locally

Use Node.js 22.12 or later and PostgreSQL 16 or later. Create an empty PostgreSQL database, copy `.env.example` to `.env`, and set `DATABASE_URL` and `JWT_SECRET`. Generate a fresh signing secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open [initial setup](http://localhost:3000/setup) to create the first staff administrator. The database starts empty. Add your actual customer and policy records, and use **Customers ? Portal access** to give a customer a sign-in password. Customers sign in at `/support`.

## Configuration

| Environment variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Server-side secret for signing staff and customer sessions |
| `NEXT_PUBLIC_APP_URL` | Public origin for links, callbacks, and integrations |
| `OPENROUTER_API_KEY` | Optional server-side OpenRouter key |
| `OPENAI_API_KEY` | Optional direct OpenAI credential and embedding access |
| `WEBHOOK_SECRET` | Optional secret for signing outgoing webhooks |
| `CORS_ORIGIN` | Optional allowed origin for cross-origin API requests |

To use OpenRouter, choose **OpenRouter** during setup or in **Settings → AI Configuration**, select a model, and save your API key. GPT-OSS 120B is the default OpenRouter model. A saved OpenRouter key takes precedence over `OPENROUTER_API_KEY`. The environment key also supports existing installations that use the default OpenAI provider without an OpenAI key. Restart the app after changing environment credentials. Set email transport in **Channels**, or pair WhatsApp using **Linked Devices**.

## Orders and approvals

Orders are associated with existing customer records in PostgreSQL. The **Orders** desk shows delivery information and approval history. Refund and cancellation requests remain pending until a staff administrator decides them. Approved decisions update the local order and write an audit entry. Payment and fulfillment changes require connected services.

## Deploy and integrate

For a production process, run `npm run build`, apply migrations with `npx prisma migrate deploy`, and run `npm start`. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin before building. For a local container deployment, set a URL-safe `POSTGRES_PASSWORD` in `.env` and run `docker compose up --build -d`. Compose sets the app's database URL to the included database service.

The Helm chart is in `helm/supportops`. Supply your image repository, PostgreSQL connection, public URL, and a Kubernetes Secret before deploying.

The storefront launcher is served at `/widget/supportops-chat.js`. Use its `data-server` attribute to point to the app origin. The machine-readable API is available at `/api/openapi.json`, and service status is available at `/api/health`. See [API and integration notes](docs/api.md).

Run `npm run lint` and `npm run build` to verify a source checkout. See [LICENSE](LICENSE) for licensing.
