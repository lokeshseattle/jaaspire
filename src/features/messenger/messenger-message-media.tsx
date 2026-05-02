import type { MessengerMediaAttachment } from "@/src/services/api/api.types";
import type { AppTheme } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const BUBBLE_MEDIA_MAX_W = Math.min(260, SCREEN_WIDTH - 80);
const BUBBLE_MEDIA_MAX_H = 200;

function firstNonEmpty(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length > 0) return t;
  }
  return null;
}

/** Best URL to show in the bubble (poster / thumb); avoids using raw video URL in Image when possible. */
function getBubbleThumbnailUri(a: MessengerMediaAttachment): string | null {
  if (a.path && a.attachmentType === "image") {
    return a.path;
  }

  const raw = a as MessengerMediaAttachment & { preview_url?: string | null };
  const fromApi = firstNonEmpty(
    a.thumbnail,
    a.previewurl ?? undefined,
    raw.preview_url ?? undefined,
  );
  if (fromApi) return fromApi;
  if (a.attachmentType === "image") {
    return firstNonEmpty(a.path);
  }
  return null;
}

function getFullScreenMediaUri(a: MessengerMediaAttachment): string {
  return firstNonEmpty(a.path, a.thumbnail, a.previewurl) ?? "";
}

// ---------------------------------------------------------------------------
// Full-screen image viewer
// ---------------------------------------------------------------------------

function FullScreenImageViewer({
  uri,
  visible,
  onClose,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={fullStyles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={fullStyles.backdrop}>
          <Pressable onPress={onClose} style={fullStyles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          <Image
            source={{ uri }}
            style={fullStyles.image}
            contentFit="contain"
            transition={200}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const fullStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

// ---------------------------------------------------------------------------
// Full-screen video player
// ---------------------------------------------------------------------------

function FullScreenVideoPlayer({
  uri,
  visible,
  onClose,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  const player = useVideoPlayer(visible ? uri : null, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    if (!visible) player.pause();
  }, [visible, player]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={videoFullStyles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={videoFullStyles.backdrop}>
          <Pressable
            onPress={onClose}
            style={videoFullStyles.closeBtn}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          <VideoView
            player={player}
            style={videoFullStyles.video}
            contentFit="contain"
            nativeControls
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const videoFullStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});

// ---------------------------------------------------------------------------
// Single attachment thumbnail (in-bubble)
// ---------------------------------------------------------------------------

function AttachmentThumbnail({
  attachment,
  theme,
}: {
  attachment: MessengerMediaAttachment;
  theme: AppTheme;
}) {
  const [fullScreenType, setFullScreenType] = useState<
    "image" | "video" | null
  >(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const isVideo = attachment.attachmentType === "video";
  const thumbnailUri = getBubbleThumbnailUri(attachment);
  const fullUri = getFullScreenMediaUri(attachment);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [attachment.id, thumbnailUri]);

  const openFullScreen = useCallback(() => {
    if (!fullUri) return;
    setFullScreenType(isVideo ? "video" : "image");
  }, [isVideo, fullUri]);

  const closeFullScreen = useCallback(() => {
    setFullScreenType(null);
  }, []);

  const showImageThumb = Boolean(thumbnailUri) && !imageLoadFailed;
  const showPlaceholder = !showImageThumb;

  return (
    <>
      <Pressable
        onPress={openFullScreen}
        style={thumbStyles.container}
        disabled={!fullUri}
      >
        {showImageThumb ? (
          <Image
            source={{ uri: thumbnailUri! }}
            style={thumbStyles.image}
            contentFit="cover"
            transition={150}
            onError={() => setImageLoadFailed(true)}
          />
        ) : (
          <View
            style={[
              thumbStyles.image,
              thumbStyles.thumbPlaceholder,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Ionicons
              name={isVideo ? "videocam" : "image"}
              size={40}
              color={theme.colors.textSecondary}
            />
          </View>
        )}
        {isVideo && (
          <View style={thumbStyles.playOverlay} pointerEvents="none">
            <View
              style={[
                thumbStyles.playCircle,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Ionicons name="play" size={22} color="#fff" />
            </View>
          </View>
        )}
      </Pressable>

      {fullScreenType === "image" && fullUri ? (
        <FullScreenImageViewer
          uri={fullUri}
          visible
          onClose={closeFullScreen}
        />
      ) : null}
      {fullScreenType === "video" && fullUri ? (
        <FullScreenVideoPlayer
          uri={fullUri}
          visible
          onClose={closeFullScreen}
        />
      ) : null}
    </>
  );
}

const thumbStyles = StyleSheet.create({
  container: {
    maxWidth: BUBBLE_MEDIA_MAX_W,
    maxHeight: BUBBLE_MEDIA_MAX_H,
    borderRadius: 12,
    overflow: "hidden",
    margin: 4,
  },
  image: {
    width: BUBBLE_MEDIA_MAX_W,
    height: BUBBLE_MEDIA_MAX_H,
    borderRadius: 12,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.85,
  },
});

// ---------------------------------------------------------------------------
// Public: stack of all attachments for a message bubble
// ---------------------------------------------------------------------------

export function MessageMediaStack({
  attachments,
  theme,
  isLocked = false,
  onUnlockPress,
  price,
  isSender = false,
  hasUserUnlockedMessage = false,
}: {
  attachments: MessengerMediaAttachment[];
  theme: AppTheme;
  isLocked?: boolean;
  onUnlockPress?: () => void;
  price?: number;
  isSender?: boolean;
  hasUserUnlockedMessage?: boolean;
}) {
  const mediaAttachments = useMemo(
    () =>
      attachments.filter(
        (a) => a.attachmentType === "image" || a.attachmentType === "video",
      ),
    [attachments],
  );

  if (mediaAttachments.length === 0) return null;

  // Sender always sees the full media with a lock badge to indicate it's paid
  if (isLocked && !isSender) {
    const firstAttachment = mediaAttachments[0];
    const thumbnailUri = getBubbleThumbnailUri(firstAttachment);
    const formattedPrice =
      price != null ? `$${price} to unlock` : "Tap to unlock";

    return (
      <View style={stackStyles.container}>
        <Pressable onPress={onUnlockPress} style={lockedStyles.container}>
          {thumbnailUri ? (
            <Image
              source={{ uri: thumbnailUri }}
              style={lockedStyles.blurredThumb}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View
              style={[
                lockedStyles.blurredThumb,
                { backgroundColor: theme.colors.surface },
              ]}
            />
          )}
          <View style={lockedStyles.overlay}>
            <View
              style={[
                lockedStyles.iconBadge,
                { backgroundColor: "rgba(0,0,0,0.55)" },
              ]}
            >
              <Ionicons name="lock-closed" size={28} color="#fff" />
            </View>
            <Text style={lockedStyles.priceLabel}>{formattedPrice}</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={stackStyles.container}>
      {mediaAttachments.map((a) => (
        <View key={a.id} style={stackStyles.attachmentWrapper}>
          <AttachmentThumbnail attachment={a} theme={theme} />
          {isLocked && isSender && (
            <View style={lockedStyles.senderBadge}>
              <Ionicons
                name={
                  hasUserUnlockedMessage ? "lock-open-outline" : "lock-closed"
                }
                size={12}
                color="#fff"
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  container: {
    paddingBottom: 2,
  },
  attachmentWrapper: {
    position: "relative",
  },
});

const lockedStyles = StyleSheet.create({
  container: {
    maxWidth: BUBBLE_MEDIA_MAX_W,
    maxHeight: BUBBLE_MEDIA_MAX_H,
    borderRadius: 12,
    overflow: "hidden",
    margin: 4,
  },
  blurredThumb: {
    width: BUBBLE_MEDIA_MAX_W,
    height: BUBBLE_MEDIA_MAX_H,
    opacity: 0.35,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    gap: 8,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  priceLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  senderBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
