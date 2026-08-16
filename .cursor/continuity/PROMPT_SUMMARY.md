# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Studio recommended list must not treat Food/kitchen specialists as Lifestyle fits for the Arab Bank mass mix

## Why `abeer_kittchen` appeared

Creator Match is the broader Egypt Discovery pool. Recommended was Egypt-home + ECI Recommended, then a loose Lifestyle match — Food/kitchen creators tagged Lifestyle (or inferred only from audience text) scored the same as Sports/Entertainment.

## Fix (Dev + Production)

- Kitchen/Food specialists are off-brief for Sports / Lifestyle / Entertainment unless Food is requested
- Rank recommended cards from real creator categories + handle inference (`kittchen` → Food)

After ship: hard-refresh and **re-run Discovery**.

Dev: https://dev.thinkwaymedia.com  
Prod: https://app.thinkwaymedia.com  

Client Workspace is **not** started.
