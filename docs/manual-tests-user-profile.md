# Manual tests: user profile visibility & posts (`/user/[username]`)

Use two accounts: **A** (viewer) and **B** (profile owner). Reset the app or clear cache between runs if you need a clean React Query state.

## Prerequisites

- B can toggle **Privacy → Profile visibility** (public / private).
- B has at least one published post.
- A is **not** B.

---

## 1. Public profile (both flags “on” in app sense)

**Setup:** B sets visibility to **Public** and saves.

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Log in as A, open `/user/{B.username}` (first visit) | Grid/feed shows B’s posts; no “This account is private” placeholder. |
| 1.2 | Pull to refresh | Posts still visible; no errors. |
| 1.3 | Switch tabs: gallery, home feed, video | Posts load where applicable; premium tab stays empty (placeholder behavior unchanged). |

---

## 2. Private profile — not following

**Setup:** B sets visibility to **Private** and saves. As A, ensure you do **not** follow B (button shows **Follow**, `follow_status` is `follow`).

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Log in as A, open `/user/{B.username}` (cold open / first navigation) | **No** post thumbnails in the grid; **no** feed posts. Placeholder: “This account is private” (or loading spinner briefly, then placeholder). |
| 2.2 | A pulls to refresh multiple times | Posts stay hidden; each refresh refetches profile and should confirm private state. |
| 2.3 | Stats row may still show post **count** from profile API (Instagram-like). | |

---

## 3. Private profile — follow request pending

**Setup:** B is **Private**. A taps **Follow** so status becomes **Requested**.

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | After tap, still on B’s profile | Posts remain hidden. Placeholder copy reflects pending (e.g. “Request pending”). |
| 3.2 | Pull to refresh | Still hidden until B accepts. |
| 3.3 | Tap **Requested** to cancel the request | Button returns to **Follow**; posts stay hidden (no brief flash of the grid). |

---

## 4. Private profile — accepted follower

**Setup:** B accepts A’s follow request (or B is public, A follows, then B goes private—use whichever your backend supports so A remains an accepted follower).

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | A opens B’s profile | Posts visible without restarting the app. |
| 4.2 | `follow_status` shows **Unfollow** (API value `unfollow`) and/or `is_following: true` | Message button visible (public **or** accepted follower). |

---

## 5. Own profile

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Log in as B, open own profile via same route as others if applicable | Always see own posts regardless of private setting. |
| 5.2 | No overflow “…” menu on self (header). | |

---

## 6. Blocked user

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | As A, block B from the profile ⋮ menu | Posts hidden; block UX as implemented; back navigation after confirm if that’s current behavior. |
| 6.2 | Unblock from menu | Profile loads again; visibility rules follow sections 1–4. |

---

## 7. `is_following` vs `follow_status` (API sanity)

If the backend sends **`is_following: true`** with an unexpected `follow_status`, or only one of them:

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Accepted follower with `is_following: true` | Posts visible even if string status were wrong. |
| 7.2 | Not following, `is_following: false`, `follow_status: "follow"` | Private account: posts **hidden** (regression check for the old `=== "follow"` bug). |

---

## 8. Deep link / post detail

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | As A (not following private B), try opening a direct post URL for B if exposed | Server should 403/empty; app should not show media if API is correct (verify against backend). |

---

## 9. Regression: optimistic follow

| Step | Action | Expected |
|------|--------|----------|
| 9.1 | On **public** B, A taps Follow | Immediately shows **Unfollow** (optimistic); posts stay visible. |
| 9.2 | On **private** B, A taps Follow | **Requested** state; posts stay hidden. |

---

## Pass / fail checklist

- [ ] 2.1 Private + not following: **never** see grid media on first paint.
- [ ] 4.1 Private + following: see posts.
- [ ] 7.2 No accidental access when `follow_status === "follow"` on a private account.
- [ ] Message button only when public **or** accepted follower (section 4).

Record device OS, app build, and any API anomalies (missing `public_profile`, etc.) when filing bugs.
