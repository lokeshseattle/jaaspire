type VideoNetworkScreen = "home" | "flicks";
type VideoNetworkAction = "create" | "replace";

/**
 * Manual dev toggle — flip to `true` to enable `[VideoNet:*]` console logs.
 * Only runs when `__DEV__` is true; production builds never log.
 */
export const VIDEO_NETWORK_DEBUG_ENABLED = true;

export function isVideoNetworkDebugEnabled(): boolean {
  return __DEV__ && VIDEO_NETWORK_DEBUG_ENABLED;
}

let activeScreen: VideoNetworkScreen = "home";

const networkCallCount = { create: 0, replace: 0 };

const postRequestCounts = new Map<number, number>();

export function setVideoNetworkDebugScreen(screen: VideoNetworkScreen): void {
  if (!isVideoNetworkDebugEnabled()) return;
  activeScreen = screen;
}

export function getVideoNetworkDebugStats() {
  return {
    activeScreen,
    networkCallCount: { ...networkCallCount },
    totalNetworkCalls: networkCallCount.create + networkCallCount.replace,
    postRequestCounts: Object.fromEntries(postRequestCounts),
  };
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.slice(-2).join("/") || parsed.pathname;
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}…` : url;
  }
}

function emitLog(
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  const payload = {
    sessionId: "284afa",
    location: "video-network-debug.ts",
    message,
    data: { screen: activeScreen, ...data },
    timestamp: Date.now(),
    hypothesisId,
  };

  console.log(`[VideoNet:${activeScreen}] ${message}`, payload.data);

  // #region agent log
  fetch("http://127.0.0.1:7713/ingest/79ddd8a3-01f8-49ed-88ed-8df194c3a36a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "284afa",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

/** Called when expo-video actually loads a new source (create or replace). */
export function logVideoNetworkFetch(
  postId: number,
  url: string,
  action: VideoNetworkAction,
): void {
  if (!isVideoNetworkDebugEnabled()) return;

  networkCallCount[action] += 1;
  postRequestCounts.set(postId, (postRequestCounts.get(postId) ?? 0) + 1);

  emitLog(
    `NETWORK ${action.toUpperCase()} #${networkCallCount.create + networkCallCount.replace}`,
    {
      postId,
      url: shortUrl(url),
      action,
      createCount: networkCallCount.create,
      replaceCount: networkCallCount.replace,
      totalNetworkCalls: networkCallCount.create + networkCallCount.replace,
      requestsForPost: postRequestCounts.get(postId),
    },
    "network-fetch",
  );
}

/** Called from tab screens when the visible/preload video window changes. */
export function logVideoFeedWindow(
  screen: VideoNetworkScreen,
  context: {
    focusedPostId: number | null;
    focusedIndex: number;
    videos: { postId: number; url: string; role: string }[];
  },
): void {
  if (!isVideoNetworkDebugEnabled()) return;

  emitLog(
    `FEED WINDOW (${context.videos.length} video(s) in preload range)`,
    {
      focusedPostId: context.focusedPostId,
      focusedIndex: context.focusedIndex,
      videos: context.videos.map((v) => ({
        postId: v.postId,
        url: shortUrl(v.url),
        role: v.role,
      })),
      ...getVideoNetworkDebugStats(),
    },
    "feed-window",
  );
}
