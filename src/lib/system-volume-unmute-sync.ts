import { addVolumeListener, getVolume } from "react-native-volume-manager";
import { Platform } from "react-native";

import { videoManager } from "@/src/lib/video-manager";

let lastSystemVolume: number | null = null;

/**
 * Keeps feed video mute state aligned with the hardware volume keys: when clips
 * are globally muted, raising the device volume unmutes (similar to TikTok / IG).
 * Safe no-op on web; requires a dev/production native build (not Expo Go).
 */
export function startSystemVolumeUnmuteSync(): () => void {
  if (Platform.OS === "web") {
    return () => {};
  }

  let subscription: ReturnType<typeof addVolumeListener> | null = null;

  void getVolume()
    .then(({ volume }) => {
      lastSystemVolume = volume;
    })
    .catch(() => {
      /* unsupported or permission — listener still may work */
    });

  try {
    subscription = addVolumeListener((result) => {
      const v = result.volume;
      if (lastSystemVolume === null) {
        lastSystemVolume = v;
        return;
      }
      if (!videoManager.getGlobalMuted()) {
        lastSystemVolume = v;
        return;
      }
      if (v > lastSystemVolume) {
        videoManager.setGlobalMuted(false);
      }
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
