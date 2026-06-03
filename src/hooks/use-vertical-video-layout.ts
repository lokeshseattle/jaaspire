import { useMemo } from "react";
import { PixelRatio, useWindowDimensions } from "react-native";
import type { VideoContentFit } from "expo-video";

/** Portrait reel width / height (9:16). */
export const VERTICAL_VIDEO_ASPECT = 9 / 16;

/** Instagram-style max track width on tablets. */
export const DEFAULT_MAX_TRACK_WIDTH = 430;

/** Viewport width at or above which tablet layout applies. */
export const DEFAULT_TABLET_MIN_WIDTH = 768;

/** Under cover, use landscape inset when less than this fraction of source is visible. */
export const DEFAULT_CROP_THRESHOLD = 0.78;

export type VerticalVideoLayoutOptions = {
  maxTrackWidth?: number;
  tabletMinWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** Full-screen reels: fill the entire viewport on phones (cover, no letterboxing). */
  fillViewport?: boolean;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  cropThreshold?: number;
};

export type VerticalVideoLayout = {
  frameWidth: number;
  frameHeight: number;
  contentFit: VideoContentFit;
  isWideLayout: boolean;
  /** True when a landscape source uses a centered inset frame instead of full-bleed cover. */
  isLandscapeInset: boolean;
};

function roundPx(value: number): number {
  return PixelRatio.roundToNearestPixel(value);
}

/** Visible source fraction on the worst axis under object-fit: cover. */
export function coverVisibleMinFrac(
  frameW: number,
  frameH: number,
  videoW: number,
  videoH: number,
): number {
  if (videoW <= 0 || videoH <= 0 || frameW <= 0 || frameH <= 0) return 1;
  const scale = Math.max(frameW / videoW, frameH / videoH);
  return Math.min(frameW / (videoW * scale), frameH / (videoH * scale));
}

/**
 * Option B: fit landscape source to track width, center vertically in the cell.
 * No side crop; top/bottom letterboxing stays on the outer stage.
 */
function applyLandscapeInsetIfNeeded(
  layout: VerticalVideoLayout,
  availableWidth: number,
  availableHeight: number,
  sourceWidth?: number | null,
  sourceHeight?: number | null,
  cropThreshold = DEFAULT_CROP_THRESHOLD,
  maxHeight?: number,
  minHeight?: number,
): VerticalVideoLayout {
  if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
    return layout;
  }
  if (sourceWidth <= sourceHeight) return layout;

  const visible = coverVisibleMinFrac(
    layout.frameWidth,
    layout.frameHeight,
    sourceWidth,
    sourceHeight,
  );
  if (visible >= cropThreshold) return layout;

  const sourceAspect = sourceWidth / sourceHeight;
  let frameWidth = layout.frameWidth;
  let frameHeight = frameWidth / sourceAspect;

  if (maxHeight != null && frameHeight > maxHeight) {
    frameHeight = maxHeight;
    frameWidth = frameHeight * sourceAspect;
  }

  if (frameHeight > availableHeight) {
    frameHeight = availableHeight;
    frameWidth = frameHeight * sourceAspect;
  }

  if (minHeight != null && frameHeight < minHeight) {
    frameHeight = minHeight;
    frameWidth = frameHeight * sourceAspect;
    if (frameWidth > availableWidth) {
      frameWidth = availableWidth;
      frameHeight = frameWidth / sourceAspect;
    }
  }

  return {
    frameWidth: roundPx(frameWidth),
    frameHeight: roundPx(frameHeight),
    contentFit: "cover",
    isWideLayout: layout.isWideLayout,
    isLandscapeInset: true,
  };
}

/**
 * Computes a 9:16 video frame that fills mobile width or caps + centers on tablets.
 * Pass measured viewport dims from parent onLayout when snap accuracy matters (Flicks).
 */
export function computeVerticalVideoLayout(
  availableWidth: number,
  availableHeight: number,
  options?: VerticalVideoLayoutOptions,
): VerticalVideoLayout {
  const maxTrackWidth = options?.maxTrackWidth ?? DEFAULT_MAX_TRACK_WIDTH;
  const tabletMinWidth = options?.tabletMinWidth ?? DEFAULT_TABLET_MIN_WIDTH;
  const minHeight = options?.minHeight;
  const maxHeight = options?.maxHeight;
  const fillViewport = options?.fillViewport ?? false;

  if (availableWidth <= 0 || availableHeight <= 0) {
    return {
      frameWidth: 0,
      frameHeight: 0,
      contentFit: "cover",
      isWideLayout: false,
      isLandscapeInset: false,
    };
  }

  const cropThreshold = options?.cropThreshold ?? DEFAULT_CROP_THRESHOLD;
  const sourceWidth = options?.sourceWidth;
  const sourceHeight = options?.sourceHeight;

  const isWideLayout = availableWidth >= tabletMinWidth;

  let layout: VerticalVideoLayout;

  if (fillViewport && !isWideLayout) {
    layout = {
      frameWidth: roundPx(availableWidth),
      frameHeight: roundPx(availableHeight),
      contentFit: "cover" as const,
      isWideLayout: false,
      isLandscapeInset: false,
    };
  } else {
    let frameWidth = isWideLayout
      ? Math.min(availableWidth, maxTrackWidth)
      : availableWidth;

    let frameHeight = frameWidth / VERTICAL_VIDEO_ASPECT;

    if (frameHeight > availableHeight) {
      frameHeight = availableHeight;
      if (isWideLayout) {
        frameWidth = frameHeight * VERTICAL_VIDEO_ASPECT;
      }
    }

    if (maxHeight != null && frameHeight > maxHeight) {
      frameHeight = maxHeight;
      if (isWideLayout) {
        frameWidth = frameHeight * VERTICAL_VIDEO_ASPECT;
      }
    }

    if (minHeight != null && frameHeight < minHeight) {
      frameHeight = minHeight;
      if (isWideLayout) {
        frameWidth = frameHeight * VERTICAL_VIDEO_ASPECT;
        if (frameWidth > availableWidth) {
          frameWidth = Math.min(availableWidth, maxTrackWidth);
          frameHeight = frameWidth / VERTICAL_VIDEO_ASPECT;
        }
      } else if (frameWidth > availableWidth) {
        frameWidth = availableWidth;
        frameHeight = frameWidth / VERTICAL_VIDEO_ASPECT;
      }
    }

    layout = {
      frameWidth: roundPx(frameWidth),
      frameHeight: roundPx(frameHeight),
      contentFit: "cover" as const,
      isWideLayout,
      isLandscapeInset: false,
    };
  }

  return applyLandscapeInsetIfNeeded(
    layout,
    availableWidth,
    availableHeight,
    sourceWidth,
    sourceHeight,
    cropThreshold,
    maxHeight,
    minHeight,
  );
}

export function useVerticalVideoLayout(
  availableWidth: number,
  availableHeight: number,
  options?: VerticalVideoLayoutOptions,
): VerticalVideoLayout {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  return useMemo(() => {
    const width =
      availableWidth > 0 ? availableWidth : windowWidth;
    const height =
      availableHeight > 0 ? availableHeight : windowHeight;

    return computeVerticalVideoLayout(width, height, options);
  }, [
    availableWidth,
    availableHeight,
    windowWidth,
    windowHeight,
    options?.maxTrackWidth,
    options?.tabletMinWidth,
    options?.minHeight,
    options?.maxHeight,
    options?.fillViewport,
    options?.sourceWidth,
    options?.sourceHeight,
    options?.cropThreshold,
  ]);
}
