import { addVolumeListener, getVolume } from "react-native-volume-manager";
import { Platform } from "react-native";

import { videoManager } from "@/src/lib/video-manager";

let lastSystemVolume: number | null = null;

/**
 * Keeps video mute state aligned with hardware volume keys:
 * - volume → 0: mutes playback (+ UI when dropping from above 0)
 * - volume up while muted: unmutes (TikTok / IG pattern)
 * Bootstrap getVolume() fixes initial state when listener does not fire on iOS.
 * Safe no-op on web; requires a dev/production native build (not Expo Go).
 */
export function startSystemVolumeUnmuteSync(): () => void {
  if (Platform.OS === "web") {
    return () => {};
  }

  let subscription: ReturnType<typeof addVolumeListener> | null = null;

  void getVolume()
    .then(({ volume }) => {
      videoManager.applySystemVolume(volume, null);
      lastSystemVolume = volume;
    })
    .catch(() => {
      /* unsupported or permission — listener still may work */
    });

  try {
    subscription = addVolumeListener((result) => {
      const v = result.volume;
      const prev = lastSystemVolume;
      videoManager.applySystemVolume(v, prev);
      lastSystemVolume = v;
    });
  } catch {
    return () => {};
  }

  return () => {
    subscription?.remove();
    subscription = null;
  };
}

/** Re-read device volume without resetting user mute preference (e.g. Flicks tab focus). */
export function syncSystemVolumeFromDevice(): void {
  if (Platform.OS === "web") return;

  void getVolume()
    .then(({ volume }) => {
      videoManager.applySystemVolume(volume, null);
      lastSystemVolume = volume;
    })
    .catch(() => {});
}

/** Home tab focus: restore muted default before user has interacted with volume. */
export function applyHomeTabFocusVolume(): void {
  if (!videoManager.getHasInteracted()) {
    videoManager.autoMuteForScreen();
  }
}

/** Flicks tab focus: sync device volume; auto-unmute when pre-interaction and vol > 0. */
export function applyFlicksTabFocusVolume(): void {
  if (Platform.OS === "web") {
    if (!videoManager.getHasInteracted()) {
      videoManager.autoUnmuteForScreen();
    }
    return;
  }

  void getVolume()
    .then(({ volume }) => {
      videoManager.applySystemVolume(volume, null);
      lastSystemVolume = volume;
      if (!videoManager.getHasInteracted() && volume > 0) {
        videoManager.autoUnmuteForScreen();
      }
    })
    .catch(() => {
      if (!videoManager.getHasInteracted()) {
        videoManager.autoUnmuteForScreen();
      }
    });
}
