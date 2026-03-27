import {
  appendGiftedMessages,
  GiftedChat,
  type GiftedIMessage,
} from "@/src/features/messenger/gifted-chat-bridge";
import { messengerMessagesQueryKey } from "@/src/features/messenger/messenger-query-keys";
import {
  useGetMessengerContacts,
  useInfiniteMessengerMessages,
  useMarkMessageAsRead,
  useSendAiChatMessage,
  useSendMessengerMessage,
} from "@/src/features/messenger/messenger.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { useChatRealtime } from "@/src/lib/pusher";
import type {
  MessengerMessage,
  MessengerMessagesResponse,
  MessengerUser,
} from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMessengerPeer } from "@/src/utils/messenger-contact";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import {
  Bubble,
  Composer,
  Send,
  type BubbleProps,
  type ComposerProps,
  type SendProps,
} from "react-native-gifted-chat";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** WhatsApp-style blue for “read” double-ticks (outgoing bubble). */
const READ_RECEIPT_BLUE = "#34B7F1";

function peerMessengerUser(
  m: MessengerMessage,
  peerUserId: number,
): MessengerUser {
  return m.sender_id === peerUserId ? m.sender : m.receiver;
}

function toGiftedMessage(m: MessengerMessage): GiftedIMessage {
  return {
    _id: m.id,
    text: m.message,
    createdAt: new Date(m.created_at),
    user: {
      _id: m.sender_id,
      name: m.sender.name,
      avatar: m.sender.avatar,
    },
    isSeen: m.isSeen,
  };
}

function paramString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === "string" ? v : v[0];
}

/** GiftedChat passes full toolbar props to renderComposer at runtime; types only list ComposerProps. */
type GiftedComposerToolbarProps = ComposerProps & {
  onSend?: SendProps<GiftedIMessage>["onSend"];
};

const MERGED_INPUT_MIN_H = 40;
const MERGED_INPUT_MAX_H = 120;

type PeerHeaderDisplay = {
  name: string;
  username: string;
  avatar: string;
};

function ChatPeerHeaderTitle({
  peer,
  theme,
}: {
  peer: PeerHeaderDisplay;
  theme: AppTheme;
}) {
  const handle = peer.username.replace(/^@/, "").trim();
  const nameTrim = peer.name.trim();
  const primary = nameTrim || (handle ? `@${handle}` : "") || "Chat";
  const showUsernameLine = handle.length > 0 && nameTrim.length > 0;

  const onPress =
    handle.length > 0
      ? () => {
          router.push({
            pathname: "/user/[username]",
            params: { username: handle },
          });
        }
      : undefined;

  const content = (
    <View style={headerTitleStyles.row}>
      {peer.avatar ? (
        <Image
          source={{ uri: peer.avatar }}
          style={headerTitleStyles.avatar}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={[
            headerTitleStyles.avatar,
            headerTitleStyles.avatarPlaceholder,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Ionicons
            name="person"
            size={18}
            color={theme.colors.textSecondary}
          />
        </View>
      )}
      <View style={headerTitleStyles.textCol}>
        <Text
          style={[headerTitleStyles.name, { color: theme.colors.textPrimary }]}
          numberOfLines={1}
        >
          {primary}
        </Text>
        {showUsernameLine ? (
          <Text
            style={[
              headerTitleStyles.username,
              { color: theme.colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            @{handle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={headerTitleStyles.pressable}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const headerTitleStyles = StyleSheet.create({
  pressable: {
    maxWidth: 240,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 240,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
  },
  username: {
    fontSize: 13,
    marginTop: 1,
  },
});

type MergedComposerStyles = ReturnType<typeof createStyles>;

/**
 * Gifted Chat's Composer keeps native height uncontrolled (no fixed `height` on iOS/Android)
 * so multiline grows like stock chat apps. We only style + cap max height; the outer bubble
 * grows with the composer row.
 */
function MergedComposerRow({
  text,
  textInputProps,
  onSend,
  styles,
  theme,
}: {
  text?: string;
  textInputProps?: ComposerProps["textInputProps"];
  onSend?: GiftedComposerToolbarProps["onSend"];
  styles: MergedComposerStyles;
  theme: AppTheme;
}) {
  return (
    <View style={styles.mergedComposer}>
      <View style={styles.mergedComposerInputWrap}>
        <Composer
          text={text}
          textInputProps={{
            ...textInputProps,
            textAlignVertical: "top",
            style: [styles.mergedTextInput, textInputProps?.style],
          }}
        />
      </View>
      <Send
        text={text}
        onSend={onSend}
        isSendButtonAlwaysVisible
        containerStyle={styles.mergedSendWrap}
        sendButtonProps={{
          accessibilityLabel: "Send message",
          hitSlop: { top: 6, bottom: 6, left: 6, right: 6 },
        }}
      >
        <View
          style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </View>
      </Send>
    </View>
  );
}

export default function MessengerChatScreen() {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { theme, mode } = useTheme();
  const systemScheme = useColorScheme();
  const colorScheme: "light" | "dark" =
    mode === "system" ? (systemScheme ?? "light") : mode;

  const { senderId, name, username, avatar, isAiBot } = useLocalSearchParams<{
    senderId?: string | string[];
    name?: string | string[];
    username?: string | string[];
    avatar?: string | string[];
    isAiBot?: string | string[];
  }>();

  const peerId = Number(paramString(senderId));
  const isAiBotParam = paramString(isAiBot);

  const { data: me } = useGetProfile();
  const myId = me?.data?.id;

  const { data: contactsData } = useGetMessengerContacts();

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteMessengerMessages(peerId);

  const sendMutation = useSendMessengerMessage(peerId);
  const sendAiChatMutation = useSendAiChatMessage();
  const markMessageAsReadMutation = useMarkMessageAsRead();
  const queryClient = useQueryClient();

  useChatRealtime(peerId, myId);

  useEffect(() => {
    markMessageAsReadMutation.mutate(peerId);
  }, [peerId]);

  useFocusEffect(
    useCallback(() => {
      // Inbox can update before thread rows become query-visible; do a second
      // focused refetch to bridge that short backend consistency window.
      void refetch();
      const timer = setTimeout(() => {
        void refetch();
      }, 900);
      return () => clearTimeout(timer);
    }, [refetch]),
  );

  // useFocusEffect(() => {
  //   markMessageAsReadMutation.mutate(peerId);
  // }, [peerId, markMessageAsReadMutation]);

  const serverMessages = useMemo(() => {
    const map = new Map<number, MessengerMessage>();
    messagesData?.pages.forEach((page: MessengerMessagesResponse) => {
      page.data.messages.forEach((m: MessengerMessage) => map.set(m.id, m));
    });
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [messagesData]);

  const peerFromContacts = useMemo(() => {
    const contacts = contactsData?.data.contacts ?? [];
    for (const c of contacts) {
      const p = getMessengerPeer(c);
      if (p.id === peerId) {
        return { name: p.name, username: "", avatar: p.avatar };
      }
    }
    return null;
  }, [contactsData, peerId]);

  const peerDisplay: PeerHeaderDisplay = useMemo(() => {
    const fromParams: PeerHeaderDisplay = {
      name: paramString(name) ?? "",
      username: paramString(username) ?? "",
      avatar: paramString(avatar) ?? "",
    };
    const latest = serverMessages[0];
    if (latest) {
      const u = peerMessengerUser(latest, peerId);
      return {
        name: (u.name && String(u.name).trim()) || fromParams.name,
        username:
          (typeof u.username === "string" && u.username.trim()) ||
          fromParams.username,
        avatar: (u.avatar && String(u.avatar).trim()) || fromParams.avatar,
      };
    }
    if (fromParams.name || fromParams.username || fromParams.avatar) {
      return fromParams;
    }
    if (peerFromContacts) {
      return {
        name: peerFromContacts.name,
        username: peerFromContacts.username,
        avatar: peerFromContacts.avatar,
      };
    }
    return { name: "", username: "", avatar: "" };
  }, [serverMessages, peerId, name, username, avatar, peerFromContacts]);

  const isAiConversation = useMemo(() => {
    const fromParams = isAiBotParam;
    if (fromParams != null) {
      const normalized = fromParams.trim().toLowerCase();
      return normalized === "1" || normalized === "true";
    }
    const contacts = contactsData?.data.contacts ?? [];
    const match = contacts.find((c) => getMessengerPeer(c).id === peerId);
    return Boolean(match?.isAiBot);
  }, [contactsData, peerId, isAiBotParam]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <ChatPeerHeaderTitle peer={peerDisplay} theme={theme} />
      ),
    });
  }, [navigation, peerDisplay, theme]);

  const giftedServerMessages = useMemo(() => {
    if (myId == null) return [];
    return serverMessages.map((m) => toGiftedMessage(m));
  }, [serverMessages, myId]);

  const [pending, setPending] = useState<GiftedIMessage[]>([]);

  /**
   * Hide optimistic rows once enough server copies exist for that text from me
   * (avoids a one-frame gap before React re-renders after refetch).
   * Uses counts so duplicate identical messages in a row still behave.
   */
  const displayMessages = useMemo(() => {
    const merged = appendGiftedMessages(giftedServerMessages, pending);
    if (myId == null) return merged;

    const serverCountByText = new Map<string, number>();
    for (const m of serverMessages) {
      if (m.sender_id !== myId) continue;
      const t = m.message.trim();
      serverCountByText.set(t, (serverCountByText.get(t) ?? 0) + 1);
    }

    const pendingQueueByText = new Map<string, GiftedIMessage[]>();
    for (const p of pending) {
      if (typeof p._id !== "string" || !p._id.startsWith("temp-")) continue;
      const t = p.text.trim();
      const q = pendingQueueByText.get(t) ?? [];
      q.push(p);
      pendingQueueByText.set(t, q);
    }

    return merged.filter((msg) => {
      if (typeof msg._id !== "string" || !msg._id.startsWith("temp-")) {
        return true;
      }
      const t = msg.text.trim();
      const queue = pendingQueueByText.get(t) ?? [];
      const ordinal = queue.findIndex((p) => p._id === msg._id) + 1;
      if (ordinal === 0) return true;
      const serverCount = serverCountByText.get(t) ?? 0;
      return serverCount < ordinal;
    });
  }, [giftedServerMessages, pending, serverMessages, myId]);

  const currentUser = useMemo(
    () =>
      myId != null
        ? {
            _id: myId,
            name: me?.data?.name,
            avatar: me?.data?.avatar,
          }
        : { _id: 0 },
    [myId, me?.data?.name, me?.data?.avatar],
  );

  const onSend = useCallback(
    async (messages: GiftedIMessage[]) => {
      if (myId == null) return;
      // if (sendMutation.isPending) return;
      const msg = messages[0];
      const trimmed = msg?.text?.trim();
      if (!trimmed) return;
      const tempId = `temp-${Date.now()}`;
      const optimistic: GiftedIMessage = {
        ...msg,
        _id: tempId,
        pending: true,
        user: {
          _id: myId,
          name: me?.data?.name,
          avatar: me?.data?.avatar,
        },
      };
      setPending((prev) => appendGiftedMessages(prev, [optimistic]));
      try {
        if (isAiConversation) {
          const res = await sendAiChatMutation.mutateAsync({
            message: trimmed,
          });
          queryClient.setQueryData<InfiniteData<MessengerMessagesResponse>>(
            messengerMessagesQueryKey(peerId),
            (prev) => {
              const userMessage = res.data.user_message;
              const aiMessage = res.data.ai_message;
              if (!prev || prev.pages.length === 0) {
                return {
                  pageParams: [undefined],
                  pages: [
                    {
                      status: "success",
                      data: {
                        messages: [userMessage, aiMessage],
                        pagination: {
                          hasMore: false,
                          oldestMessageId: Math.min(
                            userMessage.id,
                            aiMessage.id,
                          ),
                        },
                      },
                    },
                  ],
                };
              }

              const firstPage = prev.pages[0];
              const existingIds = new Set(
                firstPage.data.messages.map((m) => Number(m.id)),
              );
              const nextMessages = [...firstPage.data.messages];
              if (!existingIds.has(Number(userMessage.id))) {
                nextMessages.push(userMessage);
              }
              if (!existingIds.has(Number(aiMessage.id))) {
                nextMessages.push(aiMessage);
              }

              return {
                ...prev,
                pages: [
                  {
                    ...firstPage,
                    data: {
                      ...firstPage.data,
                      messages: nextMessages,
                    },
                  },
                  ...prev.pages.slice(1),
                ],
              };
            },
          );
          await queryClient.invalidateQueries({
            queryKey: ["messenger", "contacts"],
          });
        } else {
          await sendMutation.mutateAsync(
            { message: trimmed, price: 0 },
            {
              onSuccess: (data) => {
                console.log("121212", data.data);
              },
            },
          );
          await queryClient.refetchQueries({
            queryKey: messengerMessagesQueryKey(peerId),
          });
        }
        /** Let React Query subscribers apply cache before dropping the temp row (prevents flicker). */
        await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
        setPending((prev) => prev.filter((m) => m._id !== tempId));
      } catch {
        setPending((prev) => prev.filter((m) => m._id !== tempId));
        Alert.alert("Could not send", "Please try again.");
      }
    },
    [
      myId,
      me?.data?.name,
      me?.data?.avatar,
      sendMutation,
      sendAiChatMutation,
      queryClient,
      peerId,
      isAiConversation,
    ],
  );

  const loadEarlier = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();

      console.log("fetching next page");
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderTicks = useCallback(
    (currentMessage: GiftedIMessage) => {
      if (myId == null || currentMessage.user._id !== myId) return null;
      return (
        <View style={styles.tickRow}>
          {currentMessage.pending ? (
            <Ionicons
              name="time-outline"
              size={12}
              color="rgba(255,255,255,0.88)"
            />
          ) : (
            <Ionicons
              name="checkmark-done"
              size={14}
              color={
                currentMessage.isSeen
                  ? READ_RECEIPT_BLUE
                  : "rgba(255,255,255,0.62)"
              }
            />
          )}
        </View>
      );
    },
    [myId, styles],
  );

  const renderBubble = useCallback(
    (bubbleProps: BubbleProps<GiftedIMessage>) => (
      <Bubble {...bubbleProps} renderTicks={renderTicks} />
    ),
    [renderTicks],
  );

  /**
   * Offset for keyboard-controller KAV (screen-top → view). Using header + full
   * safe-top often over-pads; header-only keeps the composer tight to the keyboard.
   */
  const keyboardVerticalOffset = useMemo(() => headerHeight, [headerHeight]);

  if (!Number.isFinite(peerId) || peerId <= 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Invalid conversation.</Text>
      </View>
    );
  }

  if (isLoading && !messagesData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load messages.</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // Set price row: was renderAccessory + Pressable "Set price" — restore when monetization ships.
  return (
    <View style={styles.root}>
      <GiftedChat
        messages={displayMessages}
        onSend={onSend}
        user={currentUser}
        renderBubble={renderBubble}
        isUsernameVisible={false}
        colorScheme={colorScheme}
        isInverted
        keyboardAvoidingViewProps={{
          keyboardVerticalOffset,
        }}
        loadEarlierMessagesProps={{
          isAvailable: Boolean(hasNextPage),
          isLoading: isFetchingNextPage,
          onPress: loadEarlier,
          label: "Load earlier messages",
          isInfiniteScrollEnabled: true,
        }}
        messagesContainerStyle={{
          backgroundColor: theme.colors.background,
        }}
        // minInputToolbarHeight={78}
        containerStyle={[
          styles.inputToolbarContainer,
          { paddingBottom: Math.min(insets.bottom, 6) },
        ]}
        primaryStyle={styles.inputToolbarPrimary}
        textInputProps={{
          placeholder: "Message",
          placeholderTextColor: theme.colors.textSecondary,
          multiline: true,
          numberOfLines: 4,
        }}
        // renderComposer={(props: ComposerProps) => {
        //   const { text, textInputProps, onSend } =
        //     props as GiftedComposerToolbarProps;
        //   return (
        //     <MergedComposerRow
        //       text={text}
        //       textInputProps={textInputProps}
        //       onSend={onSend}
        //       styles={styles}
        //       theme={theme}
        //     />
        //   );
        // }}
        renderSend={(props: SendProps<GiftedIMessage>) => (
          <Send
            {...props}
            containerStyle={styles.mergedSendWrap}
            sendButtonProps={{
              accessibilityLabel: "Send message",
              style: styles.sendButton,
            }}
          >
            <Ionicons name="send" size={18} color={theme.colors.primary} />
          </Send>
        )}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
      // backgroundColor: "red",
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      textAlign: "center",
      marginBottom: theme.spacing.md,
    },
    retryBtn: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    retryLabel: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600",
    },
    inputToolbarContainer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      // backgroundColor: theme.colors.background,
      // backgroundColor: "blue",
      // height: 100,
      // height: MERGED_INPUT_MAX_H,
    },
    inputToolbarPrimary: {
      paddingHorizontal: theme.spacing.sm,
      paddingTop: 6,
      paddingBottom: 4,
      alignItems: "flex-end",
    },
    mergedComposer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-end",
      // backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      paddingLeft: theme.spacing.md,
      paddingRight: 4,
      paddingVertical: 4,
      minHeight: MERGED_INPUT_MIN_H,
      backgroundColor: "green",
    },
    mergedComposerInputWrap: {
      flex: 1,
      minWidth: 0,
    },
    mergedTextInput: {
      fontSize: 16,
      lineHeight: 22,
      minHeight: MERGED_INPUT_MIN_H,
      maxHeight: MERGED_INPUT_MAX_H,
      margin: 0,
      paddingTop: Platform.OS === "ios" ? 8 : 6,
      paddingBottom: Platform.OS === "ios" ? 8 : 6,
      paddingRight: 6,
      paddingLeft: 0,
      color: theme.colors.textPrimary,
      backgroundColor: "transparent",
    },
    mergedSendWrap: {
      justifyContent: "flex-end",
      alignSelf: "flex-end",
      marginBottom: 2,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    tickRow: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 5,
    },
  });
