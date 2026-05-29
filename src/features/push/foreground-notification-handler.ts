import { extractChatPeerIdFromPushUrl } from "@/src/constants/linking.config";
import { getActiveChatPeerId } from "@/src/features/push/active-chat-peer.store";
import * as Notifications from "expo-notifications";

type NotificationData = Record<string, unknown>;

function getIncomingChatPeerId(
  notification: Notifications.Notification,
): string | null {
  const data = notification.request.content.data as
    | NotificationData
    | undefined;
  if (!data) return null;

  const url = data.url;
  if (typeof url === "string" && url.trim()) {
    const fromUrl = extractChatPeerIdFromPushUrl(url);
    if (fromUrl) return fromUrl;
  }

  for (const key of ["chat", "sender_id", "from_user_id"] as const) {
    const value = data[key];
    if (value != null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return null;
}

function shouldSuppressForegroundChatNotification(
  notification: Notifications.Notification,
): boolean {
  const activePeerId = getActiveChatPeerId();
  if (activePeerId == null) return false;

  const incomingPeerId = getIncomingChatPeerId(notification);
  if (incomingPeerId == null) return false;

  return String(incomingPeerId) === String(activePeerId);
}

/** Register once at startup; handler reads live {@link getActiveChatPeerId} on each notification. */
export function configureForegroundNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      if (shouldSuppressForegroundChatNotification(notification)) {
        return {
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }

      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });
}
