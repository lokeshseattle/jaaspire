// screens/PendingRequestsScreen.tsx

import {
    useGetPendingRequests,
} from "@/src/features/profile/notification.hooks";
import { useAcceptRejectRequestMutation } from "@/src/features/profile/profile.hooks";
import { apiClient } from "@/src/services/api/api.client";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { FlatList, RefreshControl } from "react-native-gesture-handler";
import Animated, {
    FadeIn,
    FadeOut,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

// Type for a pending request
interface PendingRequest {
    id: number;
    name: string;
    username: string;
    avatar: string;
    verified_user: boolean;
    story_status: {
        has_stories: boolean;
        all_viewed: boolean;
        story_count: number;
    };
    requested_at: string;
}

interface SuggestedMember {
    id: number;
    name: string;
    username: string;
    bio: string | null;
    location: string | null;
    avatar: string;
    cover: string;
    verified_user: boolean;
    paid_profile: boolean;
    profile_access_price: number;
    story_status: {
        has_stories: boolean;
        all_viewed: boolean;
        story_count: number;
    };
    follow_status: string;
}

interface SuggestedMembersResponse {
    success: boolean;
    message: string;
    data: {
        members: SuggestedMember[];
        total: number;
    };
}

// Animated Pressable for button press feedback
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RequestItemProps {
    item: PendingRequest;
    onAccept: (id: number) => void;
    onReject: (id: number) => void;
    isAccepting: boolean;
    isRejecting: boolean;
}

function RequestItem({
    item,
    onAccept,
    onReject,
    isAccepting,
    isRejecting,
}: RequestItemProps) {
    const acceptScale = useSharedValue(1);
    const rejectScale = useSharedValue(1);

    const acceptAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(acceptScale.value) }],
    }));

    const rejectAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(rejectScale.value) }],
    }));

    const isProcessing = isAccepting || isRejecting;

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            layout={Layout.springify()}
            style={styles.requestItem}
        >
            {/* Avatar */}
            <Pressable
                onPress={() => router.push(`/user/${item.username}`)}
                style={styles.avatarContainer}
            >
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                {item.story_status?.has_stories && (
                    <View
                        style={[
                            styles.storyRing,
                            item.story_status.all_viewed && styles.storyRingViewed,
                        ]}
                    />
                )}
            </Pressable>

            {/* User Info */}
            <Pressable
                onPress={() => router.push(`/user/${item.username}`)}
                style={styles.userInfo}
            >
                <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.verified_user && (
                        <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" />
                    )}
                </View>
                <Text style={styles.username} numberOfLines={1}>
                    @{item.username}
                </Text>
            </Pressable>

            {/* Action Buttons */}
            <View style={styles.buttonsContainer}>
                <AnimatedPressable
                    style={[styles.acceptButton, acceptAnimatedStyle]}
                    onPress={() => onAccept(item.id)}
                    onPressIn={() => (acceptScale.value = 0.95)}
                    onPressOut={() => (acceptScale.value = 1)}
                    disabled={isProcessing}
                >
                    {isAccepting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.acceptButtonText}>Accept</Text>
                    )}
                </AnimatedPressable>

                <AnimatedPressable
                    style={[styles.rejectButton, rejectAnimatedStyle]}
                    onPress={() => onReject(item.id)}
                    onPressIn={() => (rejectScale.value = 0.95)}
                    onPressOut={() => (rejectScale.value = 1)}
                    disabled={isProcessing}
                >
                    {isRejecting ? (
                        <ActivityIndicator size="small" color="#333" />
                    ) : (
                        <Text style={styles.rejectButtonText}>Reject</Text>
                    )}
                </AnimatedPressable>
            </View>
        </Animated.View>
    );
}

export default function PendingRequestsScreen() {
    const {
        data,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        refetch,
        isRefetching,
    } = useGetPendingRequests();
    const {
        data: suggestionsData,
        isLoading: isSuggestionsLoading,
        refetch: refetchSuggestedMembers,
    } = useQuery<SuggestedMembersResponse>({
        queryKey: ["suggested_members", "pending_requests"],
        queryFn: async () => {
            const response = await apiClient.get<SuggestedMembersResponse>("/suggestions/members");
            return response.data;
        },
    });

    // Track which requests are being processed
    const [processingIds, setProcessingIds] = useState<{
        accepting: Set<number>;
        rejecting: Set<number>;
    }>({
        accepting: new Set(),
        rejecting: new Set(),
    });
    const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<Set<number>>(
        new Set(),
    );

    // TODO: Replace with your actual mutation hooks
    // const acceptMutation = useAcceptFollowRequestMutation();
    // const rejectMutation = useRejectFollowRequestMutation();
    const { mutate } = useAcceptRejectRequestMutation();


    // Flatten paginated data
    // const hasInteracted = useRef(false);

    const allRequests = useMemo(() => {
        return data?.pages.flatMap((page) => page.data.requests) ?? [];
    }, [data]);
    const requests = useMemo(() => {
        return allRequests.filter((request) => !optimisticallyRemovedIds.has(request.id));
    }, [allRequests, optimisticallyRemovedIds]);

    // 👇 Navigate back when requests become empty AFTER user interaction
    // useEffect(() => {
    //     if (hasInteracted.current && !isLoading && requests.length === 0) {
    //         router.back();
    //     }
    // }, [requests.length, isLoading]);

    const totalCount = data?.pages?.[0]?.data?.pagination?.total ?? 0;
    const displayPendingCount = Math.max(totalCount - optimisticallyRemovedIds.size, 0);
    const suggestedMembers = suggestionsData?.data?.members ?? [];

    const handleAccept = useCallback((id: number) => {
        setProcessingIds((prev) => ({
            ...prev,
            accepting: new Set(prev.accepting).add(id),
        }));
        setOptimisticallyRemovedIds((prev) => new Set(prev).add(id));

        mutate({ userId: id, action: "accept" }, {
            onSuccess: () => {
                // Remove from list or refetch
            },
            onError: () => {
                setOptimisticallyRemovedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            },

            onSettled: () => {
                setProcessingIds((prev) => {
                    const newAccepting = new Set(prev.accepting);
                    newAccepting.delete(id);
                    return { ...prev, accepting: newAccepting };
                });
            },
        });
    }, [mutate]);

    const handleReject = useCallback((id: number) => {
        setProcessingIds((prev) => ({
            ...prev,
            rejecting: new Set(prev.rejecting).add(id),
        }));
        setOptimisticallyRemovedIds((prev) => new Set(prev).add(id));

        mutate({ userId: id, action: "reject" }, {
            onSuccess: () => {
                // Remove from list or refetch
            },
            onError: () => {
                setOptimisticallyRemovedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            },

            onSettled: () => {
                setProcessingIds((prev) => {
                    const newRejecting = new Set(prev.rejecting);
                    newRejecting.delete(id);
                    return { ...prev, rejecting: newRejecting };
                });
            },
        });
    }, [mutate]);

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleRefresh = useCallback(() => {
        refetch();
        refetchSuggestedMembers();
    }, [refetch, refetchSuggestedMembers]);

    const renderItem = useCallback(
        ({ item }: { item: PendingRequest }) => (
            <RequestItem
                item={item}
                onAccept={handleAccept}
                onReject={handleReject}
                isAccepting={processingIds.accepting.has(item.id)}
                isRejecting={processingIds.rejecting.has(item.id)}
            />
        ),
        [handleAccept, handleReject, processingIds]
    );

    const renderFooter = () => {
        const showSuggestionsSection = isSuggestionsLoading || suggestedMembers.length > 0;
        if (!isFetchingNextPage && !showSuggestionsSection) return null;

        return (
            <View>
                {showSuggestionsSection && (
                    <View style={styles.suggestionsSection}>
                        <Text style={styles.suggestionsTitle}>Suggested members</Text>
                        {isSuggestionsLoading ? (
                            <View style={styles.suggestionsLoader}>
                                <ActivityIndicator />
                            </View>
                        ) : (
                            suggestedMembers.map((member) => (
                                <Pressable
                                    key={member.id}
                                    onPress={() => router.push(`/user/${member.username}`)}
                                    style={styles.suggestionItem}
                                >
                                    <View style={styles.avatarContainer}>
                                        <Image source={{ uri: member.avatar }} style={styles.avatar} />
                                        {member.story_status?.has_stories && (
                                            <View
                                                style={[
                                                    styles.storyRing,
                                                    member.story_status.all_viewed && styles.storyRingViewed,
                                                ]}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.suggestionInfo}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {member.name}
                                            </Text>
                                            {member.verified_user && (
                                                <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" />
                                            )}
                                        </View>
                                        <Text style={styles.username} numberOfLines={1}>
                                            @{member.username}
                                        </Text>
                                        {!!member.bio && (
                                            <Text style={styles.suggestionBio} numberOfLines={2}>
                                                {member.bio}
                                            </Text>
                                        )}
                                    </View>
                                </Pressable>
                            ))
                        )}
                    </View>
                )}

                {isFetchingNextPage && (
                    <View style={styles.footerLoader}>
                        <ActivityIndicator />
                    </View>
                )}
            </View>
        );
    };

    const renderHeader = () => {
        if (requests.length === 0) return null;
        return (
            <View style={styles.header}>
                <Text style={styles.headerText}>
                    {displayPendingCount} pending {displayPendingCount === 1 ? "request" : "requests"}
                </Text>
            </View>
        );
    };

    const renderEmpty = () => {
        if (isLoading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="person-add-outline" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>No Pending Requests</Text>
                <Text style={styles.emptySubtitle}>
                    When someone requests to follow you, you'll see it here.
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: "Follow Requests",
                    headerBackTitle: "Back",
                }}
            />

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={renderEmpty}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    refreshing={isRefetching}
                    onRefresh={handleRefresh}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={handleRefresh}
                            colors={["#007AFF"]}
                            tintColor="#007AFF"
                        />
                    }
                    contentContainerStyle={
                        requests.length === 0 ? styles.emptyListContent : undefined
                    }
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },

    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#f8f9fa",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },

    headerText: {
        fontSize: 13,
        color: "#666",
        fontWeight: "500",
    },

    requestItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
    },

    avatarContainer: {
        position: "relative",
    },

    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#f0f0f0",
    },

    storyRing: {
        position: "absolute",
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: "#E1306C",
    },

    storyRingViewed: {
        borderColor: "#ccc",
    },

    userInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },

    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },

    name: {
        fontSize: 15,
        fontWeight: "600",
        color: "#000",
        flexShrink: 1,
    },

    username: {
        fontSize: 14,
        color: "#666",
        marginTop: 2,
    },

    buttonsContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    acceptButton: {
        backgroundColor: "#007AFF",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 70,
        alignItems: "center",
        justifyContent: "center",
    },

    acceptButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },

    rejectButton: {
        backgroundColor: "#E8E8E8",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 70,
        alignItems: "center",
        justifyContent: "center",
    },

    rejectButtonText: {
        color: "#333",
        fontSize: 14,
        fontWeight: "600",
    },

    separator: {
        height: 1,
        backgroundColor: "#f1f1f1",
        marginLeft: 84, // avatar width + padding
    },

    footerLoader: {
        paddingVertical: 20,
        alignItems: "center",
    },

    suggestionsSection: {
        marginTop: 8,
        paddingTop: 16,
        borderTopWidth: 8,
        borderTopColor: "#f5f5f5",
    },

    suggestionsTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111",
        paddingHorizontal: 16,
        marginBottom: 8,
    },

    suggestionsLoader: {
        paddingVertical: 16,
        alignItems: "center",
    },

    suggestionItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: "#f1f1f1",
    },

    suggestionInfo: {
        flex: 1,
    },

    suggestionBio: {
        fontSize: 13,
        color: "#666",
        marginTop: 4,
        lineHeight: 18,
    },

    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },

    emptyListContent: {
        flexGrow: 1,
    },

    emptyTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
        marginTop: 16,
    },

    emptySubtitle: {
        fontSize: 14,
        color: "#999",
        textAlign: "center",
        marginTop: 8,
        lineHeight: 20,
    },
});