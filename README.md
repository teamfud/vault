# fud vault

Per-box credential vault for [team fud](https://fud.team) in Red vs Blue competitions. Blue team members look up, reveal, copy and rotate the passwords for user and service accounts on each box; admins manage users, boxes, bulk import/export and the audit log.

## Features

- **Boxes → credentials**: each credential has a user/service type, service name, username, notes and an encrypted password.
- **Reveal / copy on demand**: list pages never contain plaintext. Revealing (auto-hides after 30s) or copying calls the server, and the access is audited.
- **Rotate with generator**: Strong, Shell-safe (no quotes, `$` or backticks), or Passphrase presets.
- **History and rollback**: every rotation keeps the previous value; any version can be revealed or restored.
- **Audit log**: logins, failed logins, reveals, copies, changes, imports and exports, with user and IP.
- **Artifacts**: upload files (tools, scripts, configs, up to 50 MB), optionally attached to a box. Logged-in users can download them. Files can be made **public** at `https://<vault>/d/<box token>/<filename>`, which works without a login so boxes can fetch them with `curl` or `wget`. Each box has one token and the filename picks the file, so a tool that fetches `<url>` and then `<url>.sig` works. Files with no box (one-off scripts, installers) can be made public too, each at its own `https://<vault>/d/<file token>/<filename>`. Unpublishing kills that link and publishing again makes a new one. Public files can expire after 1h, 6h, 24h or 72h, or stay up until unpublished. Uploading a file with the same name to the same box replaces it after a confirmation, keeping its URL. Every public download is audited.
- **CSV import/export**: dry-run preview, then commit. Existing box + service + username rows are rotated; boxes are created as needed.
- **Accounts**: admins create users (a temporary password is shown once and must be changed at first login). Optional TOTP 2FA per user. Admins can reset passwords/2FA and disable accounts, which kills their sessions immediately.

Roles: **members** can view, reveal, add and rotate credentials, and upload, publish and delete artifacts. **Admins** can also delete, manage boxes and users, import/export and view the audit log.

## Security model

- Secrets and TOTP seeds are encrypted with AES-256-GCM using `VAULT_MASTER_KEY`. Each blob is bound to its row via AAD, so ciphertexts can't be swapped between rows. A database dump alone reveals nothing.
- Passwords use argon2id. Sessions are random 256-bit tokens stored as SHA-256 hashes, in `HttpOnly; Secure; SameSite=Strict` cookies, and expire after 12h.
- Login throttling is per IP and per IP+username, so the red team can't lock blue members out by spraying their usernames.
- Every page and server action re-checks the session and role (`src/lib/auth.ts`). The proxy redirect is only a convenience.
- Artifacts are encrypted with the same key (AAD `artifact:<id>`) and stored in Postgres, so they count toward DB size and backups. Each box's public token, and each public boxless file's own token, is 256 bits and never listed anywhere. Only its hash is used for lookup. Unknown, private and expired files all return the same 404. Invalid tokens are throttled per IP, but missing files under a valid token are not, so a box polling for an optional `.sig` doesn't lock itself out. "New box link" rotates the token, and every old URL on that box stops working. Downloads are always served as `application/octet-stream` attachments with a sandbox CSP, so an uploaded HTML or SVG file can't run on the vault origin.
- Strict security headers: CSP, `frame-ancestors 'none'`, HSTS, `no-store` on app pages.

> ⚠️ **Back up `VAULT_MASTER_KEY` offline before the competition.** If it is lost, every stored secret is unrecoverable. If it leaks along with the database, every secret is exposed. Treat exported CSVs as plaintext secrets.

## Local development

```bash
docker run -d --name vault-pg -e POSTGRES_PASSWORD=vault -e POSTGRES_DB=vault -p 55432:5432 postgres:17
cp .env.example .env          # set DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD
npm run gen-key               # paste into VAULT_MASTER_KEY
npm install
npx prisma migrate dev
npm run dev
```

The first admin is created at boot when the users table is empty (from `ADMIN_USERNAME` / `ADMIN_PASSWORD`, min 12 chars); they must change the password on first login.

```bash
npm test          # unit tests (crypto, generator, CSV, filenames)
npm run typecheck
npm run lint
```

## Deploying on Railway

1. Create a project with a **Postgres** database and a service from this repo.
2. Set the service variables:
   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `VAULT_MASTER_KEY` | output of `npm run gen-key` |
   | `ADMIN_USERNAME` | e.g. `admin` |
   | `ADMIN_PASSWORD` | strong temporary password (≥ 12 chars) |
3. Set the service health check path to `/api/health` and generate a domain. Railpack's Node defaults run `npm run build` and `npm start` (which runs `prisma migrate deploy` before starting).

Keep the service at **one replica**: the login rate limiter is in memory.

## CSV format

```
box,address,os,kind,service,username,password,notes
web01,10.0.1.10,Ubuntu 22.04,user,ssh,root,ChangeMe!1,
web01,10.0.1.10,Ubuntu 22.04,service,mysql,wordpress,wp-db-pass,used by wp-config.php
```

Only `box`, `username` and `password` are required. `kind` is `user` (default) or `service`. Aliases such as `host`, `ip`, `user` and `pass` are accepted.
