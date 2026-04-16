import { useGetMessengerContacts } from "@/src/features/messenger/messenger.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { useMessengerContactsRealtimeWhileFocused } from "@/src/lib/pusher";
import type { MessengerContact } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMessengerPeer } from "@/src/utils/messenger-contact";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FlatList, RefreshControl } from "react-native-gesture-handler";

export default function MessagesScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { data: me } = useGetProfile();
  useMessengerContactsRealtimeWhileFocused(me?.data?.id);

  const { data, isLoading, isRefetching, isError, error, refetch } =
    useGetMessengerContacts();

  const contacts = data?.data.contacts ?? [];

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const keyExtractor = useCallback((item: MessengerContact) => {
    return `${item.contactID}-${item.messageDate}-${item.lastMessage}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MessengerContact }) => {
      const peer = getMessengerPeer(item);
      const unread = item.isSeen === 0 && item.senderID !== me?.data?.id;

      return (
        <Pressable
          style={[styles.row, unread && styles.rowUnread]}
          onPress={() => {
            router.push({
              pathname: "/chat/[senderId]",
              params: {
                senderId: String(peer.id),
                name: peer.name,
                avatar: peer.avatar,
                isAiBot: item.isAiBot ? "1" : "0",
              },
            });
          }}
        >
          <Image
            source={{ uri: peer.avatar }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.peerName, unread && styles.peerNameUnread]}
                  numberOfLines={1}
                >
                  {peer.name}
                </Text>
                {item.isAiBot && (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                )}
              </View>
              <Text style={styles.time} numberOfLines={1}>
                {item.created_at || ""}
              </Text>
            </View>
            <Text style={styles.preview} numberOfLines={2}>
              {item.lastMessage}
            </Text>
          </View>
          {unread ? <View style={styles.unreadDot} /> : null}
        </Pressable>
      );
    },
    [styles],
  );

  if (isLoading && contacts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (contacts.length === 0 && isError) {
    const message =
      error instanceof Error ? error.message : "Could not load messages";
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{message}</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              When you message someone, they will appear here.
            </Text>
          </View>
        }
        contentContainerStyle={
          contacts.length === 0 ? styles.emptyListContent : undefined
        }
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      textAlign: "center",
      marginBottom: theme.spacing.md,
    },
    retryBtn: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    retryLabel: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    rowUnread: {
      backgroundColor: theme.colors.surface,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.border,
    },
    rowBody: {
      flex: 1,
      marginLeft: theme.spacing.md,
      minWidth: 0,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    peerName: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.textPrimary,
    },
    peerNameUnread: {
      fontWeight: "700",
    },
    aiBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.colors.primary + "22",
    },
    aiBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    time: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    preview: {
      marginTop: 4,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
      marginLeft: theme.spacing.sm,
    },
    emptyWrap: {
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
    },
    emptyTitle: {
      marginTop: theme.spacing.md,
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    emptySubtitle: {
      marginTop: theme.spacing.sm,
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    emptyListContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
  });
