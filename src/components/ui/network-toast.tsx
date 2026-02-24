// NetworkToast.tsx
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

interface Props {
  visible: boolean;
}

export default function NetworkToast({ visible }: Props) {
  const translateY = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#ff4d4f",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    elevation: 5,
  },
  text: {
    color: "white",
    fontWeight: "600",
  },
});
