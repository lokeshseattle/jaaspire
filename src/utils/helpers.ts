export type MediaType = "image" | "video" | "unknown";

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

export const getMediaType = (extension: string): MediaType => {
  if (!extension) return "unknown";

  const ext = extension.toLowerCase().trim();

  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";

  return "unknown";
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