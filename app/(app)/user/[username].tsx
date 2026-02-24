import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

const UserProfile = () => {
  const { username } = useLocalSearchParams<{ username: string }>();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>UserProfile of {username}</Text>
    </View>
  );
};

export default UserProfile;
