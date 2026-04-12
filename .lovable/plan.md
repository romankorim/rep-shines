

# Plan: Performance audit and code cleanup

## Root causes identified

### 1. Auth middleware creates a new Supabase client + calls `getUser()` on EVERY server function call
The `requireSupabaseAuth` middleware (line 51) calls `serverSupabase.auth.getUser(token)` which makes a network request to the auth server on every single server function invocation. When navigating to the dashboard, this happens at least once. When navigating between pages, each route's loader triggers another `getUser()` call. This is the primary bottleneck.

### 2. Redundant data fetching across routes
- `getDashboard` fetches reps, deals, and quota_tiers
- `getReps` fetches reps, deals, and quota_tiers (same data)
- `getDeals` fetches deals and reps
- `getCompPlans` fetches plans, tiers, quota_tiers, and reps

Every page navigation re-fetches overlapping datasets from the database. The TanStack Query cache helps on the client, but each server function still runs independently.

### 3. `createDeal` / `updateDeal` make 4-5 sequential DB queries
These functions query comp_plans → comp_tiers → reps → deals → quota_tiers sequentially instead of parallelizing where possible.

### 4. Landing page imports `framer-motion` — heavy bundle for a single page
The 429-line landing page imports the full `motion` component from framer-motion, adding significant JS to the initial bundle.

## Changes

### 1. Cache auth validation to avoid repeated `getUser()` calls
**File: `src/integrations/supabase/auth-middleware.ts`**
- Instead of calling `getUser(token)` every time, decode the JWT locally to extract user ID and expiry, then only call `getUser()` if the token needs full validation (e.g., first request). Since the token is already verified by the Supabase client and passed as a Bearer token, we can trust the JWT claims for most operations.
- Use a simple in-memory Map with token → user data, TTL of 60 seconds. This avoids the auth roundtrip on rapid page navigations.

### 2. Parallelize sequential queries in `createDeal` and `updateDeal`
**File: `src/lib/server-functions.ts`**
- In `createDeal`: fetch comp_plan + rep + existing deals + quota_tiers in parallel with `Promise.all` instead of 4 sequential awaits (lines 110-142)
- In `updateDeal`: same pattern — fetch existing deal, comp_plan, rep, other deals, and quota_tiers with fewer sequential rounds (lines 282-324)

### 3. Deduplicate `formatCurrency` helper
**File: `src/lib/format-utils.ts`** (new)
- Extract the repeated `formatCurrency` function (duplicated in dashboard.tsx, deals.tsx, reps.index.tsx) into a shared utility
- Update all three files to import from the shared module

### 4. Optimize landing page bundle
**File: `src/routes/index.tsx`**
- Replace `framer-motion` `motion` components with CSS animations (the project already has `animate-fade-in` defined in styles.css)
- Remove the `framer-motion` dependency from `package.json` if no other file uses it
- This reduces the landing page JS bundle significantly

### 5. Remove stale `tailwind.config.ts` reference
The dev logs show repeated errors: `Could not resolve "/dev-server/tailwind.config.ts"`. This file doesn't exist (the project uses Tailwind v4 with CSS-based config). This causes a build warning on every restart.
**File: check if any config references `tailwind.config.ts`** and remove the reference.

## File summary

| File | Change |
|---|---|
| `src/integrations/supabase/auth-middleware.ts` | Add in-memory token cache to skip repeated `getUser()` calls |
| `src/lib/server-functions.ts` | Parallelize sequential DB queries in `createDeal` and `updateDeal` |
| `src/lib/format-utils.ts` | New shared `formatCurrency` utility |
| `src/routes/_authenticated/dashboard.tsx` | Import shared `formatCurrency` |
| `src/routes/_authenticated/deals.tsx` | Import shared `formatCurrency` |
| `src/routes/_authenticated/reps.index.tsx` | Import shared `formatCurrency` |
| `src/routes/index.tsx` | Replace framer-motion with CSS animations |
| `package.json` | Remove `framer-motion` if unused elsewhere |

## Technical details
- The JWT token cache uses a `Map<string, { user, expiry }>` cleared after 60 seconds. This is safe because the token itself is cryptographically signed — if it's valid, the claims are trustworthy.
- `Promise.all` on the DB queries in `createDeal` reduces 4 sequential network hops to 2 (first round: plan + rep + existing deals + quota_tiers, second round: the insert).
- CSS `@keyframes` already exist in `styles.css` for fade-in animations, so removing framer-motion requires only swapping `<motion.div>` for `<div className="animate-fade-in">` with appropriate delays via `animation-delay` style props.
- The `tailwind.config.ts` error is cosmetic but adds noise to logs; removing any stale reference cleans up the dev experience.

