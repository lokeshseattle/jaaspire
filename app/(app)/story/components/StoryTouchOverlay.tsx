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
  onPressIn?: () => void; // for pause
  onPressOut?: () => void; // for resume
}

const { width } = Dimensions.get("window");

const StoryTouchOverlay = ({
  onNext,
  onPrevious,
  onPressIn,
  onPressOut,
}: Props) => {
  const pressStartX = useRef<number | null>(null);

  const handlePress = (e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;

    if (locationX < width / 2) {
      onPrevious();
    } else {
      onNext();
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={styles.touchArea}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
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
