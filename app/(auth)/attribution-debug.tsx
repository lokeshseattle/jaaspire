import { buildAttributionExtras } from "@/src/features/attribution/attribution.parser";
import { getInstallTrackPayload } from "@/src/features/attribution/attribution.service";
import {
  getAttributionDone,
  getFullStoredAttribution,
  getInstallTrackDone,
} from "@/src/features/attribution/attribution.storage";
import { API_BASE_URL } from "@/src/constants/app-env";
import type { AttributionExtras } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

type DebugState = {
  attribution: Record<string, unknown>;
  attributionExtras: AttributionExtras | null;
  installPayload: Record<string, unknown> | null;
  installPayloadError: string | null;
};

export default function AttributionDebugScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [debugState, setDebugState] = useState<DebugState | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [
          attribution,
          attributionDone,
          installTrackDone,
        ] = await Promise.all([
          getFullStoredAttribution(),
          getAttributionDone(),
          getInstallTrackDone(),
        ]);

        const attributionExtras = buildAttributionExtras(attribution);

        let installPayload: Record<string, unknown> | null = null;
        let installPayloadError: string | null = null;

        try {
          const payload = await getInstallTrackPayload();
          installPayload = payload ?? null;
          if (!payload) {
            installPayloadError = "Unsupported platform for install track.";
          }
        } catch (error) {
          installPayloadError =
            error instanceof Error ? error.message : String(error);
        }

        if (!cancelled) {
          setDebugState({
            attribution: {
              attribution_done: attributionDone,
              install_track_done: installTrackDone,
              ...attribution,
            },
            attributionExtras,
            installPayload,
            installPayloadError,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
    >
      <Text style={styles.lead}>
        Attribution debug (production builds included). Long-press any block to
        copy.
      </Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sign-up attribution_extras</Text>
            <Text selectable style={styles.json}>
              {formatPayload(
                debugState?.attributionExtras ?? { raw: null },
              )}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Attribution data</Text>
            <Text selectable style={styles.json}>
              {formatPayload(debugState?.attribution ?? {})}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Install / track payload</Text>
            {debugState?.installPayloadError ? (
              <Text style={styles.error}>{debugState.installPayloadError}</Text>
            ) : (
              <Text selectable style={styles.json}>
                {formatPayload(debugState?.installPayload ?? {})}
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>API base URL</Text>
            <Text selectable style={styles.json}>
              {API_BASE_URL}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    lead: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    json: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
      lineHeight: 16,
      color: theme.colors.textSecondary,
    },
    error: {
      fontSize: 14,
      lineHeight: 20,
      color: "#dc2626",
    },
  });
