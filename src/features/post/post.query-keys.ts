export const postKeys = {
  feed: () => ["feed"] as const,
  userFeed: (
    username: string | undefined,
    type: "video" | "" | "exclusive" = "",
  ) => ["user_feed", username, type] as const,
  bookmarks: (type?: "all" | "photos" | "videos") =>
    ["bookmarks", type] as const,
  flicks: (
    feed: "following" | "explore" | "user",
    instanceKey: string | number = "main",
    userId?: number,
  ) => (feed === "user"
    ? (["flicks", "user", userId, instanceKey] as const)
    : (["flicks", feed, instanceKey] as const)),
  explore: () => ["explore"] as const,
  single: (id: string, mode: "explore" | "user" = "explore") =>
    ["single-post", id, mode] as const,
  comments: (id: number) => ["post-comments", id] as const,
  search: (
    query: string,
    filter: "people" | "latest" | "photos" | "videos",
  ) => ["global-search", query, filter] as const,
  report: () => ["report"] as const,
} as const;
