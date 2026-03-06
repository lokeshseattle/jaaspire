import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, View } from "react-native";

const TABS = ["gallery", "home_feed", "premium"];
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
            {tab === "gallery" && <Ionicons name="grid-outline" size={24} />}
            {tab === "home_feed" && <Ionicons name="layers-outline" size={24} />}
            {tab === "premium" && <Ionicons name="heart-circle-outline" size={24} />}
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
