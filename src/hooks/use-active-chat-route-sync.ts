import { setActiveChatPeerId } from "@/src/features/push/active-chat-peer.store";
import { usePathname, useSegments } from "expo-router";
import { useEffect } from "react";

/** Matches `/chat/5452` — same param as `app/(app)/chat/[senderId].tsx`. */
const CHAT_PATH_PEER_REGEX = /^\/chat\/([^/]+)/;

/**
 * Keeps active chat peer id in sync with Expo Router (for foreground push suppression).
 * Call once from root layout; only updates a module ref (no notification re-bindings).
 */
export function useActiveChatRouteSync(): void {
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    const pathMatch = pathname.match(CHAT_PATH_PEER_REGEX);
    if (pathMatch?.[1]) {
      setActiveChatPeerId(decodeURIComponent(pathMatch[1]));
      return;
    }

    const chatSegmentIdx = segments.findIndex((s) => s === "chat");
    if (chatSegmentIdx >= 0) {
      const next = segments[chatSegmentIdx + 1];
      if (next && next !== "[senderId]") {
        setActiveChatPeerId(decodeURIComponent(next));
        return;
      }
    }

    setActiveChatPeerId(null);
  }, [pathname, segments]);
}
