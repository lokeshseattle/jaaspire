// src/components/profile/ProfileGridView.tsx
import { usePostStore } from "@/src/features/post/post.store";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Pressable,
    StyleSheet,
    View,
} from "react-native";

const { width } = Dimensions.get("window");
const ITEM_SIZE = width / 3;
const NUM_COLUMNS = 3;

type GridItem = {
    id: string;
    postId: number;
    image: string;
    type: "image" | "video";
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
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

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

    const renderItem = useCallback(
        ({ item }: { item: GridItem }) => (
            <Pressable onPress={() => handleItemPress(item.postId)}>
                <View style={styles.gridItemContainer}>
                    <Image
                        source={{ uri: item.image }}
                        style={styles.gridImage}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={200}
                    />
                    {item.type === "video" && (
                        <View style={styles.videoIndicator}>
                            <Ionicons name="play" size={14} color="white" />
                        </View>
                    )}
                </View>
            </Pressable>
        ),
        [styles, handleItemPress]
    );

    const keyExtractor = useCallback(
        (item: GridItem) => `grid-${item.id}`,
        []
    );

    const ListFooter = useMemo(
        () =>
            isFetchingNextPage ? (
                <ActivityIndicator style={styles.loader} />
            ) : null,
        [isFetchingNextPage, styles.loader]
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

const createStyles = (theme: AppTheme) =>
    StyleSheet.create({
        gridItemContainer: {
            width: ITEM_SIZE,
            height: ITEM_SIZE,
            padding: 1,
        },
        gridImage: {
            flex: 1,
            backgroundColor: theme.colors.surface ?? "#1a1a1a",
        },
        videoIndicator: {
            position: "absolute",
            top: 6,
            right: 6,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 4,
            padding: 3,
        },
        loader: {
            padding: 20,
        },
    });