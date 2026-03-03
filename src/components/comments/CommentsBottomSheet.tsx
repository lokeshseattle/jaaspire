import {
    useAddComment,
    useDeleteComment,
    useGetPostComments,
    useLikeComment,
} from "@/src/features/post/comments.hooks";
import { queryClient } from "@/src/lib/query-client";
import type { ProfileResponse, TComment } from "@/src/services/api/api.types";
import { timeAgo } from "@/src/utils/helpers";
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
    Alert,
    Dimensions,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============ Reply Item ============
const ReplyItem = ({
    item,
    onReply,
    parentCommentId,
    onDelete,
    isDeleting,
    currentUserId,
    onLike,
}: {
    item: TComment["replies"][0];
    onReply: (commentId: number, username: string) => void;
    parentCommentId: number;
    onDelete: (commentId: number) => void;
    isDeleting: boolean;
    currentUserId: number | null;
    onLike: (commentId: number) => void;
}) => {
    const isOwner = item.user.id === currentUserId;

    return (
        <View style={[
            styles.replyItem,
            item._isOptimistic && styles.optimisticItem,
            isDeleting && styles.deletingItem,
        ]}>
            <Image source={{ uri: item.user.avatar }} style={styles.replyAvatar} />
            <View style={styles.replyContent}>
                <View style={styles.commentHeader}>
                    <Text style={styles.username}>@{item.user.username}</Text>
                    <Text style={styles.time}>
                        {item._isOptimistic ? "Posting..." : timeAgo(item.created_at)}
                    </Text>
                </View>
                <Text style={styles.message}>{item.message}</Text>

                {/* Actions row with like and reply */}
                {!item._isOptimistic && (
                    <View style={styles.actionsRow}>
                        <Pressable style={styles.actionButton} onPress={() => onLike(item.id)}>
                            <Ionicons
                                name={item.is_liked ? "heart" : "heart-outline"}
                                size={14}
                                color={item.is_liked ? "#FF3B30" : "#8E8E8E"}
                            />
                            {item.reactions > 0 && (
                                <Text style={styles.actionCount}>{item.reactions}</Text>
                            )}
                        </Pressable>
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => onReply(parentCommentId, item.user.username)}
                        >
                            <Text style={styles.replyButtonText}>Reply</Text>
                        </Pressable>
                        {isOwner && (
                            <Pressable
                                style={styles.actionButton}
                                onPress={() => onDelete(item.id)}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color="#8E8E8E" />
                                ) : (
                                    <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                                )}
                            </Pressable>
                        )}
                    </View>
                )}
            </View>
        </View>
    )
};

// ============ Comment Item ============
const CommentItem = ({
    item,
    onReply,
    onDelete,
    deletingId,
    currentUserId,
    onLike,
}: {
    item: TComment;
    onReply: (commentId: number, username: string) => void;
    onDelete: (commentId: number) => void;
    deletingId: number | null;
    currentUserId: number | null;
    onLike: (commentId: number) => void;

}) => {
    const [showReplies, setShowReplies] = useState(false);
    const hasReplies = item.replies && item.replies.length > 0;

    const isOwner = item.user.id === currentUserId;
    const isDeleting = deletingId === item.id;

    return (
        <View style={[
            item._isOptimistic && styles.optimisticItem,
            isDeleting && styles.deletingItem,
        ]}>
            <View style={styles.commentItem}>
                <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                        <Text style={styles.username}>@{item.user.username}</Text>
                        <Text style={styles.time}>
                            {item._isOptimistic ? "Posting..." : timeAgo(item.created_at)}
                        </Text>
                    </View>
                    <Text style={styles.message}>{item.message}</Text>

                    {!item._isOptimistic && (
                        <View style={styles.actionsRow}>
                            <Pressable style={styles.actionButton} onPress={() => onLike(item.id)}>
                                <Ionicons
                                    name={item.is_liked ? "heart" : "heart-outline"}
                                    size={16}
                                    color={item.is_liked ? "#FF3B30" : "#8E8E8E"}
                                />
                                {item.reactions > 0 && (
                                    <Text style={styles.actionCount}>{item.reactions}</Text>
                                )}
                            </Pressable>
                            <Pressable
                                style={styles.actionButton}
                                onPress={() => onReply(item.id, item.user.username)}
                            >
                                <Text style={styles.replyButtonText}>Reply</Text>
                            </Pressable>
                            {isOwner && (
                                <Pressable
                                    style={styles.actionButton}
                                    onPress={() => onDelete(item.id)}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <ActivityIndicator size="small" color="#8E8E8E" />
                                    ) : (
                                        <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                                    )}
                                </Pressable>
                            )}
                        </View>
                    )}

                    {hasReplies && !item._isOptimistic && (
                        <Pressable
                            onPress={() => setShowReplies(!showReplies)}
                            style={styles.repliesToggle}
                        >
                            <View style={styles.repliesLine} />
                            <Text style={styles.repliesToggleText}>
                                {showReplies
                                    ? "Hide replies"
                                    : `View ${item.reply_count} ${item.reply_count > 1 ? "replies" : "reply"}`}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {showReplies && hasReplies && (
                <View style={styles.repliesContainer}>
                    {item.replies.map((reply) => (
                        <ReplyItem
                            key={reply.id}
                            item={reply}
                            onReply={onReply}
                            parentCommentId={item.id}
                            onDelete={onDelete}
                            isDeleting={isDeleting}
                            currentUserId={currentUserId}
                            onLike={onLike}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};


// ============ Footer Input Component ============
interface FooterInputProps {
    postId: number | null;
    bottomInset: number;
    replyTo: { commentId: number; username: string } | null;  // 👈 Changed id to commentId
    onCancelReply: () => void;
}

const FooterInput = ({ postId, bottomInset, replyTo, onCancelReply }: FooterInputProps) => {
    const addComment = useAddComment();
    const [message, setMessage] = useState("");

    React.useEffect(() => {
        if (replyTo) {
            setMessage(`@${replyTo.username} `);
        }
    }, [replyTo]);

    const handleSend = () => {
        if (!message.trim() || !postId) return;
        addComment.mutate(
            { postId, message, reply_id: replyTo?.commentId ?? null },
            {
                onSuccess: () => {
                    setMessage("");
                    onCancelReply();
                    // Keyboard.dismiss();
                },
            }
        );
    };

    const handleCancel = () => {
        setMessage("");
        onCancelReply();
    };

    return (
        <View style={[styles.footerWrapper, { paddingBottom: bottomInset || 12 }]}>
            {replyTo && (
                <View style={styles.replyIndicator}>
                    <Text style={styles.replyIndicatorText}>
                        Replying to <Text style={styles.replyUsername}>@{replyTo.username}</Text>
                    </Text>
                    <Pressable onPress={handleCancel} hitSlop={8}>
                        <Ionicons name="close" size={18} color="#8E8E8E" />
                    </Pressable>
                </View>
            )}

            <View style={styles.inputContainer}>
                <BottomSheetTextInput
                    style={styles.input}
                    placeholder={replyTo ? `Reply to @${replyTo.username}...` : "Add a comment..."}
                    placeholderTextColor="#8E8E8E"
                    value={message}
                    onChangeText={setMessage}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                    maxLength={500}
                    autoFocus={!!replyTo}
                />
                <Pressable
                    onPress={handleSend}
                    disabled={!message.trim() || addComment.isPending}
                    style={[
                        styles.sendButton,
                        (!message.trim() || addComment.isPending) && styles.sendButtonDisabled,
                    ]}
                >
                    <Text style={styles.sendButtonText}>
                        {addComment.isPending ? "..." : "Post"}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
};

// ============ Comments List Content ============
interface CommentsListProps {
    postId: number | null;
    onReply: (commentId: number, username: string) => void;
    onDelete: (commentId: number) => void;
    deletingId: number | null;
    currentUserId: number | null;
    onLike: (commentId: number) => void;  // 👈 Add

}

const CommentsList = ({
    postId,
    onReply,
    onDelete,
    deletingId,
    currentUserId, onLike
}: CommentsListProps) => {
    const { height } = Dimensions.get("window");

    const {
        comments,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading, isError, refetch, error
    } = useGetPostComments(postId ?? 0);

    const insets = useSafeAreaInsets();
    const FOOTER_HEIGHT = 80 + insets.bottom;

    const renderItem = useCallback(
        ({ item }: { item: TComment }) => (
            <CommentItem onLike={onLike} onReply={onReply} item={item} onDelete={onDelete} deletingId={deletingId} currentUserId={currentUserId} />
        ),
        [onReply, onDelete, deletingId, currentUserId, onLike]
    );

    const ListHeader = () => (
        <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Comments</Text>
        </View>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ListHeader />
                <ActivityIndicator style={{ marginTop: 20 }} />
            </View>
        );
    }

    return (
        <BottomSheetFlatList
            data={comments}
            keyExtractor={(item: TComment) => item.id.toString()}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ paddingBottom: height * 0.28 }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={() => {
                if (isError) {
                    return (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.errorText}>
                                {error?.message || "Failed to load comments"}
                            </Text>
                            <Pressable style={styles.retryButton} onPress={() => refetch()}>
                                <Text style={styles.retryText}>Retry</Text>
                            </Pressable>
                        </View>
                    );
                }
                return <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No comments yet</Text>
                </View>
            }}
            onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
                <>
                    {isFetchingNextPage && (
                        <ActivityIndicator style={{ marginVertical: 16 }} />
                    )}
                    <View style={{ height: FOOTER_HEIGHT }} />
                </>
            }
            keyboardShouldPersistTaps="handled"
        />
    );
};

// ============ Main Component ============
interface CommentsBottomSheetProps {
    bottomSheetRef: React.RefObject<BottomSheetModal | null>;
    postId: number | null;
    onDismiss: () => void;
}

export const CommentsBottomSheet = ({
    bottomSheetRef,
    postId,
    onDismiss,
}: CommentsBottomSheetProps) => {
    const snapPoints = useMemo(() => ["60%", "90%"], []);
    const insets = useSafeAreaInsets();

    const likeComment = useLikeComment();

    const handleLike = useCallback((commentId: number) => {
        if (!postId) return;
        likeComment.mutate({ postId, commentId });
    }, [postId, likeComment]);

    const [replyTo, setReplyTo] = useState<{ commentId: number; username: string } | null>(null);

    const handleReply = useCallback((commentId: number, username: string) => {
        setReplyTo({ commentId, username });
    }, []);

    const handleCancelReply = useCallback(() => setReplyTo(null), []);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const deleteComment = useDeleteComment();

    // Get current user
    const profileData = queryClient.getQueryData<ProfileResponse>(["profile"]);
    const currentUserId = profileData?.data?.id ?? null;

    // Add delete handler
    const handleDelete = useCallback((commentId: number) => {
        if (!postId) return;

        Alert.alert(
            "Delete Comment",
            "Are you sure you want to delete this comment?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        setDeletingId(commentId);
                        deleteComment.mutate(
                            { postId, commentId },
                            { onSettled: () => setDeletingId(null) }
                        );
                    },
                },
            ]
        );
    }, [postId, deleteComment]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.2}
                pressBehavior="close"
            />
        ),
        []
    );


    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props}>
                <FooterInput
                    replyTo={replyTo}
                    onCancelReply={handleCancelReply}
                    // inputRef={inputRef}
                    postId={postId}
                    bottomInset={insets.bottom}
                />
            </BottomSheetFooter>
        ),
        [postId, insets.bottom, replyTo, handleCancelReply]  // Add replyTo, handleCancelReply
    );

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            snapPoints={snapPoints}
            index={0}
            enableDynamicSizing={false}
            backdropComponent={renderBackdrop}
            footerComponent={renderFooter}
            enablePanDownToClose
            enableContentPanningGesture={false}
            enableOverDrag={false}
            onDismiss={onDismiss}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            keyboardBehavior={"extend"}
            keyboardBlurBehavior="none"
        >
            <CommentsList
                onDelete={handleDelete}
                deletingId={deletingId}
                currentUserId={currentUserId}
                postId={postId}
                onReply={handleReply}
                onLike={handleLike}
            />
        </BottomSheetModal>
    );
};

// ============ Styles ============
const styles = StyleSheet.create({
    // Sheet
    sheetBackground: {
        backgroundColor: "white",
    },
    handleIndicator: {
        backgroundColor: "#DEDEDE",
        width: 40,
    },

    // List
    listContent: {
        paddingBottom: SCREEN_HEIGHT * 0.1, // 50% of screen height
    },
    centered: {
        flex: 1,
        alignItems: "center",
    },
    deletingItem: {
        opacity: 0.5,
    },
    errorText: {
        color: "#777",
        fontSize: 14,
        marginBottom: 12,
        textAlign: "center",
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryText: {
        color: "#3b82f6",
        // color: "#fff",
        fontWeight: "600",
    },
    // Header
    commentsHeader: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5E5",
        alignItems: "center",
    },
    commentsTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#262626",
    },

    // Comment Item
    commentItem: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 12,
    }, optimisticItem: {
        opacity: 0.6,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    commentContent: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
    },
    username: {
        fontSize: 14,
        fontWeight: "600",
        color: "#262626",
    },
    time: {
        fontSize: 12,
        color: "#8E8E8E",
    },
    message: {
        fontSize: 14,
        color: "#262626",
        lineHeight: 20,
    },

    // Replies
    repliesContainer: {
        marginLeft: 52,
        paddingLeft: 16,
    },
    replyItem: {
        flexDirection: "row",
        paddingVertical: 8,
        // backgroundColor: "red",
        marginRight: 8
    },
    replyAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    replyContent: {
        flex: 1,
    },
    repliesToggle: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    repliesLine: {
        width: 24,
        height: 1,
        backgroundColor: "#C7C7C7",
        marginRight: 8,
    },
    repliesToggleText: {
        fontSize: 13,
        color: "#8E8E8E",
        fontWeight: "500",
    },
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
        gap: 16,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    actionCount: {
        fontSize: 12,
        color: "#8E8E8E",
    },
    replyButtonText: {
        fontSize: 12,
        color: "#8E8E8E",
        fontWeight: "500",
    },
    // States
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#E5E5E5",
        marginLeft: 68,
    },
    emptyContainer: {
        padding: 32,
        alignItems: "center",
    },
    emptyText: {
        color: "#8E8E8E",
        fontSize: 14,
    },
    footerWrapper: {
        backgroundColor: "white",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#E5E5E5",
    },
    replyIndicator: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#F5F5F5",
    },
    replyIndicatorText: {
        fontSize: 13,
        color: "#8E8E8E",
    },
    replyUsername: {
        fontWeight: "600",
        color: "#262626",
    },
    // Footer Input
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingTop: 12,
        // borderTopWidth: StyleSheet.hairlineWidth,
        // borderTopColor: "#E5E5E5",
        backgroundColor: "white",
        gap: 12,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#F5F5F5",
        borderRadius: 20,
        fontSize: 14,
        color: "#262626",
    },
    sendButton: {
        paddingHorizontal: 4,
        paddingVertical: 10,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    sendButtonText: {
        color: "#3897F0",
        fontSize: 14,
        fontWeight: "600",
    },
});