import { useTheme } from "@/src/theme/ThemeProvider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const pathname = usePathname();
  const segments = useSegments();
  const isFlicksTab =
    pathname === "/flicks" ||
    (segments as string[]).includes("flicks");
  const isDarkTheme = theme.colors.background === "#0B0F14";
  /** Flicks is full-bleed black; other tabs follow app theme (must update on tab change — child-only StatusBar may not restore when leaving Flicks). */
  const statusBarStyle = isFlicksTab
    ? "light"
    : isDarkTheme
      ? "light"
      : "dark";

  /** Bottom tab chrome: force dark chrome on Flicks regardless of light/dark app theme. */
  const flicksTabChrome = {
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
        backgroundColor: isFlicksTab ? "#000" : theme.colors.background,
        paddingTop: isFlicksTab ? 0 : insets.top,
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
          ...(isFlicksTab ? flicksTabChrome : defaultTabChrome),
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
          name="flicks"
          options={{
            headerShown: false,
            title: "Flicks",
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
