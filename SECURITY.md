# Security Policy

## Supported Versions

MyAthan Core is pre-1.0 software under active development. Only the latest version on `main` receives security updates.

| Version | Supported |
| ------- | --------- |
| Latest `main` | :white_check_mark: |
| Older commits | :x: |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### Preferred: GitHub Security Advisories

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/My-Athan/core/security/advisories/new). This keeps the report confidential until a fix is available.

### Alternative: Email

If you prefer email, contact the maintainer directly at **security@myathan.com**.

### What to Expect

- **Acknowledgment** within 72 hours
- **Triage and initial assessment** within 7 days
- **Fix for critical issues** within 30 days
- **Coordinated disclosure** after 90 days, or when a fix is released (whichever comes first)

You will be credited in the fix unless you prefer to remain anonymous.

## Security Measures

### Authentication & Authorization

- **Device authentication**: HMAC-SHA256 API keys derived from device MAC address and a server-side salt
- **Admin authentication**: bcrypt password hashing with JWT tokens (24-hour expiry)
- **Role-based access**: Admin-only routes are protected by middleware

### Input Validation

- Zod schemas enforce strict validation on all API endpoints
- Request payloads are validated before reaching business logic

### Rate Limiting

- 100 requests per minute per IP via `@fastify/rate-limit`

### CORS

- Production uses a whitelist of allowed origins
- Development mode allows all origins (not used in production)

### OTA Firmware Integrity

- SHA256 checksums are stored per firmware release
- Devices verify binary integrity before flashing

### Infrastructure

- HTTPS everywhere via Traefik reverse proxy with auto-SSL
- Multi-stage Docker builds for minimal production images
- Daily PostgreSQL backups to Cloudflare R2 (30-day retention)

### CI/CD

- GitHub Actions pipeline: lint, test, build, Docker image
- Dependabot monitors GitHub Actions dependency versions

## Scope

The following are in scope for security reports:

- Authentication or authorization bypasses (JWT, API key validation)
- SQL injection or ORM escaping issues
- Input validation bypasses (Zod schema circumvention)
- Cross-site scripting (XSS) in the PWA or admin dashboard
- CORS misconfigurations exposing APIs to unauthorized origins
- Sensitive data exposure in API responses
- Insecure direct object references (accessing another user's devices)
- OTA pipeline integrity issues (binary tampering, unsigned releases)
- Dependency vulnerabilities with a known exploit path

## Out of Scope

- Rate limiting threshold values (configurable, not a vulnerability)
- Self-hosted instances with misconfigured environment variables
- Denial of service against the VPS (single-server deployment, not hardened against DDoS)
- Social engineering attacks
- Issues in third-party services (Cloudflare, Hostinger, Coolify)
- Vulnerabilities requiring physical access to the server

## Known Limitations

- **npm dependency scanning**: Dependabot is configured for GitHub Actions only, not npm packages. npm dependency updates are currently manual.
- **No WAF**: Single VPS deployment without a Web Application Firewall.
- **No admin 2FA**: The admin dashboard uses password-only authentication.
- **Development fallbacks**: JWT secret and API key salt fall back to random values in development mode. This is intentional for DX and does not affect production.

## Related

For security issues related to the ESP32 firmware, see the [firmware security policy](https://github.com/My-Athan/firmware/blob/main/SECURITY.md).
