import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { StyleSheet } from "react-native";

type PostHeartOverlayProps = {
  animatedStyle: any;
  iconSize?: number;
  showShadow?: boolean;
};

export function PostHeartOverlay({
  animatedStyle,
  iconSize = 120,
  showShadow = false,
}: PostHeartOverlayProps) {
  return (
    <Animated.View
      style={[styles.heartContainer, animatedStyle]}
      pointerEvents="none"
    >
      <Ionicons
        name="heart"
        size={iconSize}
        color="#ff3040"
        style={showShadow ? styles.heartIcon : undefined}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heartContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -60,
    marginTop: -60,
    justifyContent: "center",
    alignItems: "center",
  },
  heartIcon: {
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
