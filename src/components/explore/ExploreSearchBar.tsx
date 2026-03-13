import { AppTheme } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

interface ExploreSearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onFocus: () => void;
    onBlur: () => void;
    onClear: () => void;
    isFocused: boolean;
}

export const ExploreSearchBar: React.FC<ExploreSearchBarProps> = ({
    value,
    onChangeText,
    onFocus,
    onBlur,
    onClear,
    isFocused,
}) => {
    const { theme } = useTheme()
    const styles = createStyles(theme)
    return (
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <Ionicons name="search" size={18} color="#8e8e93" style={styles.searchIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Search"
                    placeholderTextColor="#8e8e93"
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                />
                {value.length > 0 && (
                    <Pressable onPress={onClear} style={styles.clearButton}>
                        <Ionicons name="close-circle" size={18} color="#8e8e93" />
                    </Pressable>
                )}
            </View>
            {/* {isFocused && (
                <Pressable onPress={onBlur} style={styles.cancelButton}>
                    <Ionicons name="close" size={24} color="#ffffff" />
                </Pressable>
            )} */}
        </View>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: theme.colors.background,
    },
    inputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 36,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    searchIcon: {
        marginRight: 6,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.textPrimary,
        padding: 0,
    },
    clearButton: {
        padding: 4,
    },
    cancelButton: {
        marginLeft: 12,
        padding: 4,
    },
});