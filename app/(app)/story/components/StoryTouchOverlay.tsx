import React, { useRef } from "react";
import {
  Dimensions,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

interface Props {
  onNext: () => void;
  onPrevious: () => void;
  onPressIn?: () => void;   // pause on hold (left side)
  onPressOut?: () => void;  // resume
  onFastForwardStart?: () => void; // 2x speed (right 30%)
  onFastForwardEnd?: () => void;   // back to 1x speed
}

const { width } = Dimensions.get("window");
const FAST_FORWARD_THRESHOLD = width * 0.7; // right 30% boundary

const StoryTouchOverlay = ({
  onNext,
  onPrevious,
  onPressIn,
  onPressOut,
  onFastForwardStart,
  onFastForwardEnd,
}: Props) => {
  const isFastForwarding = useRef(false);
  const longPressX = useRef<number | null>(null);

  const handlePress = (e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    if (locationX < width / 2) {
      onPrevious();
    } else {
      onNext();
    }
  };

  const handlePressIn = (e: GestureResponderEvent) => {
    longPressX.current = e.nativeEvent.locationX;
    // Don't pause immediately — wait to see if it becomes a long press
  };

  const handleLongPress = (e: GestureResponderEvent) => {
    const x = longPressX.current ?? e.nativeEvent.locationX;

    if (x >= FAST_FORWARD_THRESHOLD) {
      // Right 30% → fast forward
      isFastForwarding.current = true;
      onFastForwardStart?.();
    } else {
      // Left 70% → pause (existing behavior)
      onPressIn?.();
    }
  };

  const handlePressOut = () => {
    if (isFastForwarding.current) {
      isFastForwarding.current = false;
      onFastForwardEnd?.();
    } else {
      onPressOut?.();
    }
    longPressX.current = null;
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={styles.touchArea}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
        delayLongPress={200}
      />
    </View>
  );
};

export default StoryTouchOverlay;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  touchArea: {
    flex: 1,
  },
});
