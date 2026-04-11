# Phase 8: Gamification + Analytics + Leader Oversight

**Goal:** FSC streaks/points/leaderboard, brand admin analytics dashboard, leader comments on artifacts.

**User stories:** US-022 (gamification), US-023 (analytics), US-025 (leader comments)

**Dependencies:** Phase 5 + Phase 6 + Phase 4

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/models/gamification.py` | `UserPoints`: id, user_id (FK, unique), total_points, current_streak, longest_streak, last_activity_date, updated_at. `PointsLog`: id, user_id (FK), action (Enum: create_artifact, export, remix, streak_bonus), points, created_at. |
| `backend/app/models/comment.py` | `Comment`: id, artifact_id (FK), user_id (FK), text, created_at |
| `backend/app/api/gamification.py` | `GET /api/gamification/me` (current user's stats), `GET /api/gamification/leaderboard?district=...` (top 10 + current user rank) |
| `backend/app/api/analytics.py` | `GET /api/analytics/overview` (key metrics), `GET /api/analytics/top-remixed` (top library items), `GET /api/analytics/content-gaps` (types without library equivalent), `GET /api/analytics/activity` (time series). Query params: `period`, `district`, `product`. |
| `backend/app/api/comments.py` | `POST /api/artifacts/{id}/comments` (add), `GET /api/artifacts/{id}/comments` (list) |
| `backend/app/schemas/gamification.py` | `GamificationStatsResponse(total_points, current_streak, longest_streak, rank, percentile, next_milestone)`, `LeaderboardResponse(entries, user_rank, user_entry)`, `LeaderboardEntry(rank, user_name, user_avatar, points, streak)` |
| `backend/app/schemas/analytics.py` | `OverviewResponse(assets_created_week, assets_created_month, total_remixes, compliance_rate, active_fscs)`, `TopRemixedResponse(items)`, `ContentGapResponse(gaps)`, `ActivityResponse(data)` |
| `backend/app/schemas/comment.py` | `CreateCommentRequest(text)`, `CommentResponse(id, user, text, created_at)` |
| `backend/app/services/gamification_service.py` | `award_points(user_id, action)` — adds points, updates streak, logs to PointsLog, updates Redis sorted set (ZADD). `get_user_stats(user_id)` — from UserPoints + Redis rank (ZREVRANK). `get_leaderboard(district?, top_n=10)` — ZREVRANGE from Redis. `update_streak(user_id)` — compare last_activity_date with today: same day=no change, yesterday=increment, older=reset to 1. Award 50-point bonus at 7-day streak. |
| `backend/app/services/analytics_service.py` | `get_overview(filters)` — aggregate queries over artifacts, exports, library items. `get_top_remixed(filters)` — ORDER BY remix_count DESC. `get_content_gaps(filters)` — LEFT JOIN artifacts (FSC, grouped by product+type) against brand_library_items; combinations present in artifacts but absent from library = gaps. `get_activity_timeseries(filters, granularity)` — GROUP BY date, COUNT. |
| `backend/app/services/comment_service.py` | `add_comment(user, artifact_id, text)` — validates user is project member and role is leader+. `list_comments(artifact_id)`. |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/leaderboard/page.tsx` | Full leaderboard page: district selector, top 10 list, current user highlighted. FSC-only. |
| `frontend/src/components/home/gamification-strip.tsx` (update) | Wire to real API: `GET /api/gamification/me`. Display real streak, points, rank, progress bar to next milestone. |
| `frontend/src/components/home/tabs/analytics-tab.tsx` (update) | Wire to real APIs. Overview metrics, top remixed chart, content gaps, activity chart. |
| `frontend/src/components/analytics/overview-metrics.tsx` | Grid of metric cards: assets this week/month, total remixes, compliance rate, active FSCs |
| `frontend/src/components/analytics/top-remixed-chart.tsx` | Horizontal bar chart (recharts) of most-remixed library items |
| `frontend/src/components/analytics/content-gaps.tsx` | Table: product/type combos FSCs create without library equivalent. "Publish to library" link per row. |
| `frontend/src/components/analytics/activity-chart.tsx` | Line chart (recharts) of daily/weekly creation and export volume |
| `frontend/src/components/analytics/analytics-filters.tsx` | Filter bar: time period selector, district dropdown, product dropdown |
| `frontend/src/components/gamification/leaderboard-table.tsx` | Ranked list with avatars, names, points, streaks. Current user row highlighted. |
| `frontend/src/components/gamification/streak-display.tsx` | Flame icon + streak count + "day streak" label |
| `frontend/src/components/gamification/points-progress.tsx` | Progress bar: points toward next milestone (e.g., 2847/3000 for "Gold Creator") |
| `frontend/src/components/artifacts/comment-thread.tsx` | Comment list on artifact detail. Leader can type + submit. FSC sees comments. |
| `frontend/src/components/artifacts/comment-input.tsx` | Textarea + submit button. Shown only to leaders on team project artifacts. |
| `frontend/src/lib/api/gamification.ts` | `fetchMyGamification()`, `fetchLeaderboard(district?)` |
| `frontend/src/lib/api/analytics.ts` | `fetchOverview(filters)`, `fetchTopRemixed(filters)`, `fetchContentGaps(filters)`, `fetchActivity(filters)` |
| `frontend/src/lib/api/comments.ts` | `addComment(artifactId, text)`, `fetchComments(artifactId)` |
| `frontend/src/types/gamification.ts` | `GamificationStats`, `LeaderboardEntry` types |
| `frontend/src/types/analytics.ts` | `OverviewMetrics`, `TopRemixedItem`, `ContentGap`, `ActivityDataPoint` types |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/gamification/me` | fsc | Get own stats |
| GET | `/api/gamification/leaderboard` | fsc | Get district leaderboard |
| GET | `/api/analytics/overview` | brand_admin | Key metrics |
| GET | `/api/analytics/top-remixed` | brand_admin | Top remixed library items |
| GET | `/api/analytics/content-gaps` | brand_admin | Content gap signals |
| GET | `/api/analytics/activity` | brand_admin | Activity time series |
| POST | `/api/artifacts/{id}/comments` | leader+ | Add comment |
| GET | `/api/artifacts/{id}/comments` | Member | List comments |

## Points system

| Action | Points |
|---|---|
| Create artifact | +10 |
| Export artifact | +20 |
| Remix from library | +15 |
| 7-day streak bonus | +50 |

## Milestones

| Level | Points threshold |
|---|---|
| Bronze Creator | 0 |
| Silver Creator | 500 |
| Gold Creator | 2,000 |
| Platinum Creator | 5,000 |
| Diamond Creator | 10,000 |

## Streak logic

```python
update_streak(user_id):
  user_points = get_or_create_user_points(user_id)
  today = date.today()
  
  if user_points.last_activity_date == today:
    return  # Already counted today
  elif user_points.last_activity_date == today - timedelta(days=1):
    user_points.current_streak += 1  # Consecutive day
    if user_points.current_streak == 7:
      award_bonus(user_id, "streak_bonus", 50)
  else:
    user_points.current_streak = 1  # Reset
  
  user_points.longest_streak = max(user_points.longest_streak, user_points.current_streak)
  user_points.last_activity_date = today
```

## Leaderboard (Redis sorted sets)

- Key: `leaderboard:global` (MVP — no district_id on users yet)
- On each point award: `ZADD leaderboard:global {total_points} {user_id}`
- Get rank: `ZREVRANK leaderboard:global {user_id}`
- Get top N: `ZREVRANGE leaderboard:global 0 {N-1} WITHSCORES`
- Percentile: `rank / total_members * 100`

## Content gaps SQL

```sql
SELECT a.product, a.type, COUNT(*) as fsc_count
FROM artifacts a
JOIN users u ON a.creator_id = u.id
WHERE u.role = 'fsc'
GROUP BY a.product, a.type
HAVING NOT EXISTS (
  SELECT 1 FROM brand_library_items bli
  JOIN artifacts ba ON bli.artifact_id = ba.id
  WHERE ba.product = a.product AND ba.type = a.type
  AND bli.status = 'published'
)
ORDER BY fsc_count DESC;
```

Surfaces insights like: "FSCs created 47 WhatsApp cards for HealthShield but there's no library template for this."

## Gamification hooks (integration with existing services)

Points are awarded by calling gamification_service from existing services — no event bus for MVP:

- `artifact_service.create_artifact()` → calls `gamification_service.award_points(user_id, "create_artifact")`
- `export_service.export_artifact()` → calls `gamification_service.award_points(user_id, "export")`
- `brand_library_service.remix_item()` → calls `gamification_service.award_points(user_id, "remix")`

## Comments (leader oversight)

- Only leaders (district_leader, agency_leader, brand_admin) can add comments on artifacts in team projects
- FSCs see comments but cannot reply (they respond by creating a new version of the artifact)
- Comments are simple text — no threads, no reactions (MVP)

## Key implementation details

- Analytics queries should use cached results (Redis with 5-minute TTL) for dashboard responsiveness.
- Gamification is FSC-only — not shown to internal staff.
- The leaderboard uses `leaderboard:global` key for MVP since `district_id` is not yet on users. When hierarchy API is integrated, switch to `leaderboard:district:{id}`.
- Install `recharts` for frontend charts (lightweight, React-native).

## Verification

- FSC creates artifact → points awarded (+10), streak updated
- FSC exports → points awarded (+20)
- FSC gamification strip shows real streak, points, rank
- Leaderboard page shows top 10 with current user highlighted
- Brand admin Analytics tab: overview metrics, top remixed chart, content gaps, activity chart
- Content gaps shows product/type combos without library equivalent
- Leader comments on FSC artifact → comment appears
- FSC sees comment but cannot add own
- `pytest` passes
- `npm run typecheck` passes
