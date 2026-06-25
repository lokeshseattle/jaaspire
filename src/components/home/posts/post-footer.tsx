import { WEB_ORIGIN } from "@/src/constants/app-env";
import { usePost } from "@/src/context/post-context";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import RichText from "../../ui/rich-text";

function buildPostUrl(postId: number): string {
  const base = WEB_ORIGIN.replace(/\/+$/, "");
  return `${base}/posts/${postId}`;
}

const LIKED_COLOR = "#ff3040";
const ACTION_ICON_SIZE = 24;
const VIEWS_ICON_SIZE = 18;
const CAPTION_LINE_HEIGHT = 20;
const CAPTION_COLLAPSED_LINES = 2;
const CAPTION_COLLAPSED_HEIGHT =
  CAPTION_LINE_HEIGHT * CAPTION_COLLAPSED_LINES;
const CAPTION_ANIMATION_MS = 220;

function captionHasVisibleText(text: string | null | undefined): boolean {
  return (text ?? "").replace(/<[^>]+>/g, "").trim().length > 0;
}

function PostFooterInner() {
  const { theme } = useTheme();
  const { post } = usePost();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hasCaption = captionHasVisibleText(post.text);

  return (
    <View style={[styles.container, !hasCaption && styles.containerNoCaption]}>
      <PostActions theme={theme} styles={styles} />
      <PostCaptions theme={theme} styles={styles} />
    </View>
  );
}

const PostFooter = React.memo(PostFooterInner);

export default PostFooter;

/* =========================
   Post Actions
========================= */

interface ActionProps {
  theme: AppTheme;
  styles: ReturnType<typeof createStyles>;
}

const PostActions = ({ theme, styles }: ActionProps) => {
  const { isLiked, toggleLike, post } = usePost();

  const loveCount = post.reactions.find((r) => r.name === "love")?.count ?? 0;

  return (
    <View style={styles.actionsContainer}>
      <View style={styles.leftActions}>
        <View style={styles.actionItem}>
          <Heart isLiked={isLiked} onPress={toggleLike} theme={theme} />
          {loveCount > 0 && <Text style={styles.countText}>{loveCount}</Text>}
        </View>
        <View style={styles.actionItem}>
          <Comments theme={theme} />
          {post.comments_count > 0 && (
            <Text style={styles.countText}>{post.comments_count}</Text>
          )}
        </View>
        <Tip theme={theme} />
        <ShareButton theme={theme} />
      </View>

      <Views viewCount={post.views_count} theme={theme} styles={styles} />
    </View>
  );
};

/* =========================
   Action Icons
========================= */

interface HeartProps {
  isLiked: boolean;
  onPress: () => void;
  theme: AppTheme;
}

const Heart = ({ isLiked, onPress, theme }: HeartProps) => {
  return (
    <Pressable onPress={onPress}>
      <Ionicons
        name={isLiked ? "heart" : "heart-outline"}
        size={ACTION_ICON_SIZE}
        color={isLiked ? LIKED_COLOR : theme.colors.icon}
      />
    </Pressable>
  );
};

const Comments = ({ theme }: { theme: AppTheme }) => {
  const { onPressComments } = usePost();
  return (
    <Pressable onPress={onPressComments}>
      <Ionicons
        name="chatbubble-outline"
        size={ACTION_ICON_SIZE}
        color={theme.colors.icon}
      />
    </Pressable>
  );
};

const Tip = ({ theme }: { theme: AppTheme }) => {
  const { onTip } = usePost();
  return (
    <Pressable onPress={onTip}>
      <Ionicons
        name="gift-outline"
        size={ACTION_ICON_SIZE}
        color={theme.colors.icon}
      />
    </Pressable>
  );
};

const ShareButton = ({ theme }: { theme: AppTheme }) => {
  const { post } = usePost();

  // In-app inbox sharing (SharePostBottomSheet) deferred — open native share instead.
  const handleShare = useCallback(async () => {
    const url = buildPostUrl(post.id);
    try {
      // URL-only payload so "Copy" in the system sheet copies just the link.
      await Share.share(Platform.OS === "ios" ? { url } : { message: url });
    } catch {
      /* dismissed */
    }
  }, [post.id]);

  return (
    <Pressable onPress={handleShare}>
      <Ionicons
        name="paper-plane-outline"
        size={ACTION_ICON_SIZE}
        color={theme.colors.icon}
      />
    </Pressable>
  );
};

interface ViewsProps {
  viewCount: number;
  theme: AppTheme;
  styles: ReturnType<typeof createStyles>;
}

const Views = ({ viewCount, theme, styles }: ViewsProps) => {
  return (
    <View style={styles.viewsContainer}>
      <Ionicons
        name="eye-outline"
        size={VIEWS_ICON_SIZE}
        color={theme.colors.icon}
      />
      <Text style={styles.countText}>{viewCount}</Text>
    </View>
  );
};

/* =========================
   Post Captions
========================= */

const PostCaptions = ({ styles }: ActionProps) => {
  const caption = usePost().post.text;

  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const fullHeightRef = useRef(0);
  const measuredRef = useRef(false);
  const animatedHeight = useSharedValue(CAPTION_COLLAPSED_HEIGHT);

  const animatedCaptionStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    overflow: "hidden" as const,
  }));

  const handleMeasureLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const fullHeight = e.nativeEvent.layout.height;
      fullHeightRef.current = fullHeight;
      const truncated = fullHeight > CAPTION_COLLAPSED_HEIGHT;

      if (!measuredRef.current) {
        measuredRef.current = true;
        animatedHeight.value = truncated
          ? CAPTION_COLLAPSED_HEIGHT
          : fullHeight;
        setIsTruncated(truncated);
      } else if (!truncated) {
        setIsTruncated(false);
      }
    },
    [animatedHeight],
  );

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const nextExpanded = !prev;
      const toValue = nextExpanded
        ? fullHeightRef.current
        : CAPTION_COLLAPSED_HEIGHT;
      animatedHeight.value = withTiming(toValue, {
        duration: CAPTION_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      return nextExpanded;
    });
  }, [animatedHeight]);

  if (!captionHasVisibleText(caption)) return null;

  return (
    <View style={styles.captionContainer}>
      <RichText
        style={[styles.captionText, styles.hidden]}
        onLayout={handleMeasureLayout}
      >
        {caption}
      </RichText>

      <Animated.View style={animatedCaptionStyle}>
        <RichText style={styles.captionText}>{caption}</RichText>
      </Animated.View>

      {isTruncated && (
        <Pressable onPress={toggle}>
          <Text style={styles.toggleText}>
            {expanded ? "Show less" : "More"}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

/* =========================
   Styles
========================= */

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.sm,
    },

    containerNoCaption: {
      paddingBottom: theme.spacing.xl,
    },

    actionsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    leftActions: {
      flexDirection: "row",
      gap: theme.spacing.lg,
    },

    actionItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    viewsContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    countText: {
      fontSize: 14,
      color: theme.colors.textPrimary,
    },

    captionContainer: {
      marginTop: theme.spacing.sm,
    },

    captionText: {
      fontSize: 14,
      lineHeight: CAPTION_LINE_HEIGHT,
      color: theme.colors.textPrimary,
    },

    hidden: {
      position: "absolute",
      opacity: 0,
      zIndex: -1,
    },

    toggleText: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.textSecondary,
    },
  });
