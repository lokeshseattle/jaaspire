import { WEB_ORIGIN } from "@/src/constants/app-env";
import { useGetMessengerContacts } from "@/src/features/messenger/messenger.hooks";
import type { MessengerContact } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMessengerPeer } from "@/src/utils/messenger-contact";
import { Ionicons } from "@expo/vector-icons";
import type { BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function buildPostUrl(postId: number): string {
  const base = WEB_ORIGIN.replace(/\/+$/, "");
  return `${base}/posts/${postId}`;
}

interface SharePostBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
  postId: number | null;
  onDismiss: () => void;
}

export function SharePostBottomSheet({
  bottomSheetRef,
  postId,
  onDismiss,
}: SharePostBottomSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["60%", "90%"], []);

  const [query, setQuery] = useState("");

  const { data, isLoading, isError, error, refetch } =
    useGetMessengerContacts();

  const contacts = useMemo(
    () => data?.data.contacts ?? [],
    [data?.data.contacts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const peer = getMessengerPeer(c);
      return peer.name.toLowerCase().includes(q);
    });
  }, [contacts, query]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.35}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleShareLink = useCallback(async () => {
    if (postId == null) return;
    const url = buildPostUrl(postId);
    const message = "Check out this post on Jaaspire";
    try {
      await Share.share(
        Platform.OS === "android"
          ? { message: `${message}\n${url}` }
          : { message, url },
      );
    } catch {
      /* dismissed */
    }
  }, [postId]);

  const keyExtractor = useCallback((item: MessengerContact) => {
    return `${item.contactID}-${item.messageDate}-${item.lastMessage}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MessengerContact }) => {
      const peer = getMessengerPeer(item);
      return (
        <View style={styles.row}>
          <Image
            source={{ uri: peer.avatar }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
          <Text style={styles.peerName} numberOfLines={1}>
            {peer.name}
          </Text>
          <Pressable
            onPress={() => {
              if (postId == null) return;
              console.log("share post to peer", {
                postId,
                peerId: peer.id,
                peerName: peer.name,
              });
            }}
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && styles.sendBtnPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="send"
              size={18}
              color={theme.colors.primary}
            />
          </Pressable>
        </View>
      );
    },
    [postId, styles, theme.colors.primary],
  );

  const footerInset = insets.bottom || 12;

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          style={[styles.footerWrap, { paddingBottom: footerInset }]}
        >
          <Pressable
            onPress={handleShareLink}
            style={({ pressed }) => [
              styles.shareLinkBtn,
              pressed && styles.shareLinkBtnPressed,
            ]}
          >
            <Ionicons
              name="share-outline"
              size={22}
              color="#FFFFFF"
            />
            <Text style={styles.shareLinkBtnText}>Share link</Text>
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    [footerInset, handleShareLink, styles],
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyBlock}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (isError) {
      const message =
        error instanceof Error ? error.message : "Could not load contacts";
      return (
        <View style={styles.emptyBlock}>
          <Text style={styles.errorText}>{message}</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    if (contacts.length === 0) {
      return (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyText}>No conversations yet</Text>
        </View>
      );
    }
    if (query.trim()) {
      return (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyText}>No matches</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={0}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      enablePanDownToClose
      enableContentPanningGesture
      enableOverDrag={false}
      onDismiss={() => {
        setQuery("");
        onDismiss();
      }}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="extend"
      keyboardBlurBehavior="none"
    >
      <View style={styles.sheetBody}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Share</Text>
          <BottomSheetTextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={theme.colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          style={styles.list}
          contentContainerStyle={{
            paddingBottom: SCREEN_HEIGHT * 0.12,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
        />
      </View>
    </BottomSheetModal>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    sheetBackground: {
      backgroundColor: theme.colors.background,
    },
    handleIndicator: {
      backgroundColor: theme.colors.border,
      width: 40,
    },
    sheetBody: {
      flex: 1,
    },
    list: {
      flex: 1,
    },
    sheetHeader: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      textAlign: "center",
      marginBottom: theme.spacing.md,
    },
    searchInput: {
      minHeight: 44,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.border,
    },
    peerName: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.textPrimary,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    sendBtnPressed: {
      opacity: 0.85,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: theme.spacing.lg + 44 + theme.spacing.md,
    },
    emptyBlock: {
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
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
    footerWrap: {
      backgroundColor: theme.colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    shareLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      minHeight: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    shareLinkBtnPressed: {
      opacity: 0.9,
    },
    shareLinkBtnText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
    },
  });
