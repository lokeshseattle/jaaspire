import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import DraggableText from "./DraggableText";

export default function TextOverlayLayer() {
  const [texts, setTexts] = useState<number[]>([]);

  return (
    <View style={{ flex: 1 }}>
      {texts.map((id) => (
        <DraggableText key={id} />
      ))}

      <TouchableOpacity
        onPress={() => setTexts((prev) => [...prev, Date.now()])}
        style={{
          position: "absolute",
          bottom: 40,
          alignSelf: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 18 }}>Add Text</Text>
      </TouchableOpacity>
    </View>
  );
}
