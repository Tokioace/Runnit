# Runnit

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

- Copy `.env.example` to `.env.local` (or `.env`):

```bash
cp .env.example .env.local
```

- Fill in:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

3. Run the app:

```bash
npm run dev
```

The app uses React Router for `/` → `MapScreen`, Tailwind CSS, and Leaflet. Leaflet CSS is imported globally in `src/main.tsx`.