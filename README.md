# Kharcha

Personal expense, loan and roommate-split tracker (installable PWA) on Supabase, with a Groq-powered "Ask AI" tab.

## 1. Supabase (free tier)
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/migrations/001_schema.sql` → Run. (Do this *before* signing up in the app, so your default categories are seeded.)
3. Authentication → Providers → Email. For personal use you can turn off "Confirm email".
4. Project Settings → API: copy the **Project URL** and **anon public key**.

## 2. Run the app
```bash
cp .env.example .env     # paste URL + anon key
npm install
npm run dev              # http://localhost:5173
```

## 3. Ask AI (Groq)
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set GROQ_API_KEY=gsk_...    # key from console.groq.com/keys
# optional: npx supabase secrets set GROQ_MODEL=openai/gpt-oss-120b APP_CURRENCY=PKR
npx supabase functions deploy ask-grok
```
The Groq key never reaches the browser. Groq has a free tier with rate limits; each question makes two small calls.

## 4. Deploy free + install on your phone
Push to GitHub → import in Vercel or Netlify (build `npm run build`, output `dist`, set the two `VITE_` env vars). Open the URL in Chrome on Android → ⋮ → **Install app**.

## How the money logic works
- **Personal**: all yours.
- **Split**: friend owes `friend_share` (preset 25/33/50/67/75% or custom). Your real cost = amount − share.
- **Friend owes all**: share = full amount.
- **Reimbursable** (company dinner etc.): paid by you, *not counted as your spending*, and kept out of the roommate split. Listed under "Waiting to be reimbursed" until you tap *Received*.
- **Roommate tab**: running balance (all splits − payments he made), month breakdown by category with the individual items, and "payment received" entries. Payments are rows, so history is never lost.
- **Loans**: each loan is permanent. Returned money is a separate repayment entry (partial supported, over-repayment blocked by a DB trigger). Settled loans stay under the "Settled" filter with the full timeline.

## Ask AI safety
Question → the LLM writes one SELECT over `v_expenses / v_loans / v_settlements / v_friend_balance` → validated in the function and again in `run_readonly_query()` (SECURITY INVOKER, read-only transaction, 4s timeout, 200 rows, no base tables, no CTEs) → your own RLS applies → the LLM phrases the answer from the real rows. The Ask AI tab ("mission control") has a QUERY LOG that shows the SQL used.


## Upgrading to the warm redesign
1. Supabase SQL editor: run `supabase/migrations/002_friend_paid_and_theme.sql` (safe to re-run).
2. Replace `supabase/functions/ask-grok/index.ts`, then `npx supabase functions deploy ask-grok`.
3. `npm install` (Recharts was removed), keep your `.env`, then `npm run dev`.

## Migration 003 (budget + Lahore/Sahiwal)
Run `supabase/migrations/003_spend_targets_and_budget.sql` in the SQL editor, then redeploy `ask-grok`.

## Migration 004 (income)
Run `supabase/migrations/004_income.sql` in the SQL editor, then redeploy `ask-grok`.

## Migration 005 (review flag)
Run `supabase/migrations/005_review_flag.sql` in the SQL editor BEFORE importing from Monefy.

## Migration 006 (settling specific bills)
Run `supabase/migrations/006_settlement_allocations.sql` after 005. It lets a payment be tied to specific bills or a whole month (Roommate -> "SQ paid me" / "I paid SQ"). The app still works without it, but bills cannot be ticked until it is run.

## Migration 007 (starting balance)
Run `supabase/migrations/007_opening_balance.sql` after 006. Optional: it stores the "Starting balance" you can set in Settings. The app works without it.
After this update also redeploy the AI function: `npx supabase functions deploy ask-grok`.
