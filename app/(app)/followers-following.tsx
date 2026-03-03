import { AnimatedTabBar } from "@/src/components/ui/animated-tabbar";
import { useGetFollowersQuery, useGetFollowingQuery, useGetProfile } from "@/src/features/profile/profile.hooks";
import { FollowUser } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    // Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

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


const FollowersFollowingScreen = () => {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const { data: profile } = useGetProfile();
    const { type } = useLocalSearchParams<{
        type: "followers" | "following";
        username: string;
    }>();

    // const translateX = useSharedValue(0);
    const opacity = useSharedValue(1);
    const [activeTab, setActiveTab] = useState<"followers" | "following">(
        type ?? "followers"
    );



    const followersQuery = useGetFollowersQuery(
        profile?.data.username!,
        activeTab === "followers"
    );

    const followingQuery = useGetFollowingQuery(
        profile?.data.username!,
        activeTab === "following"
    );

    const followersList =
        followersQuery.data?.pages?.flatMap(
            (page) => page?.data?.followers ?? []
        ) ?? [];

    const followingList =
        followingQuery.data?.pages?.flatMap(
            (page) => page?.data?.following ?? []
        ) ?? [];

    console.log({ followersList, followingList })

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

            <TouchableOpacity
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
                    {item.follow_status.toLocaleUpperCase()}
                </Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <View style={styles.container}>

                <AnimatedTabBar tabs={FILTER_CONFIG} activeKey={activeTab} onTabChange={setActiveTab} />

                {/* Content */}
                <Animated.View style={[styles.listWrapper, contentStyle]}>
                    {isLoading ? (
                        <ActivityIndicator />
                    ) : (
                        <FlatList
                            data={listData}
                            keyExtractor={(item) => item?.id?.toString()}
                            renderItem={renderItem}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.5}
                            showsVerticalScrollIndicator={false}
                        />)}
                </Animated.View>
            </View></SafeAreaView>
    );
};

export default FollowersFollowingScreen;

const createStyles = (theme: AppTheme) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
            // paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
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