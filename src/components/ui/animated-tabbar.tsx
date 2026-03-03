import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    LayoutChangeEvent,
    Pressable,
    StyleSheet,
    View
} from "react-native";
import Animated, {
    Easing,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

type TabConfig = {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    activeIcon?: keyof typeof Ionicons.glyphMap;
};

interface AnimatedTabBarProps<T extends string> {
    tabs: Record<T, TabConfig>;
    activeKey: T;
    onTabChange: (key: T) => void;
}

/* ============================= */
/* Animated Single Tab Component */
/* ============================= */

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

function AnimatedTab<T extends string>({
    tabKey,
    config,
    isActive,
    onPress,
    onLayout,
}: {
    tabKey: T;
    config: TabConfig;
    isActive: boolean;
    onPress: () => void;
    onLayout: (event: LayoutChangeEvent) => void;
}) {
    const scale = useSharedValue(1);
    const progress = useSharedValue(isActive ? 1 : 0);

    useEffect(() => {
        progress.value = withTiming(isActive ? 1 : 0, {
            duration: 250,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
    }, [isActive]);

    const animatedTextStyle = useAnimatedStyle(() => ({
        color: interpolateColor(progress.value, [0, 1], ["#999", "#000"]),
        transform: [
            {
                scale: withSpring(scale.value, {
                    damping: 15,
                    stiffness: 150,
                }),
            },
        ],
    }));

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: withSpring(scale.value * (0.9 + progress.value * 0.1), {
                    damping: 15,
                    stiffness: 150,
                }),
            },
        ],
    }));

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => (scale.value = 0.92)}
            onPressOut={() => (scale.value = 1)}
            onLayout={onLayout}
            style={styles.tab}
        >
            {config.icon && (
                <Animated.View style={animatedIconStyle}>
                    <Ionicons
                        name={
                            isActive && config.activeIcon
                                ? config.activeIcon
                                : config.icon
                        }
                        size={22}
                        color={isActive ? "#000" : "#999"}
                    />
                </Animated.View>
            )}

            <Animated.Text style={[styles.tabText, animatedTextStyle]}>
                {config.label}
            </Animated.Text>
        </Pressable>
    );
}

/* ============================= */
/* Main Tab Bar Component */
/* ============================= */

export function AnimatedTabBar<T extends string>({
    tabs,
    activeKey,
    onTabChange,
}: AnimatedTabBarProps<T>) {
    const [tabLayouts, setTabLayouts] = useState<
        Record<string, { x: number; width: number }>
    >({});

    const indicatorX = useSharedValue(0);
    const indicatorWidth = useSharedValue(0);

    const tabKeys = Object.keys(tabs) as T[];

    useEffect(() => {
        const layout = tabLayouts[activeKey];
        if (layout) {
            const actualWidth = layout.width * 0.6;
            const offsetX = (layout.width - actualWidth) / 2;

            indicatorX.value = withSpring(layout.x + offsetX, {
                damping: 30,
                stiffness: 400,
                mass: 0.6,
            });

            indicatorWidth.value = withSpring(actualWidth, {
                damping: 20,
                stiffness: 200,
            });
        }
    }, [activeKey, tabLayouts]);

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: indicatorX.value }],
        width: indicatorWidth.value,
    }));

    const handleLayout =
        (key: T) => (event: LayoutChangeEvent) => {
            const { x, width } = event.nativeEvent.layout;
            setTabLayouts((prev) => ({
                ...prev,
                [key]: { x, width },
            }));
        };

    return (
        <View style={styles.container}>
            {tabKeys.map((key) => (
                <AnimatedTab
                    key={key}
                    tabKey={key}
                    config={tabs[key]}
                    isActive={key === activeKey}
                    onPress={() => onTabChange(key)}
                    onLayout={handleLayout(key)}
                />
            ))}

            <Animated.View style={[styles.indicator, indicatorStyle]} />
        </View>
    );
}

/* ============================= */
/* Styles */
/* ============================= */

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: "#eee",
        position: "relative",
    },
    tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
    },
    tabText: {
        // fontSize: 11,
        marginTop: 4,
        fontWeight: "500",
    },
    indicator: {
        position: "absolute",
        bottom: 0,
        left: 0,
        height: 2,
        backgroundColor: "#000",
        borderRadius: 2,
    },
});