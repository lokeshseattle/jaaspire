import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
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

interface User {
  id: string;
  username: string;
  avatar: string;
}

const MENU_WIDTH = 180;

const PostHeader: React.FC<User> = ({ avatar, id, username }) => {
  const iconRef = useRef<View>(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const closeMenu = () => setMenuVisible(false);

  const openMenu = () => {
    if (!iconRef.current) return;

    const handle = findNodeHandle(iconRef.current);
    if (!handle) return;

    UIManager.measureInWindow(handle, (x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;

      // Prevent overflow on right side
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
    console.log("Action:", action);
    closeMenu();
  };

  return (
    <>
      <View style={styles.container}>
        {/* Left Section */}
        <View style={styles.left}>
          <View style={styles.avatarWrapper}>
            <Image source={avatar} style={styles.avatar} />
          </View>

          <View>
            <Text style={styles.username}>{username}</Text>
            <Text style={styles.sub}>{username}</Text>
          </View>
        </View>

        {/* Right Section */}
        <View style={styles.right}>
          <Text style={styles.time}>1h ago</Text>

          <Pressable ref={iconRef} onPress={openMenu} hitSlop={10}>
            <Feather name="more-horizontal" size={22} color="#000" />
          </Pressable>
        </View>
      </View>

      {/* Anchored Popup */}
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
              icon="edit-2"
              label="Edit"
              onPress={() => handleAction("edit")}
            />
            <MenuItem
              icon="share"
              label="Share"
              onPress={() => handleAction("share")}
            />
            <MenuItem
              icon="flag"
              label="Report"
              danger
              onPress={() => handleAction("report")}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

export default PostHeader;
interface MenuItemProps {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  danger,
}) => {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Feather name={icon} size={18} color={danger ? "#e53935" : "#222"} />
      <Text style={[styles.menuText, danger && { color: "#e53935" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    borderColor: "#ddd",
  },
  avatar: {
    height: "100%",
    width: "100%",
    borderRadius: 100,
  },
  username: {
    fontWeight: "600",
    fontSize: 15,
  },
  sub: {
    fontSize: 12,
    opacity: 0.6,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  time: {
    fontSize: 12,
    opacity: 0.6,
  },

  overlay: {
    flex: 1,
    backgroundColor: "transparent",
  },

  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  menuText: {
    fontSize: 14,
  },
});
