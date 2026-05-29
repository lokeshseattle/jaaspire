---
name: Feed Re-Architecture Plan
overview: Re-architect the post feed system into a clean, layered, reusable design. Extract shared utilities, create a generic feed data hook, build a reusable feed controller + container, decompose the 1300-line PostMedia monolith, and fix all identified bugs along the way.
todos:
  - id: phase-1a
    content: Create post.utils.ts -- extract canViewPostMedia, parseDuration, and related helpers from 3 files
    status: pending
  - id: phase-1b
    content: Create post.query-keys.ts -- centralized query key factory replacing hardcoded strings across 4 hook files
    status: pending
  - id: phase-2a
    content: Create use-hydrated-infinite-feed.ts -- generic wrapper for the fetch+select+hydrate pattern
    status: pending
  - id: phase-2b
    content: Refactor 6 feed hooks to use the generic wrapper (useGetFeedQuery, useGetUserFeedQuery, useGetBookmarksQuery, useGlobalSearchPostsQuery, useGetFlicksQuery, useGetUserFlicksQuery)
    status: pending
  - id: phase-3a
    content: Create use-feed-controller.ts -- reusable hook for viewability, focus lifecycle, tracking, and bottom sheets
    status: pending
  - id: phase-3b
    content: Create FeedContainer.tsx -- reusable FlatList wrapper consuming the controller
    status: pending
  - id: phase-3c
    content: Create feed/PostItem.tsx -- move from PostWrapper.tsx, fix useShallow bug
    status: pending
  - id: phase-4-profile
    content: Migrate ProfileFeedView.tsx to use useFeedController + FeedContainer
    status: pending
  - id: phase-4-home
    content: Migrate Home feed (tabs/index.tsx) to use useFeedController + FeedContainer
    status: pending
  - id: phase-4-single
    content: Migrate post/[postId].tsx and user/[username]/posts/[postId].tsx to use useFeedController
    status: pending
  - id: phase-4-flicks
    content: Migrate flicks.tsx to use useFeedController with pager mode config
    status: pending
  - id: phase-5
    content: Decompose post-media.tsx into PostMedia router, PostImage, PostVideo, PostPaywall, PostHeartOverlay
    status: pending
  - id: phase-6-bugs
    content: "Fix remaining bugs: comments_count, Date.now collision, reactions_count null, reply isDeleting scope (video-manager.ts deferred)"
    status: pending
  - id: phase-8-video-manager
    content: "DEFERRED: Fix releaseAll() mount leak in video-manager.ts (Bug #8) -- only after all other phases are confirmed stable"
    status: pending
  - id: phase-7-cleanup
    content: Delete old PostWrapper.tsx, remove commented code, verify all imports, run TypeScript check
    status: pending
isProject: false
---

# Feed System Re-Architecture

## Why This Improves Performance

The re-architecture delivers measurable performance gains:

- **Fewer re-renders:** Replacing `useShallow` on single-object lookups with plain selectors eliminates unnecessary shallow-comparison work on every Zustand store update (Bug #2). The current code iterates all ~20 keys of every `Post` object on every store change.
- **Smaller JS bundle per screen:** Each feed screen currently bundles ~150-200 lines of identical viewability/tracking/sheet boilerplate. Extracting this to a shared hook means each screen imports a few KB instead of inlining it.
- **Reduced bridge traffic:** Removing production `console.log` calls in [ProfileFeedView.tsx](src/components/profile/ProfileFeedView.tsx) (Bug #4) eliminates synchronous bridge serialization during scroll, which causes frame drops on Android.
- **Correct video lifecycle (deferred):** Bug #8 (`releaseAll()` mount leak in `video-manager.ts`) will be fixed in a separate follow-up phase after the re-architecture is stable, since it is a critical native-layer file.
- **Smaller component trees:** Splitting `post-media.tsx` (1327 lines) means React only diffs the subtree relevant to the current post type (image vs video vs paywall) instead of evaluating all branches.
- **More stable memo boundaries:** Fixing the stale ref/callback issues means fewer false positive re-renders from inconsistent state across batch renders.

---

## Phase 1: Shared Utilities and Query Keys

**Goal:** Eliminate duplicated logic, establish single sources of truth.

### 1a. Create `src/features/post/post.utils.ts`

Extract duplicated functions into one file:

- `canViewPostMedia(viewer, price, isExclusive)` — currently duplicated in:
  - [post-media.tsx](src/components/home/posts/post-media.tsx) (line 78)
  - [flicks.tsx](<app/(app)/(tabs)/flicks.tsx>) (line 68)
  - [ProfileGridView.tsx](src/components/profile/ProfileGridView.tsx) (line 164)
- `parseDuration(value)` — from [post-media.tsx](src/components/home/posts/post-media.tsx) (line 90)
- `isPaywalled(post)` — derived helper
- `isPaidPreview(post)` — derived helper

Then update all three files to import from `post.utils.ts`.

### 1b. Create `src/features/post/post.query-keys.ts`

Centralized query key factory replacing hardcoded string arrays scattered across [post.hooks.ts](src/features/post/post.hooks.ts), [explore.hooks.ts](src/features/post/explore.hooks.ts), [comments.hooks.ts](src/features/post/comments.hooks.ts), and [flicks.hooks.ts](src/features/flicks/flicks.hooks.ts):

```typescript
export const postKeys = {
  feed: () => ["feed"] as const,
  userFeed: (username: string, type?: string) =>
    ["user_feed", username, type] as const,
  bookmarks: (type?: string) => ["bookmarks", type] as const,
  flicks: (feed: string, instanceKey?: string | number) =>
    ["flicks", feed, instanceKey ?? "main"] as const,
  explore: () => ["explore"] as const,
  single: (id: string, mode?: string) => ["single-post", id, mode] as const,
  comments: (id: number) => ["post-comments", id] as const,
  search: (q: string, filter: string) => ["global-search", q, filter] as const,
};
```

---

## Phase 2: Generic Feed Data Hook

**Goal:** DRY the "fetch + select IDs + hydrate Zustand" pattern duplicated across 6 hooks.

### 2a. Create `src/features/post/internals/use-hydrated-infinite-feed.ts`

This wraps `useInfiniteQuery` with the shared pattern currently copy-pasted in every feed hook:

1. Calls `useInfiniteQuery` with provided config
2. `select` maps pages to post ID arrays
3. `useLayoutEffect` hydrates `usePostStore` from raw cache on `dataUpdatedAt` change
4. Returns `{ ...query, postIds }` flattened

### 2b. Refactor existing hooks to use the wrapper

Each hook shrinks to ~10-15 lines of configuration:

- [post.hooks.ts](src/features/post/post.hooks.ts): `useGetFeedQuery` (line 83), `useGetUserFeedQuery` (line 121), `useGetBookmarksQuery` (line 526)
- [explore.hooks.ts](src/features/post/explore.hooks.ts): `useGlobalSearchPostsQuery` (line 74)
- [flicks.hooks.ts](src/features/flicks/flicks.hooks.ts): `useGetFlicksQuery` (line 63), `useGetUserFlicksQuery` (line 121)

`useGetSinglePost` has unique logic (main post + recommended with dedup) so it stays as-is but uses `postKeys.single()`.

---

## Phase 3: Reusable Feed Controller Hook

**Goal:** Extract the ~150 lines of viewability/focus/tracking/sheet boilerplate duplicated across 5 screens.

### 3a. Create `src/components/feed/use-feed-controller.ts`

Encapsulates:

- `visiblePostId` / `visibleFeedIndex` state + refs
- `isScreenFocused` state + `useFocusEffect` lifecycle
- `viewabilityConfigCallbackPairs` (with correct ref-wrapper pattern, fixing Bug #1)
- `useTrackPostView` integration
- `useCommentsSheet` + `useShareSheet` wiring
- `videoManager.pauseAll()` on blur
- `getNextPostId(currentId)` helper

```typescript
interface FeedControllerOptions {
  postIds: number[];
  isTabActive?: boolean;
  viewabilityConfig?: Partial<ViewabilityConfig>;
  onFocusRestore?: () => void;
}
```

### 3b. Create `src/components/feed/FeedContainer.tsx`

A thin FlatList wrapper that accepts a `controller` and standard list props:

```typescript
interface FeedContainerProps {
  controller: FeedControllerReturn;
  postIds: number[];
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  flatListRef?: React.RefObject<FlatList>;
  flatListProps?: Partial<FlatListProps<number>>;
}
```

Internally renders `<PostItem>` (moved here) with correct props from controller refs, and attaches `CommentsBottomSheet` + `SharePostBottomSheet`.

### 3c. Create `src/components/feed/PostItem.tsx`

Move from [PostWrapper.tsx](src/components/home/posts/PostWrapper.tsx). Fix Bug #2 by replacing `useShallow` with plain selector:

```typescript
const post = usePostStore((state) => state.posts[id]);
```

---

## Phase 4: Migrate Feed Screens

**Goal:** Replace boilerplate in each screen with `useFeedController` + `FeedContainer`.

### Screens to migrate (in order of risk):

1. **[ProfileFeedView.tsx](src/components/profile/ProfileFeedView.tsx)** (243 lines) -- Replace internals with `useFeedController` + `FeedContainer`. Remove debug `console.log` (Bug #4). This component is consumed by:
   - [profile/index.tsx](<app/(app)/(tabs)/profile/index.tsx>) (own profile, home_feed tab)
   - [user/\[username\].tsx](<app/(app)/user/[username].tsx>) (other user, home_feed tab)
   - [global-search.tsx](<app/(app)/global-search.tsx>) (search results posts)

2. **[app/(app)/(tabs)/index.tsx](<app/(app)/(tabs)/index.tsx>)** (422 lines) -- Home feed. Replace feed logic with `useFeedController`. Keep custom header animation and story/badge logic. Fix Bug #1 (stale viewability callback).

3. **[app/(app)/post/\[postId\].tsx](<app/(app)/post/[postId].tsx>)** (267 lines) -- Single post detail. Use `useFeedController`. Fix Bug #10 (useFocusEffect double-fire).

4. **[app/(app)/user/\[username\]/posts/\[postId\].tsx](<app/(app)/user/[username]/posts/[postId].tsx>)** (275 lines) -- User-scoped post detail. Nearly identical to `post/[postId].tsx`; both use `useFeedController`.

5. **Flicks screens** -- [flicks.tsx](<app/(app)/(tabs)/flicks.tsx>) and [flick/\[postId\].tsx](<app/(app)/flick/[postId].tsx>) use pager mode (snapToInterval). These can use `useFeedController` with `mode: 'pager'` config but keep their unique `FlickRow`/`FlickItem` render. This is lowest priority since flicks has unique pager behavior.

---

## Phase 5: Decompose PostMedia

**Goal:** Break the 1327-line monolith into focused files.

### New file structure under `src/components/home/posts/media/`:

- **`PostMedia.tsx`** (~30 lines) -- Router: delegates to `PostImage`, `PostVideo`, or paywall based on type and access
- **`PostImage.tsx`** (~100 lines) -- Image display, double-tap-to-like, heart animation. Extracted from `PostMediaImage` (current line 972-1067)
- **`PostVideo.tsx`** (~250 lines) -- Video player, poster crossfade, progress bar, gestures, mute. Extracted from `PostMediaInnerMain` (current line 319-966)
- **`PostPaywall.tsx`** (~180 lines) -- All paywall variants: `ImagePaywall`, `VideoLockedPaywall`, `VideoPreviewEndedOverlay`, `PaywallContent`. Extracted from lines 136-315
- **`PostHeartOverlay.tsx`** (~30 lines) -- Shared heart animation overlay used by both Image and Video

The original [post-media.tsx](src/components/home/posts/post-media.tsx) becomes a re-export barrel for backward compatibility during migration.

---

## Phase 6: Fix Remaining Bugs

These fixes happen naturally during the phases above or as small targeted patches:

| Bug                                      | Fix                                                                                                                                                                  | Phase                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| #1 Stale viewability callback (home)     | `useFeedController` uses ref-wrapper pattern                                                                                                                         | Phase 3              |
| #2 `useShallow` on single object         | Plain selector in new `PostItem.tsx`                                                                                                                                 | Phase 3c             |
| #3 `comments_count` never updates        | Add `usePostStore.updatePost(postId, p => ({...p, comments_count: p.comments_count + 1}))` in `useAddComment.onMutate` and decrement in `useDeleteComment.onSuccess` | Phase 6 (standalone) |
| #4 Debug console.log                     | Remove in `ProfileFeedView` refactor                                                                                                                                 | Phase 4.1            |
| #5 `Date.now()` optimistic ID collision  | Use `-(Date.now() + Math.random())` or a counter                                                                                                                     | Phase 6 (standalone) |
| #7 Stale ref reads in renderItem         | Controller refs + `extraData` pattern standardized                                                                                                                   | Phase 3              |
| #8 `releaseAll` mount leak               | **DEFERRED to Phase 8** -- `video-manager.ts` is not touched until all other phases are stable                                                                       | Phase 8 (separate)   |
| #10 useFocusEffect double-fire           | Controller handles focus lifecycle correctly                                                                                                                         | Phase 4.3            |
| #11 `reactions_count` null inconsistency | Normalize to `0` instead of `null` in like mutation                                                                                                                  | Phase 6 (standalone) |
| #12 Reply isDeleting wrong scope         | Pass `deletingId` to `ReplyItem` and compare `deletingId === reply.id`                                                                                               | Phase 6 (standalone) |

---

## Phase 7: Cleanup

- Delete the old [PostWrapper.tsx](src/components/home/posts/PostWrapper.tsx) once all consumers use `feed/PostItem.tsx`
- If `ProfileFeedView` is fully replaced by `FeedContainer`, delete the file
- Remove commented-out old like mutation code in [post.hooks.ts](src/features/post/post.hooks.ts) (lines 171-265)
- Verify all imports resolve, run TypeScript check, test each feed surface

---

## Final Directory Structure

```
src/
  features/
    post/
      post.types.ts              (new - moved from api.types.ts if desired)
      post.utils.ts              (new)
      post.store.ts              (unchanged)
      post.query-keys.ts         (new)
      post.hooks.ts              (refactored, smaller)
      explore.hooks.ts           (refactored, smaller)
      comments.hooks.ts          (bug fixes)
      internals/
        use-hydrated-infinite-feed.ts  (new)
    flicks/
      flicks.hooks.ts            (refactored, smaller)

  components/
    feed/
      use-feed-controller.ts     (new - core reusable hook)
      FeedContainer.tsx          (new - reusable FlatList wrapper)
      PostItem.tsx               (moved from PostWrapper.tsx, fixed)
    home/
      posts/
        post.tsx                 (unchanged)
        post-header.tsx          (unchanged)
        post-footer.tsx          (unchanged)
        post-media.tsx           (barrel re-export)
        media/
          PostMedia.tsx          (new - router)
          PostImage.tsx          (new - extracted)
          PostVideo.tsx          (new - extracted)
          PostPaywall.tsx        (new - extracted)
          PostHeartOverlay.tsx   (new - extracted)
```

---

## Migration Safety

Each phase is independently shippable and testable:

- **Phase 1** is zero-risk (just moves code, no behavior change)
- **Phase 2** is internal to hooks (consumers unchanged)
- **Phase 3** creates new files without touching existing ones yet
- **Phase 4** is where screens switch over one at a time -- each can be tested individually
- **Phase 5** is purely component decomposition with a barrel re-export for compatibility
- **Phase 6** is targeted bug fixes
- **Phase 7** is cleanup after everything works

Total estimated lines saved: ~800-1000 lines of duplicated code across the codebase.

---

## Phase 8 (Deferred): video-manager.ts Fixes

**NOT part of the initial re-architecture.** Only executed after all other phases are confirmed stable.

- Fix `releaseAll()` mount leak (Bug #8): re-add pinned player to `mountedPlayers` after clearing
- Any other `video-manager.ts` improvements identified during migration

This file manages native video decoders and is the most critical runtime file in the app. Isolating changes to it reduces risk of the re-architecture introducing playback regressions.
