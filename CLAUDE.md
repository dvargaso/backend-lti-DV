# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LTI is a full-stack talent tracking system. The backend is a TypeScript Express API with Prisma ORM, and the frontend is a React app styled with Bootstrap. PostgreSQL is the database, run locally via Docker.

## Commands

### Database (run from repo root)
```bash
docker-compose up -d          # Start PostgreSQL container
docker-compose down           # Stop the container
```

### Backend (run from `backend/`)
```bash
npm run dev                   # Start dev server with hot reload (ts-node-dev, port 3010)
npm run build                 # Compile TypeScript to dist/
npm start                     # Run compiled output
npm test                      # Run all Jest tests
npx jest path/to/test.ts      # Run a single test file
npx prisma generate           # Regenerate Prisma client after schema changes
npx prisma migrate dev        # Apply pending migrations
npx prisma db seed            # Seed the database (uses prisma/seed.ts)
```

### Frontend (run from `frontend/`)
```bash
npm start                     # Start React dev server (port 3000)
npm run build                 # Production build to build/
```

## Architecture

The backend follows a clean layered architecture:

```
src/
  index.ts                    # Express app setup, middleware, route registration
  routes/                     # Route definitions (Express Router)
  presentation/controllers/   # HTTP handlers — parse req, call service, send res
  application/services/       # Business logic (no HTTP awareness)
  application/validator.ts    # Input validation rules
  domain/models/              # Domain entity classes (not Prisma models)
```

**Data flow**: Route → Controller → Service → Prisma ORM → PostgreSQL

The domain model layer (`src/domain/models/`) contains plain TypeScript classes representing entities: `Candidate`, `Education`, `WorkExperience`, `Resume`, `Application`, `Interview`, `InterviewFlow`, `InterviewStep`, `InterviewType`, `Position`, `Company`, `Employee`. These are separate from the Prisma-generated types.

**Key backend services:**
- `candidateService.ts` — creates candidates with nested educations/work experiences; retrieves candidates with their full relation graph
- `fileUploadService.ts` — Multer-based CV upload (PDF/DOCX, 10 MB limit), exposed at `POST /upload`

**Prisma schema** lives at `backend/prisma/schema.prisma`. After editing the schema, run `npx prisma migrate dev` (creates a migration) and `npx prisma generate` (updates the client).

The frontend calls the backend at `http://localhost:3010`. CORS is configured in `backend/src/index.ts` to allow `http://localhost:3000` only.

The Prisma client is injected onto `req` as middleware in `index.ts`, making it accessible in all controllers without re-instantiation.

## Environment

Copy `.env` values to configure the database connection. `DATABASE_URL` is constructed from the individual `DB_*` variables and must be set before running Prisma commands.
