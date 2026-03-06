// src/components/profile/ProfileView.tsx

import ProfileHeader from "@/src/components/profile/ProfileHeader";
import ProfileTabs from "@/src/components/profile/ProfileTabs";
import { useGetUserFeedQuery } from "@/src/features/post/post.hooks";
import { usePostStore } from "@/src/features/post/post.store";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    StyleSheet,
    View,
} from "react-native";

const { width } = Dimensions.get("window");
const ITEM_SIZE = width / 3;
const NUM_COLUMNS = 3;

type GridItem = {
    id: number;
    postId: number;
    image: string;
    type: "image" | "video";
};

interface ProfileViewProps {
    username: string;
    isOwnProfile?: boolean;
    onRefreshProfile?: () => Promise<void>;
    isRefreshingProfile?: boolean;
}

export default function ProfileView({
    username,
    isOwnProfile = false,
    onRefreshProfile,
    isRefreshingProfile = false,
}: ProfileViewProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [activeTab, setActiveTab] = useState<"video" | "">("");

    const {
        data: feedData,
        refetch: refetchFeed,
        isRefetching: isRefetchingFeed,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useGetUserFeedQuery(username, activeTab);

    // Get posts from Zustand store
    const posts = usePostStore((state) => state.posts);

    // Get post IDs from query
    const postIds = useMemo(() => {
        if (!feedData?.pages) return [];
        return feedData.pages.flatMap((page) => page.data.posts);
    }, [feedData?.pages]);

    // Transform post IDs into grid items using store data
    const gridData = useMemo<GridItem[]>(() => {
        const items: GridItem[] = [];

        for (const postId of postIds) {
            const post = posts[postId];
            if (!post?.attachments) continue;

            for (const att of post.attachments) {
                const mediaType = getMediaType(att.type);
                items.push({
                    id: Number(att.id),
                    postId: post.id,
                    image: mediaType === "image" ? att.path : att.thumbnail,
                    type: mediaType as "image" | "video",
                });
            }
        }

        return items;
    }, [postIds, posts]);

    // Handle refresh
    const handleRefresh = useCallback(async () => {
        await Promise.all([
            onRefreshProfile?.(),
            refetchFeed(),
        ].filter(Boolean));
    }, [onRefreshProfile, refetchFeed]);

    // Handle pagination
    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Handle grid item press - navigate to post
    const handleItemPress = useCallback((postId: number) => {
        router.push(`/post/${postId}`);
    }, []);

    // Render grid item
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

    const keyExtractor = useCallback((item: GridItem) => item.id.toString(), []);

    // List header component
    const ListHeader = useMemo(
        () => (
            <>
                <ProfileHeader username={username} isOwnProfile={isOwnProfile} />
                <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
            </>
        ),
        [username, isOwnProfile, activeTab]
    );

    // List footer component
    const ListFooter = useMemo(
        () =>
            isFetchingNextPage ? (
                <ActivityIndicator style={styles.loader} />
            ) : null,
        [isFetchingNextPage, styles.loader]
    );

    const isRefreshing = isRefreshingProfile || isRefetchingFeed;

    return (
        <View style={styles.container}>
            <FlashList
                data={gridData}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                numColumns={NUM_COLUMNS}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                onRefresh={handleRefresh}
                refreshing={isRefreshing}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                // estimatedItemSize={ITEM_SIZE}
                showsVerticalScrollIndicator={false}
                extraData={activeTab}
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