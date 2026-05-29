import {
  LINKING_SAFE_FALLBACK_PATH,
  rewriteMarketingPathToRouterPath,
} from "@/src/constants/linking.config";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { useEffect, useRef } from "react";

const NAVIGATION_DELAY_MS = 100;
const LOG_PREFIX = "[NotificationDeepLink]";

/** In-app notifications / alerts screen (app/(app)/notifications.tsx). */
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
  } catch (error) {
    if (__DEV__) {
      console.warn(LOG_PREFIX, "rewriteMarketingPathToRouterPath threw", error);
    }
    return LINKING_SAFE_FALLBACK_PATH;
  }
}

type UseNotificationDeepLinkOptions = {
  /** When false, skips cold-start check and tap listener (e.g. while auth is restoring). */
  enabled?: boolean;
};

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
      const notificationId = response.notification.request.identifier;
      if (handledNotificationIdsRef.current.has(notificationId)) return;
      handledNotificationIdsRef.current.add(notificationId);

      const data = getNotificationData(response);
      const isMessage = isMessageNotification(data);

      let path: string;
      if (isMessage) {
        const rawUrl = getNotificationDeepLinkUrl(data);
        if (!rawUrl) {
          if (__DEV__) {
            console.warn(LOG_PREFIX, "Message notification missing data.url", {
              data,
            });
          }
          path = NOTIFICATIONS_ALERT_ROUTE;
        } else {
          path = resolveRouterPath(rawUrl);
          if (path === LINKING_SAFE_FALLBACK_PATH) {
            if (__DEV__) {
              console.warn(
                LOG_PREFIX,
                "Unrecognized message URL; routing to fallback",
                { rawUrl, path },
              );
            }
          }
        }
      } else {
        path = NOTIFICATIONS_ALERT_ROUTE;
      }

      if (__DEV__) {
        console.log(LOG_PREFIX, "Navigating", {
          isMessage,
          path,
          notification_type: data?.notification_type,
        });
      }

      setTimeout(() => {
        try {
          router.push(path as Href);
        } catch (error) {
          if (__DEV__) {
            console.warn(LOG_PREFIX, "router.push failed", { path, error });
          }
          try {
            router.push(LINKING_SAFE_FALLBACK_PATH);
          } catch {
            /* navigation tree not ready — avoid crashing */
          }
        }
      }, NAVIGATION_DELAY_MS);
    };

    if (!coldStartCheckedRef.current) {
      coldStartCheckedRef.current = true;
      void Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) navigateFromResponse(response);
        })
        .catch((error) => {
          if (__DEV__) {
            console.warn(
              LOG_PREFIX,
              "getLastNotificationResponseAsync failed",
              error,
            );
          }
        });
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        navigateFromResponse,
      );

    return () => subscription.remove();
  }, [enabled]);
}
