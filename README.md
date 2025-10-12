# Runnit

## Setup

1. Create a `.env` file based on `.env.example` and set:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. Serve via HTTPS (required for geolocation in browsers). For local dev you can use `localhost` over HTTP, or run Vite with HTTPS:

```
npm run dev
```

If your browser still reports insecure context for geolocation, open the app via `https://` or `http://localhost`.

3. Apply SQL in `supabase/` to your Supabase project (SQL Editor):
   - `schema.sql`
   - `duel_functions.sql`

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