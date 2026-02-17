import Entypo from "@expo/vector-icons/Entypo";
import React from "react";
import { Text, View } from "react-native";
const OwnStory = () => {
  return (
    <View>
      <Text style={{ marginBottom: 4 }}>Add story</Text>
      <View
        style={{
          borderRadius: 100,
          height: 58,
          width: 58,
          borderWidth: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Entypo name="plus" size={24} color="black" />
      </View>
    </View>
  );
};

export default OwnStory;
