import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { v4 as uuid } from "uuid";
import SingleTextLayer from "./SingleTextLayer";

export interface TextLayerType {
  id: string;
  text: string;
}

export default function StoryTextManager() {
  const [texts, setTexts] = useState<TextLayerType[]>([]);

  const addNewText = () => {
    setTexts((prev) => [
      ...prev,
      {
        id: uuid(),
        text: "New Text",
      },
    ]);
  };

  const updateText = (id: string, value: string) => {
    setTexts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: value } : t)),
    );
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {texts.map((item) => (
        <SingleTextLayer
          key={item.id}
          id={item.id}
          text={item.text}
          onChange={updateText}
        />
      ))}

      {/* Add Button */}
      <Pressable style={styles.addButton} onPress={addNewText} />
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 40,
    height: 40,
  },
});
