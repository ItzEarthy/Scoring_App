# Brand & Design Guidelines

## 1. Brand Identity & Tone
*   **Target Audience:** Competitive athletes, casual sports players, and club owners.
*   **Tone of Voice:** Energetic, professional, concise, and encouraging. Avoid overly corporate jargon. Use active verbs (e.g., "Queue up", "Report Score", "Dominate the Leaderboard").
*   **Empty States:** When a user has no data (e.g., no matches played), write engaging copy that prompts them to take action rather than just saying "No data found."

## 2. Color Palette (Tailwind CSS)
*   **Brand Custom Colors (Configured in tailwind.config.ts):**
    *   `bg-brand-base` (#FFF8CF) for the main application background.
    *   `bg-brand-surface` (#FBE6C2) for cards, dialogs, and highlighted containers.
    *   `bg-brand-primary` (#2A7C13) for primary call-to-action buttons and active navigation links.
    *   `text-brand-primary` (#2A7C13) for prominent headings.
    *   `bg-brand-secondary` (#76C457) for secondary buttons, badges, and hover states.
*   **Text:** Use `text-gray-900` for standard body text to ensure high contrast against the light yellow/sand backgrounds.
*   **Semantic Colors (For Match Results):**
    *   Win: `bg-emerald-500`
    *   Loss: `bg-rose-500`
    *   Draw: `bg-amber-500`

## 3. UI/UX Rules
*   **Component Library:** Use `shadcn/ui` for all interactive elements. 
*   **Borders & Radius:** Keep it modern. Use `rounded-lg` or `rounded-xl` for cards and buttons. Use subtle borders (`border-gray-200`) instead of heavy drop shadows.
*   **Spacing:** Use generous padding. Rely heavily on flexbox with `gap-4` or `gap-6` to keep layouts breathing.
*   **Icons:** Use `lucide-react`. Keep icon sizing consistent (usually `w-4 h-4` or `w-5 h-5`).