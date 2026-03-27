// src/lib/pusher.ts

import { Pusher } from "@pusher/pusher-websocket-react-native";
import NetInfo from "@react-native-community/netinfo";
import { InfiniteData } from "@tanstack/react-query";
import { useFocusEffect, usePathname } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { AppState, AppStateStatus } from "react-native";
import { messengerMessagesQueryKey } from "../features/messenger/messenger-query-keys";
import { useMarkMessageAsRead } from "../features/messenger/messenger.hooks";
import { useNotificationBadgeStore } from "../features/notifications/notification-badge.store";
import { notificationCountsQueryKey } from "../features/profile/notification.hooks";
import { apiClient } from "../services/api/api.client";
import type { NotificationCountsResponse } from "../services/api/api.types";
import {
  NotificationsAPIResponse,
  TNotification,
} from "../services/api/api.types";
import { queryClient } from "./query-client";

/* =========================================================
   DEBUG LOGGING (__DEV__ only for verbose paths)
========================================================= */

const PUSHER_LOG_PREFIX = "[Pusher]";

function pusherDebug(...args: unknown[]) {
  if (__DEV__) {
    console.log(PUSHER_LOG_PREFIX, ...args);
  }
}

function pusherWarn(...args: unknown[]) {
  if (__DEV__) {
    console.warn(PUSHER_LOG_PREFIX, ...args);
  }
}

function pusherError(message: string, ...args: unknown[]) {
  console.error(PUSHER_LOG_PREFIX, message, ...args);
}

/* =========================================================
   EVENT TYPES
========================================================= */

export const EventTypes = {
  NOTIFICATION_NEW: "notification.new",
  MESSAGE_NEW: "message.new",
  MESSAGE_READ: "message.read",
  WALLET_UPDATED: "wallet.updated",
  SUBSCRIPTION_NEW: "subscription.new",
  SUBSCRIPTION_EXPIRED: "subscription.expired",
  FOLLOWER_NEW: "follower.new",
  FOLLOWER_REQUEST: "follower.request",
  POST_APPROVED: "post.approved",
  POST_REJECTED: "post.rejected",
  VIDEO_READY: "video.ready",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

/* =========================================================
   EVENT PAYLOAD MAP (TYPE SAFETY)
========================================================= */

export type EventPayloadMap = {
  /** chatId: prefer API value; else canonical DM id from {@link canonicalDirectChatId}. */
  "message.new": {
    id: string;
    chatId: string;
    text: string;
    senderId: string;
    createdAt: string;
    notification_type: string;
  };

  // "message.read": {
  //   chatId: string;
  //   messageIds: string[];
  //   readBy: string;
  // };

  "notification.new": {
    id: string;
    notification_type: string;
    message: string;
    from_user_id: number;
    from_user: {
      id: number;
      name: string;
      username: string;
      avatar: string;
    };
    post_id: number;
    created_at: string;
  };
  "wallet.updated": {
    balance: number;
  };

  "subscription.new": {
    plan: string;
    expiresAt: string;
  };

  "subscription.expired": {
    expiredAt: string;
  };

  "follower.new": {
    userId: string;
    username: string;
  };

  "follower.request": {
    userId: string;
    username: string;
  };

  "post.approved": {
    postId: string;
  };

  "post.rejected": {
    postId: string;
    reason?: string;
  };

  "video.ready": {
    postId: string;
    url: string;
  };
};

/* =========================================================
   EVENT BUS (CORE ARCHITECTURE)
========================================================= */

type Callback<K extends keyof EventPayloadMap> = (
  data: EventPayloadMap[K],
) => void;

class EventBus {
  private listeners: {
    [K in keyof EventPayloadMap]?: Callback<K>[];
  } = {};

  on<K extends keyof EventPayloadMap>(event: K, cb: Callback<K>) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(cb);
  }

  off<K extends keyof EventPayloadMap>(event: K, cb: Callback<K>) {
    const arr = this.listeners[event];
    if (!arr) return;
    const next = arr.filter((fn) => fn !== cb);
    (this.listeners as Record<K, Callback<K>[] | undefined>)[event] =
      next.length > 0 ? next : undefined;
  }

  emit<K extends keyof EventPayloadMap>(event: K, data: EventPayloadMap[K]) {
    const count = this.listeners[event]?.length ?? 0;
    pusherDebug("eventBus.emit", event, { listenerCount: count });
    this.listeners[event]?.forEach((cb) => cb(data));
  }
}

export const eventBus = new EventBus();

/* =========================================================
   PUSHER SETUP
========================================================= */

// const PUSHER_KEY = process.env.EXPO_PUBLIC_PUSHER_KEY;
// const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER;

const PUSHER_KEY = "d79a5a8f9ee122c046fe";
const PUSHER_CLUSTER = "ap2";

const pusherInstance = Pusher.getInstance();
const pusherAny = pusherInstance as any;

let isInitialized = false;
let isConnecting = false;
let isConnected = false;
let lifecycleBound = false;
let pusherLifecycleBound = false;
let appStateSubscription: { remove: () => void } | null = null;
let netInfoUnsubscribe: (() => void) | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;
let reconnectInFlight = false;
let reconnectAttempt = 0;
let isNetworkReachable = true;
let currentAppState: AppStateStatus = AppState.currentState;
let lastActivityAt = Date.now();

/** Ensures concurrent callers wait for the same init; avoids subscribing before connect. */
let pusherInitPromise: Promise<void> | null = null;

let activeUserId: string | null = null;
let activeChannelName: string | null = null;

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const WATCHDOG_INTERVAL_MS = 30_000;
const WATCHDOG_STALE_MS = 2 * 60_000;

function markRealtimeActivity(source: string) {
  lastActivityAt = Date.now();
  pusherDebug("activity", { source, at: lastActivityAt });
}

function normalizeConnectionState(state: string): string {
  return String(state).trim().toLowerCase();
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

async function forceReconnect(reason: string) {
  if (reconnectInFlight) {
    pusherDebug("forceReconnect skipped (already running)", { reason });
    return;
  }
  reconnectInFlight = true;
  clearReconnectTimer();
  pusherDebug("forceReconnect start", { reason, activeUserId });

  try {
    try {
      await pusherInstance.disconnect();
    } catch (error) {
      pusherWarn("disconnect before reconnect failed", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await pusherInstance.connect();
    isConnected = true;
    reconnectAttempt = 0;
    markRealtimeActivity(`force_reconnect:${reason}`);

    if (activeUserId) {
      channel = null;
      activeChannelName = null;
      await subscribeUserChannel(activeUserId, { forceResubscribe: true });
    }
  } catch (error) {
    isConnected = false;
    pusherError(`forceReconnect failed (${reason})`, error);
    scheduleReconnect(`force_reconnect_failed:${reason}`);
  } finally {
    reconnectInFlight = false;
  }
}

function scheduleReconnect(reason: string) {
  if (!isInitialized || !isNetworkReachable || currentAppState !== "active") {
    pusherDebug("scheduleReconnect skipped", {
      reason,
      isInitialized,
      isNetworkReachable,
      currentAppState,
    });
    return;
  }

  if (reconnectTimer || reconnectInFlight) return;

  const expDelay = Math.min(
    RECONNECT_MAX_DELAY_MS,
    RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
  );
  const jitter = Math.floor(Math.random() * 500);
  const delay = expDelay + jitter;
  reconnectAttempt += 1;

  pusherDebug("scheduleReconnect", { reason, delay, reconnectAttempt });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void forceReconnect(`scheduled:${reason}`);
  }, delay);
}

function startRealtimeWatchdog() {
  if (watchdogInterval) return;
  watchdogInterval = setInterval(() => {
    if (!isInitialized || !activeUserId) return;
    if (!isNetworkReachable || currentAppState !== "active") return;

    const idleForMs = Date.now() - lastActivityAt;
    if (isConnected && idleForMs < WATCHDOG_STALE_MS) return;

    pusherWarn("watchdog detected stale realtime connection", {
      idleForMs,
      isConnected,
    });
    scheduleReconnect("watchdog_stale");
  }, WATCHDOG_INTERVAL_MS);
}

function stopRealtimeWatchdog() {
  if (!watchdogInterval) return;
  clearInterval(watchdogInterval);
  watchdogInterval = null;
}

async function performPusherInit(): Promise<void> {
  isConnecting = true;
  pusherDebug("initializePusher start", { cluster: PUSHER_CLUSTER });

  try {
    await pusherInstance.init({
      apiKey: PUSHER_KEY!,
      cluster: PUSHER_CLUSTER!,

      onAuthorizer: async (channelName, socketId) => {
        pusherDebug("onAuthorizer", {
          channelName,
          socketIdSuffix: socketId?.slice?.(-6),
        });
        try {
          const response = await apiClient.post("/broadcasting/auth", {
            channel_name: channelName,
            socket_id: socketId,
          });

          return response.data;
        } catch (error) {
          pusherError("auth request failed", error);
          throw error;
        }
      },
    });

    bindPusherLifecycle();
    await pusherInstance.connect();

    isInitialized = true;
    isConnected = true;
    bindAppLifecycleRecovery();

    pusherDebug("connected", { cluster: PUSHER_CLUSTER });
  } catch (error) {
    pusherError("connection error", error);
    isConnected = false;
    isInitialized = false;
    pusherInitPromise = null;
    throw error;
  } finally {
    isConnecting = false;
  }
}

export const initializePusher = async () => {
  if (isInitialized) return;

  if (!pusherInitPromise) {
    pusherInitPromise = performPusherInit();
  }

  await pusherInitPromise;
};

/* =========================================================
   CHANNEL SUBSCRIPTION + BRIDGE
========================================================= */

let channel: any = null;

export const subscribeUserChannel = async (
  userId: string,
  options?: { forceResubscribe?: boolean },
) => {
  activeUserId = userId;
  const nextChannelName = `private-user.${userId}`;
  const forceResubscribe = options?.forceResubscribe === true;

  pusherDebug("subscribeUserChannel", {
    userId,
    nextChannelName,
    forceResubscribe,
  });

  try {
    await initializePusher();
  } catch {
    pusherError(
      "subscribeUserChannel: initializePusher failed, not subscribing",
    );
    return null;
  }

  if (!isInitialized) {
    pusherError("subscribeUserChannel: Pusher not initialized after await");
    return null;
  }

  if (!forceResubscribe && channel && activeChannelName === nextChannelName) {
    pusherDebug("subscribeUserChannel noop (already on channel)", {
      channelName: nextChannelName,
    });
    return channel;
  }

  if (channel && activeChannelName && activeChannelName !== nextChannelName) {
    pusherDebug("unsubscribe previous channel", {
      from: activeChannelName,
      to: nextChannelName,
    });
    try {
      await pusherInstance.unsubscribe({ channelName: activeChannelName });
    } catch (error) {
      pusherError("failed to unsubscribe previous channel", error);
    }
    channel = null;
    activeChannelName = null;
  }

  channel = await pusherInstance.subscribe({
    channelName: nextChannelName,
    onSubscriptionError: (name: string, message: string, error?: unknown) => {
      pusherError("subscription failed", { name, message, error });
    },
    onEvent: (event: { eventName: string; data: unknown }) => {
      markRealtimeActivity(`event:${event.eventName}`);
      pusherDebug("onEvent (raw)", {
        eventName: event.eventName,
        dataType: typeof event.data,
      });

      const normalizedEventName = normalizeEventName(event.eventName);

      if (!isValidEvent(normalizedEventName)) {
        pusherWarn("ignored unknown event", {
          raw: event.eventName,
          normalized: normalizedEventName,
        });
        return;
      }

      pusherDebug("channel event", {
        raw: event.eventName,
        normalized: normalizedEventName,
        data: event.data,
      });
      const bridged = bridgeEventPayload(normalizedEventName, event.data);
      eventBus.emit(normalizedEventName, bridged);
    },
  });
  activeChannelName = nextChannelName;

  pusherDebug("subscribed", { channelName: nextChannelName });

  return channel;
};

const bindPusherLifecycle = () => {
  if (pusherLifecycleBound) return;
  pusherLifecycleBound = true;

  const hasConnectionStateHandler =
    typeof pusherAny?.onConnectionStateChange === "function";
  if (hasConnectionStateHandler) {
    pusherAny.onConnectionStateChange(
      (currentState: string, previousState: string) => {
        const normalized = normalizeConnectionState(currentState);
        isConnected = normalized === "connected";
        markRealtimeActivity(`state:${normalized}`);
        if (isConnected) {
          reconnectAttempt = 0;
          clearReconnectTimer();
        } else if (
          normalized === "disconnected" ||
          normalized === "unavailable"
        ) {
          scheduleReconnect(`state:${normalized}`);
        }
        pusherDebug("connectionStateChange", { previousState, currentState });
      },
    );
  }

  const hasErrorHandler = typeof pusherAny?.onError === "function";
  if (hasErrorHandler) {
    pusherAny.onError((message: string, code?: number, error?: unknown) => {
      pusherError("runtime error", { message, code, error });
      scheduleReconnect(`error:${code ?? "unknown"}`);
    });
  }
};

const bindAppLifecycleRecovery = () => {
  if (lifecycleBound) return;
  lifecycleBound = true;

  appStateSubscription = AppState.addEventListener(
    "change",
    async (nextState: AppStateStatus) => {
      currentAppState = nextState;
      if (nextState !== "active") return;
      markRealtimeActivity("app_active");
      await recoverRealtime("app_active");
    },
  );

  netInfoUnsubscribe = NetInfo.addEventListener(async (state) => {
    isNetworkReachable = Boolean(state.isConnected);
    if (!state.isConnected) return;
    markRealtimeActivity("network_restored");
    await recoverRealtime("network_restored");
  });

  startRealtimeWatchdog();
};

const recoverRealtime = async (reason: "app_active" | "network_restored") => {
  pusherDebug("recoverRealtime", {
    reason,
    isInitialized,
    isConnected,
    activeUserId: activeUserId ?? undefined,
  });
  try {
    if (!isInitialized) {
      await initializePusher();
    } else if (!isConnected) {
      pusherDebug("recoverRealtime reconnect", { reason });
      await forceReconnect(`recover:${reason}`);
    }

    if (activeUserId) {
      channel = null;
      await subscribeUserChannel(activeUserId, { forceResubscribe: true });
    }
  } catch (error) {
    pusherError(`recoverRealtime failed (${reason})`, error);
  }
};

export const teardownPusherLifecycle = () => {
  appStateSubscription?.remove();
  appStateSubscription = null;
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
  stopRealtimeWatchdog();
  clearReconnectTimer();
  reconnectInFlight = false;
  reconnectAttempt = 0;
  lifecycleBound = false;
};

/* =========================================================
   EVENT VALIDATION + LARAVEL BROADCAST BRIDGE
========================================================= */

const isValidEvent = (event: string): event is keyof EventPayloadMap => {
  return Object.values(EventTypes).includes(event as EventType);
};

const normalizeEventName = (eventName: string): string => {
  // Laravel / broadcaster integrations often prefix a leading dot or namespace.
  if (eventName.startsWith(".")) return eventName.slice(1);
  const namespaceSplit = eventName.split(".");
  if (namespaceSplit.length > 2) {
    return namespaceSplit.slice(-2).join(".");
  }
  return eventName;
};

/** Stable DM thread id for two numeric user ids (use when navigating / useChatRealtime). */
export function canonicalDirectChatId(
  a: string | number,
  b: string | number,
): string {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) {
    return `${a}:${b}`;
  }
  return na <= nb ? `${na}:${nb}` : `${nb}:${na}`;
}

/** True when `chatId` is a canonical DM id and the current user is one of the two participants. */
function directChatIdInvolvesUser(chatId: string, myUserId: number): boolean {
  if (!chatId) return false;
  const my = String(myUserId);
  const parts = chatId.split(":");
  return parts.some((p) => p === my);
}

function parseJsonIfNeeded(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Laravel often sends `{ type, data: { ...payload }, timestamp }` as the JSON body.
 */
function readNestedUserId(obj: unknown): string | number | undefined {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    return undefined;
  }
  const id = (obj as { id?: unknown }).id;
  if (id == null || typeof id === "object") return undefined;
  return id as string | number;
}

/**
 * Resolves DM participants from flat + nested shapes (APIs differ).
 */
function resolveMessageParticipants(p: Record<string, unknown>): {
  senderRaw: string | number | undefined;
  receiverRaw: string | number | undefined;
} {
  const senderRaw =
    (p.sender_id as string | number | undefined) ??
    (p.senderId as string | number | undefined) ??
    (p.from_user_id as string | number | undefined) ??
    readNestedUserId(p.sender);

  const receiverRaw =
    (p.receiver_id as string | number | undefined) ??
    (p.receiverId as string | number | undefined) ??
    (p.to_user_id as string | number | undefined) ??
    (p.recipient_id as string | number | undefined) ??
    readNestedUserId(p.receiver);

  return { senderRaw, receiverRaw };
}

function unwrapLaravelBroadcastPayload(parsed: unknown): {
  inner: Record<string, unknown>;
  envelopeTimestamp?: string;
} {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { inner: (parsed as Record<string, unknown>) ?? {} };
  }
  const o = parsed as Record<string, unknown>;
  const nested = o.data;
  if (nested != null && typeof nested === "object" && !Array.isArray(nested)) {
    return {
      inner: nested as Record<string, unknown>,
      envelopeTimestamp:
        typeof o.timestamp === "string" ? o.timestamp : undefined,
    };
  }
  return { inner: o };
}

function bridgeEventPayload<K extends keyof EventPayloadMap>(
  event: K,
  raw: unknown,
): EventPayloadMap[K] {
  const parsed = parseJsonIfNeeded(raw);
  const { inner, envelopeTimestamp } = unwrapLaravelBroadcastPayload(parsed);

  switch (event) {
    case "message.new": {
      const p = inner;
      const { senderRaw, receiverRaw } = resolveMessageParticipants(p);
      const explicitChat =
        p.chatId ??
        p.chat_id ??
        p.conversation_id ??
        p.conversationId ??
        p.thread_id ??
        p.threadId;
      let chatId = explicitChat != null ? String(explicitChat) : "";
      if (!chatId && senderRaw != null && receiverRaw != null) {
        chatId = canonicalDirectChatId(senderRaw, receiverRaw);
      }
      // One participant id only: treat the other side as the logged-in user (common DM payloads).
      if (!chatId && activeUserId != null) {
        if (senderRaw != null && receiverRaw == null) {
          chatId = canonicalDirectChatId(activeUserId, senderRaw);
        } else if (receiverRaw != null && senderRaw == null) {
          chatId = canonicalDirectChatId(activeUserId, receiverRaw);
        }
      }
      if (!chatId) {
        pusherWarn("message.new: could not derive chatId", {
          keys: Object.keys(p),
          senderRaw,
          receiverRaw,
        });
      }
      const id = p.id;
      return {
        id: id != null ? String(id) : "",
        chatId,
        text: String(p.message ?? p.text ?? ""),
        notification_type: p.notification_type ?? "",
        senderId:
          senderRaw != null ? String(senderRaw) : String(p.senderId ?? ""),
        createdAt: String(
          envelopeTimestamp ??
            p.dateAdded ??
            p.createdAt ??
            p.created_at ??
            new Date().toISOString(),
        ),
      } as EventPayloadMap[K];
    }
    default:
      return inner as EventPayloadMap[K];
  }
}

/* =========================================================
   CHAT REALTIME HOOK
========================================================= */

export const useUnreadMessengerBadgeRealtime = () => {
  const pathname = usePathname();

  useEffect(() => {
    const handler = (data: EventPayloadMap["message.new"]) => {
      // Only adjust badge optimistically when the home feed is active.
      const isOnHomeScreen = pathname === "/(app)/(tabs)/index";

      if (isOnHomeScreen) {
        // Ensure next read reflects latest server value.
        queryClient.refetchQueries({ queryKey: notificationCountsQueryKey });
        return;
      }

      queryClient.setQueryData<NotificationCountsResponse>(
        notificationCountsQueryKey,
        (old) => {
          if (!old) return old;

          console.log("2232313", data);

          const raw = old.data?.messages ?? 0;
          const current =
            typeof raw === "string" ? parseInt(raw, 10) : Number(raw ?? 0);
          const next =
            Number.isFinite(current) && current >= 0
              ? data?.notification_type === "new-message"
                ? current
                : current + 1
              : 1;

          return {
            ...old,
            data: {
              ...old.data,
              messages: String(next),
            },
          };
        },
      );
    };

    eventBus.on("message.new", handler);
    return () => {
      eventBus.off("message.new", handler);
    };
  }, [pathname]);
};

/**
 * Update messenger thread cache + contacts when realtime events match this DM.
 * Thread updates use targeted cache merges so infinite-query “load earlier” pages are not dropped.
 * @param peerUserId - Peer user id (same as `senderId` in REST paths).
 * @param myUserId - Current user id (for canonical chat id match with Pusher payload).
 */
export const useChatRealtime = (
  peerUserId: number,
  myUserId: number | undefined,
) => {
  const chatId = useMemo(() => {
    if (myUserId == null) return "";
    return canonicalDirectChatId(myUserId, peerUserId);
  }, [myUserId, peerUserId]);
  const markMessageAsReadMutation = useMarkMessageAsRead();

  useEffect(() => {
    const handleNewMessage = (data: EventPayloadMap["message.new"]) => {
      console.log(myUserId, "myUserId");
      if (myUserId == null) return;
      const matchesCanonicalChat = Boolean(chatId) && data.chatId === chatId;
      const incomingFromPeer =
        String(data.senderId) === String(peerUserId) &&
        String(data.senderId) !== String(myUserId);
      if (!matchesCanonicalChat && !incomingFromPeer) return;

      pusherDebug("useChatRealtime message.new", {
        chatId,
        messageId: data.id,
        peerUserId,
      });
      queryClient.invalidateQueries({
        queryKey: messengerMessagesQueryKey(peerUserId),
      });
      // queryClient.invalidateQueries({ queryKey: ["messenger", "contacts"] });
      // console.log("Staring refetch");
      queryClient.refetchQueries({ queryKey: ["messenger", "contacts"] });
      // console.log("Refetched");
      markMessageAsReadMutation.mutate(peerUserId);
      // queryClient.invalidateQueries({ queryKey: ["contacts"] });
    };

    // const handleRead = (data: EventPayloadMap["message.read"]) => {
    //   if (!chatId || data.chatId !== chatId) return;

    //   pusherDebug("useChatRealtime message.read", {
    //     chatId,
    //     count: data.messageIds?.length,
    //   });
    //   queryClient.invalidateQueries({
    //     queryKey: messengerMessagesQueryKey(peerUserId),
    //   });
    //   queryClient.invalidateQueries({ queryKey: ["messenger", "contacts"] });
    //   // queryClient.invalidateQueries({ queryKey: ["contacts"] });
    // };

    eventBus.on("message.new", handleNewMessage);
    // eventBus.on("message.read", handleRead);

    return () => {
      eventBus.off("message.new", handleNewMessage);
      // eventBus.off("message.read", handleRead);
    };
  }, [chatId, peerUserId, myUserId]);
};

/**
 * While the screen that calls this hook is focused, invalidate messenger contacts
 * on any DM `message.new` / `message.read` that involves the logged-in user.
 */
export const useMessengerContactsRealtimeWhileFocused = (
  myUserId: number | undefined,
) => {
  useFocusEffect(
    useCallback(() => {
      if (myUserId == null) return;

      const handleNewMessage = (data: EventPayloadMap["message.new"]) => {
        const involvesMe =
          !data.chatId || directChatIdInvolvesUser(data.chatId, myUserId);
        if (!involvesMe) return;
        pusherDebug("useMessengerContactsRealtimeWhileFocused message.new", {
          chatId: data.chatId,
        });
        queryClient.invalidateQueries({ queryKey: ["messenger", "contacts"] });
      };

      // const handleRead = (data: EventPayloadMap["message.read"]) => {
      //   if (!data.chatId || !directChatIdInvolvesUser(data.chatId, myUserId)) {
      //     return;
      //   }
      //   pusherDebug("useMessengerContactsRealtimeWhileFocused message.read", {
      //     chatId: data.chatId,
      //   });
      //   queryClient.invalidateQueries({ queryKey: ["messenger", "contacts"] });
      // };

      eventBus.on("message.new", handleNewMessage);
      // eventBus.on("message.read", handleRead);

      return () => {
        eventBus.off("message.new", handleNewMessage);
        // eventBus.off("message.read", handleRead);
      };
    }, [myUserId]),
  );
};

/* =========================================================
   NOTIFICATION HOOK
========================================================= */

export const useNotificationRealtime = () => {
  const { incrementUnread, clearBadge } = useNotificationBadgeStore();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (data: EventPayloadMap["notification.new"]) => {
      pusherDebug("notification.new", {
        id: data.id,
        type: data.notification_type,
        pathname,
      });
      const isOnNotificationsScreen = pathname.startsWith("/notifications");

      if (!isOnNotificationsScreen) {
        incrementUnread(); // only when user is NOT on screen
      } else {
        clearBadge();
      }
      // incrementUnread();

      pusherDebug("notification.new updating query cache");
      queryClient.setQueryData<InfiniteData<NotificationsAPIResponse>>(
        ["notifications"],
        (old) => {
          if (!old) return old;
          if (old.pages.length === 0) return old;

          const mappedNotification: TNotification = {
            id: data.id,
            type: data.notification_type,
            message: data.message,
            read: false,
            created_at: data.created_at,
            from_user: {
              id: data.from_user.id,
              name: data.from_user.name,
              username: data.from_user.username,
              avatar: data.from_user.avatar,
              verified_user: false,
              story_status: {
                has_stories: false,
                all_viewed: true,
                story_count: 0,
              },
            },
            post: data.post_id ? { id: data.post_id, text: "" } : undefined,
            transaction: null,
          };

          const alreadyExists = old.pages.some((page) =>
            page.data.notifications.some((n) => n.id === mappedNotification.id),
          );

          if (alreadyExists) return old;

          const firstPage = old.pages[0];
          const updatedFirstPage: NotificationsAPIResponse = {
            ...firstPage,
            data: {
              ...firstPage.data,
              notifications: [
                mappedNotification,
                ...firstPage.data.notifications,
              ],
              pagination: {
                ...firstPage.data.pagination,
                total: firstPage.data.pagination.total + 1,
              },
            },
          };

          return {
            ...old,
            pages: [updatedFirstPage, ...old.pages.slice(1)],
          };
        },
      );

      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    eventBus.on("notification.new", handler);

    return () => {
      eventBus.off("notification.new", handler);
    };
  }, [incrementUnread, clearBadge, pathname]);
};
