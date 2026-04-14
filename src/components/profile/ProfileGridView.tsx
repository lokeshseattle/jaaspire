// src/components/profile/ProfileGridView.tsx
import { usePostStore } from "@/src/features/post/post.store";
import { Post } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  ColorValue,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const ITEM_SIZE = width / 3;
const NUM_COLUMNS = 3;
export type PostMediaViewer = Post["viewer"];

/** Appends alpha to a 6-digit `#RRGGBB` hex (React Native 8-digit hex). */
function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? `${hex}${a}` : hex;
}

type GridItem = {
  id: string;
  postId: number;
  image: string;
  type: "image" | "video";
  status: "pending" | "completed";
  isLocked: boolean;
};

interface ProfileGridViewProps {
  postIds: number[];
  ListHeaderComponent: React.ReactElement;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  /** When set, opens user-scoped post detail (`mode=user` API). Otherwise `/post/:id` (explore). */
  postRouteUsername?: string;
  ListEmptyComponent?: React.ReactElement | null;
}

export function ProfileGridView({
  postIds,
  ListHeaderComponent,
  onRefresh,
  isRefreshing,
  onEndReached,
  isFetchingNextPage,
  postRouteUsername,
  ListEmptyComponent,
}: ProfileGridViewProps) {
  const { theme, mode } = useTheme();
  const systemScheme = useColorScheme();
  const resolvedMode =
    mode === "system" ? (systemScheme ?? "light") : mode;

  const styles = useMemo(
    () => createStyles(theme, resolvedMode),
    [theme, resolvedMode],
  );

  const lockedGradients = useMemo(() => {
    const g = theme.colors.gradient;
    const badgeGradient = [g[0], g[1], g[2]] as [
      ColorValue,
      ColorValue,
      ColorValue,
    ];

    if (resolvedMode === "light") {
      const scrim: [string, string, string] = [
        "rgba(15, 23, 42, 0.28)",
        hexWithAlpha(theme.colors.primary, 0.4),
        "rgba(15, 23, 42, 0.84)",
      ];
      return { scrim, badgeGradient };
    }

    const scrim: [string, string, string] = [
      hexWithAlpha(theme.colors.background, 0.38),
      hexWithAlpha(theme.colors.primary, 0.52),
      hexWithAlpha(theme.colors.background, 0.92),
    ];
    return { scrim, badgeGradient };
  }, [theme, resolvedMode]);

  const pendingScrim = useMemo((): [string, string] => {
    return [
      hexWithAlpha(theme.colors.card, 0.78),
      hexWithAlpha(theme.colors.background, 0.92),
    ];
  }, [theme]);

  // Get posts from Zustand store
  const posts = usePostStore((state) => state.posts);

  // Transform post IDs into grid items
  const gridData = useMemo<GridItem[]>(() => {
    const items: GridItem[] = [];

    for (const postId of postIds) {
      const post = posts[postId];
      if (!post?.attachments) continue;

      for (const att of post.attachments) {
        const mediaType = getMediaType(att.type);
        items.push({
          id: att.id,
          postId: post.id,
          image: mediaType === "image" ? att.path : att.thumbnail,
          type: mediaType as "image" | "video",
          status: post.attachments[0].status,
          isLocked: !viewerCanViewPostMedia(
            post.viewer,
            post.price,
            post.is_exclusive,
          ),
        });
      }
    }

    return items;
  }, [postIds, posts]);

  const handleItemPress = useCallback(
    (postId: number) => {
      if (postRouteUsername) {
        router.push(`/user/${postRouteUsername}/posts/${postId}`);
      } else {
        router.push(`/post/${postId}`);
      }
    },
    [postRouteUsername],
  );

  function viewerCanViewPostMedia(
    viewer: PostMediaViewer | undefined,
    price: number,
    isExclusive: boolean,
  ): boolean {
    if (viewer?.is_owner === true) return true;
    if (price > 0 && !viewer?.has_purchased) return false;
    if (isExclusive && !viewer?.has_subscription) return false;
    return true;
  }

  const renderItem = useCallback(
    ({ item }: { item: GridItem }) => {
      const isPending = item.status === "pending";

      return (
        <Pressable
          disabled={isPending}
          onPress={() => handleItemPress(item.postId)}
        >
          <View style={styles.gridItemContainer}>
            <Image
              source={{ uri: item.image }}
              style={styles.gridImage}
              contentFit="cover"
              cachePolicy="disk"
              transition={200}
            />

            {item.isLocked && (
              <LinearGradient
                pointerEvents="none"
                colors={lockedGradients.scrim}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.lockedOverlay}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={lockedGradients.badgeGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.lockBadge}
                >
                  <Ionicons name="lock-closed" size={26} color="#FFFFFF" />
                </LinearGradient>
              </LinearGradient>
            )}

            {/* Video Indicator */}
            {item.type === "video" && !isPending && (
              <View style={styles.videoIndicator}>
                <Ionicons name="play" size={14} color="#FFFFFF" />
              </View>
            )}

            {/* Pending Overlay */}
            {isPending && (
              <LinearGradient
                pointerEvents="none"
                colors={pendingScrim}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pendingOverlay}
              >
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={styles.overlayText}>Processing...</Text>
              </LinearGradient>
            )}
          </View>
        </Pressable>
      );
    },
    [styles, handleItemPress, lockedGradients, pendingScrim, theme.colors.primary],
  );

  const keyExtractor = useCallback((item: GridItem) => `grid-${item.id}`, []);

  const ListFooter = useMemo(
    () =>
      isFetchingNextPage ? (
        <ActivityIndicator
          style={styles.loader}
          color={theme.colors.primary}
        />
      ) : null,
    [isFetchingNextPage, styles.loader, theme.colors.primary],
  );

  return (
    <FlatList
      data={gridData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent ?? undefined}
      ListFooterComponent={ListFooter}
      onRefresh={onRefresh}
      refreshing={isRefreshing}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
    />
  );
}

const createStyles = (theme: AppTheme, resolvedMode: "light" | "dark") =>
  StyleSheet.create({
    gridItemContainer: {
      width: ITEM_SIZE,
      height: ITEM_SIZE * 1.2,
      padding: 1,
    },
    gridImage: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    videoIndicator: {
      position: "absolute",
      top: theme.spacing.sm,
      right: theme.spacing.sm,
      backgroundColor:
        resolvedMode === "light"
          ? hexWithAlpha(theme.colors.textPrimary, 0.58)
          : hexWithAlpha(theme.colors.background, 0.72),
      borderRadius: theme.radius.sm,
      padding: 4,
    },
    loader: {
      padding: 20,
    },
    lockedOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    lockBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      elevation: 4,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
    },
    pendingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    overlayText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
  });
