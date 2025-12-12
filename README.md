# Organization Management Service

Multi-tenant backend built with Node.js and Express. Each organization gets an isolated MongoDB database with admin authentication via JWT tokens. Designed for clean, scalable SaaS architectures.

## Quick Start

### Local Setup
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Set required env vars
# - MONGO_URL: MongoDB connection string
# - JWT_SECRET_KEY: Random secret for token signing

# Start server
npm start

# For development with auto-reload
npm run dev
```

### Docker Setup
```bash
# Using docker-compose (includes MongoDB)
docker-compose up
```

### Seed Sample Data
```bash
npm run seed
# Creates a sample organization with credentials:
# Email: admin@sample.com
# Password: sample_password_123
```

## API Endpoints

- `POST /org/create` – Create organization (email, password required)
- `GET /org/get?organization_name=...` – Fetch org metadata
- `PUT /org/update` – Update admin credentials (requires auth token)
- `DELETE /org/delete?organization_name=...` – Delete org and its database (requires auth)
- `POST /admin/login` – Authenticate admin, returns access + refresh tokens
- `POST /auth/refresh` – Get new access token from refresh token
- `GET /admin/verify-token` – Check if token is valid (requires auth)
- `GET /health` – Health check

## Architecture

- **DatabaseManager (singleton)**: Manages MongoDB connections; creates/drops per-org databases.
- **Services (class-based)**: `OrganizationService`, `AuthService` contain business logic.
- **Validators**: Joi schemas validate all request payloads; returns structured error messages.
- **Auth**: JWT tokens (15min access, 7d refresh); bcryptjs password hashing (cost 12).
- **Logging**: Winston structured logging with timestamp, level, message, metadata.
- **Rate limiting**: 5 requests/15min on `/admin/login` and `/org/create`.
- **Security**: Helmet middleware, input validation, non-root Docker user.

## Example Usage

```bash
# 1. Create organization
curl -X POST http://localhost:8000/org/create \
  -H "Content-Type: application/json" \
  -d '{
    "organization_name": "Acme Inc",
    "email": "admin@acme.com",
    "password": "MySecurePass123"
  }'

# 2. Admin login (get tokens)
curl -X POST http://localhost:8000/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "MySecurePass123"
  }'
# Response: { "access_token": "...", "refresh_token": "...", "expires_in": 900 }

# 3. Get organization (with token)
curl -X GET "http://localhost:8000/org/get?organization_name=Acme%20Inc" \
  -H "Authorization: Bearer <access_token>"

# 4. Refresh access token (when expired)
curl -X POST http://localhost:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "admin_id": "<admin_id>",
    "refresh_token": "<refresh_token>"
  }'

# 5. Delete organization
curl -X DELETE "http://localhost:8000/org/delete?organization_name=Acme%20Inc" \
  -H "Authorization: Bearer <access_token>"
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## Code Quality

```bash
# Run linter
npm run lint
```

## Files

- `src/server.js` – Express app setup, middleware, connection
- `src/routes.js` – All endpoints with auth + validation
- `src/services.js` – Business logic (organizations, auth)
- `src/auth.js` – Password hashing, token creation/verification
- `src/database.js` – MongoDB connection management
- `src/config.js` – Environment config
- `src/validators.js` – Joi schema definitions
- `src/logger.js` – Winston logger setup
- `scripts/seed_master_db.js` – Seed sample data
- `Dockerfile` – Non-root container image
- `.env.example` – Environment template
- `.github/workflows/ci.yml` – CI pipeline (tests on push)

## Design Decisions

**One DB per organization**: Ensures complete data isolation. A SQL injection in org A cannot leak org B's data. Simple cleanup—drop the database and everything's gone.

**JWT + refresh tokens**: Stateless authentication scales horizontally. Short-lived access tokens (15min) limit exposure if compromised. Refresh tokens (7d) reduce login frequency.

**Class-based services**: Static methods in service classes make dependencies explicit and code easy to unit test. DatabaseManager is a singleton to avoid multiple connections.

**Structured logging**: Winston logs include timestamps, error stacks, and request metadata for production debugging without verbose console.log.

## If More Time...

1. **Audit logging**: Track all org creates/deletes with user + timestamp in a separate audit collection.
2. **Bulk operations**: Batch create/update endpoints for teams managing hundreds of orgs.
3. **Webhooks**: POST to configured URLs on org events (create, delete, admin changed).
4. **Fine-grained RBAC**: Support multiple admins per org with different scopes (read-only, invite members, etc.).

## License

MIT
