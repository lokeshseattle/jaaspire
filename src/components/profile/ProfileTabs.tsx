import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, View } from "react-native";
import { ThemedText as Text } from "../themed-text";

const TABS = ["posts", "video", "tagged"];
const SCREEN_WIDTH = Dimensions.get("window").width;
const TAB_WIDTH = SCREEN_WIDTH / TABS.length;

function ProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: string;
  onChange: (tab: any) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const index = TABS.indexOf(activeTab);

    Animated.spring(translateX, {
      toValue: index * TAB_WIDTH,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [activeTab]);

  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            style={{
              flex: 1,
              padding: 12,
              alignItems: "center",
            }}
          >
            <Text>{tab}</Text>
          </Pressable>
        ))}
      </View>

      {/* Animated underline */}
      <Animated.View
        style={{
          height: 2,
          width: TAB_WIDTH,
          backgroundColor: "black",
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}

export default ProfileTabs;
