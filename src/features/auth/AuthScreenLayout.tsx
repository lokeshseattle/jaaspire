import { Logo } from "@/assets/svg";
import { ThemedView } from "@/src/components/themed-view";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Link, useRouter, type Href } from "expo-router";
import { ReactNode, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

const LOGO_TAP_TARGET = 10;
const LOGO_TAP_RESET_MS = 2000;

type AuthScreenLayoutProps = {
  /** Shown only when `showBranding` is true (default). */
  title?: string;
  children: ReactNode;
  footerLink?: {
    label: string;
    href: string;
  };
  /** When true, content is vertically centered and shifts up when keyboard opens (e.g. login). */
  centerVertically?: boolean;
  /** When false, logo and title are omitted (e.g. compact flows like 2FA). */
  showBranding?: boolean;
};

export function AuthScreenLayout({
  title = "",
  children,
  footerLink,
  centerVertically = false,
  showBranding = true,
}: AuthScreenLayoutProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const [logoTapCount, setLogoTapCount] = useState(0);
  const lastLogoTapAtRef = useRef(0);

  const handleLogoPress = () => {
    const now = Date.now();
    const elapsed = now - lastLogoTapAtRef.current;
    const nextCount =
      elapsed > LOGO_TAP_RESET_MS || lastLogoTapAtRef.current === 0
        ? 1
        : logoTapCount + 1;

    lastLogoTapAtRef.current = now;

    if (nextCount >= LOGO_TAP_TARGET) {
      setLogoTapCount(0);
      lastLogoTapAtRef.current = 0;
      router.push("/(auth)/attribution-debug" as Href);
      return;
    }

    setLogoTapCount(nextCount);
  };

  const body = (
    <>
      {showBranding ? (
        <>
          <Pressable
            onPress={handleLogoPress}
            style={styles.logoContainer}
            accessibilityRole="button"
            accessibilityLabel="App logo"
          >
            <Logo />
          </Pressable>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
          </View>
        </>
      ) : null}
      <View
        style={[styles.form, !centerVertically ? styles.formExpand : null]}
      >
        {children}
      </View>
      {footerLink ? (
        <Link href={footerLink.href as any} style={styles.link}>
          {footerLink.label}
        </Link>
      ) : null}
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !showBranding && styles.scrollContentCompact,
          centerVertically && styles.scrollContentCentered,
        ]}
        bottomOffset={centerVertically ? 48 : 20}
        extraKeyboardSpace={centerVertically ? 20 : 0}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {centerVertically ? (
          <View style={styles.centeredCluster}>{body}</View>
        ) : (
          body
        )}
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: 40,
      paddingBottom: 40,
      flexGrow: 1,
    },
    scrollContentCentered: {
      justifyContent: "center",
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    scrollContentCompact: {
      paddingTop: theme.spacing.md,
    },
    /** Wraps login stack so the group is vertically centered (avoids flex:1 form pinning fields to top). */
    centeredCluster: {
      width: "100%",
      alignSelf: "stretch",
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: theme.spacing.xl,
    },
    titleRow: {
      marginBottom: theme.spacing.xl,
    },
    title: {
      fontSize: 26,
      fontWeight: "600",
      letterSpacing: -0.4,
      color: theme.colors.textPrimary,
    },
    form: {
      gap: theme.spacing.xl,
    },
    formExpand: {
      flex: 1,
    },
    link: {
      color: theme.colors.primary,
      fontSize: 14,
      textAlign: "center",
      marginTop: theme.spacing.xl,
    },
  });
