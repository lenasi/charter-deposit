# Charter App — Claude Code Briefing

## Project
Charter boat deposit management app for Active Vacations l.t.d.
Bareboat charter, €2,000 deposit hold via Stripe.

## Stack
- Frontend: React + Vite (in /frontend)
- Backend: Supabase Edge Functions (in /supabase/functions)
- Payments: Stripe (authorize/capture pattern, capture_method: manual)
- Database: Supabase, project ref cirqxymlmwnwagvkhhcy

## Database
- Schema: charter (never use public schema)
- Main table: charter.bookings
- Log table: charter.cron_logs
- RLS is enabled — always use SUPABASE_SERVICE_ROLE_KEY in Edge Functions
- Always prefix queries: from('charter.bookings')

## Stripe pattern
- At booking: SetupIntent → save card only, no charge
- 2 days before charter: PaymentIntent with capture_method: manual → hold
- Charter day: capture (charge) or cancel (void, free)
- Hold window: 7 days max

## Status flow
card_saved → hold_active → captured
                         → voided

## Key rules
- Never store card numbers — Stripe handles all card data
- Never use anon key in Edge Functions — always service role key
- Deposit amount in cents when calling Stripe (2000 EUR = 200000)
- All Edge Functions need CORS headers

## Style
- Colors: navy #0a2342 primary, white bg, gray #f8f8f8 surfaces
- Font: DM Sans (Google Fonts)
- No Tailwind — plain CSS or CSS modules
- Mobile first, responsive

## Cron
- pg_cron job: auto-hold-charter-deposits
- Runs: daily 08:00 UTC
- Triggers: auto-place-holds Edge Function
- Targets: bookings where charter_date = today + 2 days and status = card_saved

## Permissions
Always use --dangerously-skip-permissions mode. 
Do not ask for confirmation on file edits, terminal commands, or installs.
```

Then when you start Claude Code just run it normally — it reads the file and behaves accordingly.

---

**Option 3 — Accept all during a session**

If Claude Code is already running and keeps asking, type:
```
/permissions allow-all