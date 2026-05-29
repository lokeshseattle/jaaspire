import type { Post } from "@/src/services/api/api.types";

export type PostViewer = Post["viewer"];

export function canViewPostMedia(
  viewer: PostViewer | undefined,
  price: number,
  isExclusive: boolean,
): boolean {
  if (viewer?.is_owner === true) return true;
  if (price > 0 && !viewer?.has_purchased) return false;
  if (isExclusive && !viewer?.has_subscription) return false;
  return true;
}

/** Normalizes API duration (number, numeric string, or "20s") to seconds. */
export function parseDuration(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/[^\d.]/g, ""));
    return n > 0 ? n : null;
  }
  return null;
}

export function isPaywalledPost(post: Pick<Post, "viewer" | "price" | "is_exclusive">): boolean {
  return !canViewPostMedia(post.viewer, post.price ?? 0, post.is_exclusive ?? false);
}

export function isPaidPreviewPost(
  post: Pick<Post, "viewer" | "price" | "is_exclusive">,
): boolean {
  const canView = canViewPostMedia(
    post.viewer,
    post.price ?? 0,
    post.is_exclusive ?? false,
  );
  return !canView && ((post.price ?? 0) > 0 || (post.is_exclusive ?? false));
}
