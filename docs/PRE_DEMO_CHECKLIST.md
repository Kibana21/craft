# Pre-Demo Checklist

Run through this **30 minutes before** any live demo. Items take ~10 min total. Built after the AIA demo where projects appeared empty mid-presentation — most of those failure modes are now structurally fixed, but this checklist exists so the ones we couldn't fully eliminate (infra dependencies) don't bite us.

---

## 1. Backend stable mode

```bash
make backend-demo          # NOT make backend — that uses --reload
```

Why: `--reload` restarts uvicorn on every `.py` save. A stray edit during the demo kills every in-flight HTTP request.

**Then**: don't open backend code in the IDE during the demo. Editor-on-save can still reformat / lint / autoindent.

---

## 2. Infrastructure up

```bash
docker-compose up -d           # Postgres + Redis
docker-compose ps              # confirm both "Up"
psql -d craft_db -c "SELECT 1" # confirm Postgres reachable
redis-cli ping                 # expect PONG
```

If Postgres is down → every API call returns 500.
If Redis is down → leaderboard/quotas fail open silently; poster generation polling still works (writes go to DB).

---

## 3. AI credentials present

```bash
ls backend/video-key.json      # for Vertex AI / Veo
echo $GOOGLE_API_KEY           # for Gemini text + image
```

Missing key → `app/main.py:lifespan` logs a WARN, app still boots, but the first generation request fails. Ugly during a demo.

---

## 4. Migrations + seed

```bash
make migrate                   # idempotent; safe to re-run
make seed                      # 8 test users + brand kit + compliance rules
```

Default test login (everybody): `sarah.lim@example.com / craft2026`. (Don't screenshare the source — password is hardcoded in `scripts/seed.py`.)

---

## 5. Clean leftover uploads

```bash
make clean-uploads
```

Removes `backend/uploads/poster-variants/*` and `backend/uploads/studio/*`. Old test images otherwise show up in the gallery views. Keep the source uploads (`backend/uploads/photos/`, etc.) — they're referenced by seeded data.

---

## 6. Worker running

```bash
make worker                    # in a third terminal
```

Listens on `video,poster,studio,celery` queues. Without it, the user dispatches a generation and it sits in `QUEUED` forever.

---

## 7. Smoke the golden path manually

In the browser, log in as `sarah.lim@example.com`:

1. `/home` → see Personal Projects tab populated (seed data).
2. Click any project → artifacts tab renders artifacts.
3. Click an artifact → detail page renders (or wizard opens, depending on type).
4. `/my-studio` → upload one PNG → confirm thumbnail appears within 2s.
5. (Optional) Trigger an enhancement: click ⚡ on the uploaded image → Make Professional → Continue → wait for generated output.

If any of these blanks out: **STOP**. Investigate before going live.

---

## 8. Browser sanity

- Hard-reload (`⌘⇧R`) once on `/home` to bust any stale dev cache.
- Open browser DevTools Console — verify zero red errors.
- Close other tabs that might OAuth-redirect or share localStorage.

---

## 9. Screen-share discipline

- Share the **browser window only**, not the whole desktop. Terminals can leak the seed password.
- Close any IDE windows that have backend Python files open (IDE auto-formatters can trigger reload if `--reload` ever sneaks back in).

---

## 10. Recovery paths

If something does break mid-demo:
- **Empty list** → click another tab + back, or hard-reload. The TanStack Query retry will refetch.
- **Stuck spinner on generation** → check the worker terminal for the failing task. Most failures land an `error_message` on the run row that the UI surfaces.
- **Logged out unexpectedly** → log back in. The token-retry change in `auth-provider.tsx` should make this rare; if it still happens, check that PostgreSQL is reachable.

---

## Post-demo

- Note any rough edges in `.claude/plans/reliability-hardening.md` for the next iteration.
- If `make clean-uploads` was run, regenerate any demo content you want to preserve.
