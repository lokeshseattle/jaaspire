import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import StoryView from "./StoryView";

const { height } = Dimensions.get("window");

export default function StoryScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();

  const translateY = useSharedValue(0);
  const [isPanning, setIsPanning] = useState(false);

  const close = () => {
    router.back();
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(setIsPanning)(true);
    })
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      const shouldClose =
        translateY.value > height * 0.25 || event.velocityY > 1200;

      if (shouldClose) {
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0);
      }
      runOnJS(setIsPanning)(false);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const progress = translateY.value / height;
    const scale = interpolate(progress, [0, 1], [1, 0.85], Extrapolation.CLAMP);

    return {
      transform: [{ translateY: translateY.value }, { scale }],
      borderRadius: interpolate(
        progress,
        [0, 0.1],
        [0, 20],
        Extrapolation.CLAMP,
      ),
      overflow: "hidden" as const,
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, height * 0.5],
      [1, 0],
      Extrapolation.CLAMP,
    );

    return { opacity };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={{ flex: 1, backgroundColor: "black" }}>
        <Animated.View style={[{ flex: 1 }, backgroundStyle]} />
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            },
            animatedStyle,
          ]}
        >
          <StoryView
            username={username}
            onClose={close}
            isPanning={isPanning}
          />
          {/* <Viewers /> */}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
