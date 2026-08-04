# Supabase Self-Hosted Template

A monorepo template for self-hosting Supabase on a VPS with a decoupled client application.

## Structure

```
.
├── infra/    # Self-hosted Supabase infrastructure — see infra/README.md
└── app/      # Client application — see app/README.md
```

### `infra/`

Everything needed to run and operate a self-hosted Supabase instance: Docker Compose stack,
Caddy TLS termination, Supabase CLI project, deployment scripts, and GitHub Actions CI/CD.

→ See [infra/README.md](infra/README.md) for local development and deployment instructions.

### `app/`

Place your frontend or backend application here (Next.js, Vue, React Native, etc.).

→ See [app/README.md](app/README.md) for how to connect to the Supabase instance.
