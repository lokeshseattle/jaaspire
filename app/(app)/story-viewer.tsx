import StoryMedia from "@/src/components/home/story/StoryMedia";
import StoryProgressBars from "@/src/components/home/story/StoryProgressBars";
import { StoryItem } from "@/src/components/home/story/types";
import { useStoryController } from "@/src/components/home/story/useStoryController";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Dimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";

const { height, width } = Dimensions.get("window");

const STORIES: StoryItem[] = [
  { id: "1", type: "image", uri: "https://picsum.photos/800/1200?1" },
  // { id: "2", type: "video", uri: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: "3", type: "image", uri: "https://picsum.photos/800/1200?3" },
  { id: "4", type: "image", uri: "https://picsum.photos/800/1200?6" },
];

export default function StoryViewer() {
  const navigation = useNavigation();

  const { currentIndex, progress, next, previous, pause, resume } =
    useStoryController(STORIES, () => navigation.goBack());

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      if (e.x > width / 2) {
        scheduleOnRN(next);
      } else {
        scheduleOnRN(previous);
      }
    });

  const longPress = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      scheduleOnRN(pause);
    })
    .onEnd(() => {
      scheduleOnRN(resume);
    });

  const swipeDown = Gesture.Pan()
    .activeOffsetY(20)
    .onEnd((e) => {
      if (e.translationY > 120) {
        scheduleOnRN(navigation.goBack);
      }
    });

  // Tap and LongPress compete
  const pressGestures = Gesture.Exclusive(longPress, tapGesture);

  // Swipe can happen alongside presses
  const composed = Gesture.Simultaneous(pressGestures, swipeDown);

  const currentStory = STORIES[currentIndex];

  if (!currentStory) return null;

  return (
    <GestureDetector gesture={composed}>
      <View style={{ flex: 1, backgroundColor: "black" }}>
        <StoryProgressBars
          stories={STORIES}
          progress={progress}
          currentIndex={currentIndex}
        />

        <StoryMedia story={currentStory} />
      </View>
    </GestureDetector>
  );
}
