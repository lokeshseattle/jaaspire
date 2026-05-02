/**
 * Shared rules for “public vs private” and who may see another user’s posts.
 * Aligns with Privacy settings: public only when both flags are effectively on.
 */

export type ProfileVisibilityFlags = {
  open_profile?: boolean;
  public_profile?: boolean;
};

export type ProfileViewerFlags = {
  is_following?: boolean;
  follow_status?: string;
  is_blocked?: boolean;
};

/** Matches app/(app)/privacy-settings resolveVisibilityFromProfile → "public". */
export function isProfilePublicInAppSense(p: ProfileVisibilityFlags): boolean {
  const open = p.open_profile !== false;
  const pub = p.public_profile !== false;
  return open && pub;
}

export function profileVisibilityLabel(
  p: ProfileVisibilityFlags,
): "public" | "private" {
  return isProfilePublicInAppSense(p) ? "public" : "private";
}

/**
 * Accepted follower: API uses follow_status "unfollow" when the viewer follows
 * (button label “Unfollow”); is_following is preferred when present.
 */
export function viewerIsAcceptedFollower(
  viewer: ProfileViewerFlags | undefined,
): boolean {
  if (!viewer) return false;
  if (viewer.is_following === true) return true;
  return viewer.follow_status === "unfollow";
}

/** Posts grid/feed for someone else’s profile (not own, not blocked). */
export function canViewerSeeAnotherUsersPosts(args: {
  profile: ProfileVisibilityFlags;
  viewer: ProfileViewerFlags;
}): boolean {
  const { profile, viewer } = args;
  if (viewer?.is_blocked === true) return false;
  if (isProfilePublicInAppSense(profile)) return true;
  return viewerIsAcceptedFollower(viewer);
}
