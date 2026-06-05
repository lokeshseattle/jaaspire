import { canViewPostMedia } from "@/src/features/post/post.utils";
import { videoManager } from "@/src/lib/video-manager";
import type { Post } from "@/src/services/api/api.types";
import { getMediaType } from "@/src/utils/helpers";
import { Image } from "expo-image";

export const FLICKS_PRELOAD_RADIUS = 1;
/** Start playback once the incoming reel covers this fraction of the viewport. */
export const FLICKS_PLAY_VISIBILITY = 0.6;

/** URL eligible for decoder preload (full access or timed preview). */
export function flickPreloadTarget(post: Post | undefined): {
  postId: number;
  url: string;
} | null {
  if (!post?.attachments?.[0]) return null;
  const a = post.attachments[0];
  if (getMediaType(a.type) !== "video" || !a.path) return null;
  const price = post.price ?? 0;
  const isExclusive = post.is_exclusive ?? false;
  const canView = canViewPostMedia(post.viewer, price, isExclusive);
  const isPaidVideo = !canView && (price > 0 || isExclusive);
  if (canView || isPaidVideo) return { postId: post.id, url: a.path };
  return null;
}

export function flickThumbnailUrl(post: Post | undefined): string | null {
  const thumb = post?.attachments?.[0]?.thumbnail;
  return thumb && thumb.length > 0 ? thumb : null;
}

/** Focus index from scroll offset (pixel-rounded page height). */
export function flickIndexFromOffset(
  offsetY: number,
  pageHeight: number,
  itemCount: number,
): number {
  if (pageHeight <= 0 || itemCount <= 0) return 0;
  const nearest = Math.round(offsetY / pageHeight);
  return Math.min(Math.max(nearest, 0), itemCount - 1);
}

/**
 * Active reel index while scrolling — switches when the incoming reel is
 * FLICKS_PLAY_VISIBILITY (60%) visible instead of waiting for snap.
 */
export function flickActiveIndexFromOffset(
  offsetY: number,
  pageHeight: number,
  itemCount: number,
  direction: FlickScrollDirection,
): number {
  if (pageHeight <= 0 || itemCount <= 0) return 0;

  const base = Math.floor(offsetY / pageHeight);
  const progress = (offsetY % pageHeight) / pageHeight;
  const hideThreshold = 1 - FLICKS_PLAY_VISIBILITY;

  let index = base;
  if (direction === "down") {
    index = progress >= hideThreshold ? base + 1 : base;
  } else if (direction === "up") {
    index = progress <= hideThreshold ? base : base + 1;
  } else {
    index = flickIndexFromOffset(offsetY, pageHeight, itemCount);
  }

  return Math.min(Math.max(index, 0), itemCount - 1);
}

/** Pause + seek previous active reel when focus moves (clean handoff). */
export function resetFlickOnFocusChange(
  postIds: number[],
  prevIndex: number,
  nextIndex: number,
): void {
  if (prevIndex === nextIndex) return;
  const prevId = postIds[prevIndex];
  const nextId = postIds[nextIndex];
  if (prevId != null) {
    videoManager.pause(prevId);
    videoManager.seekToStart(prevId);
  }
  if (nextId != null) {
    videoManager.seekToStart(nextId);
  }
}

export type FlickScrollDirection = "down" | "up" | "none";

export function flickScrollDirection(
  prevOffsetY: number,
  nextOffsetY: number,
): FlickScrollDirection {
  if (nextOffsetY > prevOffsetY + 2) return "down";
  if (nextOffsetY < prevOffsetY - 2) return "up";
  return "none";
}

/** Reserve focused + upcoming decoders and preload with scroll-direction priority. */
export function syncFlickVideoPool(options: {
  postIds: number[];
  focusedIndex: number;
  postsMap: Record<number, Post | undefined>;
  scrollDirection: FlickScrollDirection;
}): void {
  const { postIds, focusedIndex, postsMap, scrollDirection } = options;
  if (postIds.length === 0 || focusedIndex < 0) return;

  const focusedId = postIds[focusedIndex];
  const prevId = postIds[focusedIndex - 1];
  const nextId = postIds[focusedIndex + 1];

  const upcomingId =
    scrollDirection === "up"
      ? prevId
      : scrollDirection === "down"
        ? nextId
        : (nextId ?? prevId);

  const reserved = [focusedId, upcomingId].filter(
    (id): id is number => id != null,
  );
  videoManager.setReservedPostIds(reserved);

  const prevTarget = prevId != null ? flickPreloadTarget(postsMap[prevId]) : null;
  const nextTarget = nextId != null ? flickPreloadTarget(postsMap[nextId]) : null;

  videoManager.preloadAdjacent({
    primary: scrollDirection === "up" ? prevTarget : nextTarget ?? prevTarget,
    secondary: scrollDirection === "up" ? nextTarget : prevTarget,
  });
}

/** Disk-cache neighbor posters for instant crossfade. */
export function prefetchFlickThumbnails(options: {
  postIds: number[];
  focusedIndex: number;
  postsMap: Record<number, Post | undefined>;
  scrollDirection: FlickScrollDirection;
}): void {
  const { postIds, focusedIndex, postsMap, scrollDirection } = options;
  if (postIds.length === 0 || focusedIndex < 0) return;

  const urls: string[] = [];
  const push = (idx: number) => {
    const id = postIds[idx];
    if (id == null) return;
    const url = flickThumbnailUrl(postsMap[id]);
    if (url) urls.push(url);
  };

  if (scrollDirection === "up") {
    push(focusedIndex - 1);
    push(focusedIndex + 1);
  } else {
    push(focusedIndex + 1);
    push(focusedIndex - 1);
  }

  for (const url of urls) {
    void Image.prefetch(url);
  }
}

/** Seek off-window items back to start; skip neighbors still in preload radius. */
export function seekOffWindowFlicks(
  postId: number,
  postIds: number[],
  focusedIndex: number,
): void {
  const idx = postIds.indexOf(postId);
  if (idx < 0) return;
  if (Math.abs(idx - focusedIndex) <= FLICKS_PRELOAD_RADIUS) return;
  videoManager.seekToStart(postId);
}
