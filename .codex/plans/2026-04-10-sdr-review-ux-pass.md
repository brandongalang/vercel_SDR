## SDR Review UX Pass

### Goal
Make the prototype feel like a natural SDR work surface for reviewing AI-generated first-touch messages for leads that already exist in the workflow, while adding a dedicated analytics surface that proves the system is outperforming the static-template baseline.

### Scope
- Re-ground the interaction around existing leads coming from upstream systems rather than agent-led contact discovery.
- Keep the draft and decision central, with one compact explanation of the chosen perspective visible above the fold.
- Push deeper research and reasoning behind lighter disclosure layers instead of showing everything at once.
- Reframe approval language around human review, with downstream send as a secondary consequence.
- Replace implausible mock signals with believable lead-enrichment inputs such as lead source, product activity, hiring, launches, leadership posts, and event context.
- Reduce crowding in the main review area so the draft is easier to read above the fold.
- Add a separate analytics surface for clean accepts, edited accepts, archives, and weekly response-rate comparisons against the static-template baseline.

### Planned Changes
1. Add a top-level switch between the lead-review workspace and a dedicated analytics page.
2. Replace the slide-out insights pattern with an analytics surface focused on clean accepts, edited accepts, archives, and weekly response-rate trends versus the static baseline.
3. Keep the draft primary and visible above the fold, with deeper evidence available only on demand.
4. Remove stale contact-search and repo-heavy signal framing from the visible mock experience.
5. Update the mock data to reflect believable lead-enrichment signal pairs for outbound messaging.

### Verification
- `npm run lint`
- `npm run build`
- Visual browser check of the review workspace and dedicated analytics tab
