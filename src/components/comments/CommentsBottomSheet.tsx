// src/components/comments/CommentsBottomSheet.tsx
import {
    useAddComment,
    useGetPostComments,
} from "@/src/features/post/comments.hooks";
import type { TComment } from "@/src/services/api/api.types";
import { timeAgo } from "@/src/utils/helpers";
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
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ============ Reply Item ============
const ReplyItem = ({ item }: { item: TComment["replies"][0] }) => (
    <View style={styles.replyItem}>
        <Image source={{ uri: item.user.avatar }} style={styles.replyAvatar} />
        <View style={styles.replyContent}>
            <View style={styles.commentHeader}>
                <Text style={styles.username}>@{item.user.username}</Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
            <Text style={styles.message}>{item.message}</Text>
        </View>
    </View>
);

// ============ Comment Item ============
const CommentItem = ({ item }: { item: TComment }) => {
    const [showReplies, setShowReplies] = useState(false);
    const hasReplies = item.replies && item.replies.length > 0;

    return (
        <View>
            <View style={styles.commentItem}>
                <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                        <Text style={styles.username}>@{item.user.username}</Text>
                        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                    </View>
                    <Text style={styles.message}>{item.message}</Text>

                    {hasReplies && (
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
                        <ReplyItem key={reply.id} item={reply} />
                    ))}
                </View>
            )}
        </View>
    );
};

// ============ Footer Input Component ============
// ============ Footer Input Component ============
interface FooterInputProps {
    postId: number | null;
    bottomInset: number;
}

const FooterInput = ({ postId, bottomInset }: FooterInputProps) => {
    const addComment = useAddComment();
    const [message, setMessage] = useState("");


    const handleSend = () => {
        if (!message.trim() || !postId) return;
        addComment.mutate(
            { postId, message, reply_id: null },
            {
                onSuccess: () => {
                    setMessage("");
                    Keyboard.dismiss();
                },
            }
        );
    };


    return (
        <View style={[styles.inputContainer, { paddingBottom: bottomInset || 12 }]}>
            <BottomSheetTextInput
                style={styles.input}
                placeholder="Add a comment..."
                placeholderTextColor="#8E8E8E"
                value={message}
                onChangeText={setMessage}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                maxLength={500}
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
    );
};

// ============ Comments List Content ============
interface CommentsListProps {
    postId: number | null;
}

const CommentsList = ({ postId }: CommentsListProps) => {
    const {
        comments,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useGetPostComments(postId ?? 0);

    const renderItem = useCallback(
        ({ item }: { item: TComment }) => <CommentItem item={item} />,
        []
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
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No comments yet</Text>
                </View>
            )}
            onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
                isFetchingNextPage ? (
                    <ActivityIndicator style={{ marginVertical: 16 }} />
                ) : null
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
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

    // 👇 Footer component - always visible at bottom
    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props}>
                <FooterInput postId={postId} bottomInset={insets.bottom} />
            </BottomSheetFooter>
        ),
        [postId, insets.bottom]
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
            // 👇 Remove/change these keyboard props
            keyboardBehavior={"extend"}  // 👈 Sheet stays in place
        // keyboardBlurBehavior="none"    // 👈 Don't restore on blur
        // android_keyboardInputMode="adjustNothing" // 👈 Android: don't adjust
        >
            <CommentsList postId={postId} />
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
        paddingBottom: 100, // Space for footer
    },
    centered: {
        flex: 1,
        alignItems: "center",
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

    // Footer Input
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#E5E5E5",
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