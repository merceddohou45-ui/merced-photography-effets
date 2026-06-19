# Merced Photography Effects

Merced Photography Effects is a modular, production-ready scaffold for an AI-powered web application that helps photographers and creators automatically generate cinematic videos from photos, videos and music.

This repository contains a foundation with:

- Next.js App Router with TypeScript
- Tailwind CSS configured
- Prisma ORM and schema for core models
- NextAuth authentication placeholders (email/password + Google)
- API route placeholders: /api/upload, /api/projects, /api/export
- Clean folder structure: app, components, lib, prisma, styles
- Basic homepage and dashboard pages
- README with setup instructions and architecture plan

This scaffold intentionally provides structure and placeholders rather than full feature implementations.

Getting started

1. Copy .env.example to .env and set your DATABASE_URL and NEXTAUTH_SECRET (and Google OAuth secrets if needed).

2. Install dependencies:

   npm install

3. Generate Prisma client and run migrations:

   npx prisma generate
   npx prisma migrate dev --name init

4. Seed the database (optional):

   npm run seed

5. Run the development server:

   npm run dev

Architecture and next steps

The project is organized for expansion into these subsystems:

- AI Video Editor: Background worker(s) that run FFmpeg jobs, apply effects, and generate exports.
- Storage: Cloudflare R2 for assets; uploads streamed directly to R2 and metadata stored in Postgres.
- Beat Sync: Music analysis service that extracts BPM/beat times and stores them in MusicTrack metadata.
- Watermark Service: Apply text/image watermarks with position/opacity settings during export.
- Export/Queue: Job queue (Redis + BullMQ or cloud task runner) to manage FFmpeg workflows and scaling.
- Auth & Billing: NextAuth with an eventual adapter to support persisted sessions and Stripe for subscriptions.

Recommended roadmap (phases)

1. Core MVP: upload, project creation, simple FFmpeg export for a single clip + music.
2. Advanced effects: implement cinematic, glitch, transitions pipeline modularly.
3. Beat sync: integrate music analysis and sync edits to detected beats.
4. User features: watermark management, subscription plans, storage management.
5. Performance: background workers, horizontal scaling, CDN, streaming uploads.

Contributing

This repository is a starting point. Please open issues for feature requests, and follow the TODOs in code for next implementation steps.
