import { Stack } from "expo-router";
import React from "react";

const ProfileLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="profile-crop" />
      <Stack.Screen name="settings" />
    </Stack>
  );
};

export default ProfileLayout;
