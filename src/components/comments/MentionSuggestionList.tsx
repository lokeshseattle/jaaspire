import { useSearchUserQuery } from "@/src/features/profile/profile.hooks";
import { MentionUser } from "@/src/services/api/api.types";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { useCallback } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ============ Mention Suggestions List ============
interface MentionSuggestionsListProps {
    query: string;
    onSelect: (user: MentionUser) => void;
}

const MentionSuggestionsList = ({ query, onSelect }: MentionSuggestionsListProps) => {
    const { data, isLoading, isError } = useSearchUserQuery(query);
    const insets = useSafeAreaInsets();
    const { height } = Dimensions.get("window");
    const FOOTER_HEIGHT = 80 + insets.bottom;

    const users = data?.data?.users ?? [];

    const renderItem = useCallback(
        ({ item }: { item: MentionUser }) => (
            <Pressable style={styles.mentionItem} onPress={() => onSelect(item)}>
                <Image source={{ uri: item.avatar }} style={styles.mentionAvatar} />
                <View style={styles.mentionInfo}>
                    <View style={styles.mentionNameRow}>
                        <Text style={styles.mentionName}>{item.name}</Text>
                        {item.verified_user && (
                            <Ionicons name="checkmark-circle" size={14} color="#3897F0" />
                        )}
                    </View>
                    <Text style={styles.mentionUsername}>@{item.username}</Text>
                </View>
            </Pressable>
        ),
        [onSelect]
    );

    const ListHeader = () => (
        <View style={styles.mentionHeader}>
            <Ionicons name="at" size={18} color="#8E8E8E" />
            <Text style={styles.mentionHeaderText}>
                {query ? `Searching "${query}"` : "Type to search users"}
            </Text>
        </View>
    );

    if (isLoading) {
        return (
            <View style={styles.mentionCentered}>
                <ListHeader />
                <ActivityIndicator style={{ marginTop: 40 }} />
            </View>
        );
    }

    return (
        <BottomSheetFlatList
            data={users}
            keyExtractor={(item: MentionUser) => item.id.toString()}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT }}
            ItemSeparatorComponent={() => <View style={styles.mentionSeparator} />}
            ListEmptyComponent={() => (
                <View style={styles.mentionEmpty}>
                    <Ionicons name="person-outline" size={48} color="#E5E5E5" />
                    <Text style={styles.mentionEmptyText}>
                        {query ? "No users found" : "Start typing to search"}
                    </Text>
                </View>
            )}
            keyboardShouldPersistTaps="handled"
        />
    );
};

const styles = StyleSheet.create({
    // ... existing styles ...

    // Mention Suggestions Styles
    mentionCentered: {
        flex: 1,
    },
    mentionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5E5",
    },
    mentionHeaderText: {
        fontSize: 14,
        color: "#8E8E8E",
    },
    mentionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    mentionAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    mentionInfo: {
        flex: 1,
    },
    mentionNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    mentionName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#262626",
    },
    mentionUsername: {
        fontSize: 14,
        color: "#8E8E8E",
        marginTop: 2,
    },
    mentionSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#E5E5E5",
        marginLeft: 72,
    },
    mentionEmpty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 60,
        gap: 12,
    },
    mentionEmptyText: {
        fontSize: 15,
        color: "#8E8E8E",
    },
});

export default MentionSuggestionsList