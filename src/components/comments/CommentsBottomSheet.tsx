import {
    useAddComment,
    useDeleteComment,
    useGetPostComments,
    useLikeComment,
} from "@/src/features/post/comments.hooks";
import { queryClient } from "@/src/lib/query-client";
import type { MentionUser, ProfileResponse, TComment } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { debounce, getMentionQuery, timeAgo } from "@/src/utils/helpers";
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
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
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
import MentionSuggestionsList from "./MentionSuggestionList";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const LIKED_COLOR = "#FF3B30";
const SEND_COLOR = "#3897F0";

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
    const { theme } = useTheme();
    const styles = createStyles(theme);
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

                {!item._isOptimistic && (
                    <View style={styles.actionsRow}>
                        <Pressable style={styles.actionButton} onPress={() => onLike(item.id)}>
                            <Ionicons
                                name={item.is_liked ? "heart" : "heart-outline"}
                                size={14}
                                color={item.is_liked ? LIKED_COLOR : theme.colors.textSecondary}
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
                                    <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                                ) : (
                                    <Ionicons name="trash-outline" size={14} color={LIKED_COLOR} />
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
    const { theme } = useTheme();
    const styles = createStyles(theme);

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
                                    color={item.is_liked ? LIKED_COLOR : theme.colors.textSecondary}
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
                                        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                                    ) : (
                                        <Ionicons name="trash-outline" size={16} color={LIKED_COLOR} />
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
    replyTo: { commentId: number; username: string } | null;
    onCancelReply: () => void;
    onMessageChange: (text: string) => void;
    onCursorChange: (position: number) => void;
}

interface FooterInputRef {
    updateMessage: (msg: string, cursor: number) => void;
}

const FooterInput = forwardRef<FooterInputRef, FooterInputProps>(
    (
        {
            postId,
            bottomInset,
            replyTo,
            onCancelReply,
            onMessageChange,
            onCursorChange,
        },
        ref
    ) => {
        const { theme } = useTheme();
        const styles = createStyles(theme);

        const addComment = useAddComment();

        const [message, setMessage] = useState("");
        const inputRef = useRef<any>(null);

        useImperativeHandle(ref, () => ({
            updateMessage: (msg: string, cursor: number) => {
                setMessage(msg);
                setTimeout(() => {
                    inputRef.current?.setNativeProps({
                        selection: { start: cursor, end: cursor },
                    });
                }, 0);
            },
        }));

        const handleTextChange = useCallback((text: string) => {
            setMessage(text);
            onMessageChange(text);
        }, [onMessageChange]);

        const handleSelectionChange = useCallback(
            (e: any) => {
                onCursorChange(e.nativeEvent.selection.end);
            },
            [onCursorChange]
        );

        React.useEffect(() => {
            if (replyTo) {
                const replyText = `@${replyTo.username} `;
                setMessage(replyText);
                onMessageChange(replyText);
            }
        }, [replyTo, onMessageChange]);

        const handleSend = () => {
            if (!message.trim() || !postId) return;
            addComment.mutate(
                { postId, message, reply_id: replyTo?.commentId ?? null },
                {
                    onSuccess: () => {
                        setMessage("");
                        onMessageChange("");
                        onCancelReply();
                    },
                }
            );
        };

        const handleCancel = () => {
            setMessage("");
            onMessageChange("");
            onCancelReply();
        };

        return (
            <View style={[styles.footerWrapper, { paddingBottom: bottomInset || 12 }]}>
                {replyTo && (
                    <View style={styles.replyIndicator}>
                        <Text style={styles.replyIndicatorText}>
                            Replying to{" "}
                            <Text style={styles.replyUsername}>@{replyTo.username}</Text>
                        </Text>
                        <Pressable onPress={handleCancel} hitSlop={8}>
                            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
                        </Pressable>
                    </View>
                )}

                <View style={styles.inputContainer}>
                    <BottomSheetTextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder={
                            replyTo ? `Reply to @${replyTo.username}...` : "Add a comment..."
                        }
                        placeholderTextColor={theme.colors.textSecondary}
                        value={message}
                        onChangeText={handleTextChange}
                        onSelectionChange={handleSelectionChange}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                        maxLength={500}
                    />
                    <Pressable
                        onPress={handleSend}
                        disabled={!message.trim() || addComment.isPending}
                        style={[
                            styles.sendButton,
                            (!message.trim() || addComment.isPending) &&
                            styles.sendButtonDisabled,
                        ]}
                    >
                        <Text style={styles.sendButtonText}>
                            {addComment.isPending ? "..." : "Post"}
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }
);

// ============ Comments List Content ============
interface CommentsListProps {
    postId: number | null;
    onReply: (commentId: number, username: string) => void;
    onDelete: (commentId: number) => void;
    deletingId: number | null;
    currentUserId: number | null;
    onLike: (commentId: number) => void;
}

const CommentsList = ({
    postId,
    onReply,
    onDelete,
    deletingId,
    currentUserId,
    onLike
}: CommentsListProps) => {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const { height } = Dimensions.get("window");

    const {
        comments,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        refetch,
        error
    } = useGetPostComments(postId ?? 0);

    const insets = useSafeAreaInsets();
    const FOOTER_HEIGHT = 80 + insets.bottom;

    const renderItem = useCallback(
        ({ item }: { item: TComment }) => (
            <CommentItem
                onLike={onLike}
                onReply={onReply}
                item={item}
                onDelete={onDelete}
                deletingId={deletingId}
                currentUserId={currentUserId}
            />
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
                <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.textSecondary} />
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
                return (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No comments yet</Text>
                    </View>
                );
            }}
            onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
                <>
                    {isFetchingNextPage && (
                        <ActivityIndicator style={{ marginVertical: 16 }} color={theme.colors.textSecondary} />
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
    const { theme } = useTheme();
    const styles = createStyles(theme);

    const snapPoints = useMemo(() => ["60%", "90%"], []);
    const insets = useSafeAreaInsets();

    const likeComment = useLikeComment();

    // Reply state
    const [replyTo, setReplyTo] = useState<{ commentId: number; username: string } | null>(null);
    const handleReply = useCallback((commentId: number, username: string) => {
        setReplyTo({ commentId, username });
    }, []);
    const handleCancelReply = useCallback(() => setReplyTo(null), []);

    // Delete state
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const deleteComment = useDeleteComment();

    // Current user
    const profileData = queryClient.getQueryData<ProfileResponse>(["profile"]);
    const currentUserId = profileData?.data?.id ?? null;

    // Refs for message & cursor
    const messageRef = useRef("");
    const cursorRef = useRef(0);

    // Debounced state for mention detection
    const [mentionState, setMentionState] = useState<{
        isSearching: boolean;
        query: string;
        startIndex: number;
        endIndex: number;
    } | null>(null);

    // Debounced mention detection
    const debouncedMentionCheck = useMemo(
        () =>
            debounce((text: string, cursor: number) => {
                const result = getMentionQuery(text, cursor);
                if (result) {
                    setMentionState({
                        isSearching: true,
                        query: result.query,
                        startIndex: result.startIndex,
                        endIndex: result.endIndex,
                    });
                } else {
                    setMentionState(null);
                }
            }, 150),
        []
    );

    const handleMessageChange = useCallback((text: string) => {
        messageRef.current = text;
        debouncedMentionCheck(text, cursorRef.current);
    }, [debouncedMentionCheck]);

    const handleCursorChange = useCallback((position: number) => {
        cursorRef.current = position;
        debouncedMentionCheck(messageRef.current, position);
    }, [debouncedMentionCheck]);

    const handleSelectMention = useCallback((user: MentionUser) => {
        if (!mentionState) return;

        const before = messageRef.current.slice(0, mentionState.startIndex);
        const after = messageRef.current.slice(mentionState.endIndex);
        const newMessage = `${before}@${user.username} ${after}`;

        messageRef.current = newMessage;
        cursorRef.current = before.length + user.username.length + 2;

        setMentionState(null);
        footerRef.current?.updateMessage(newMessage, cursorRef.current);
    }, [mentionState]);

    const footerRef = useRef<{ updateMessage: (msg: string, cursor: number) => void } | null>(null);

    // Like handler
    const handleLike = useCallback((commentId: number) => {
        if (!postId) return;
        likeComment.mutate({ postId, commentId });
    }, [postId, likeComment]);

    // Delete handler
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
                    ref={footerRef}
                    replyTo={replyTo}
                    onCancelReply={handleCancelReply}
                    postId={postId}
                    bottomInset={insets.bottom}
                    onMessageChange={handleMessageChange}
                    onCursorChange={handleCursorChange}
                />
            </BottomSheetFooter>
        ),
        [postId, insets.bottom, replyTo, handleCancelReply, handleMessageChange, handleCursorChange]
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
            keyboardBehavior="extend"
            keyboardBlurBehavior="none"
        >
            {mentionState?.isSearching ? (
                <MentionSuggestionsList
                    query={mentionState.query}
                    onSelect={handleSelectMention}
                />
            ) : (
                <CommentsList
                    onDelete={handleDelete}
                    deletingId={deletingId}
                    currentUserId={currentUserId}
                    postId={postId}
                    onReply={handleReply}
                    onLike={handleLike}
                />
            )}
        </BottomSheetModal>
    );
};

// ============ Styles ============
const createStyles = (theme: AppTheme) =>
    StyleSheet.create({
        // Sheet
        sheetBackground: {
            backgroundColor: theme.colors.background,
        },
        handleIndicator: {
            backgroundColor: theme.colors.border,
            width: 40,
        },

        // List
        listContent: {
            paddingBottom: SCREEN_HEIGHT * 0.1,
        },
        centered: {
            flex: 1,
            alignItems: "center",
        },
        deletingItem: {
            opacity: 0.5,
        },
        errorText: {
            color: theme.colors.textSecondary,
            fontSize: 14,
            marginBottom: theme.spacing.md,
            textAlign: "center",
        },
        retryButton: {
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.sm,
        },
        retryText: {
            color: theme.colors.primary,
            fontWeight: "600",
        },

        // Header
        commentsHeader: {
            paddingVertical: theme.spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
            alignItems: "center",
        },
        commentsTitle: {
            fontSize: 16,
            fontWeight: "600",
            color: theme.colors.textPrimary,
        },

        // Comment Item
        commentItem: {
            flexDirection: "row",
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
        },
        optimisticItem: {
            opacity: 0.6,
        },
        avatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            marginRight: theme.spacing.md,
        },
        commentContent: {
            flex: 1,
        },
        commentHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            marginBottom: 4,
        },
        username: {
            fontSize: 14,
            fontWeight: "600",
            color: theme.colors.textPrimary,
        },
        time: {
            fontSize: 12,
            color: theme.colors.textSecondary,
        },
        message: {
            fontSize: 14,
            color: theme.colors.textPrimary,
            lineHeight: 20,
        },

        // Replies
        repliesContainer: {
            marginLeft: 52,
            paddingLeft: theme.spacing.lg,
        },
        replyItem: {
            flexDirection: "row",
            paddingVertical: theme.spacing.sm,
            marginRight: theme.spacing.sm,
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
            marginTop: theme.spacing.sm,
        },
        repliesLine: {
            width: 24,
            height: 1,
            backgroundColor: theme.colors.border,
            marginRight: theme.spacing.sm,
        },
        repliesToggleText: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            fontWeight: "500",
        },
        actionsRow: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: theme.spacing.sm,
            gap: theme.spacing.lg,
        },
        actionButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        actionCount: {
            fontSize: 12,
            color: theme.colors.textSecondary,
        },
        replyButtonText: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            fontWeight: "500",
        },

        // States
        separator: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.border,
            marginLeft: 68,
        },
        emptyContainer: {
            padding: 32,
            alignItems: "center",
        },
        emptyText: {
            color: theme.colors.textSecondary,
            fontSize: 14,
        },

        // Footer
        footerWrapper: {
            backgroundColor: theme.colors.background,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
        },
        replyIndicator: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.surface,
        },
        replyIndicatorText: {
            fontSize: 13,
            color: theme.colors.textSecondary,
        },
        replyUsername: {
            fontWeight: "600",
            color: theme.colors.textPrimary,
        },

        // Footer Input
        inputContainer: {
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            backgroundColor: theme.colors.background,
            gap: theme.spacing.md,
        },
        input: {
            flex: 1,
            minHeight: 40,
            maxHeight: 100,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: 10,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            fontSize: 14,
            color: theme.colors.textPrimary,
        },
        sendButton: {
            paddingHorizontal: 4,
            paddingVertical: 10,
        },
        sendButtonDisabled: {
            opacity: 0.5,
        },
        sendButtonText: {
            color: SEND_COLOR,
            fontSize: 14,
            fontWeight: "600",
        },
    });