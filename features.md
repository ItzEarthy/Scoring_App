# Planned Features / UX Improvements

Selected from the UX review on 2026-09-04. These are approved for build — not yet implemented.

## 1. Post-signup onboarding flow
Guide new users through picking sports, joining or creating their first org, and setting an avatar instead of dropping them on an empty dashboard.

## 2. Player profile pages
Clickable player names across leaderboards, queues, and match history leading to a profile: rating history, match log, head-to-head record vs. other players.

## 3. Account settings page
Change password, upload/crop avatar, manage notification preferences — a self-service settings page separate from org admin settings.

## 4. OAuth login
Add Google/Discord (or similar) login options alongside credentials auth to lower signup friction. `@auth/prisma-adapter` already supports this.

## 5. Empty-state dashboard
Replace the blank dashboard for new users with clear "next step" CTAs (join an org, queue up, complete profile).

## 7. Build out Pool / Free-for-all matchmaking modes
These are currently configurable in org settings but render "not available yet." Needs real implementation — full build-out, not a stub removal.

## 8. Queue position / estimated wait time
Show players where they are in line and a rough wait estimate while queued.

## 9. Match reasoning visibility
Show why a match was made — preferred opponents / skill-range matching context — instead of a black-box pairing.

## 10. Location check-in + ready-up auto-queue system
A global system: player checks into a physical location, hits "ready," and is automatically added to the relevant queue(s) — no manual per-sport/per-org queue navigation needed. Goal is a seamless, low-friction flow, not a chore. This likely needs:
- A location/venue model (or reuse of org settings if orgs map 1:1 to locations)
- A "ready" state per player tied to check-in
- Auto-enrollment into the correct queue(s) based on location + player's eligible sports
- Auto-removal from queue on check-out / un-ready

## 12. Match history page with filters
Filterable by sport, org, date range, win/loss — currently no dedicated history view exists.

## 13. Post-match summary screen
Show rating delta, win/loss streak, leaderboard movement ("you moved up 3 spots") right after a match ends.

## 14. Spectator mode polish
Shareable read-only match link for non-participants to follow a live match.

## 16. Player-initiated disputes
Let players raise a dispute with a reason/comment, not just admins reacting to ambiguous scores.

## 17. Manual score override for admins
Admins should be able to manually correct/override a reported score, not just accept-the-algorithmic-winner or void the match. **Ratings must be recalculated/updated correctly** when an override changes the outcome — this needs to hook into the existing Glicko-2/OpenSkill rating update path rather than bypass it.

## 18. Visible dispute audit trail
Show who changed what and when on a disputed match.

## 19. Search/filter on org and member lists
The org directory and member lists currently render full unfiltered lists.

## 20. Private orgs with invite codes/links
Replace (or supplement) the flat public join list with private orgs joinable via invite code or link.

## 21. Leave-organization flow
No way to leave an org currently exists in the UI.

## 22. Org activity feed
New members, recent match results, rating milestones surfaced on the org home page.

## 23. Head-to-head / rivalry stats
Stats between two specific players, likely surfaced from the player profile page (#2).

## 24. Dark mode toggle
Dark theme CSS already exists per `DESIGN.md`; just needs an in-app toggle wired up.

## 25. Loading skeletons across all major routes
Currently only one route (`orgs/[orgId]`) has a `loading.tsx`. Extend to dashboard, matches, queue, etc.

## 27. Better mobile tab bar
Add Matches and Profile as first-class tabs alongside Dashboard/Orgs/Admin.

## 28. Leaderboard pagination/search
For orgs with large member counts, the leaderboard needs pagination and/or search.
