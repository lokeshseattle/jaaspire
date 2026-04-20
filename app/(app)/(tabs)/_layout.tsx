import { useNotificationBadgeStore } from "@/src/features/notifications/notification-badge.store";
import { useTheme } from "@/src/theme/ThemeProvider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const unreadCount = useNotificationBadgeStore((s) => s.unreadCount);
  const pathname = usePathname();
  const segments = useSegments();
  const isReelsTab =
    pathname === "/reels" ||
    (segments as string[]).includes("reels");
  const isDarkTheme = theme.colors.background === "#0B0F14";
  /** Reels is full-bleed black; other tabs follow app theme (must update on tab change — child-only StatusBar may not restore when leaving Reels). */
  const statusBarStyle = isReelsTab
    ? "light"
    : isDarkTheme
      ? "light"
      : "dark";

  /** Bottom tab chrome: force dark chrome on Reels regardless of light/dark app theme. */
  const reelsTabChrome = {
    tabBarStyle: {
      backgroundColor: "#000000",
      borderTopColor: "rgba(255,255,255,0.14)",
      borderTopWidth: 1,
    },
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: "rgba(255,255,255,0.5)",
  };
  const defaultTabChrome = {
    tabBarStyle: {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
    },
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textSecondary,
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isReelsTab ? "#000" : theme.colors.background,
        paddingTop: isReelsTab ? 0 : insets.top,
      }}
    >
      <StatusBar
        style={statusBarStyle}
        translucent
        backgroundColor="transparent"
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          ...(isReelsTab ? reelsTabChrome : defaultTabChrome),
          tabBarItemStyle: {},
          tabBarLabelStyle: {
            fontSize: 11,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            headerShown: false,
            title: "Home",

            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="reels"
          options={{
            headerShown: false,
            title: "Reels",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "play-circle" : "play-circle-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "search" : "search-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="create"
          options={{
            title: "Create",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "add-circle" : "add-circle-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="notifications"
          options={{
            title: "Alerts",
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              fontSize: 10,
            },
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "notifications" : "notifications-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
