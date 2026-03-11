export type MediaType = "image" | "video";

const IMAGE_EXTENSIONS = new Set<string>([
  // Common
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tiff",
  "tif",

  // Modern
  "heic",
  "heif",
  "avif",

  // Vector
  "svg",
]);

const VIDEO_EXTENSIONS = new Set<string>([
  // Common
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "flv",
  "wmv",
  "m4v",

  // Mobile
  "3gp",
  "3g2",
  "ts",
  "mts",
  "m2ts",
]);

export const getMediaType = (pathOrExtension: string): MediaType => {
  if (!pathOrExtension) return "image";

  // Strip query params, then extract just the filename from the path/URL
  const withoutQuery = pathOrExtension.split("?")[0];
  const filename = withoutQuery.split("/").pop() ?? "";
  // If the filename has a dot, use its extension; otherwise treat the whole input as an extension
  const ext = (filename.includes(".")
    ? filename.split(".").pop()
    : pathOrExtension
  )?.toLowerCase().trim() ?? "";

  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";

  return "image";
};

export function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);

  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

export function getDirtyValues<T>(
  dirtyFields: Partial<Record<keyof T, any>>,
  allValues: T,
): Partial<T> {
  const result: Partial<T> = {};

  (Object.keys(dirtyFields) as Array<keyof T>).forEach((key) => {
    result[key] = allValues[key];
  });

  return result;
}


/**
 * Determines if an item should be large based on the pattern:
 * 
 * Pattern A (index 0-4): Large at position 0 (left)
 * Pattern B (index 5-9): Large at position 9 (right)
 * 
 * Repeats every 10 items
 */
export const isLargeItem = (index: number): boolean => {
  const cycleIndex = index % 10;

  // Pattern A: First item of first 5 is large (position 0)
  // Pattern B: Last item of next 5 is large (position 9)
  return cycleIndex === 0 || cycleIndex === 9;
};

export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export type TButtonStatus = "follow" | "unfollow" | "requested"

export const getNextButtonStatus = (isOpenProfile: boolean, status: TButtonStatus): TButtonStatus => {
  if (status === "unfollow") return "follow"
  if (status === "requested") return "unfollow"

  if (status === "follow") return isOpenProfile ? "unfollow" : "requested"

  return status
}

export const getMentionQuery = (text: string, cursorPosition: number) => {
  // Find the @ before cursor
  const textBeforeCursor = text.slice(0, cursorPosition);
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");

  if (lastAtIndex === -1) return null;

  const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

  // If there's a space after @, we're not in mention mode
  if (textAfterAt.includes(" ")) return null;

  return {
    query: textAfterAt,
    startIndex: lastAtIndex,
    endIndex: cursorPosition,
  };
};

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

const uriToBlob = async (uri: string): Promise<Blob> => {
  const res = await fetch(uri);
  return await res.blob();
};