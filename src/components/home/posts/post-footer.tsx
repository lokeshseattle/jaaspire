import Feather from "@expo/vector-icons/Feather";
import Octicons from "@expo/vector-icons/Octicons";
import React from "react";
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
  return (
    <View style={styles.actionsContainer}>
      <View style={styles.leftActions}>
        <Heart />
        <Comments />
        <Tip />
        <Share />
      </View>

      <Views />
    </View>
  );
};

const Heart = () => {
  return <Feather name="heart" size={24} style={styles.icon} />;
};

const Comments = () => {
  return <Feather name="message-circle" size={24} style={styles.icon} />;
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

import { useState } from "react";
import { LayoutAnimation, Pressable } from "react-native";

// if (Platform.OS === "android") {
//   UIManager.setLayoutAnimationEnabledExperimental?.(true);
// }

const PostCaptions = () => {
  const caption =
    "This is a long caption example that demonstrates how a social media style caption collapses after two lines and smoothly expands when tapped. It keeps going to make sure it exceeds two lines on most screen sizes and behaves consistently across devices.";

  const [expanded, setExpanded] = useState(false);
  const [shouldShowToggle, setShouldShowToggle] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      {/* Hidden full text for measuring */}
      {!shouldShowToggle && (
        <Text
          style={[styles.text, styles.hidden]}
          onTextLayout={(e) => {
            if (e.nativeEvent.lines.length > 2) {
              setShouldShowToggle(true);
            }
          }}
        >
          {caption}
        </Text>
      )}

      {/* Visible text */}
      <Text style={styles.text} numberOfLines={expanded ? undefined : 2}>
        {caption}
      </Text>

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
