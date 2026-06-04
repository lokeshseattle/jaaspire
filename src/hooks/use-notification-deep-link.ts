import {
  LINKING_SAFE_FALLBACK_PATH,
  rewriteMarketingPathToRouterPath,
} from "@/src/constants/linking.config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { useEffect, useRef } from "react";

const NAVIGATION_DELAY_MS = 100;
const LAST_HANDLED_NOTIFICATION_ID_KEY =
  "notification_deep_link_last_handled_id";

/** In-app notifications screen (app/(app)/notifications.tsx). */
export const NOTIFICATIONS_ALERT_ROUTE = "/notifications" as const;

type NotificationData = Record<string, unknown>;

function getNotificationData(
  response: Notifications.NotificationResponse,
): NotificationData | undefined {
  const data = response.notification.request.content.data;
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  return data as NotificationData;
}

function getNotificationDeepLinkUrl(data: NotificationData | undefined): string | null {
  const url = data?.url;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Message pushes deep-link to chat; everything else opens the notifications tab. */
function isMessageNotification(data: NotificationData | undefined): boolean {
  if (!data) return false;

  const type = data.notification_type;
  if (typeof type === "string" && type.toLowerCase() === "new-message") {
    return true;
  }

  const url = getNotificationDeepLinkUrl(data);
  if (!url) return false;

  const lower = url.toLowerCase();
  return (
    lower.includes("/my/messenger") ||
    lower.includes("/chat/") ||
    /\/chat(?:\?|$)/.test(lower) ||
    /[?&]chat=/.test(url)
  );
}

function resolveRouterPath(rawUrl: string): string {
  try {
    return rewriteMarketingPathToRouterPath(rawUrl);
  } catch {
    return LINKING_SAFE_FALLBACK_PATH;
  }
}

/**
 * Stable id for deduping notification taps across sessions.
 * Android may return a stale getLastNotificationResponse with a null identifier.
 */
function getNotificationDedupKey(
  response: Notifications.NotificationResponse,
): string | null {
  const requestId = response.notification.request.identifier?.trim();
  if (requestId) return requestId;

  const data = getNotificationData(response);
  const dataId = data?.notification_id ?? data?.id;
  if (typeof dataId === "string" && dataId.trim()) return dataId.trim();
  if (typeof dataId === "number") return String(dataId);

  const trigger = response.notification.request.trigger;
  if (trigger && typeof trigger === "object" && "remoteMessage" in trigger) {
    const messageId = (
      trigger as { remoteMessage?: { messageId?: string | null } }
    ).remoteMessage?.messageId;
    if (typeof messageId === "string" && messageId.trim()) {
      return messageId.trim();
    }
  }

  const date = response.notification.date;
  if (date > 0) return `date:${date}`;

  return null;
}

/** Ignore Android ghost responses left in getLastNotificationResponseAsync. */
function isActionableNotificationResponse(
  response: Notifications.NotificationResponse,
): boolean {
  return getNotificationDedupKey(response) != null;
}

type UseNotificationDeepLinkOptions = {
  /** When false, skips cold-start check and tap listener (e.g. while auth is restoring). */
  enabled?: boolean;
};

async function markNotificationResponseHandled(
  identifier: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_HANDLED_NOTIFICATION_ID_KEY, identifier);
  } catch {
    /* non-fatal */
  }
}

async function clearStoredNotificationResponse(): Promise<void> {
  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch {
    /* non-fatal */
  }
}

/**
 * Handles notification taps: messages use `data.url` + {@link rewriteMarketingPathToRouterPath};
 * all other types open {@link NOTIFICATIONS_ALERT_ROUTE}.
 * Register once in root `app/_layout.tsx` — response listener only (no foreground receive).
 */
export function useNotificationDeepLink(
  options: UseNotificationDeepLinkOptions = {},
): void {
  const { enabled = true } = options;
  const handledNotificationIdsRef = useRef(new Set<string>());
  const coldStartCheckedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const navigateFromResponse = (
      response: Notifications.NotificationResponse,
    ) => {
      const dedupKey = getNotificationDedupKey(response);
      if (!dedupKey) return;

      if (handledNotificationIdsRef.current.has(dedupKey)) return;
      handledNotificationIdsRef.current.add(dedupKey);

      void (async () => {
        const storedId = await AsyncStorage.getItem(
          LAST_HANDLED_NOTIFICATION_ID_KEY,
        ).catch(() => null);
        if (storedId === dedupKey) return;

        await markNotificationResponseHandled(dedupKey);
        await clearStoredNotificationResponse();

        const data = getNotificationData(response);
        const isMessage = isMessageNotification(data);

        let path: string;
        if (isMessage) {
          const rawUrl = getNotificationDeepLinkUrl(data);
          if (!rawUrl) {
            path = NOTIFICATIONS_ALERT_ROUTE;
          } else {
            path = resolveRouterPath(rawUrl);
          }
        } else {
          path = NOTIFICATIONS_ALERT_ROUTE;
        }

        setTimeout(() => {
          try {
            router.push(path as Href);
          } catch {
            try {
              router.push(LINKING_SAFE_FALLBACK_PATH);
            } catch {
              /* navigation tree not ready — avoid crashing */
            }
          }
        }, NAVIGATION_DELAY_MS);
      })();
    };

    if (!coldStartCheckedRef.current) {
      coldStartCheckedRef.current = true;
      void Notifications.getLastNotificationResponseAsync()
        .then(async (response) => {
          await clearStoredNotificationResponse();
          if (!response) return;
          if (!isActionableNotificationResponse(response)) return;
          navigateFromResponse(response);
        })
        .catch(() => {
          /* getLastNotificationResponseAsync unavailable or failed */
        });
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        navigateFromResponse,
      );

    return () => subscription.remove();
  }, [enabled]);
}
