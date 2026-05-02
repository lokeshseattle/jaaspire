import { usePost } from "@/src/context/post-context";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { FontAwesome } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import Octicons from "@expo/vector-icons/Octicons";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RichText from "../../ui/rich-text";

const LIKED_COLOR = "#ff3040";

function PostFooterInner() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
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
          {loveCount > 0 && (
            <Text style={styles.countText}>{loveCount}</Text>
          )}
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
      <FontAwesome
        name={isLiked ? "heart" : "heart-o"}
        size={24}
        color={isLiked ? LIKED_COLOR : theme.colors.icon}
      />
    </Pressable>
  );
};

const Comments = ({ theme }: { theme: AppTheme }) => {
  const { onPressComments } = usePost();
  return (
    <Pressable onPress={onPressComments}>
      <Feather name="message-circle" size={24} color={theme.colors.icon} />
    </Pressable>
  );
};

const Tip = ({ theme }: { theme: AppTheme }) => {
  const { onTip } = usePost();
  return (
    <Pressable onPress={onTip}>
      <Octicons name="gift" size={24} color={theme.colors.icon} />
    </Pressable>
  );
};

const ShareButton = ({ theme }: { theme: AppTheme }) => {
  const { onPressShare } = usePost();
  return (
    <Pressable onPress={onPressShare}>
      <Feather name="send" size={24} color={theme.colors.icon} />
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
      <Feather name="eye" size={16} color={theme.colors.icon} />
      <Text style={styles.countText}>{viewCount}</Text>
    </View>
  );
};

/* =========================
   Post Captions
========================= */

const PostCaptions = ({ theme, styles }: ActionProps) => {
  const caption = usePost().post.text;

  const [expanded, setExpanded] = useState(false);
  const [shouldShowToggle, setShouldShowToggle] = useState(false);

  const animatedHeight = useRef(new Animated.Value(0)).current;
  const fullHeight = useRef(0);
  const collapsedHeight = useRef(0);

  const LINE_HEIGHT = 20;
  const COLLAPSED_LINES = 2;

  const toggle = () => {
    const toValue = expanded ? collapsedHeight.current : fullHeight.current;

    Animated.timing(animatedHeight, {
      toValue,
      duration: 100,
      useNativeDriver: false,
    }).start();

    setExpanded(!expanded);
  };

  return (
    <View style={styles.captionContainer}>
      {/* Measure full height */}
      <RichText
        style={[styles.captionText, styles.hidden]}
        onLayout={(e) => {
          fullHeight.current = e.nativeEvent.layout.height;

          if (collapsedHeight.current === 0) {
            collapsedHeight.current = LINE_HEIGHT * COLLAPSED_LINES;

            if (fullHeight.current > collapsedHeight.current) {
              setShouldShowToggle(true);
              animatedHeight.setValue(collapsedHeight.current);
            } else {
              animatedHeight.setValue(fullHeight.current);
            }
          }
        }}
      >
        {caption}
      </RichText>

      {/* Animated visible container */}
      <Animated.View style={{ height: animatedHeight, overflow: "hidden" }}>
        <RichText style={styles.captionText}>{caption}</RichText>
      </Animated.View>

      {shouldShowToggle && (
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
      paddingVertical: theme.spacing.sm,
    },

    captionText: {
      fontSize: 14,
      lineHeight: 20,
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