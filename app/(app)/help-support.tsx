import { WEB_ORIGIN } from "@/src/constants/app-env";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";
import { useMemo } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const POLICY_LINKS: { label: string; path: string }[] = [
  { label: "Terms of Service", path: "/pages/terms-of-service" },
  { label: "Privacy Policy", path: "/pages/privacy-policy" },
  { label: "Acceptable Use Policy", path: "/pages/acceptable-use-policy" },
  { label: "Complaints Policy", path: "/pages/complaint-policy" },
];

async function openWebUrl(url: string) {
  await openBrowserAsync(url, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
}

export default function HelpSupportScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const contactUrl = `${WEB_ORIGIN}/contact`;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
      showsVerticalScrollIndicator
    >
      <View style={styles.section}>
        <View style={styles.sectionBody}>
          <Text style={styles.lead}>
            Jaaspire is a social media and content-sharing platform that empowers
            creators to share photos, videos, and other media with their
            audience. Users can set subscription prices, engage with their
            followers, and earn income from their content.
          </Text>
          <Text style={styles.body}>
            Operated by realdrseattle, a company registered in Washington, USA,
            Jaaspire is committed to providing a transparent, secure, and
            respectful experience for everyone on the platform.
          </Text>
          <Text style={styles.bodyMuted}>
            Below you will find important documents that govern how Jaaspire
            works, how we protect your data, and what is expected from all users.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Legal &amp; policies</Text>
      <View style={styles.section}>
        {POLICY_LINKS.map((item, index) => (
          <Pressable
            key={item.path}
            style={({ pressed }) => [
              styles.linkRow,
              index < POLICY_LINKS.length - 1 && styles.linkRowBorder,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => openWebUrl(`${WEB_ORIGIN}${item.path}`)}
          >
            <Text style={styles.linkLabel}>{item.label}</Text>
            <Ionicons
              name="open-outline"
              size={18}
              color={theme.colors.icon}
            />
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Contact</Text>
      <View style={styles.section}>
        <View style={[styles.staticRow, styles.linkRowBorder]}>
          <Ionicons name="location-outline" size={20} color={theme.colors.icon} />
          <Text style={styles.staticText}>
            600 Broadway UNIT 320, Seattle, WA 98122, United States
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.linkRow,
            styles.linkRowBorder,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => Linking.openURL("tel:+14258661447")}
        >
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={20} color={theme.colors.icon} />
            <Text style={styles.linkLabel}>(425) 866-1447</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.icon}
          />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
          onPress={() => openWebUrl(contactUrl)}
        >
          <View style={styles.phoneRow}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.icon} />
            <Text style={styles.linkLabel}>Contact support</Text>
          </View>
          <Ionicons
            name="open-outline"
            size={18}
            color={theme.colors.icon}
          />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
    },
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      overflow: "hidden",
      marginBottom: theme.spacing.lg,
    },
    sectionBody: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
    },
    lead: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    bodyMuted: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    linkRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    linkLabel: {
      fontSize: 15,
      color: theme.colors.textPrimary,
      fontWeight: "500",
      flex: 1,
    },
    staticRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    staticText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textPrimary,
    },
    phoneRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      flex: 1,
    },
  });
