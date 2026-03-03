import { Image } from 'expo-image';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

// Placeholder type - update when API is ready
export interface ProfileSuggestion {
    id: number;
    name: string;
    username: string;
    avatar: string;
}

interface ProfileSuggestionsProps {
    query: string;
    suggestions: ProfileSuggestion[];
    isLoading: boolean;
    onSelect: (profile: ProfileSuggestion) => void;
}

export const ProfileSuggestions: React.FC<ProfileSuggestionsProps> = ({
    query,
    suggestions,
    isLoading,
    onSelect,
}) => {
    // Placeholder data - remove when API is ready
    const placeholderSuggestions: ProfileSuggestion[] = query.length > 0 ? [
        { id: 1, name: 'John Doe', username: 'johndoe', avatar: 'https://i.pravatar.cc/150?img=1' },
        { id: 2, name: 'Jane Smith', username: 'janesmith', avatar: 'https://i.pravatar.cc/150?img=2' },
        { id: 3, name: 'Bob Wilson', username: 'bobwilson', avatar: 'https://i.pravatar.cc/150?img=3' },
    ].filter(
        (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.username.toLowerCase().includes(query.toLowerCase())
    ) : [];

    const data = suggestions.length > 0 ? suggestions : placeholderSuggestions;

    if (query.length === 0) return null;

    const renderItem = ({ item }: { item: ProfileSuggestion }) => (
        <Pressable style={styles.suggestionItem} onPress={() => onSelect(item)}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.textContainer}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.username}>@{item.username}</Text>
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Searching...</Text>
                </View>
            ) : data.length > 0 ? (
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    keyboardShouldPersistTaps="handled"
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No results found for "{query}"</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#000000',
        maxHeight: 300,
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#2c2c2e',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1c1c1e',
    },
    textContainer: {
        marginLeft: 12,
        flex: 1,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    username: {
        fontSize: 13,
        color: '#8e8e93',
        marginTop: 2,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        color: '#8e8e93',
        fontSize: 14,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#8e8e93',
        fontSize: 14,
    },
});