# Brand & Design Guidelines

## 1. Brand Identity & Tone
*   **Concept:** Retro varsity / collegiate athletics — the look of a letterman jacket, a vintage scoreboard, and a sports pennant, executed with a clean, modern UI underneath.
*   **Target Audience:** Competitive athletes, casual sports players, and club owners.
*   **Tone of Voice:** Energetic, professional, concise, and encouraging. Avoid overly corporate jargon. Use active verbs (e.g., "Queue up", "Report Score", "Dominate the Leaderboard").
*   **Empty States:** When a user has no data (e.g., no matches played), write engaging copy that prompts them to take action rather than just saying "No data found."
*   **Platform focus:** The player-facing surfaces (dashboard, orgs, matches) are designed mobile-first — a fixed bottom tab bar replaces the top nav below `sm`. Org/site admin screens are desktop/tablet-first (dense tables, multi-column grids) since they're primarily used on larger screens.

## 2. Color Palette
All colors are CSS custom properties defined in `app/globals.css` (`:root` for light, `.dark` for dark mode) and re-exposed as Tailwind v4 theme tokens via the `@theme inline` block — never hardcode hex values or Tailwind's default gray/white palette in components.

*   **Brand tokens:**
    *   `bg-brand-base` / `text-brand-base` (`#F6EFD8`, parchment cream) — page background.
    *   `bg-brand-surface` (`#EEE0B5`, deeper cream/gold) — highlighted cards (forms, empty states, featured content).
    *   `bg-brand-primary` / `text-brand-primary` (`#1F4B33`, deep varsity green) — headers, primary actions, headings.
    *   `bg-brand-secondary` / `text-brand-secondary` (`#D6A531`, mustard gold) — accents, badges, active nav state.
    *   `--brand-primary-dark` / `--brand-secondary-dark` — darker variants for hover/pressed states.
*   **Semantic tokens** (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--destructive`, etc.) are wired to the brand palette, so shadcn/base-ui components (`Button`, `Badge`, `Card`, `Input`...) pick up the theme automatically — use the plain component defaults instead of overriding with `bg-brand-primary text-white` on every call site.
*   **Text:** Use `text-foreground` / `text-muted-foreground` for body text — never `text-gray-900` or other hardcoded Tailwind grays, which won't adapt to dark mode.
*   **Semantic Colors (For Match Results):** unchanged, kept independent of the brand palette so results stay legible regardless of theme.
    *   Win: `bg-emerald-500`
    *   Loss: `bg-rose-500`
    *   Draw: `bg-amber-500`
*   **Dark mode:** `.dark` flips the palette — deep green-black background with gold as the primary accent (a "night scoreboard" look) — already wired in `globals.css`, though no in-app theme toggle exists yet.

## 3. Typography
Three font families, all loaded via `next/font/google` in `app/layout.tsx`:

*   `font-heading` (Oswald) — page titles, section headings, `CardTitle`, `Button`, `Badge`, table headers. Always paired with `uppercase tracking-wide`.
*   `font-display` (Bebas Neue), used via the `.scoreboard` utility class (`app/globals.css`) — big numeric displays only: player ratings, match scores. Adds `tabular-nums` so digits align.
*   `font-sans` (Geist, default) — body copy, form labels/inputs, descriptions. Never uppercase this one; it's the readable workhorse font.

## 4. UI/UX Rules
*   **Component Library:** Use the `components/ui/*` primitives (built on `shadcn`/`@base-ui/react`) for all interactive elements — don't reintroduce ad hoc styling at the page level for things they already handle (border, radius, focus states).
*   **Borders & Radius:** Chunkier and more deliberate than a typical SaaS UI — `border-2` on cards, inputs, dialogs, and dropdowns; base `--radius` is `0.45rem` (tighter than default shadcn), scaled up via the existing `--radius-lg` / `--radius-xl` tokens. Don't reach for `border-gray-200` — use `border-border`.
*   **Motifs:**
    *   `.stripe-bar` (`app/globals.css`) — a repeating diagonal green/gold stripe, used as a ribbon accent under headers, hero sections, and footers. Use sparingly, at most once per screen.
    *   Card top surfaces distinguish "featured" content (`bg-brand-surface`) from neutral content (`bg-card`, the default) — keep that distinction when adding new cards instead of defaulting everything to one or the other.
*   **Buttons:** default variant is now the brand green with cream text out of the box (`--primary` = brand green) — don't hardcode `bg-brand-primary text-white` on `Button` instances; just use the component defaults or `variant="secondary"`/`"outline"`/etc.
*   **Spacing:** Use generous padding. Rely heavily on flexbox with `gap-4` or `gap-6` to keep layouts breathing.
*   **Icons:** Use `lucide-react`. Keep icon sizing consistent (usually `w-4 h-4` or `w-5 h-5`).
*   **Mobile nav:** `app/(player)/mobile-tab-bar.tsx` is a client component (`usePathname` for active-state) rendered from `app/(player)/layout.tsx`, visible only below `sm`. Any new top-level player section should get an entry here, mirrored in the desktop top nav.
