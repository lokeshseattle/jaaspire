import Feather from "@expo/vector-icons/Feather";
import Octicons from "@expo/vector-icons/Octicons";
import React, { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

const PostFooter = () => {
  return (
    <View style={styles.container}>
      <PostActions />
      <PostCaptions />
    </View>
  );
};

export default PostFooter;

const PostActions = () => {
  const { isLiked, toggleLike, post } = usePost();
  // const isLikedByUser = post.user_reaction === "love";

  const loveCount = post.reactions.find((r) => r.name === "love")?.count ?? 0;

  return (
    <View style={styles.actionsContainer}>
      <View style={styles.leftActions}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Heart isLiked={isLiked} onPress={toggleLike} />
          {loveCount > 0 && <Text>{loveCount}</Text>}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Comments />
          {post.comments_count > 0 && <Text>{post.comments_count}</Text>}
        </View>
        <Tip />
        <Share />
      </View>

      <Views />
    </View>
  );
};

const Heart = ({ isLiked, onPress }: {
  isLiked: boolean;
  onPress: () => void;
}) => {
  return (
    <Pressable onPress={onPress}>
      <FontAwesome
        name={isLiked ? "heart" : "heart-o"}
        size={24}
        style={[
          styles.icon,
          { color: isLiked ? "#ff3040" : "#000" },
        ]}
      />
    </Pressable>
  );
};

const Comments = () => {
  const { onPressComments } = usePost();
  return (
    <Pressable onPress={onPressComments}>
      <Feather name="message-circle" size={24} style={styles.icon} />
    </Pressable>
  );
};

const Tip = () => {
  return <Octicons name="gift" size={24} style={styles.icon} />;
};

const Share = () => {
  return <Feather name="send" size={24} style={styles.icon} />;
};

const Views = () => {
  return <Feather name="eye" size={24} style={styles.icon} />;
};

/* =========================
   Post Captions
========================= */

import { usePost } from "@/src/context/post-context";
import { FontAwesome } from "@expo/vector-icons";
import { useState } from "react";
import { Animated, Pressable } from "react-native";

// if (Platform.OS === "android") {
//   UIManager.setLayoutAnimationEnabledExperimental?.(true);
// }

const PostCaptions = () => {
  const caption = usePost().post.text;

  const [expanded, setExpanded] = useState(false);
  const [shouldShowToggle, setShouldShowToggle] = useState(false);

  const animatedHeight = useRef(new Animated.Value(0)).current;
  const fullHeight = useRef(0);
  const collapsedHeight = useRef(0);

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
    <View style={styles.container}>
      {/* Measure full height */}
      <Text
        style={[styles.text, styles.hidden]}
        onLayout={(e) => {
          fullHeight.current = e.nativeEvent.layout.height;

          if (collapsedHeight.current === 0) {
            collapsedHeight.current = styles.text.lineHeight * 2;

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
      </Text>

      {/* Animated visible container */}
      <Animated.View style={{ height: animatedHeight, overflow: "hidden" }}>
        <Text style={styles.text}>{caption}</Text>
      </Animated.View>

      {shouldShowToggle && (
        <Pressable onPress={toggle}>
          <Text style={styles.toggle}>{expanded ? "Show less" : "More"}</Text>
        </Pressable>
      )}
    </View>
  );
};

/* =========================
   Styles
========================= */

const styles = StyleSheet.create({
  container: {
    padding: 6,
  },

  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  leftActions: {
    flexDirection: "row",
    gap: 16,
  },

  icon: {
    color: "#000",
  },

  captionContainer: {
    paddingVertical: 6,
  },

  captionText: {
    fontSize: 14,
    color: "#000",
  },

  toggleText: {
    marginTop: 4,
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: "#000",
  },
  hidden: {
    position: "absolute",
    opacity: 0,
    zIndex: -1,
  },
  toggle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "500",
    color: "#888",
  },
});
