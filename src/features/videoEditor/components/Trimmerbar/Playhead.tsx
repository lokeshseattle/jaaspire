import React from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { GestureDetector, GestureType } from "react-native-gesture-handler";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

interface PlayheadProps {
  animatedStyle: AnimatedStyle<ViewStyle>;
  gesture: GestureType;
}

export const Playhead: React.FC<PlayheadProps> = ({ animatedStyle, gesture }) => {
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.hitArea, animatedStyle]}
        collapsable={false}
      >
        <Animated.View style={styles.playhead} />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  hitArea: {
    position: "absolute",
    top: -6,
    bottom: -6,
    width: 24,
    marginLeft: -12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  playhead: {
    width: 3,
    height: "110%",
    backgroundColor: "#FFFFFF",
    borderRadius: 1.5,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 4,
  },
});
