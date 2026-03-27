import { useSearchUserQuery } from "@/src/features/profile/profile.hooks";
import { MentionUser } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  FlatListProps,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type MentionListVariant = "bottomSheet" | "fullScreen";

type MentionSuggestionsListProps = {
  /** Debounced query for `search/mention` */
  query: string;
  onSelect: (user: MentionUser) => void;
  variant?: MentionListVariant;
  /** Extra bottom padding (e.g. bottom sheet footer) */
  bottomInset?: number;
  /** When false, omit the in-list query header (e.g. create screen has its own search field). */
  showQueryHeader?: boolean;
};

export function MentionUserRow({
  item,
  onSelect,
  styles,
}: {
  item: MentionUser;
  onSelect: (user: MentionUser) => void;
  styles: ReturnType<typeof createMentionStyles>;
}) {
  return (
    <Pressable style={styles.mentionItem} onPress={() => onSelect(item)}>
      <Image source={{ uri: item.avatar }} style={styles.mentionAvatar} />
      <View style={styles.mentionInfo}>
        <View style={styles.mentionNameRow}>
          <Text style={styles.mentionName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.verified_user && (
            <Ionicons name="checkmark-circle" size={14} color="#3897F0" />
          )}
        </View>
        <Text style={styles.mentionUsername} numberOfLines={1}>
          @{item.username}
        </Text>
      </View>
    </Pressable>
  );
}

function ListHeader({
  query,
  styles,
  iconColor,
}: {
  query: string;
  styles: ReturnType<typeof createMentionStyles>;
  iconColor: string;
}) {
  return (
    <View style={styles.mentionHeader}>
      <Ionicons name="at" size={18} color={iconColor} />
      <Text style={styles.mentionHeaderText}>
        {query ? `Searching "${query}"` : "Type to search users"}
      </Text>
    </View>
  );
}

/**
 * Shared mention picker: bottom sheet (comments) or full-screen modal (create post).
 */
export default function MentionSuggestionsList({
  query,
  onSelect,
  variant = "bottomSheet",
  bottomInset = 0,
  showQueryHeader = true,
}: MentionSuggestionsListProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createMentionStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const { data, isLoading, isFetching } = useSearchUserQuery(query);
  const users = data?.data?.users ?? [];

  const footerPad =
    variant === "bottomSheet"
      ? 80 + insets.bottom + bottomInset
      : insets.bottom + bottomInset;

  const showLoading = (isLoading || isFetching) && users.length === 0;

  const renderListHeader = showQueryHeader
    ? () => (
        <ListHeader
          query={query}
          styles={styles}
          iconColor={theme.colors.textSecondary}
        />
      )
    : undefined;

  const empty = (
    <View style={styles.mentionEmpty}>
      <Ionicons name="person-outline" size={48} color={theme.colors.border} />
      <Text style={styles.mentionEmptyText}>
        {query.length === 0 ? "Type to search users" : "No users found"}
      </Text>
    </View>
  );

  const listCommon: FlatListProps<MentionUser> = {
    data: users,
    keyExtractor: (item: MentionUser) => item.id.toString(),
    renderItem: ({ item }) => (
      <MentionUserRow item={item} onSelect={onSelect} styles={styles} />
    ),
    ListHeaderComponent: renderListHeader,
    ItemSeparatorComponent: () => <View style={styles.mentionSeparator} />,
    keyboardShouldPersistTaps: "handled",
    contentContainerStyle: {
      paddingBottom: footerPad,
      flexGrow: 1,
    },
    ListEmptyComponent: empty,
  };

  if (showLoading) {
    return (
      <View style={styles.mentionCentered}>
        {showQueryHeader ? (
          <ListHeader
            query={query}
            styles={styles}
            iconColor={theme.colors.textSecondary}
          />
        ) : null}
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color={theme.colors.primary}
        />
      </View>
    );
  }

  if (variant === "fullScreen") {
    return (
      <View style={styles.flexFill}>
        <FlatList {...listCommon} />
      </View>
    );
  }

  return (
    <View style={styles.flexFill}>
      <BottomSheetFlatList {...listCommon} />
    </View>
  );
}

const createMentionStyles = (theme: AppTheme) =>
  StyleSheet.create({
    flexFill: {
      flex: 1,
    },
    mentionCentered: {
      flex: 1,
    },
    mentionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    mentionHeaderText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    mentionItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    mentionAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    mentionInfo: {
      flex: 1,
    },
    mentionNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    mentionName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    mentionUsername: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    mentionSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: 72,
    },
    mentionEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
      gap: 12,
    },
    mentionEmptyText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },
  });
