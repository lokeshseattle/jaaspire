import { AnimatedTabBar } from "@/src/components/ui/animated-tabbar";
import { useFollowToggleMutation, useGetFollowersQuery, useGetFollowingQuery } from "@/src/features/profile/profile.hooks";
import { FollowUser } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { capitalize } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue
} from "react-native-reanimated";

// const { width } = Dimensions.get("window");

type TFilter = "followers" | "following"

const FILTER_CONFIG: Record<TFilter, any> = {

    followers: {
        label: "Followers",

    },
    following: {
        label: "Following",
    },
};

function normalizeParam(
    value: string | string[] | undefined,
): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value[0]) return value[0];
    return undefined;
}

function ConnectionsEmptyList({
    variant,
    styles,
    theme,
}: {
    variant: TFilter;
    styles: ReturnType<typeof createStyles>;
    theme: AppTheme;
}) {
    const isFollowers = variant === "followers";
    return (
        <View style={styles.emptyOuter}>
            <View style={styles.emptyCard}>
                <View
                    style={[
                        styles.emptyIconRing,
                        { borderColor: theme.colors.primary + "40" },
                    ]}
                >
                    <View
                        style={[
                            styles.emptyIconInner,
                            { backgroundColor: theme.colors.card },
                        ]}
                    >
                        <Ionicons
                            name={isFollowers ? "people-outline" : "person-outline"}
                            size={34}
                            color={theme.colors.primary}
                        />
                    </View>
                </View>
                <Text style={styles.emptyTitle}>
                    {isFollowers ? "No followers yet" : "Not following anyone"}
                </Text>
                <Text style={styles.emptySubtitle}>
                    {isFollowers
                        ? "When people follow this account, they’ll show up here."
                        : "Accounts this user follows will appear in this list."}
                </Text>
            </View>
        </View>
    );
}

const FollowersFollowingScreen = () => {
    const { theme } = useTheme();
    const navigation = useNavigation();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const params = useLocalSearchParams<{
        type?: string | string[];
        username?: string | string[];
    }>();
    const usernameRaw = normalizeParam(params.username);
    const typeRaw = normalizeParam(params.type);
    const username = usernameRaw?.replace(/^@/, "").trim() ?? "";
    const initialTab: TFilter =
        typeRaw === "following" ? "following" : "followers";

    const toggleFollowMutation = useFollowToggleMutation();

    const opacity = useSharedValue(1);
    const [activeTab, setActiveTab] = useState<TFilter>(initialTab);

    const headerHandle = username ? `@${username}` : "Connections";

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: headerHandle,
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.textPrimary,
            headerTitleStyle: { color: theme.colors.textPrimary },
            headerShadowVisible: false,
        });
    }, [
        navigation,
        headerHandle,
        theme.colors.background,
        theme.colors.textPrimary,
    ]);



    const followersQuery = useGetFollowersQuery(
        username,
        activeTab === "followers",
    );

    const followingQuery = useGetFollowingQuery(
        username,
        activeTab === "following",
    );

    const followersList =
        followersQuery.data?.pages?.flatMap(
            (page) => page?.data?.followers ?? []
        ) ?? [];

    const followingList =
        followingQuery.data?.pages?.flatMap(
            (page) => page?.data?.following ?? []
        ) ?? [];

    const listData =
        activeTab === "followers"
            ? followersList
            : followingList;


    const handleLoadMore = () => {
        if (activeTab === "followers") {
            if (
                followersQuery.hasNextPage &&
                !followersQuery.isFetchingNextPage
            ) {
                followersQuery.fetchNextPage();
            }
        } else {
            if (
                followingQuery.hasNextPage &&
                !followingQuery.isFetchingNextPage
            ) {
                followingQuery.fetchNextPage();
            }
        }
    };

    const isLoading =
        activeTab === "followers"
            ? followersQuery.isLoading
            : followingQuery.isLoading;

    const isFetchingNextPage =
        activeTab === "followers"
            ? followersQuery.isFetchingNextPage
            : followingQuery.isFetchingNextPage;

    const renderEmpty = useCallback(
        () => (
            <ConnectionsEmptyList
                variant={activeTab}
                styles={styles}
                theme={theme}
            />
        ),
        [activeTab, styles, theme],
    );

    const listContentStyle = useMemo(
        () => [
            styles.listContent,
            listData.length === 0 && !isLoading && styles.listContentEmpty,
        ],
        [isLoading, listData.length, styles.listContent, styles.listContentEmpty],
    );

    // useEffect(() => {
    //     const index = tabs.findIndex((t) => t.key === activeTab);
    //     translateX.value = withTiming((width - 32) / tabs.length * index, {
    //         duration: 200,
    //     });

    //     opacity.value = 0;
    //     opacity.value = withTiming(1, { duration: 200 });
    // }, [activeTab]);

    // const indicatorStyle = useAnimatedStyle(() => ({
    //     transform: [{ translateX: translateX.value }],
    // }));

    const contentStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const toggleFollow = (username: string) => {
        toggleFollowMutation.mutate(username)
    }

    const dispatchAlert = (username: string, type: "follow" | "unfollow", name: string) => {
        Alert.alert(
            type === "follow" ? "Follow" : "Unfollow",
            type === "follow" ? `Are you sure you want to follow ${name}?` : `Are you sure you want to unfollow ${name}?`,
            [
                {
                    text: "Cancel",
                    onPress: () => console.log("Cancel Pressed"),
                    style: "cancel",
                },
                {
                    text: type === "follow" ? "Follow" : "Unfollow",
                    style: "destructive",
                    onPress: () => toggleFollow(username),
                },
            ]
        );
    }

    const renderItem = ({ item }: { item: FollowUser }) => (
        <View style={styles.row}>
            <Image
                source={{ uri: item.avatar }}
                style={styles.avatar}
            />

            <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.verified_user && (
                        <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={theme.colors.primary}
                        />
                    )}
                </View>
                <Text style={styles.username}>@{item.username}</Text>
            </View>

            <Pressable
                onPress={() => dispatchAlert(item.username, item.follow_status === "follow" ? "follow" : "unfollow", item.name)}
                style={[
                    styles.followButton,
                    item.follow_status === "following" &&
                    styles.followingButton,
                ]}
            >
                <Text
                    style={[
                        styles.followText,
                        item.follow_status === "following" &&
                        styles.followingText,
                    ]}
                >
                    {capitalize(item.follow_status)}
                </Text>
            </Pressable>
        </View>
    );

    if (!username) {
        return (
            <View style={[styles.missingRoot, { backgroundColor: theme.colors.background }]}>
                <Text style={styles.missingText}>Missing profile.</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <View style={styles.container}>
                <AnimatedTabBar
                    tabs={FILTER_CONFIG}
                    activeKey={activeTab}
                    onTabChange={setActiveTab}
                />

                <Animated.View style={[styles.listWrapper, contentStyle]}>
                    {isLoading && listData.length === 0 ? (
                        <View style={styles.centered}>
                            <ActivityIndicator
                                color={theme.colors.textSecondary}
                                size="large"
                            />
                        </View>
                    ) : (
                        <FlatList
                            data={listData}
                            keyExtractor={(item) =>
                                item?.id != null
                                    ? String(item.id)
                                    : item.username
                            }
                            renderItem={renderItem}
                            ListEmptyComponent={renderEmpty}
                            ListFooterComponent={
                                isFetchingNextPage ? (
                                    <View style={styles.footerLoader}>
                                        <ActivityIndicator
                                            color={theme.colors.textSecondary}
                                        />
                                    </View>
                                ) : null
                            }
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.5}
                            contentContainerStyle={listContentStyle}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </Animated.View>
            </View>
        </View>
    );
};

export default FollowersFollowingScreen;

const createStyles = (theme: AppTheme) =>
    StyleSheet.create({
        missingRoot: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: theme.spacing.lg,
        },
        missingText: {
            color: theme.colors.textSecondary,
            fontSize: 16,
        },
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
            paddingTop: theme.spacing.sm,
        },

        tabContainer: {
            flexDirection: "row",
            // backgroundColor: "red",
            // borderRadius: theme.radius.md,
            marginBottom: theme.spacing.lg,
            // overflow: "hidden",
            // position: "relative",
        },

        indicator: {
            position: "absolute",
            height: "100%",
            // width: `${100 / tabs.length}%`,
            width: "50%",
            backgroundColor: theme.colors.primary + "15",
            borderBottomWidth: 2,
            borderColor: theme.colors.primary,
        },

        tab: {
            flex: 1,
            paddingVertical: theme.spacing.md,
            alignItems: "center",
            zIndex: 1,
            borderWidth: 2
        },

        tabText: {
            color: theme.colors.textSecondary,
            fontWeight: "500",
        },

        activeTabText: {
            color: theme.colors.primary,
        },

        listWrapper: {
            flex: 1,
        },

        listContent: {
            flexGrow: 1,
            paddingBottom: theme.spacing.md,
        },

        listContentEmpty: {
            flexGrow: 1,
        },

        centered: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: theme.spacing.lg,
        },

        footerLoader: {
            paddingVertical: theme.spacing.md,
        },

        emptyOuter: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.xl,
            minHeight: 320,
        },

        emptyCard: {
            width: "100%",
            maxWidth: 340,
            alignItems: "center",
            paddingVertical: theme.spacing.xl + 8,
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
        },

        emptyIconRing: {
            padding: 3,
            borderRadius: 48,
            borderWidth: 2,
            marginBottom: theme.spacing.lg,
        },

        emptyIconInner: {
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: "center",
            justifyContent: "center",
        },

        emptyTitle: {
            fontSize: 20,
            fontWeight: "700",
            letterSpacing: -0.3,
            color: theme.colors.textPrimary,
            textAlign: "center",
        },

        emptySubtitle: {
            marginTop: theme.spacing.sm,
            fontSize: 15,
            lineHeight: 22,
            color: theme.colors.textSecondary,
            textAlign: "center",
        },

        row: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: theme.spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
            paddingHorizontal: theme.spacing.lg,
        },

        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            marginRight: theme.spacing.md,
        },

        userInfo: {
            flex: 1,
        },

        nameRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },

        name: {
            fontWeight: "600",
            color: theme.colors.textPrimary,
        },

        username: {
            color: theme.colors.textSecondary,
            fontSize: 13,
        },

        followButton: {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
        },

        followingButton: {
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: theme.colors.border,
        },

        followText: {
            color: "#fff",
            fontWeight: "600",
        },

        followingText: {
            color: theme.colors.textPrimary,
        },
    });