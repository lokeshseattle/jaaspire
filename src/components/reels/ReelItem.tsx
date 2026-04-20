import { useManagedVideoPlayer } from "@/hooks/use-video-player";
import StoryAvatar from "@/src/components/home/story/StoryAvatar";
import RichText from "@/src/components/ui/rich-text";
import { useToggleLikeMutation } from "@/src/features/post/post.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import type { Post } from "@/src/services/api/api.types";
import { getMediaType } from "@/src/utils/helpers";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { VideoView, type VideoContentFit } from "expo-video";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DOUBLE_TAP_DELAY = 300;
/** Play / mute HUD visibility after single tap (ms). */
const REEL_TOOLS_HIDE_MS = 1000;

/** Edge-to-edge reel surface — always black so letterboxing matches TikTok/IG (not theme.background). */
const REELS_CANVAS = "#000";

/** Overlay chrome on video: fixed light palette (avoid theme textPrimary = black on dark reels). */
const REEL_TEXT = "#FFFFFF";
const REEL_TEXT_MUTED = "rgba(255,255,255,0.72)";
const REEL_ACCENT = "#FF4D67";
const REEL_PAYWALL_GRADIENT_DIM: [string, string] = [
  "rgba(24, 18, 38, 0.94)",
  "rgba(0, 0, 0, 0.92)",
];
const REEL_PAYWALL_BADGE_GRADIENT: [string, string, string] = [
  "#4A3A6B",
  "#2A1F40",
  "#151018",
];
const REEL_UI_SPACING = { sm: 8, md: 16, lg: 20, xl: 24 } as const;
const REEL_UI_RADIUS = { pill: 999 } as const;

/**
 * Landscape videos: use cover only if center-crop still shows at least this fraction
 * of the source frame on the worst axis (otherwise contain + letterboxing).
 */
const FIT_COVER_THRESHOLD = 0.78;

/** Under object-fit:cover with scale s = max(W/vw,H/vh), visible fraction on each axis. */
function coverVisibleMinFrac(
  W: number,
  H: number,
  vw: number,
  vh: number,
): number {
  const s = Math.max(W / vw, H / vh);
  return Math.min(W / (vw * s), H / (vh * s));
}

function chooseContentFit(
  W: number,
  H: number,
  vw?: number | null,
  vh?: number | null,
): VideoContentFit {
  if (!vw || !vh || vw <= 0 || vh <= 0 || W <= 0 || H <= 0) return "cover";
  if (vw <= vh) return "cover";
  const visibleMin = coverVisibleMinFrac(W, H, vw, vh);
  return visibleMin >= FIT_COVER_THRESHOLD ? "cover" : "contain";
}

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
  /** Visible viewport height (full window minus tab bar, including under status bar). */
  itemHeight: number;
  /** Visible viewport width (full window width). */
  itemWidth: number;
  /** Top safe inset — overlays only; video uses full item size. */
  safeTopInset: number;
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
  itemWidth,
  safeTopInset,
  isFocused,
  isScreenFocused,
  inReelWindow,
  nextPost,
  onOpenComments,
  onOpenShare,
}: ReelItemProps) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(itemHeight, safeTopInset, insets.bottom),
    [itemHeight, safeTopInset, insets.bottom],
  );

  const videoFrameSize = useMemo(
    () => ({ width: itemWidth, height: itemHeight }),
    [itemWidth, itemHeight],
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

  /**
   * Persistent pause HUD is only shown after the user explicitly taps to pause.
   * Loop boundaries (loop=true → brief playing:false→true) and seekToStart on focus
   * would otherwise flicker the HUD into view, which we don't want.
   */
  const [userPaused, setUserPaused] = useState(false);
  useEffect(() => {
    setUserPaused(false);
  }, [post.id]);
  useEffect(() => {
    if (isPlaying && userPaused) setUserPaused(false);
  }, [isPlaying, userPaused]);
  useEffect(() => {
    if (!isFocused) setUserPaused(false);
  }, [isFocused]);

  const [videoSourceSize, setVideoSourceSize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    if (!player) {
      setVideoSourceSize(null);
      return;
    }
    const sync = () => {
      try {
        const t = player.videoTrack;
        const w = t?.size?.width ?? 0;
        const h = t?.size?.height ?? 0;
        if (w > 0 && h > 0) {
          setVideoSourceSize((prev) =>
            prev?.w === w && prev?.h === h ? prev : { w, h },
          );
        }
      } catch {
        /* native player */
      }
    };
    sync();
    const sub = player.addListener("statusChange" as any, sync);
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (!player || !isReady) return;
    try {
      const t = player.videoTrack;
      const w = t?.size?.width ?? 0;
      const h = t?.size?.height ?? 0;
      if (w > 0 && h > 0) {
        setVideoSourceSize((prev) =>
          prev?.w === w && prev?.h === h ? prev : { w, h },
        );
      }
    } catch {
      /* native player */
    }
  }, [player, isReady]);

  const videoContentFit = useMemo(
    () =>
      chooseContentFit(
        itemWidth,
        itemHeight,
        videoSourceSize?.w,
        videoSourceSize?.h,
      ),
    [itemWidth, itemHeight, videoSourceSize?.w, videoSourceSize?.h],
  );

  const isLiked = post.user_reaction === "love";
  const { mutate: toggleLike } = useToggleLikeMutation();

  /** While playing: brief flash after resume/mute. While user-paused: persistent HUD (see `playbackEverStarted` + isReady/!isBuffering). */
  const [playingHudFlash, setPlayingHudFlash] = useState(false);
  const playingHudFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearPlayingHudFlashTimer = useCallback(() => {
    if (playingHudFlashTimerRef.current != null) {
      clearTimeout(playingHudFlashTimerRef.current);
      playingHudFlashTimerRef.current = null;
    }
  }, []);

  /** During playback only: show HUD briefly then hide (after resume or while interacting with mute). */
  const schedulePlayingHudHide = useCallback(() => {
    clearPlayingHudFlashTimer();
    setPlayingHudFlash(true);
    playingHudFlashTimerRef.current = setTimeout(() => {
      setPlayingHudFlash(false);
      playingHudFlashTimerRef.current = null;
    }, REEL_TOOLS_HIDE_MS);
  }, [clearPlayingHudFlashTimer]);

  useEffect(
    () => () => clearPlayingHudFlashTimer(),
    [clearPlayingHudFlashTimer],
  );

  useEffect(() => {
    if (!isFocused) {
      clearPlayingHudFlashTimer();
      setPlayingHudFlash(false);
    }
  }, [isFocused, clearPlayingHudFlashTimer]);

  useEffect(() => {
    if (!isPlaying) {
      clearPlayingHudFlashTimer();
      setPlayingHudFlash(false);
    }
  }, [isPlaying, clearPlayingHudFlashTimer]);

  const handleMuteFromHud = useCallback(() => {
    toggleMute();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      schedulePlayingHudHide();
    }
  }, [toggleMute, isPlaying, schedulePlayingHudHide]);

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
    const wasPaused = !isPlaying;
    togglePlayPause();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (wasPaused) {
      schedulePlayingHudHide();
    } else {
      setUserPaused(true);
    }
  }, [togglePlayPause, isPlaying, schedulePlayingHudHide]);

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
      <View style={[styles.root, { width: itemWidth, height: itemHeight }]}>
        <Text style={styles.fallbackText}>Post unavailable</Text>
      </View>
    );
  }

  if (type !== "video") {
    return (
      <View style={[styles.root, { width: itemWidth, height: itemHeight }]}>
        <Text style={styles.fallbackText}>Not a video</Text>
      </View>
    );
  }

  const captionSource = post.text ?? "";

  const frameW = videoFrameSize.width > 0 ? videoFrameSize.width : itemWidth;
  const frameH = videoFrameSize.height > 0 ? videoFrameSize.height : itemHeight;

  const showReelHud =
    !showVideoBlockPaywall &&
    videoUrlForPlayer &&
    !previewEnded &&
    isFocused &&
    (playingHudFlash || (userPaused && !isPlaying));

  return (
    <View style={[styles.root, { width: itemWidth, height: itemHeight }]}>
      {showVideoBlockPaywall ? (
        <View style={StyleSheet.absoluteFill}>
          <ReelLockedPaywall
            thumbnail={thumbnail}
            price={price}
            isExclusive={isExclusive}
            onPay={handlePayPress}
          />
        </View>
      ) : (
        <View style={styles.mediaStage}>
          <View style={[styles.videoFrame, { width: frameW, height: frameH }]}>
            {showVideoView && player && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <VideoView
                  style={StyleSheet.absoluteFill}
                  player={player}
                  contentFit={videoContentFit}
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
                  contentFit={videoContentFit}
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
                  <ActivityIndicator size="large" color={REEL_TEXT} />
                </View>
              )}
          </View>
        </View>
      )}

      {/* Tap zone — fullscreen; overlays use higher z-index */}
      {!showVideoBlockPaywall && videoUrlForPlayer && (
        <Pressable
          style={styles.tapZone}
          onPress={handleTap}
          onLongPress={handleLongPressIn}
          onPressOut={handleLongPressOut}
          delayLongPress={200}
        />
      )}

      {showReelHud && (
        <View style={styles.reelToolsOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.reelToolsCenterHit}
            onPress={() => {
              const wasPaused = !isPlaying;
              togglePlayPause();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (wasPaused) {
                schedulePlayingHudHide();
              } else {
                setUserPaused(true);
              }
            }}
            hitSlop={32}
          >
            <View style={styles.reelToolsPlayGlass}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={48}
                color="#fff"
                style={styles.reelToolsPlayIcon}
              />
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel={isMuted ? "Unmute" : "Mute"}
            style={[styles.reelToolsMuteBtn, { bottom: 10, right: 10 }]}
            onPress={handleMuteFromHud}
            hitSlop={12}
          >
            <View style={styles.reelToolsVolumeGlass}>
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={26}
                color="#fff"
                style={styles.reelToolsHudIconShadow}
              />
            </View>
          </Pressable>
        </View>
      )}

      {previewEnded && isPaidVideo && isFocused && (
        <View
          style={[StyleSheet.absoluteFill, styles.previewEndWrap]}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={REEL_PAYWALL_GRADIENT_DIM}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.previewEndGradient]}
          >
            <ReelPaywallContent
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
        <Ionicons name="heart" size={120} color={REEL_ACCENT} />
      </Animated.View>

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
            color={isLiked ? REEL_ACCENT : REEL_TEXT}
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
          <Feather name="message-circle" size={28} color={REEL_TEXT} />
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
          <Feather name="send" size={26} color={REEL_TEXT} />
        </Pressable>
      </View>

      {/* Bottom profile + caption */}
      <View style={styles.bottomCaption} pointerEvents="box-none">
        <Pressable
          onPress={navigateToUser}
          style={styles.bottomProfileRow}
          accessibilityRole="button"
          accessibilityLabel={`${user.name}, @${user.username}`}
        >
          <View style={styles.avatarCompactWrap}>
            <StoryAvatar
              username={user.username}
              hasStory={user.story_status?.has_stories ?? false}
              seen={user.story_status?.all_viewed ?? true}
              uri={user.avatar}
            />
          </View>
          <View style={styles.profileText}>
            <Text style={styles.displayNameBottom} numberOfLines={1}>
              {user.name} {__DEV__ ? `POST_ID: ${post.id}` : ""}
            </Text>
            <Text style={styles.handleBottom} numberOfLines={1}>
              @{user.username}
            </Text>
          </View>
        </Pressable>

        {captionExpanded ? (
          <ScrollView
            style={{ maxHeight: captionMaxExpanded }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            // showsVerticalScrollIndicator
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
  thumbnail,
  price,
  isExclusive,
  onPay,
}: {
  thumbnail?: string;
  price: number;
  isExclusive: boolean;
  onPay: () => void;
}) {
  const locked = useMemo(() => createLockedPaywallStyles(), []);
  return (
    <View style={StyleSheet.absoluteFill}>
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: REELS_CANVAS }]}
        />
      )}
      <LinearGradient
        colors={REEL_PAYWALL_GRADIENT_DIM}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, locked.gradientDim]}
      >
        <View style={locked.center}>
          <Ionicons name="lock-closed" size={48} color={REEL_TEXT} />
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
  price,
  isExclusive,
  onPay,
  onWatchAgain,
}: {
  price: number;
  isExclusive: boolean;
  onPay: () => void;
  onWatchAgain: () => void;
}) {
  const locked = useMemo(() => createLockedPaywallStyles(), []);
  return (
    <View style={locked.previewContent}>
      <LinearGradient
        colors={REEL_PAYWALL_BADGE_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={locked.lockBadge}
      >
        <Ionicons name="lock-closed" size={28} color={REEL_TEXT} />
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
        <Ionicons name="refresh" size={18} color={REEL_TEXT} />
        <Text style={locked.watchAgainText}>Watch again</Text>
      </Pressable>
      {isExclusive && (
        <Text style={locked.hint}>Or subscribe for exclusive content</Text>
      )}
    </View>
  );
}

function createLockedPaywallStyles() {
  return StyleSheet.create({
    gradientDim: {
      opacity: 0.92,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: REEL_UI_SPACING.xl,
    },
    title: {
      color: REEL_TEXT,
      fontSize: 18,
      fontWeight: "700",
      marginTop: REEL_UI_SPACING.md,
      textAlign: "center",
    },
    price: {
      color: REEL_TEXT,
      fontSize: 16,
      marginTop: REEL_UI_SPACING.sm,
      opacity: 0.95,
    },
    hint: {
      color: REEL_TEXT_MUTED,
      fontSize: 13,
      marginTop: REEL_UI_SPACING.sm,
    },
    unlockBtn: {
      marginTop: REEL_UI_SPACING.lg,
      paddingHorizontal: REEL_UI_SPACING.xl,
      paddingVertical: REEL_UI_SPACING.md,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderRadius: REEL_UI_RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.35)",
    },
    unlockText: {
      color: REEL_TEXT,
      fontWeight: "700",
      fontSize: 16,
    },
    previewContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: REEL_UI_SPACING.xl,
    },
    lockBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: REEL_UI_SPACING.md,
    },
    previewTitle: {
      color: REEL_TEXT,
      fontSize: 20,
      fontWeight: "700",
    },
    previewSub: {
      color: REEL_TEXT_MUTED,
      fontSize: 14,
      textAlign: "center",
      marginTop: REEL_UI_SPACING.sm,
    },
    watchAgain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: REEL_UI_SPACING.md,
    },
    watchAgainText: {
      color: REEL_TEXT,
      fontSize: 15,
      fontWeight: "600",
    },
  });
}

/** Dark halo for text/icons on top of video (same in light/dark for legibility). */
const VIDEO_OVERLAY_HALO = "rgba(0,0,0,0.55)";
/** HUD play / mute circular glass pills */
const HUD_GLASS_FILL = "rgba(0,0,0,0.48)";
const HUD_GLASS_BORDER = "rgba(255,255,255,0.14)";

function createStyles(
  itemHeight: number,
  safeTopInset: number,
  bottomInset: number,
) {
  return StyleSheet.create({
    root: {
      position: "relative",
      backgroundColor: REELS_CANVAS,
    },
    mediaStage: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: REELS_CANVAS,
    },
    videoFrame: {
      overflow: "hidden",
      backgroundColor: REELS_CANVAS,
    },
    fallbackText: {
      color: REEL_TEXT_MUTED,
      textAlign: "center",
      marginTop: itemHeight / 2 - 20,
    },
    posterFallback: {
      backgroundColor: REELS_CANVAS,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: REELS_CANVAS,
      opacity: 0.35,
    },
    tapZone: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 4,
    },
    reelToolsOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 11,
    },
    reelToolsCenterHit: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    reelToolsPlayGlass: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: HUD_GLASS_FILL,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HUD_GLASS_BORDER,
      alignItems: "center",
      justifyContent: "center",
    },
    reelToolsVolumeGlass: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: HUD_GLASS_FILL,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HUD_GLASS_BORDER,
      alignItems: "center",
      justifyContent: "center",
    },
    reelToolsPlayIcon: {
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
    },
    reelToolsMuteBtn: {
      position: "absolute",
      right: 14,
      zIndex: 12,
    },
    reelToolsHudIconShadow: {
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
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
      zIndex: 14,
    },
    bottomProfileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: REEL_UI_SPACING.sm,
      maxWidth: "100%",
    },
    avatarCompactWrap: {
      transform: [{ scale: 0.88 }],
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    profileText: {
      flex: 1,
      minWidth: 0,
    },
    displayNameBottom: {
      color: REEL_TEXT,
      fontWeight: "700",
      fontSize: 14,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    handleBottom: {
      color: REEL_TEXT_MUTED,
      fontSize: 12,
      marginTop: 2,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    rightActions: {
      position: "absolute",
      right: 8,
      bottom: itemHeight * 0.14,
      zIndex: 20,
      alignItems: "center",
      gap: 18,
    },
    actionButton: {
      alignItems: "center",
      gap: 4,
    },
    actionCount: {
      color: REEL_TEXT,
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
      bottom: Math.max(REEL_UI_SPACING.sm, 10 + bottomInset),
      zIndex: 12,
      paddingHorizontal: REEL_UI_SPACING.md,
      maxWidth: "88%",
    },
    captionText: {
      color: REEL_TEXT,
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
      color: REEL_TEXT_MUTED,
    },
  });
}

export default memo(ReelItemInner);
