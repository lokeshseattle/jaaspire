import { LEGAL_LINKS } from "@/src/constants/legal-links";
import { AppTheme } from "@/src/theme";
import { openWebUrl } from "@/src/utils/open-web-url";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

function storeAccountLabel(): string {
  if (Platform.OS === "ios") return "Apple ID";
  if (Platform.OS === "android") return "Google Play";
  return "app store";
}

/** App Store / Play virtual-currency disclosure (Jaasi Stars). */
export function virtualCurrencyDisclaimerText(): string {
  return (
    "Jaasi Stars are a virtual, in-app credit system. They are licensed, not sold, and grant only a limited, revocable, non-refundable, non-transferable right to access eligible in-app features. Stars carry no monetary value, cannot be redeemed for legal tender by Users, are non-transferable between accounts, and have no utility outside of Jaaspire."
  );
}

function consumableIapPaymentDisclosure(): string {
  return `Payment for star packs will be charged to your ${storeAccountLabel()} account at purchase.`;
}

type IapLegalFooterProps = {
  theme: AppTheme;
  variant: "subscribe" | "consumable";
  /** Subscribe only — auto-renew disclosure text. */
  subscribeDisclosure?: string;
  style?: object;
};

export function VirtualCurrencyDisclaimer({
  theme,
  style,
}: {
  theme: AppTheme;
  style?: object;
}) {
  const styles = createStyles(theme);
  return (
    <Text
      style={[styles.legalText, style]}
      accessibilityRole="text"
      accessibilityLabel={virtualCurrencyDisclaimerText()}
    >
      {virtualCurrencyDisclaimerText()}
    </Text>
  );
}

export function IapLegalLinksRow({ theme }: { theme: AppTheme }) {
  const styles = createStyles(theme);
  return (
    <View style={styles.linksRow}>
      <Pressable
        onPress={() => void openWebUrl(LEGAL_LINKS.termsOfService)}
        accessibilityRole="link"
        accessibilityLabel="Terms of Use EULA"
        hitSlop={4}
      >
        <Text style={styles.link}>Terms of Use (EULA)</Text>
      </Pressable>
      <Text style={styles.linkSeparator}>·</Text>
      <Pressable
        onPress={() => void openWebUrl(LEGAL_LINKS.privacyPolicy)}
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
        hitSlop={4}
      >
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
    </View>
  );
}

export default function IapLegalFooter({
  theme,
  variant,
  subscribeDisclosure,
  style,
}: IapLegalFooterProps) {
  const styles = createStyles(theme);
  const subscribeDisclosureText = subscribeDisclosure ?? "";

  if (variant === "subscribe" && !subscribeDisclosureText) return null;

  return (
    <View style={[styles.root, style]} accessibilityRole="summary">
      {variant === "consumable" ? (
        <>
          <Text style={styles.legalText}>{virtualCurrencyDisclaimerText()}</Text>
          <Text style={styles.legalText}>{consumableIapPaymentDisclosure()}</Text>
        </>
      ) : (
        <Text style={styles.legalText}>{subscribeDisclosureText}</Text>
      )}
      <IapLegalLinksRow theme={theme} />
    </View>
  );
}

export function subscriptionAutoRenewDisclosure(): string {
  if (Platform.OS === "ios") {
    return (
      "Payment will be charged to your Apple ID account at confirmation of purchase. " +
      "Subscription automatically renews unless it is canceled at least 24 hours before the end of the current period. " +
      "Your account will be charged for renewal within 24 hours prior to the end of the current period. " +
      "You can manage and cancel your subscriptions in your App Store account settings after purchase."
    );
  }
  if (Platform.OS === "android") {
    return (
      "Payment will be charged to your Google Play account at confirmation of purchase. " +
      "Subscription automatically renews unless you cancel before the end of the current billing period. " +
      "You can manage or cancel subscriptions anytime in Google Play subscription settings."
    );
  }
  return (
    "Subscription automatically renews each month unless canceled before the end of the current billing period."
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.xs,
    },
    legalText: {
      fontSize: 11,
      lineHeight: 15,
      color: theme.colors.textSecondary,
    },
    linksRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    link: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.primary,
      textDecorationLine: "underline",
    },
    linkSeparator: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
  });
