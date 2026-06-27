// src/features/videoEditor/components/TrimmerBar/TrimHandle.tsx

import React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, GestureType } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { TrimmerAnimatedStyle } from "../../types";
import { COLORS, TRIMMER } from "../../constants";

interface TrimHandleProps {
  gesture: GestureType;
  style: TrimmerAnimatedStyle;
  position: "left" | "right";
}

export const TrimHandle: React.FC<TrimHandleProps> = ({
  gesture,
  style,
  position,
}) => {
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.handle,
          position === "left" ? styles.leftHandle : styles.rightHandle,
          style,
        ]}
        collapsable={false}
      >
        <View style={styles.handleBar} />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  handle: {
    position: "absolute",
    width: TRIMMER.HANDLE_WIDTH,
    height: TRIMMER.BAR_HEIGHT,
    backgroundColor: COLORS.handleColor,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 25,
  },
  leftHandle: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  rightHandle: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  handleBar: {
    width: 4,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 2,
  },
});
