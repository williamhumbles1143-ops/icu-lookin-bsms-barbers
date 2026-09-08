ICU Barber Studio — Barber Portal v0.26.5 Mobile Auth Fix

Replace these three files in the icu-lookin-bsms-barbers GitHub repository:
  /index.html
  /BARBER_LAUNCHER.html
  /assets/supabase-auth.js

What this fixes:
- Mobile Safari stale barber-selection race (Mike opening as Will, etc.)
- Back/forward cache restoring an old barber sign-in modal
- Barber auth session collision with Owner/Client apps on the shared github.io origin
- Transient Safari/Supabase "TypeError: Load failed" requests by retrying network failures
- Reduces unnecessary auth network calls when no barber session exists
- Makes mobile network failures display a useful message after retries

Suggested GitHub commit message:
  Mobile barber auth fix v0.26.5

After GitHub Pages redeploys, on each phone:
1. Close old ICU Barber Studio Safari tabs.
2. Reopen the generic Barber Portal URL.
3. Select the correct barber by name.
4. Sign in.

Do not share or screenshot temporary passwords.
