import { useAuth } from "@/src/features/auth/auth.hooks";
import { AppTheme, ThemeMode } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
    mode: ThemeMode;
    onToggleTheme: () => void;
};

// ✅ Move Item component OUTSIDE
type ItemProps = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress?: () => void;
    right?: React.ReactNode;
    danger?: boolean;
    theme: AppTheme;
};

const Item = ({
    icon,
    label,
    onPress,
    right,
    danger,
    theme,
}: ItemProps) => {
    const styles = createStyles(theme);

    return (
        <TouchableOpacity
            style={styles.item}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={styles.left}>
                <Ionicons
                    name={icon}
                    size={20}
                    color={danger ? "#ef4444" : theme.colors.icon}
                />
                <Text
                    style={[
                        styles.label,
                        danger && { color: "#ef4444" },
                    ]}
                >
                    {label}
                </Text>
            </View>

            {right ?? (
                <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.icon}
                />
            )}
        </TouchableOpacity>
    );
};

const SettingsScreen = ({ mode, onToggleTheme }: Props) => {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const { logout } = useAuth();

    return (
        <View style={styles.container}>
            <View style={styles.section}>
                <Item theme={theme} icon="card-outline" label="Subscriptions" />
                <Item theme={theme} icon="bookmark-outline" label="Bookmarks" />
                <Item theme={theme} icon="ban-outline" label="Blocked Users" />
                <Item theme={theme} icon="wallet-outline" label="Wallet" />
            </View>

            <View style={styles.section}>
                <Item theme={theme} icon="help-circle-outline" label="Help & Support" />
                <Item theme={theme} icon="person-add-outline" label="Invite" />
            </View>

            <View style={styles.section}>
                <Item
                    theme={theme}
                    icon="moon-outline"
                    label={mode === "dark" ? "Dark Mode" : "Light Mode"}
                    right={
                        <Switch
                            value={mode === "dark"}
                            onValueChange={onToggleTheme}
                            thumbColor={theme.colors.primary}
                        />
                    }
                />
            </View>

            <View style={styles.section}>
                <Item
                    theme={theme}
                    icon="log-out-outline"
                    label="Logout"
                    danger
                    onPress={logout}
                />
            </View>
        </View>
    );
};

export default SettingsScreen;

const createStyles = (theme: AppTheme) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
            paddingTop: theme.spacing.lg, // slightly tighter
            paddingHorizontal: theme.spacing.md, // contain full width
        },

        section: {
            backgroundColor: theme.colors.card,
            marginBottom: theme.spacing.lg,
            borderRadius: theme.radius.md,
            overflow: "hidden",
        },

        item: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: theme.spacing.md, // reduced from lg
            paddingHorizontal: theme.spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth, // more subtle
            borderBottomColor: theme.colors.border,
        },

        left: {
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            flex: 1, // prevents right side from pushing row wide
        },

        label: {
            fontSize: 15, // slightly more subtle
            color: theme.colors.textPrimary,
            fontWeight: "500",
            flexShrink: 1, // prevents stretching
        },
    });