// components/MentionSuggestions.tsx
import type { MentionUser } from "@/src/services/api/api.types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface MentionSuggestionsProps {
    users: MentionUser[];
    isLoading: boolean;
    onSelect: (user: MentionUser) => void;
}

export const MentionSuggestions = ({ users, isLoading, onSelect }: MentionSuggestionsProps) => {
    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" />
            </View>
        );
    }

    if (users.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>No users found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {users.slice(0, 5).map((user) => (
                <Pressable
                    key={user.id}
                    style={styles.userItem}
                    onPress={() => onSelect(user)}
                >
                    <Image source={{ uri: user.avatar }} style={styles.avatar} />
                    <View style={styles.userInfo}>
                        <Text style={styles.name}>{user.name}</Text>
                        <Text style={styles.username}>@{user.username}</Text>
                    </View>
                    {user.verified_user && (
                        <Ionicons name="checkmark-circle" size={16} color="#3897F0" />
                    )}
                </Pressable>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "white",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#E5E5E5",
        maxHeight: 200,
    },
    userItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    userInfo: {
        flex: 1,
    },
    name: {
        fontSize: 14,
        fontWeight: "600",
        color: "#262626",
    },
    username: {
        fontSize: 13,
        color: "#8E8E8E",
    },
    emptyText: {
        padding: 16,
        color: "#8E8E8E",
        textAlign: "center",
    },
});