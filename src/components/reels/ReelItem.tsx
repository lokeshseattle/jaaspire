import { useManagedVideoPlayer } from "@/hooks/use-video-player";
import StoryAvatar from "@/src/components/home/story/StoryAvatar";
import RichText from "@/src/components/ui/rich-text";
import { useToggleLikeMutation } from "@/src/features/post/post.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import type { Post } from "@/src/services/api/api.types";
import type { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { VideoView } from "expo-video";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const DOUBLE_TAP_DELAY = 300;

type PostMediaViewer = Post["viewer"];

function viewerCanViewPostMedia(
  viewer: PostMediaViewer | undefined,
  price: number,
  isExclusive: boolean,
): boolean {
  if (viewer?.is_owner === true) return true;
  if (price > 0 && !viewer?.has_purchased) return false;
  if (isExclusive && !viewer?.has_subscription) return false;
  return true;
}

function parseDuration(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/[^\d.]/g, ""));
    return n > 0 ? n : null;
  }
  return null;
}

export type ReelItemProps = {
  post: Post;
  itemHeight: number;
  isFocused: boolean;
  isScreenFocused: boolean;
  inReelWindow: boolean;
  nextPost?: Post | null;
  onOpenComments: () => void;
  onOpenShare: () => void;
};

function ReelItemInner({
  post,
  itemHeight,
  isFocused,
  isScreenFocused,
  inReelWindow,
  nextPost,
  onOpenComments,
  onOpenShare,
}: ReelItemProps) {
  const { theme } = useTheme();
  const styles = useMemo(
    () => createStyles(theme, itemHeight),
    [theme, itemHeight],
  );
  const { data: profileData } = useGetProfile();
  const me = profileData?.data;

  const attachment = post.attachments[0];
  const media = attachment?.path ?? "";
  const thumbnail = attachment?.thumbnail;
  const fullDuration = attachment?.duration;
  const type = getMediaType(attachment?.type ?? "");

  const price = post.price ?? 0;
  const isExclusive = post.is_exclusive ?? false;
  const viewer = post.viewer;

  const canView = useMemo(
    () => viewerCanViewPostMedia(viewer, price, isExclusive),
    [viewer, price, isExclusive],
  );

  const isPaidVideo =
    !canView && type === "video" && (price > 0 || isExclusive);
  const showVideoBlockPaywall = !canView && type === "video" && !isPaidVideo;

  const parsedDuration = parseDuration(fullDuration);

  const [previewEnded, setPreviewEnded] = useState(false);
  const previewEndedRef = useRef(false);

  const videoUrlForPlayer =
    type === "video" && inReelWindow && media && (canView || isPaidVideo)
      ? media
      : null;

  const nextVideoInfo = useMemo(() => {
    if (!nextPost?.attachments?.[0]) return null;
    const nextMedia = nextPost.attachments[0];
    if (getMediaType(nextMedia.type) !== "video") return null;
    return { postId: nextPost.id, url: nextMedia.path };
  }, [nextPost]);

  const focusForPlayback = isFocused && isScreenFocused && !previewEnded;

  const {
    player,
    isReady,
    isBuffering,
    isPlaying,
    isMuted,
    toggleMute,
    togglePlayPause,
    pause,
    play,
  } = useManagedVideoPlayer(
    post.id,
    videoUrlForPlayer,
    focusForPlayback,
    nextVideoInfo?.url,
    nextVideoInfo?.postId,
  );

  const isLiked = post.user_reaction === "love";
  const { mutate: toggleLike } = useToggleLikeMutation();

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressingRef = useRef(false);
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  const videoViewMountedRef = useRef(false);
  if (isReady && player) videoViewMountedRef.current = true;
  if (!player) videoViewMountedRef.current = false;

  const showVideoView =
    inReelWindow && player !== null && (isReady || videoViewMountedRef.current);

  const firstFrameRendered = useRef(false);
  const posterOpacity = useSharedValue(1);

  useEffect(() => {
    if (!isReady) {
      firstFrameRendered.current = false;
      posterOpacity.value = 1;
    }
  }, [isReady, posterOpacity]);

  useEffect(() => {
    const shouldHide = firstFrameRendered.current && isFocused;
    posterOpacity.value = shouldHide ? withTiming(0, { duration: 150 }) : 1;
  }, [isFocused, isPlaying, posterOpacity]);

  const handleFirstFrameRender = useCallback(() => {
    firstFrameRendered.current = true;
    if (isFocusedRef.current) {
      posterOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [posterOpacity]);

  const posterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: posterOpacity.value,
  }));

  useEffect(() => {
    if (!isFocused && previewEndedRef.current) {
      previewEndedRef.current = false;
      setPreviewEnded(false);
    }
  }, [isFocused]);

  useEffect(() => {
    if (!player || !isFocused || !isPaidVideo) return;
    try {
      player.loop = false;
    } catch {
      return;
    }
    const sub = player.addListener("playToEnd" as any, () => {
      pause();
      if (!previewEndedRef.current) {
        previewEndedRef.current = true;
        setPreviewEnded(true);
      }
    });
    return () => {
      sub.remove();
      try {
        player.loop = true;
      } catch {
        /* native object may be gone */
      }
    };
  }, [player, isFocused, isPaidVideo, pause]);

  useEffect(() => {
    if (!player || !isFocused) return;
    try {
      (player as any).timeUpdateEventInterval = 0.25;
    } catch {
      /* ignore */
    }
    const sub = player.addListener(
      "timeUpdate" as any,
      ({ currentTime }: { currentTime: number }) => {
        if (!player.duration) return;
        if (isPaidVideo && parsedDuration) {
          const cap = player.duration;
          if (currentTime >= cap - 0.1) {
            pause();
            if (!previewEndedRef.current) {
              previewEndedRef.current = true;
              setPreviewEnded(true);
            }
          }
        }
      },
    );
    return () => sub.remove();
  }, [player, isFocused, isPaidVideo, parsedDuration, pause]);

  const triggerHeartAnimation = useCallback(() => {
    heartScale.value = 0.6;
    heartOpacity.value = 1;
    heartScale.value = withSpring(
      1.3,
      { damping: 8, stiffness: 300, mass: 0.5 },
      (finished) => {
        if (finished)
          heartScale.value = withSpring(1, { damping: 10, stiffness: 250 });
      },
    );
    heartOpacity.value = withTiming(0, { duration: 600 }, undefined);
  }, [heartOpacity, heartScale]);

  const handleDoubleTap = useCallback(() => {
    triggerHeartAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLiked) toggleLike(post.id);
  }, [isLiked, post.id, toggleLike, triggerHeartAnimation]);

  const handleSingleTap = useCallback(() => {
    togglePlayPause();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [togglePlayPause]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0;
      handleDoubleTap();
    } else {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        handleSingleTap();
        singleTapTimerRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  }, [handleDoubleTap, handleSingleTap]);

  const handleLongPressIn = useCallback(() => {
    isLongPressingRef.current = true;
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    if (isPlaying) {
      pause();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isPlaying, pause]);

  const handleLongPressOut = useCallback(() => {
    if (!isLongPressingRef.current) return;
    isLongPressingRef.current = false;
    if (isFocused && !previewEnded) play();
  }, [isFocused, play, previewEnded]);

  const handlePayPress = useCallback(() => {
    Alert.alert("Coming Soon");
  }, []);

  const handleWatchAgain = useCallback(() => {
    previewEndedRef.current = false;
    setPreviewEnded(false);
    firstFrameRendered.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player) {
      try {
        player.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    if (isFocused) play();
  }, [isFocused, play, player]);

  const navigateToUser = useCallback(() => {
    const user = post.user;
    if (!user) return;
    if (user.id === me?.id) {
      router.push({ pathname: "/(app)/(tabs)/profile" });
      return;
    }
    router.push({
      pathname: "/user/[username]",
      params: { username: user.username },
    });
  }, [me?.id, post.user]);

  const loveCount = post.reactions.find((r) => r.name === "love")?.count ?? 0;

  const [captionExpanded, setCaptionExpanded] = useState(false);
  const captionMaxExpanded = itemHeight * 0.4;

  const user = post.user;
  if (!user) {
    return (
      <View style={[styles.root, { height: itemHeight }]}>
        <Text style={styles.fallbackText}>Post unavailable</Text>
      </View>
    );
  }

  if (type !== "video") {
    return (
      <View style={[styles.root, { height: itemHeight }]}>
        <Text style={styles.fallbackText}>Not a video</Text>
      </View>
    );
  }

  const captionSource = post.text ?? "";

  return (
    <View style={[styles.root, { height: itemHeight }]}>
      <View style={StyleSheet.absoluteFill}>
        {showVideoBlockPaywall ? (
          <ReelLockedPaywall
            theme={theme}
            thumbnail={thumbnail}
            price={price}
            isExclusive={isExclusive}
            onPay={handlePayPress}
          />
        ) : (
          <>
            {showVideoView && player && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <VideoView
                  style={StyleSheet.absoluteFill}
                  player={player}
                  contentFit="contain"
                  nativeControls={false}
                  allowsPictureInPicture={false}
                  fullscreenOptions={{ enable: false }}
                  useExoShutter={false}
                  onFirstFrameRender={handleFirstFrameRender}
                />
              </View>
            )}

            {thumbnail ? (
              <Animated.View
                style={[StyleSheet.absoluteFill, posterAnimatedStyle]}
                pointerEvents="none"
              >
                <Image
                  source={{ uri: thumbnail }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  cachePolicy="disk"
                  transition={0}
                />
              </Animated.View>
            ) : (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.posterFallback,
                  posterAnimatedStyle,
                ]}
                pointerEvents="none"
              />
            )}

            {isFocused &&
              (isBuffering || !isReady) &&
              !showVideoBlockPaywall && (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                  />
                </View>
              )}
          </>
        )}
      </View>

      {/* Tap zone — center area; side UI sits above with higher z-index */}
      {!showVideoBlockPaywall && videoUrlForPlayer && (
        <Pressable
          style={styles.tapZone}
          onPress={handleTap}
          onLongPress={handleLongPressIn}
          onPressOut={handleLongPressOut}
          delayLongPress={200}
        />
      )}

      {previewEnded && isPaidVideo && isFocused && (
        <View
          style={[StyleSheet.absoluteFill, styles.previewEndWrap]}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={[theme.colors.gradient[0], theme.colors.gradient[2]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.previewEndGradient]}
          >
            <ReelPaywallContent
              theme={theme}
              price={price}
              isExclusive={isExclusive}
              onPay={handlePayPress}
              onWatchAgain={handleWatchAgain}
            />
          </LinearGradient>
        </View>
      )}

      <Animated.View
        style={[styles.heartBurst, heartAnimatedStyle]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={120} color={theme.colors.primary} />
      </Animated.View>

      {/* Top profile */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={navigateToUser} style={styles.profileRow}>
          <StoryAvatar
            username={user.username}
            hasStory={user.story_status?.has_stories ?? false}
            seen={user.story_status?.all_viewed ?? true}
            uri={user.avatar}
          />
          <View style={styles.profileText}>
            <Text style={styles.displayName} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              @{user.username}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Right actions */}
      <View style={styles.rightActions} pointerEvents="box-none">
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            toggleLike(post.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={8}
        >
          <FontAwesome
            name={isLiked ? "heart" : "heart-o"}
            size={28}
            color={isLiked ? theme.colors.primary : theme.colors.textPrimary}
          />
          {loveCount > 0 && <Text style={styles.actionCount}>{loveCount}</Text>}
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => {
            onOpenComments();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={8}
        >
          <Feather
            name="message-circle"
            size={28}
            color={theme.colors.textPrimary}
          />
          {post.comments_count > 0 && (
            <Text style={styles.actionCount}>{post.comments_count}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => {
            onOpenShare();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={8}
        >
          <Feather name="send" size={26} color={theme.colors.textPrimary} />
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => {
            toggleMute();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={8}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={26}
            color={theme.colors.textPrimary}
          />
        </Pressable>
      </View>

      {/* Bottom caption */}
      <View style={styles.bottomCaption} pointerEvents="box-none">
        {captionExpanded ? (
          <ScrollView
            style={{ maxHeight: captionMaxExpanded }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <RichText style={styles.captionText}>{captionSource}</RichText>
            <Pressable onPress={() => setCaptionExpanded(false)}>
              <Text style={styles.moreText}>Show less</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <>
            <RichText style={styles.captionText} numberOfLines={2}>
              {captionSource}
            </RichText>
            {captionSource.replace(/<[^>]+>/g, "").trim().length > 90 && (
              <Pressable onPress={() => setCaptionExpanded(true)}>
                <Text style={styles.moreText}>More</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function ReelLockedPaywall({
  theme,
  thumbnail,
  price,
  isExclusive,
  onPay,
}: {
  theme: AppTheme;
  thumbnail?: string;
  price: number;
  isExclusive: boolean;
  onPay: () => void;
}) {
  const locked = useMemo(() => createLockedPaywallStyles(theme), [theme]);
  return (
    <View style={StyleSheet.absoluteFill}>
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="disk"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.background },
          ]}
        />
      )}
      <LinearGradient
        colors={[theme.colors.gradient[0], theme.colors.gradient[2]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, locked.gradientDim]}
      >
        <View style={locked.center}>
          <Ionicons
            name="lock-closed"
            size={48}
            color={theme.colors.textPrimary}
          />
          <Text style={locked.title}>Exclusive content</Text>
          <Pressable onPress={onPay} style={locked.unlockBtn}>
            <Text style={locked.unlockText}>Unlock</Text>
          </Pressable>
          {price > 0 && <Text style={locked.price}>${price.toFixed(2)}</Text>}
          {isExclusive && (
            <Text style={locked.hint}>Subscription required</Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function ReelPaywallContent({
  theme,
  price,
  isExclusive,
  onPay,
  onWatchAgain,
}: {
  theme: AppTheme;
  price: number;
  isExclusive: boolean;
  onPay: () => void;
  onWatchAgain: () => void;
}) {
  const locked = useMemo(() => createLockedPaywallStyles(theme), [theme]);
  return (
    <View style={locked.previewContent}>
      <LinearGradient
        colors={[
          theme.colors.gradient[0],
          theme.colors.gradient[1],
          theme.colors.gradient[2],
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={locked.lockBadge}
      >
        <Ionicons
          name="lock-closed"
          size={28}
          color={theme.colors.textPrimary}
        />
      </LinearGradient>
      <Text style={locked.previewTitle}>Preview ended</Text>
      <Text style={locked.previewSub}>
        Unlock for full access to this reel.
      </Text>
      {price > 0 && <Text style={locked.price}>${price.toFixed(2)}</Text>}
      <Pressable onPress={onPay} style={locked.unlockBtn}>
        <Text style={locked.unlockText}>Unlock now</Text>
      </Pressable>
      <Pressable onPress={onWatchAgain} style={locked.watchAgain}>
        <Ionicons name="refresh" size={18} color={theme.colors.textPrimary} />
        <Text style={locked.watchAgainText}>Watch again</Text>
      </Pressable>
      {isExclusive && (
        <Text style={locked.hint}>Or subscribe for exclusive content</Text>
      )}
    </View>
  );
}

function createLockedPaywallStyles(theme: AppTheme) {
  return StyleSheet.create({
    gradientDim: {
      opacity: 0.92,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.xl,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginTop: theme.spacing.md,
      textAlign: "center",
    },
    price: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      marginTop: theme.spacing.sm,
      opacity: 0.95,
    },
    hint: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      marginTop: theme.spacing.sm,
    },
    unlockBtn: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    unlockText: {
      color: theme.colors.textPrimary,
      fontWeight: "700",
      fontSize: 16,
    },
    previewContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.xl,
    },
    lockBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.md,
    },
    previewTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    previewSub: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      marginTop: theme.spacing.sm,
    },
    watchAgain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: theme.spacing.md,
    },
    watchAgainText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
  });
}

/** Dark halo for text/icons on top of video (same in light/dark for legibility). */
const VIDEO_OVERLAY_HALO = "rgba(0,0,0,0.55)";

function createStyles(theme: AppTheme, itemHeight: number) {
  return StyleSheet.create({
    root: {
      width: "100%",
      backgroundColor: theme.colors.background,
      position: "relative",
    },
    fallbackText: {
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginTop: itemHeight / 2 - 20,
    },
    posterFallback: {
      backgroundColor: theme.colors.surface,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      opacity: 0.35,
    },
    tapZone: {
      position: "absolute",
      left: 0,
      right: 56,
      top: 100,
      bottom: 200,
      zIndex: 1,
    },
    previewEndWrap: {
      zIndex: 15,
    },
    previewEndGradient: {
      opacity: 0.94,
    },
    heartBurst: {
      position: "absolute",
      left: 0,
      right: 0,
      top: itemHeight * 0.38,
      alignItems: "center",
      zIndex: 12,
    },
    topBar: {
      position: "absolute",
      top: 8,
      left: 0,
      right: 56,
      zIndex: 10,
      paddingHorizontal: theme.spacing.md,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    profileText: {
      flex: 1,
    },
    displayName: {
      color: theme.colors.textPrimary,
      fontWeight: "700",
      fontSize: 15,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    handle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    rightActions: {
      position: "absolute",
      right: 8,
      bottom: itemHeight * 0.22,
      zIndex: 20,
      alignItems: "center",
      gap: 18,
    },
    actionButton: {
      alignItems: "center",
      gap: 4,
    },
    actionCount: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: "600",
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    bottomCaption: {
      position: "absolute",
      left: 0,
      right: 64,
      bottom: 24,
      zIndex: 10,
      paddingHorizontal: theme.spacing.md,
      maxWidth: "88%",
    },
    captionText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      lineHeight: 20,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    moreText: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
  });
}

export default memo(ReelItemInner);
