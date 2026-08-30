This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Running with Docker

The whole stack (Postgres + the app, with migrations applied automatically) can be run with Docker Compose:

```bash
cp .env.example .env   # then edit AUTH_SECRET at minimum
docker compose up --build
```

This starts three services:

- `db` — Postgres 16, with data persisted in the `db_data` volume.
- `migrate` — runs `prisma migrate deploy` against `db`, then exits.
- `app` — the production Next.js server (`output: "standalone"`), waits for `migrate` to finish successfully before starting.

The app is served at [http://localhost:3000](http://localhost:3000). To seed sample data into the containerized database:

```bash
docker compose run --rm migrate npx tsx prisma/seed.ts
```

To stop the stack: `docker compose down` (add `-v` to also delete the database volume).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
