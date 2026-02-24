import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  avatar: string;
  username: string;
  createdAt: string;
  onClose?: () => void;
  onDelete?: () => void;
  ownStory: boolean;
}

const StoryHeader = ({
  avatar,
  username,
  createdAt,
  onClose,
  onDelete,
  ownStory,
}: Props) => {
  const insets = useSafeAreaInsets();

  function navigateToUser() {
    router.push({
      params: { username },
      pathname: "/user/[username]",
    });
  }

  return (
    <View style={[styles.container, { top: insets.top + 20 }]}>
      <Pressable onPress={navigateToUser} style={styles.userInfo}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.time}>{createdAt}</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {ownStory && (
          <Pressable onPress={onDelete}>
            <Ionicons name="trash" size={24} color="white" />
          </Pressable>
        )}
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={24} color="white" />
        </Pressable>
      </View>
    </View>
  );
};

export default StoryHeader;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 50,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  username: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  time: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "400",
  },
  closeButton: {
    padding: 4,
  },
});
