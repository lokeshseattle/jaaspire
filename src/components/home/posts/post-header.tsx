import { usePost } from "@/src/context/post-context";
import { useBookmarkPostMutation } from "@/src/features/post/post.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { timeAgo } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  findNodeHandle,
} from "react-native";
import StoryAvatar from "../story/StoryAvatar";
import ReportModal from "./ReportModal";

const MENU_WIDTH = 180;

const PostHeader: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { post } = usePost();

  console.log("6565", post.is_bookmarked);
  const { mutateAsync: bookmarkPost } = useBookmarkPostMutation();
  const iconRef = useRef<View>(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const savePost = useBookmarkPostMutation();

  const closeMenu = () => setMenuVisible(false);

  const openMenu = () => {
    if (!iconRef.current) return;

    const handle = findNodeHandle(iconRef.current);
    if (!handle) return;

    UIManager.measureInWindow(handle, (x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;

      const calculatedLeft =
        x + MENU_WIDTH > screenWidth
          ? screenWidth - MENU_WIDTH - 8
          : x + width - MENU_WIDTH;

      setMenuPosition({
        top: y + height + 6,
        left: calculatedLeft,
      });

      setMenuVisible(true);
    });
  };

  const handleAction = (action: string) => {
    if (action === "save") {
      savePost.mutate({
        action: !post.is_bookmarked ? "add" : "remove",
        postId: post.id,
      });
    } else if (action === "report") {
      setReportModalVisible(true);
    }
    closeMenu();
  };

  const navigateToUser = () => {
    if (post.user.username)
      router.push({
        pathname: "/user/[username]",
        params: { username: post.user.username },
      });
  };

  return (
    <>
      <View style={styles.container}>
        {/* Left Section */}
        <Pressable onPress={navigateToUser} style={styles.left}>
          <StoryAvatar
            username={post.user.username}
            hasStory={post.user.story_status.has_stories}
            seen={post.user.story_status.all_viewed}
            uri={post.user.avatar}
          />

          <View>
            <Text style={styles.username}>{post.user.name}</Text>
            <Text style={styles.sub}>@{post.user.username}</Text>
          </View>
        </Pressable>

        {/* Right Section */}
        <View style={styles.right}>
          <Text style={styles.time}>{timeAgo(post.created_at)}</Text>

          <Pressable ref={iconRef} onPress={openMenu} hitSlop={10}>
            <Feather name="more-horizontal" size={22} color={theme.colors.icon} />
          </Pressable>
        </View>
      </View>

      {/* Anchored Popup Menu */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.overlay} onPress={closeMenu}>
          <View
            style={[
              styles.menu,
              {
                top: menuPosition.top,
                left: menuPosition.left,
              },
            ]}
          >
            <MenuItem
              icon={post.is_bookmarked ? "bookmark" : "bookmark-outline"}
              label={post.is_bookmarked ? "Saved" : "Save"}
              onPress={() => handleAction("save")}
              theme={theme}
            />
            <MenuItem
              icon="flag"
              label="Report"
              danger
              onPress={() => handleAction("report")}
              theme={theme}
            />
          </View>
        </Pressable>
      </Modal>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        postId={post.id}
        userId={post.user.id}
      />
    </>
  );
};

export default PostHeader;

interface MenuItemProps {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
  theme: AppTheme;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  danger,
  theme,
}) => {
  const styles = createStyles(theme);
  const DANGER_COLOR = "#e53935";

  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons
        name={icon}
        size={18}
        color={danger ? DANGER_COLOR : theme.colors.textPrimary}
      />
      <Text
        style={[
          styles.menuText,
          danger && { color: DANGER_COLOR },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatarWrapper: {
      height: 44,
      width: 44,
      borderRadius: 100,
      padding: 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    avatar: {
      height: "100%",
      width: "100%",
      borderRadius: 100,
    },
    username: {
      fontWeight: "600",
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
    sub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    right: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    time: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    overlay: {
      flex: 1,
      backgroundColor: "transparent",
    },
    menu: {
      position: "absolute",
      width: MENU_WIDTH,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingVertical: 6,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    menuText: {
      fontSize: 14,
      color: theme.colors.textPrimary,
    },
  });