import { ProfileGridView } from "@/src/components/profile/ProfileGridView";
import { AnimatedTabBar } from "@/src/components/ui/animated-tabbar";
import { useGetBookmarksQuery } from "@/src/features/post/post.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

export type BookmarkTabKey = "all" | "image" | "video";

export type TabConfig = {
    label?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    activeIcon?: keyof typeof Ionicons.glyphMap;
};

const tabs: Record<BookmarkTabKey, TabConfig> = {
    all: {
        icon: "grid-outline",
        activeIcon: "grid",
    },
    image: {
        icon: "image-outline",
        activeIcon: "image",
    },
    video: {
        icon: "play-circle-outline",
        activeIcon: "play-circle",
    },
};

export default function BookmarksScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [activeTab, setActiveTab] = useState<BookmarkTabKey>("all");

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: "Bookmarks",
        });
    }, [navigation]);

    // Map the active tab to the API type parameter
    const apiType = useMemo(() => {
        if (activeTab === "all") return "all";
        return activeTab as "image" | "video";
    }, [activeTab]);

    const {
        data: feedData,
        refetch: refetchFeed,
        isRefetching: isRefetchingFeed,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useGetBookmarksQuery(activeTab);

    // Get post IDs from query
    const postIds = useMemo(() => {
        if (!feedData?.pages) return [];
        return feedData.pages.flatMap((page) => page.data.posts);
    }, [feedData?.pages]);

    // Handle refresh
    const handleRefresh = useCallback(async () => {
        await refetchFeed();
    }, [refetchFeed]);

    // Handle pagination
    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleTabChange = useCallback((key: string) => {
        setActiveTab(key as BookmarkTabKey);
    }, []);

    const ListHeader = useMemo(
        () => (
            <View style={styles.tabContainer}>
                <AnimatedTabBar
                    tabs={tabs}
                    activeKey={activeTab}
                    onTabChange={handleTabChange}
                />
            </View>
        ),
        [activeTab, handleTabChange, styles.tabContainer]
    );

    return (
        <View style={styles.container}>
            <ProfileGridView
                postIds={postIds}
                ListHeaderComponent={ListHeader}
                onRefresh={handleRefresh}
                isRefreshing={isRefetchingFeed}
                onEndReached={handleEndReached}
                isFetchingNextPage={isFetchingNextPage}
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
        tabContainer: {
            marginTop: 16,
            marginBottom: 8,
        },
    });
