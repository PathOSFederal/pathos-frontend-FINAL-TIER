This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

\`\`\`bash
npm run dev

# or

yarn dev

# or

pnpm dev

# or

bun dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Desktop Workflows

PathOS also has a desktop shell in `pathos-desktop/`.

**Realtime dev (Next.js + Electron):**
```powershell
cd C:\path\to\fedpath-tier1-frontend
pnpm desktop:dev

cd C:\path\to\fedpath-tier1-frontend\pathos-desktop
pnpm dev
```

See `docs/dev-docs/desktop-workflows.md` for packaged QA and installer flows.

## Local Live Frontend And Backend Integration

PathOS Job Search and Saved Jobs live advisor flows now rely on frontend proxy
routes that call the local backend. The browser does not call USAJOBS directly.

### Frontend env setup

1. Copy `.env.local.example` to `.env.local`.
2. Set `PATHOS_BACKEND_BASE_URL` to your local backend URL.
   Local default: `http://127.0.0.1:8000`
3. Set `PATHOS_BACKEND_API_KEY` to a backend API key accepted by the local
   backend.
4. Restart the Next.js dev server after any env change.

### Backend alignment

- The backend must be running locally at the URL used by
  `PATHOS_BACKEND_BASE_URL`.
- The backend must accept the same key through its `PATHOS_API_KEYS`
  configuration.
- Frontend live proxy routes can fall back to the first value in
  `PATHOS_API_KEYS`, but local frontend setup should prefer
  `PATHOS_BACKEND_API_KEY` so the integration is explicit.

### Local verification

1. Start the backend locally.
2. Start the frontend locally.
3. In Job Search, enter keywords and run `Search`.
4. Confirm the results list comes from live backend-backed search data.
5. Select a Job Search result and confirm the advisor panel evaluates it.
6. Open Saved Jobs and confirm the live stored-job list and evaluation panel
   still load through the frontend proxy routes.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Tier 1 UI/UX Freeze (Frontend Wiring Phase)

As of 12/04/2025, the PathOS Tier 1 UI/UX is functionally complete and considered frozen
for this phase. Future work focuses on:

- State management and data wiring
- Mock API integration
- Responsiveness & accessibility
- Bug fixes and polish

Any major layout or UX changes should be treated as separate design work and tracked
explicitly, not done ad hoc during wiring.
