# App

Place your frontend or backend application here (Next.js, Vue, React Native, Express, etc.).

---

## Connecting to Supabase

### Local development

Start the local Supabase stack first (`pnpm supabase:start` from `infra/`), then use these values in your app:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `http://localhost:54421` |
| `SUPABASE_ANON_KEY` | Printed by `supabase start` — also in `infra/.env.local` |

The local DB is available directly at `postgresql://postgres:postgres@localhost:54422/postgres` if you need it.

### Production

Use the values set during server setup (found in `<INSTALL_DIR>/docker/.env` on the server):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Value of `API_EXTERNAL_URL` in the server's `docker/.env` |
| `SUPABASE_ANON_KEY` | Value of `ANON_KEY` in the server's `docker/.env` |

---

## Suggested setup

1. Scaffold your app in this directory (e.g. `npx create-next-app@latest .`)
2. Add a `.env.local` (gitignored) with the Supabase connection values above
3. Install the Supabase JS client: `npm install @supabase/supabase-js`
4. Create a client instance:

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```
