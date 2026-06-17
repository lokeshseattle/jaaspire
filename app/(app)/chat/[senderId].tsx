import JaasiStar from "@/assets/svg/JaasiStar";
import { PickedFile, useMediaPicker } from "@/hooks/use-media-picker";
import ReportModal from "@/src/components/home/posts/ReportModal";
import PaymentConfirmSheet from "@/src/components/payment/PaymentConfirmSheet";
import {
  appendGiftedMessages,
  GiftedChat,
  type GiftedIMessage,
} from "@/src/features/messenger/gifted-chat-bridge";
import { MessageMediaStack } from "@/src/features/messenger/messenger-message-media";
import { messengerMessagesQueryKey } from "@/src/features/messenger/messenger-query-keys";
import {
  messengerUserFromProfile,
  useGetMessengerContacts,
  useInfiniteMessengerMessages,
  useMarkMessageAsRead,
  useResetAiChat,
  useSendAiChatMessage,
  useSendMessengerMessage,
} from "@/src/features/messenger/messenger.hooks";
import {
  useBlockUserMutation,
  useGetProfile,
  useGetProfileByUsername,
  useUnblockUserMutation,
} from "@/src/features/profile/profile.hooks";
import {
  uploadAndProcessMessageAttachment,
  uploadImageAttachment,
} from "@/src/features/upload/upload.hooks";
import {
  formatIapUsdAmount,
  getStarsForWalletSku,
  skuForStarAmount,
} from "@/src/features/wallet/iap.constants";
import { useIap } from "@/src/features/wallet/iap.context";
import {
  useIapSkus,
  useUnlockMessage,
} from "@/src/features/wallet/wallet.hooks";
import { useChatRealtime } from "@/src/lib/pusher";
import type {
  IapSkuListItem,
  MessengerMessage,
  MessengerMessagesResponse,
  MessengerUser,
  ReportTarget,
} from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { normalizeImage } from "@/src/utils/helpers";
import { getMessengerPeer } from "@/src/utils/messenger-contact";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
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
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import type { ScrollEvent } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** WhatsApp-style blue for “read” double-ticks (outgoing bubble). */
const READ_RECEIPT_BLUE = "#34B7F1";

/** In inverted GiftedChat, offset near 0 means the user is at the newest messages. */
const CHAT_AT_BOTTOM_OFFSET_THRESHOLD = 80;

function formatLockStars(amount: number): string {
  if (Number.isInteger(amount)) return amount.toLocaleString();
  return amount.toFixed(2);
}

type LockPriceOption = {
  sku_key: string;
  stars: number;
  usdLabel: string | null;
};

function AttachmentLockPricePicker({
  options,
  selectedSkuKey,
  onSelectSkuKey,
  isPending,
  isError,
  onRetry,
  theme,
  styles,
}: {
  options: LockPriceOption[];
  selectedSkuKey: string;
  onSelectSkuKey: (skuKey: string) => void;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  theme: AppTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  if (isPending) {
    return (
      <View style={styles.lockPriceLoadingRow}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.lockPriceLoadingText}>Loading price options…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <Pressable onPress={onRetry} style={styles.lockPriceUnavailableCard}>
        <Text style={styles.lockPriceUnavailableTitle}>
          Could not load price options
        </Text>
        <Text style={styles.lockPriceUnavailableBody}>Tap to retry</Text>
      </Pressable>
    );
  }

  if (options.length === 0) {
    return (
      <View style={styles.lockPriceUnavailableCard}>
        <Text style={styles.lockPriceUnavailableTitle}>
          No price options available
        </Text>
        <Text style={styles.lockPriceUnavailableBody}>Try again later.</Text>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.lockPriceSectionLabel}>Choose unlock price</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lockPriceChipRow}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((option) => {
          const selected = option.sku_key === selectedSkuKey;
          return (
            <Pressable
              key={option.sku_key}
              onPress={() => onSelectSkuKey(option.sku_key)}
              style={[
                styles.lockPriceChip,
                selected && styles.lockPriceChipSelected,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={styles.lockPriceChipTopRow}>
                <JaasiStar width={16} height={16} />
                <Text
                  style={[
                    styles.lockPriceChipAmount,
                    selected && styles.lockPriceChipAmountSelected,
                  ]}
                >
                  {formatLockStars(option.stars)}
                </Text>
              </View>
              {option.usdLabel ? (
                <Text
                  style={[
                    styles.lockPriceChipHint,
                    selected && styles.lockPriceChipHintSelected,
                  ]}
                  numberOfLines={1}
                >
                  {option.usdLabel}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.lockPriceHint}>
        Select an unlock price for this attachment.
      </Text>
    </>
  );
}

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
    // maxWidth: 240,
    alignItems: "flex-start",
    // backgroundColor: "blue",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    // alignItems: "flex-start",
    // backgroundColor: "red",
    // maxWidth: 240,
    width: "100%",
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
    fontSize: 16,
    fontWeight: "600",
  },
  username: {
    fontSize: 12,
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
  const [selectedLockSkuKey, setSelectedLockSkuKey] = useState("");
  const [unlockTarget, setUnlockTarget] = useState<{
    messageId: number;
    price: number;
    username: string;
  } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const streamingAiRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const [streamingAi, setStreamingAi] = useState<{
    messageId: number;
    text: string;
  } | null>(null);

  const giftedListProps = useMemo(
    () => ({
      scrollEventThrottle: 16,
      onScroll: (event: ScrollEvent) => {
        const y = event.contentOffset?.y ?? 0;
        isAtBottomRef.current = y <= CHAT_AT_BOTTOM_OFFSET_THRESHOLD;
      },
      maintainVisibleContentPosition: {
        minIndexForVisible: 0,
        autoscrollToTopThreshold: CHAT_AT_BOTTOM_OFFSET_THRESHOLD,
      },
    }),
    [],
  );

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
  const resetAiChatMutation = useResetAiChat(peerId);
  const markMessageAsReadMutation = useMarkMessageAsRead();
  const unlockMessageMutation = useUnlockMessage();
  const blockMutation = useBlockUserMutation();
  const unblockMutation = useUnblockUserMutation();
  const queryClient = useQueryClient();
  const { openMediaPicker } = useMediaPicker();
  const {
    connected: isIapConnected,
    startPurchase,
    isProcessing: isIapUnlockProcessing,
  } = useIap();
  const {
    data: iapSkusResponse,
    isPending: iapSkusPending,
    isError: iapSkusError,
    refetch: refetchIapSkus,
  } = useIapSkus("consumable");

  const lockPriceOptions = useMemo(() => {
    const skus = iapSkusResponse?.skus ?? [];
    const consumables = skus.filter(
      (s): s is IapSkuListItem & { category: "consumable"; stars: number } =>
        s.category === "consumable" && typeof s.stars === "number",
    );
    return [...consumables]
      .sort((a, b) => a.stars - b.stars)
      .map((row) => ({
        sku_key: row.sku_key,
        stars: row.stars,
        usdLabel: formatIapUsdAmount(row.usd_amount),
      }));
  }, [iapSkusResponse?.skus]);

  const selectedLockProduct = useMemo(
    () =>
      lockPriceOptions.find(
        (product) => product.sku_key === selectedLockSkuKey,
      ),
    [selectedLockSkuKey, lockPriceOptions],
  );

  const lockPrice = selectedLockProduct?.stars ?? 0;

  const messageIapSku = useMemo(() => {
    if (!unlockTarget) return null;
    const skus = iapSkusResponse?.skus ?? [];
    if (!skus.length) return null;
    return skuForStarAmount(unlockTarget.price, skus);
  }, [unlockTarget, iapSkusResponse?.skus]);

  const messageIapStars = useMemo(() => {
    if (!messageIapSku) return null;
    return getStarsForWalletSku(messageIapSku, iapSkusResponse?.skus ?? []);
  }, [iapSkusResponse?.skus, messageIapSku]);

  const handleAttachMedia = useCallback(() => {
    openMediaPicker({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      onChange: async (file: PickedFile) => {
        setAttachments(file);
        setProcessedAttachmentId(null);
        setIsLockEnabled(false);
        setSelectedLockSkuKey("");
        void refetchIapSkus();
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
  }, [openMediaPicker, refetchIapSkus]);

  useEffect(() => {
    if (!isLockEnabled || lockPriceOptions.length === 0) return;
    setSelectedLockSkuKey((prev) =>
      prev && lockPriceOptions.some((p) => p.sku_key === prev)
        ? prev
        : lockPriceOptions[0].sku_key,
    );
  }, [isLockEnabled, lockPriceOptions]);

  const removeAttachment = useCallback(() => {
    setAttachments(null);
    setProcessedAttachmentId(null);
    setIsLockEnabled(false);
    setSelectedLockSkuKey("");
  }, []);

  const handleToggleLock = useCallback(() => {
    if (isLockEnabled) {
      setIsLockEnabled(false);
      setSelectedLockSkuKey("");
      return;
    }
    setIsLockEnabled(true);
    void refetchIapSkus();
  }, [isLockEnabled, refetchIapSkus]);

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

  const handleConfirmIapUnlock = useCallback(
    async (sku: string) => {
      if (!unlockTarget) return;
      if (!isIapConnected) {
        Alert.alert("Store unavailable", "Please try again in a moment.");
        return;
      }

      const target = unlockTarget;

      try {
        await startPurchase({
          intent: {
            kind: "unlock_message",
            messageId: target.messageId,
            peerId,
          },
          storeProductId: sku,
          purchaseType: "in-app",
          onSuccess: () => setUnlockTarget(null),
        });
      } catch (e) {
        Alert.alert(
          "Could not start purchase",
          e instanceof Error ? e.message : "Try again in a moment.",
        );
      }
    },
    [isIapConnected, peerId, startPurchase, unlockTarget],
  );

  useChatRealtime(peerId, myId, streamingAiRef);

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
    return Array.from(map.values()).sort((a, b) => {
      const byTime =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (byTime !== 0) return byTime;
      return Number(b.id) - Number(a.id);
    });
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

  const peerUsername = useMemo(
    () => peerDisplay.username.replace(/^@/, "").trim(),
    [peerDisplay.username],
  );

  const canAttachMedia = useMemo(() => {
    if (peerId === 7777) return false;
    if (peerUsername.toLowerCase() === "jaasi_ai") return false;
    return true;
  }, [peerId, peerUsername]);

  const { data: peerProfile, refetch: refetchPeerProfile } =
    useGetProfileByUsername(peerUsername);

  const isBlockedByYou = peerProfile?.data?.blocked_status === "blocked_by_you";
  const isBlockedByUser =
    peerProfile?.data?.blocked_status === "blocked_by_user";
  const isMessagingBlocked = isBlockedByYou || isBlockedByUser;
  const showChatMenu =
    myId != null && Number.isFinite(peerId) && peerId > 0 && peerId !== myId;

  useFocusEffect(
    useCallback(() => {
      if (peerUsername) void refetchPeerProfile();
    }, [peerUsername, refetchPeerProfile]),
  );

  const closeMenu = useCallback(() => setMenuVisible(false), []);
  const openMenu = useCallback(() => setMenuVisible(true), []);

  const handleReportUser = useCallback(() => {
    closeMenu();
    setReportTarget({ kind: "user", userId: peerId });
  }, [closeMenu, peerId]);

  const handleResetChat = useCallback(() => {
    closeMenu();
    Alert.alert(
      "Reset Chat",
      "Start a fresh conversation with JaasiAI? Your current chat history will be cleared.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetAiChatMutation.mutate(undefined, {
              onSuccess: async () => {
                setPending([]);
                setStreamingAi(null);
                await refetch();
              },
              onError: () => {
                Alert.alert(
                  "Couldn't reset chat",
                  "Something went wrong. Try again.",
                );
              },
            });
          },
        },
      ],
    );
  }, [closeMenu, resetAiChatMutation, refetch]);

  const handleBlock = useCallback(() => {
    if (!peerUsername) {
      Alert.alert(
        "Not ready",
        "Please wait until the conversation loads, then try again.",
      );
      return;
    }
    closeMenu();
    Alert.alert(
      "Block user",
      `Block @${peerUsername}? You won't receive messages from this user.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            blockMutation.mutate(peerUsername, {
              onSuccess: () => {
                queryClient.invalidateQueries({
                  queryKey: messengerMessagesQueryKey(peerId),
                });
                Alert.alert(
                  "Blocked",
                  "You won't receive messages from this user.",
                  [{ text: "OK", onPress: () => router.back() }],
                );
              },
              onError: () => {
                Alert.alert(
                  "Couldn't block",
                  "Something went wrong. Try again.",
                );
              },
            });
          },
        },
      ],
    );
  }, [peerUsername, closeMenu, blockMutation, queryClient, peerId]);

  const handleUnblock = useCallback(() => {
    if (!peerUsername) return;
    closeMenu();
    Alert.alert("Unblock user", `Unblock @${peerUsername}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: () => {
          unblockMutation.mutate(peerUsername, {
            onSuccess: () => {
              void refetchPeerProfile();
              Alert.alert("Unblocked", "You can message this user again.");
            },
            onError: () => {
              Alert.alert(
                "Couldn't unblock",
                "Something went wrong. Try again.",
              );
            },
          });
        },
      },
    ]);
  }, [peerUsername, closeMenu, unblockMutation, refetchPeerProfile]);

  const openMessageReport = useCallback(
    (messageId: number) => {
      setReportTarget({ kind: "message", messageId, userId: peerId });
    },
    [peerId],
  );

  const handleLongPressMessage = useCallback(
    (message: GiftedIMessage | undefined) => {
      if (!message) return;
      const messageId = message.originalMessageId;
      const isPeerMessage =
        myId != null && message.user._id === peerId && !message.pending;
      const canReportMessage =
        isPeerMessage && typeof messageId === "number" && messageId > 0;
      if (!canReportMessage) return;

      Alert.alert("Message", undefined, [
        {
          text: "Report message",
          style: "destructive",
          onPress: () => openMessageReport(messageId),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [myId, peerId, openMessageReport],
  );

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
      if (isMessagingBlocked) return;
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
      if (picked && isLockEnabled && !selectedLockProduct) {
        Alert.alert(
          "Select unlock price",
          "Choose a price before sending a locked attachment.",
        );
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
      let aiSendConfirmed = false;
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
          if (!myId || !me?.data) {
            setPending((prev) => prev.filter((m) => m._id !== tempId));
            return;
          }
          streamingAiRef.current = true;
          try {
            await sendAiChatMutation.mutateAsync({
              message: trimmed,
              peerUserId: peerId,
              myId,
              myUser: messengerUserFromProfile(myId, {
                name: me.data.name,
                username: me.data.username,
                avatar: me.data.avatar,
                bio: me.data.bio,
              }),
              peerUser: messengerUserFromProfile(peerId, {
                name: peerDisplay.name,
                username: peerDisplay.username,
                avatar: peerDisplay.avatar,
              }),
              onStreamStart: (data) => {
                aiSendConfirmed = true;
                setPending((prev) => prev.filter((m) => m._id !== tempId));
                setStreamingAi({
                  messageId: data.ai_message_id,
                  text: "",
                });
              },
              onStreamChunk: (aiMessageId, text) => {
                setStreamingAi({ messageId: aiMessageId, text });
              },
              onStreamComplete: () => {
                setStreamingAi(null);
              },
            });
            setAttachments(null);
            setProcessedAttachmentId(null);
          } finally {
            streamingAiRef.current = false;
            if (!aiSendConfirmed) {
              setStreamingAi(null);
            }
          }
        } else {
          await sendMutation.mutateAsync({
            message: trimmed,
            sku_key:
              isLockEnabled && selectedLockProduct
                ? selectedLockProduct.sku_key
                : "",
            attachments: processedAttachmentId ? [processedAttachmentId] : [],
          });
          setAttachments(null);
          setProcessedAttachmentId(null);
          setIsLockEnabled(false);
          setSelectedLockSkuKey("");
        }
        /** Let React Query subscribers apply cache before dropping the temp row (prevents flicker). */
        await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
        if (!isAiConversation || !aiSendConfirmed) {
          setPending((prev) => prev.filter((m) => m._id !== tempId));
        }
      } catch {
        setPending((prev) => prev.filter((m) => m._id !== tempId));
        setStreamingAi(null);
        Alert.alert("Could not send", "Please try again.");
      }
    },
    [
      myId,
      me?.data,
      me?.data?.name,
      me?.data?.avatar,
      sendMutation,
      sendAiChatMutation,
      queryClient,
      peerId,
      isAiConversation,
      peerDisplay.name,
      peerDisplay.username,
      peerDisplay.avatar,
      attachments,
      processedAttachmentId,
      isUploadingAttachment,
      isLockEnabled,
      lockPrice,
      selectedLockProduct,
      isMessagingBlocked,
    ],
  );

  const loadEarlier = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();

      // console.log("fetching next page");
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleAlign: "left",
      headerTitle: () => (
        <ChatPeerHeaderTitle peer={peerDisplay} theme={theme} />
      ),
      headerRight: showChatMenu
        ? () => (
            <Pressable onPress={openMenu} style={styles.headerRightButton}>
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={theme.colors.textPrimary}
              />
            </Pressable>
          )
        : undefined,
    });
  }, [
    navigation,
    peerDisplay,
    theme,
    showChatMenu,
    openMenu,
    styles.headerRightButton,
    theme.colors.textPrimary,
  ]);

  /**
   * iOS: offset = header height (GiftedChat sits below stack header).
   * Android: useHeaderHeight() can spike; cap to status bar + typical nav header.
   */
  const androidKeyboardOffset = useMemo(() => {
    const typicalStackHeader = insets.top + 56;
    return Math.min(headerHeight, typicalStackHeader);
  }, [headerHeight, insets.top]);
  const keyboardVerticalOffset = useMemo(
    () => (Platform.OS === "ios" ? headerHeight : androidKeyboardOffset),
    [androidKeyboardOffset, headerHeight],
  );
  const keyboardAvoidingViewProps = useMemo(
    () =>
      Platform.OS === "android"
        ? {
            keyboardVerticalOffset: androidKeyboardOffset,
            enabled: true,
            behavior: "translate-with-padding" as const,
          }
        : {
            keyboardVerticalOffset,
            enabled: true,
          },
    [androidKeyboardOffset, keyboardVerticalOffset],
  );

  const renderInputToolbar = useCallback(
    (toolbarProps: ComponentProps<typeof InputToolbar<GiftedIMessage>>) => {
      if (isMessagingBlocked) {
        return (
          <View
            style={[
              styles.blockedComposerBanner,
              { paddingBottom: Math.min(insets.bottom, 6) },
            ]}
          >
            <Ionicons
              name="ban-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.blockedComposerText}>
              {isBlockedByYou
                ? "You blocked this user. Unblock from the menu to send messages."
                : "You can't message this user."}
            </Text>
          </View>
        );
      }

      return (
        <View
          style={[
            styles.inputToolbarOuter,
            { paddingBottom: Math.min(insets.bottom, 6) },
          ]}
        >
          {canAttachMedia ? (
            <AttachmentPreview
              attachment={attachments}
              onRemove={removeAttachment}
              isUploading={isUploadingAttachment}
              theme={theme}
            />
          ) : null}
          {canAttachMedia && attachments && !isAiConversation && (
            <>
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
                  {isLockEnabled && selectedLockProduct
                    ? `Locked · ${formatLockStars(lockPrice)} stars`
                    : isLockEnabled
                      ? "Locked · select price"
                      : "Lock attachment"}
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
              {isLockEnabled && (
                <View style={styles.lockPriceSection}>
                  <AttachmentLockPricePicker
                    options={lockPriceOptions}
                    selectedSkuKey={selectedLockSkuKey}
                    onSelectSkuKey={setSelectedLockSkuKey}
                    isPending={iapSkusPending}
                    isError={iapSkusError}
                    onRetry={() => void refetchIapSkus()}
                    theme={theme}
                    styles={styles}
                  />
                </View>
              )}
            </>
          )}
          <InputToolbar<GiftedIMessage>
            {...toolbarProps}
            containerStyle={[
              styles.inputToolbarInner,
              toolbarProps.containerStyle,
            ]}
          />
        </View>
      );
    },
    [
      attachments,
      removeAttachment,
      isUploadingAttachment,
      theme,
      insets.bottom,
      styles,
      isMessagingBlocked,
      isBlockedByYou,
      isAiConversation,
      canAttachMedia,
      isLockEnabled,
      lockPrice,
      selectedLockProduct,
      handleToggleLock,
      lockPriceOptions,
      selectedLockSkuKey,
      iapSkusPending,
      iapSkusError,
      refetchIapSkus,
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
    (bubbleProps: BubbleProps<GiftedIMessage>) => {
      const msg = bubbleProps.currentMessage;
      const messageId = msg?.originalMessageId;
      const isPeerMessage =
        myId != null && msg?.user._id === peerId && !msg?.pending;
      const canReportMessage =
        isPeerMessage && typeof messageId === "number" && messageId > 0;
      const displayMessage =
        streamingAi != null &&
        msg != null &&
        Number(msg._id) === streamingAi.messageId
          ? { ...msg, text: streamingAi.text }
          : msg;

      return (
        <Bubble
          {...bubbleProps}
          currentMessage={displayMessage}
          renderTicks={renderTicks}
          onLongPressMessage={
            canReportMessage
              ? (_context, message) =>
                  handleLongPressMessage(message as GiftedIMessage | undefined)
              : undefined
          }
          touchableProps={
            canReportMessage
              ? {
                  delayLongPress: 400,
                  accessibilityHint: "Long press to report this message",
                }
              : undefined
          }
        />
      );
    },
    [myId, peerId, renderTicks, handleLongPressMessage, streamingAi],
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
    <>
      <View style={styles.root}>
        <GiftedChat
          messages={displayMessages}
          extraData={streamingAi?.text}
          listProps={giftedListProps}
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
          keyboardProviderProps={
            Platform.OS === "android"
              ? {
                  statusBarTranslucent: true,
                  navigationBarTranslucent: true,
                }
              : undefined
          }
          keyboardAvoidingViewProps={keyboardAvoidingViewProps}
          loadEarlierMessagesProps={{
            isAvailable: Boolean(hasNextPage),
            isLoading: isFetchingNextPage,
            onPress: loadEarlier,
            label: "Load earlier messages",
            isInfiniteScrollEnabled: true,
          }}
          renderActions={
            canAttachMedia
              ? () => (
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
                )
              : undefined
          }
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
                canAttachMedia && attachments && processedAttachmentId,
              )}
              isTextOptional={Boolean(canAttachMedia && attachments)}
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
            onConfirm={handleUnlockConfirm}
            onConfirmIap={handleConfirmIapUnlock}
            action="unlock_message"
            username={unlockTarget.username}
            amount={unlockTarget.price}
            iapSku={messageIapSku}
            starsPerUsd={iapSkusResponse?.currency?.stars_per_usd}
            iapStarsAmount={messageIapStars}
            loading={unlockMessageMutation.isPending || isIapUnlockProcessing}
          />
        )}
      </View>

      {showChatMenu && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={closeMenu}
        >
          <Pressable style={styles.menuOverlay} onPress={closeMenu}>
            <View />
          </Pressable>
          <View
            style={[styles.menuPanel, { top: headerHeight + 6 }]}
            pointerEvents="box-none"
          >
            {isAiConversation ? (
              <Pressable
                style={({ pressed }) => [
                  styles.menuRow,
                  pressed && styles.menuRowPressed,
                  resetAiChatMutation.isPending && styles.menuRowDisabled,
                ]}
                onPress={handleResetChat}
                disabled={resetAiChatMutation.isPending}
              >
                <Ionicons
                  name="refresh-outline"
                  size={22}
                  color={theme.colors.textPrimary}
                />
                <Text style={styles.menuRowLabel}>Reset Chat</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.menuRow,
                  pressed && styles.menuRowPressed,
                ]}
                onPress={handleReportUser}
              >
                <Ionicons name="flag-outline" size={22} color="#EF4444" />
                <Text
                  style={[styles.menuRowLabel, styles.menuRowLabelDestructive]}
                >
                  Report user
                </Text>
              </Pressable>
            )}
            {!isAiConversation && (
              <>
                <View style={styles.menuDivider} />
                {isBlockedByUser || isBlockedByYou ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuRow,
                      pressed && styles.menuRowPressed,
                    ]}
                    onPress={handleUnblock}
                    disabled={unblockMutation.isPending || !peerUsername}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={22}
                      color={theme.colors.textPrimary}
                    />
                    <Text style={styles.menuRowLabel}>Unblock</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuRow,
                      pressed && styles.menuRowPressed,
                      !peerUsername && styles.menuRowDisabled,
                    ]}
                    onPress={handleBlock}
                    disabled={blockMutation.isPending}
                  >
                    <Ionicons name="ban-outline" size={22} color="#EF4444" />
                    <Text
                      style={[
                        styles.menuRowLabel,
                        styles.menuRowLabelDestructive,
                      ]}
                    >
                      Block
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </Modal>
      )}

      <ReportModal
        visible={reportTarget != null}
        onClose={() => setReportTarget(null)}
        target={reportTarget}
      />
    </>
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
    lockPriceSection: {
      marginHorizontal: 12,
      marginTop: 4,
      marginBottom: 2,
      gap: theme.spacing.xs,
    },
    lockPriceSectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    lockPriceChipRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    lockPriceChip: {
      minWidth: 88,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      gap: 4,
    },
    lockPriceChipSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      backgroundColor: theme.colors.card,
    },
    lockPriceChipTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    lockPriceChipAmount: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    lockPriceChipAmountSelected: {
      color: theme.colors.primary,
    },
    lockPriceChipHint: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.colors.textSecondary,
    },
    lockPriceChipHintSelected: {
      color: theme.colors.textSecondary,
    },
    lockPriceHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    lockPriceLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    lockPriceLoadingText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    lockPriceUnavailableCard: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    lockPriceUnavailableTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    lockPriceUnavailableBody: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
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
    headerRightButton: {
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
      marginRight: -8,
    },
    menuOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    menuPanel: {
      position: "absolute",
      zIndex: 1,
      right: theme.spacing.md,
      minWidth: 200,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    menuRowPressed: {
      opacity: 0.65,
    },
    menuRowDisabled: {
      opacity: 0.45,
    },
    menuRowLabel: {
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    menuRowLabelDestructive: {
      color: "#EF4444",
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.sm,
    },
    blockedComposerBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    blockedComposerText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
  });
