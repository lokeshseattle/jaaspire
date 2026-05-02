import { PickedFile, useMediaPicker } from "@/hooks/use-media-picker";
import PaymentConfirmSheet from "@/src/components/payment/PaymentConfirmSheet";
import {
  appendGiftedMessages,
  GiftedChat,
  type GiftedIMessage,
} from "@/src/features/messenger/gifted-chat-bridge";
import { MessageMediaStack } from "@/src/features/messenger/messenger-message-media";
import { messengerMessagesQueryKey } from "@/src/features/messenger/messenger-query-keys";
import {
  useGetMessengerContacts,
  useInfiniteMessengerMessages,
  useMarkMessageAsRead,
  useSendAiChatMessage,
  useSendMessengerMessage,
} from "@/src/features/messenger/messenger.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import {
  uploadAndProcessMessageAttachment,
  uploadImageAttachment,
} from "@/src/features/upload/upload.hooks";
import { useUnlockMessage } from "@/src/features/wallet/wallet.hooks";
import { useChatRealtime } from "@/src/lib/pusher";
import type {
  MessengerMessage,
  MessengerMessagesResponse,
  MessengerUser,
} from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { normalizeImage } from "@/src/utils/helpers";
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
  type ComponentProps,
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
  InputToolbar,
  Send,
  type BubbleProps,
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
    text: m.message ?? "",
    createdAt: new Date(m.created_at),
    user: {
      _id: m.sender_id,
      name: m.sender.name,
      avatar: m.sender.avatar,
    },
    isSeen: m.isSeen,
    messengerAttachments: m.attachments?.length > 0 ? m.attachments : undefined,
    price: m.price,
    hasUserUnlockedMessage: m.hasUserUnlockedMessage,
    originalMessageId: m.id,
  };
}

function paramString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === "string" ? v : v[0];
}

/** GiftedChat passes full toolbar props to renderComposer at runtime; types only list ComposerProps. */
// type GiftedComposerToolbarProps = ComposerProps & {
//   onSend?: SendProps<GiftedIMessage>["onSend"];
// };

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
// function MergedComposerRow({
//   text,
//   textInputProps,
//   onSend,
//   styles,
//   theme,
// }: {
//   text?: string;
//   textInputProps?: ComposerProps["textInputProps"];
//   onSend?: GiftedComposerToolbarProps["onSend"];
//   styles: MergedComposerStyles;
//   theme: AppTheme;
// }) {
//   return (
//     <View style={styles.mergedComposer}>
//       <View style={styles.mergedComposerInputWrap}>
//         <Composer
//           text={text}
//           textInputProps={{
//             ...textInputProps,
//             textAlignVertical: "top",
//             style: [styles.mergedTextInput, textInputProps?.style],
//           }}
//         />
//       </View>
//       <Send
//         text={text}
//         onSend={onSend}
//         isSendButtonAlwaysVisible
//         containerStyle={styles.mergedSendWrap}
//         sendButtonProps={{
//           accessibilityLabel: "Send message",
//           hitSlop: { top: 6, bottom: 6, left: 6, right: 6 },
//         }}
//       >
//         <View
//           style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
//         >
//           <Ionicons name="send" size={18} color="#fff" />
//         </View>
//       </Send>
//     </View>
//   );
// }

function AttachmentPreview({
  attachment,
  onRemove,
  isUploading,
  theme,
}: {
  attachment: PickedFile | null;
  onRemove: () => void;
  isUploading: boolean;
  theme: AppTheme;
}) {
  const isVideo = attachment?.type.startsWith("video/") ?? false;
  const [videoThumb, setVideoThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment || !isVideo) {
      setVideoThumb(null);
      return;
    }
    let cancelled = false;
    import("expo-video-thumbnails")
      .then(({ getThumbnailAsync }) =>
        getThumbnailAsync(attachment.uri, { time: 0 }),
      )
      .then((result) => {
        if (!cancelled) setVideoThumb(result.uri);
      })
      .catch(() => {
        // fall back to showing a placeholder
      });
    return () => {
      cancelled = true;
    };
  }, [attachment?.uri, isVideo]);

  if (!attachment) return null;

  const previewUri = isVideo ? videoThumb : attachment.uri;

  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: theme.colors.background,
      }}
    >
      <View
        style={{
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          padding: 6,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Preview */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={{ width: 56, height: 56 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.surface,
              }}
            >
              <Ionicons
                name="videocam"
                size={26}
                color={theme.colors.textSecondary}
              />
            </View>
          )}
          {isVideo && (
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.25)",
              }}
              pointerEvents="none"
            >
              <Ionicons name="play" size={18} color="#fff" />
            </View>
          )}
        </View>

        {/* Meta */}
        <View
          style={{
            flex: 1,
            marginLeft: 10,
          }}
        >
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: 14,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            {attachment.type.startsWith("video/")
              ? "Video selected"
              : "Image selected"}
          </Text>

          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {isUploading ? "Uploading attachment..." : "Tap + to replace"}
          </Text>
        </View>

        {/* Remove */}
        <Pressable
          onPress={onRemove}
          disabled={isUploading}
          hitSlop={8}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.background,
          }}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons
              name="close"
              size={16}
              color={theme.colors.textSecondary}
            />
          )}
        </Pressable>
      </View>
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
  const [attachments, setAttachments] = useState<PickedFile | null>(null);
  const [processedAttachmentId, setProcessedAttachmentId] = useState<
    string | null
  >(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [lockPrice, setLockPrice] = useState(0);
  const [unlockTarget, setUnlockTarget] = useState<{
    messageId: number;
    price: number;
    username: string;
  } | null>(null);

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
  const unlockMessageMutation = useUnlockMessage();
  const queryClient = useQueryClient();
  const { openMediaPicker } = useMediaPicker();

  const handleAttachMedia = useCallback(() => {
    openMediaPicker({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      onChange: async (file: PickedFile) => {
        setAttachments(file);
        setProcessedAttachmentId(null);
        setIsUploadingAttachment(true);
        try {
          if (file.type.startsWith("image/")) {
            const normalized = await normalizeImage(file.uri);
            const uploaded = await uploadImageAttachment(
              normalized.uri,
              file.name ?? "image.jpg",
              "image/jpeg",
            );
            setProcessedAttachmentId(uploaded.attachmentID);
          } else {
            const { processed } = await uploadAndProcessMessageAttachment({
              fileUri: file.uri,
              fileName: file.name ?? "video.mp4",
            });
            setProcessedAttachmentId(processed.attachmentID);
          }
        } catch {
          Alert.alert(
            "Upload failed",
            "Could not upload this attachment. Please try again.",
          );
          setAttachments(null);
          setProcessedAttachmentId(null);
        } finally {
          setIsUploadingAttachment(false);
        }
      },
    });
  }, [openMediaPicker]);
  const removeAttachment = useCallback(() => {
    setAttachments(null);
    setProcessedAttachmentId(null);
    setIsLockEnabled(false);
    setLockPrice(0);
  }, []);

  const handleToggleLock = useCallback(() => {
    if (isLockEnabled) {
      setIsLockEnabled(false);
      setLockPrice(0);
      return;
    }
    Alert.prompt(
      "Set Price",
      "Set a price to unlock this attachment:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Lock",
          onPress: (value: string | undefined) => {
            const trimmed = (value ?? "").trim();
            const parsed = parseInt(trimmed, 10);
            if (
              !Number.isFinite(parsed) ||
              parsed <= 0 ||
              parsed > 100 ||
              String(parsed) !== trimmed
            ) {
              Alert.alert(
                "Invalid price",
                "Please enter a whole dollar amount from 1 to 100.",
              );
              return;
            }
            setLockPrice(parsed);
            setIsLockEnabled(true);
          },
        },
      ],
      "plain-text",
      "",
      "number-pad",
    );
  }, [isLockEnabled]);

  const handleUnlockConfirm = useCallback(async () => {
    if (!unlockTarget) return;
    try {
      await unlockMessageMutation.mutateAsync({
        messageId: unlockTarget.messageId,
        peerId,
      });
      setUnlockTarget(null);
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Could not unlock this message. Please try again.";
      Alert.alert("Unlock failed", msg);
    }
  }, [unlockTarget, unlockMessageMutation, peerId]);
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
      const t = (m.message ?? "").trim();
      serverCountByText.set(t, (serverCountByText.get(t) ?? 0) + 1);
    }

    const pendingQueueByText = new Map<string, GiftedIMessage[]>();
    for (const p of pending) {
      if (typeof p._id !== "string" || !p._id.startsWith("temp-")) continue;
      const t = (p.text ?? "").trim();
      const q = pendingQueueByText.get(t) ?? [];
      q.push(p);
      pendingQueueByText.set(t, q);
    }

    return merged.filter((msg) => {
      if (typeof msg._id !== "string" || !msg._id.startsWith("temp-")) {
        return true;
      }
      const t = (msg.text ?? "").trim();
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
      if (sendMutation.isPending || sendAiChatMutation.isPending) return;
      const msg = messages[0];
      const trimmed = msg?.text?.trim() ?? "";
      const picked = attachments;
      if (!trimmed && !picked) return;
      if (picked && !processedAttachmentId) {
        if (isUploadingAttachment) {
          Alert.alert("Please wait", "Your attachment is still uploading.");
        } else {
          Alert.alert(
            "Attachment not ready",
            "Wait for the upload to finish or remove the attachment.",
          );
        }
        return;
      }
      const tempId = `temp-${Date.now()}`;
      const optimisticAttachments = picked
        ? [
            {
              id: processedAttachmentId ?? `temp-attachment-${Date.now()}`,
              filename: picked.name,
              thumbnail: picked.uri,
              driver: 0,
              type: picked.type,
              user_id: myId,
              post_id: null,
              message_id: null,
              coconut_id: null,
              has_thumbnail: 1,
              duration: null,
              preview_duration: null,
              status: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              payment_request_id: null,
              attachmentType: (picked.type.startsWith("video/")
                ? "video"
                : "image") as "video" | "image",
              path: picked.uri,
              previewurl: null,
            },
          ]
        : undefined;
      const optimistic: GiftedIMessage = {
        ...msg,
        text: trimmed || " ",
        _id: tempId,
        pending: true,
        messengerAttachments: optimisticAttachments,
        user: {
          _id: myId,
          name: me?.data?.name,
          avatar: me?.data?.avatar,
        },
      };
      setPending((prev) => appendGiftedMessages(prev, [optimistic]));
      try {
        if (isAiConversation) {
          if (!trimmed) {
            Alert.alert(
              "Message required",
              "Please add a message before sending to this chat.",
            );
            setPending((prev) => prev.filter((m) => m._id !== tempId));
            return;
          }
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
          setAttachments(null);
          setProcessedAttachmentId(null);
        } else {
          await sendMutation.mutateAsync({
            message: trimmed,
            price: isLockEnabled ? lockPrice : 0,
            attachments: processedAttachmentId ? [processedAttachmentId] : [],
          });
          setAttachments(null);
          setProcessedAttachmentId(null);
          setIsLockEnabled(false);
          setLockPrice(0);
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
      attachments,
      processedAttachmentId,
      isUploadingAttachment,
      isLockEnabled,
      lockPrice,
    ],
  );

  const loadEarlier = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();

      console.log("fetching next page");
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderInputToolbar = useCallback(
    (toolbarProps: ComponentProps<typeof InputToolbar<GiftedIMessage>>) => (
      <View
        style={[
          styles.inputToolbarOuter,
          { paddingBottom: Math.min(insets.bottom, 6) },
        ]}
      >
        <AttachmentPreview
          attachment={attachments}
          onRemove={removeAttachment}
          isUploading={isUploadingAttachment}
          theme={theme}
        />
        {attachments && !isAiConversation && (
          <Pressable
            onPress={handleToggleLock}
            hitSlop={8}
            style={[
              styles.lockToggleBar,
              {
                backgroundColor: isLockEnabled
                  ? theme.colors.primary + "18"
                  : theme.colors.surface,
                borderColor: isLockEnabled
                  ? theme.colors.primary
                  : theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name={isLockEnabled ? "lock-closed" : "lock-open-outline"}
              size={16}
              color={
                isLockEnabled
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
            <Text
              style={[
                styles.lockToggleLabel,
                {
                  color: isLockEnabled
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                },
              ]}
            >
              {isLockEnabled ? `Locked · $${lockPrice}` : "Lock attachment"}
            </Text>
            <Ionicons
              name={isLockEnabled ? "close-circle" : "chevron-forward"}
              size={14}
              color={
                isLockEnabled
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
          </Pressable>
        )}
        <InputToolbar<GiftedIMessage>
          {...toolbarProps}
          containerStyle={[
            styles.inputToolbarInner,
            toolbarProps.containerStyle,
          ]}
        />
      </View>
    ),
    [
      attachments,
      removeAttachment,
      isUploadingAttachment,
      theme,
      insets.bottom,
      styles,
      isLockEnabled,
      lockPrice,
      handleToggleLock,
      isAiConversation,
    ],
  );

  const renderTicks = useCallback(
    (currentMessage: GiftedIMessage) => {
      if (myId == null || currentMessage.user._id !== myId) return null;

      return (
        <View style={styles.tickRow}>
          {currentMessage.pending ? (
            // ⏳ Sending
            <Ionicons
              name="time-outline"
              size={12}
              color="rgba(255,255,255,0.88)"
            />
          ) : currentMessage.isSeen ? (
            // ✅✅ Seen (blue double tick)
            <Ionicons
              name="checkmark-done"
              size={14}
              color={READ_RECEIPT_BLUE}
            />
          ) : (
            // ✅ Delivered (single tick)
            <Ionicons
              name="checkmark"
              size={14}
              color="rgba(255,255,255,0.62)"
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
  const keyboardVerticalOffset = useMemo(
    () => (Platform.OS === "ios" ? headerHeight : 0),
    [headerHeight],
  );

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
        renderCustomView={(bubbleProps: BubbleProps<GiftedIMessage>) => {
          const msg = bubbleProps.currentMessage;
          const atts = msg?.messengerAttachments;
          if (!atts?.length) return null;

          const isMessageLocked =
            (msg?.price ?? 0) > 0 && !msg?.hasUserUnlockedMessage;
          const isSender = msg?.user._id === myId;

          return (
            <MessageMediaStack
              attachments={atts}
              theme={theme}
              isLocked={isMessageLocked}
              isSender={isSender}
              price={msg?.price}
              hasUserUnlockedMessage={msg?.hasUserUnlockedMessage ?? false}
              onUnlockPress={() => {
                if (!msg?.originalMessageId || isSender) return;
                setUnlockTarget({
                  messageId: msg.originalMessageId,
                  price: msg.price ?? 0,
                  username: peerDisplay.username || peerDisplay.name,
                });
              }}
            />
          );
        }}
        renderInputToolbar={renderInputToolbar}
        isUsernameVisible={false}
        colorScheme={colorScheme}
        isInverted
        keyboardAvoidingViewProps={{
          keyboardVerticalOffset,
          enabled: Platform.OS === "ios",
        }}
        loadEarlierMessagesProps={{
          isAvailable: Boolean(hasNextPage),
          isLoading: isFetchingNextPage,
          onPress: loadEarlier,
          label: "Load earlier messages",
          isInfiniteScrollEnabled: true,
        }}
        renderActions={() => (
          <View style={styles.attachActionsWrap}>
            <Pressable
              onPress={handleAttachMedia}
              disabled={isUploadingAttachment}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={styles.attachButton}
              accessibilityRole="button"
              accessibilityLabel="Attach photo or video"
            >
              <Ionicons
                name={attachments ? "refresh-outline" : "add-outline"}
                size={28}
                color={
                  attachments
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                }
              />
            </Pressable>
          </View>
        )}
        messagesContainerStyle={{
          backgroundColor: theme.colors.background,
        }}
        // minInputToolbarHeight={78}
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
            isSendButtonAlwaysVisible={Boolean(
              attachments && processedAttachmentId,
            )}
            isTextOptional={Boolean(attachments)}
            sendButtonProps={{
              accessibilityLabel: "Send message",
              style: styles.sendButton,
            }}
          >
            <Ionicons name="send" size={18} color={theme.colors.primary} />
          </Send>
        )}
      />

      {unlockTarget && (
        <PaymentConfirmSheet
          visible={Boolean(unlockTarget)}
          onClose={() => setUnlockTarget(null)}
          onConfirm={() => void handleUnlockConfirm()}
          action="unlock_message"
          username={unlockTarget.username}
          amount={unlockTarget.price}
          loading={unlockMessageMutation.isPending}
        />
      )}
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
    inputToolbarOuter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    lockToggleBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 12,
      marginTop: 4,
      marginBottom: 2,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.md,
      borderWidth: 1,
    },
    lockToggleLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
    },
    inputToolbarInner: {
      borderTopWidth: 0,
      backgroundColor: theme.colors.background,
    },
    inputToolbarPrimary: {
      paddingHorizontal: theme.spacing.sm,
      paddingTop: 6,
      paddingBottom: 4,
      alignItems: "flex-end",
    },
    attachActionsWrap: {
      justifyContent: "flex-end",
      alignItems: "flex-end",
      paddingBottom: 4,
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

    tickRow: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 5,
    },
    attachButton: {
      paddingHorizontal: 6,
      paddingVertical: 6,
    },

    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      elevation: 2,
    },
  });
