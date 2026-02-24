import { ThemedText as Text } from "@/src/components/themed-text";
import { forceLogout } from "@/src/features/auth/auth.utils";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

const ProfileHeader = () => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const { data, isLoading, isSuccess, refetch } = useGetProfile();
  const profile = isSuccess ? data.data : null;

  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "tagged">(
    "posts",
  );

  if (profile)
    return (
      <>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.username}>{profile.username}</Text>
          <View style={styles.headerIcons}>
            <Pressable onPress={forceLogout}>
              <Text>Logout</Text>
            </Pressable>
            <Ionicons name="add-circle-outline" size={24} />
            <Feather name="menu" size={24} style={{ marginLeft: 16 }} />
          </View>
        </View>

        {/* PROFILE INFO */}
        <View style={styles.profileRow}>
          <Image
            source={{
              uri: profile.avatar,
            }}
            style={styles.avatar}
          />

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{profile.counts.posts}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>

            <View style={styles.stat}>
              <Text style={styles.statNumber}>{profile.counts.followers}</Text>
              <Text style={styles.statLabel}>{`Followers`}</Text>
            </View>

            <View style={styles.stat}>
              <Text style={styles.statNumber}>{profile.counts.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* BIO */}
        <View style={styles.bioContainer}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>

        {/* EDIT BUTTON */}
        <Pressable
          onPress={() => router.push("/profile/edit-profile")}
          style={styles.editButton}
        >
          <Text style={styles.editText}>Edit Profile</Text>
        </Pressable>

        {/* HIGHLIGHTS */}
        {/* <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.highlights}
            >
              {["Travel", "Work", "Friends", "Gym"].map((item, i) => (
                <View key={i} style={styles.highlightItem}>
                  <View style={styles.highlightCircle} />
                  <Text style={styles.highlightText}>{item}</Text>
                </View>
              ))}
            </ScrollView> */}

        {/* TABS */}
        {/* <View style={styles.tabs}>
          <Pressable style={styles.tab} onPress={() => setActiveTab("posts")}>
            <Ionicons
              name="grid-outline"
              size={22}
              color={activeTab === "posts" ? "black" : "gray"}
            />
          </Pressable>

          <Pressable style={styles.tab} onPress={() => setActiveTab("reels")}>
            <Ionicons
              name="play-outline"
              size={22}
              color={activeTab === "reels" ? "black" : "gray"}
            />
          </Pressable>

          <Pressable style={styles.tab} onPress={() => setActiveTab("tagged")}>
            <Ionicons
              name="person-outline"
              size={22}
              color={activeTab === "tagged" ? "black" : "gray"}
            />
          </Pressable>
        </View> */}
      </>
    );
};

export default ProfileHeader;

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      alignItems: "center",
    },

    username: {
      fontSize: 18,
      fontWeight: "600",
    },

    headerIcons: {
      flexDirection: "row",
      alignItems: "center",
    },

    profileRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      marginTop: 10,
    },

    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
    },

    statsContainer: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
    },

    stat: {
      alignItems: "center",
    },

    statNumber: {
      fontWeight: "600",
      fontSize: 16,
    },

    statLabel: {
      fontSize: 13,
    },

    bioContainer: {
      paddingHorizontal: 16,
      marginTop: 10,
    },

    name: {
      fontWeight: "600",
    },

    bio: {
      marginTop: 4,
    },

    editButton: {
      marginHorizontal: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: "#ccc",
      paddingVertical: 6,
      borderRadius: 6,
      alignItems: "center",
    },

    editText: {
      fontWeight: "500",
    },

    highlights: {
      marginTop: 16,
      paddingLeft: 16,
    },

    highlightItem: {
      alignItems: "center",
      marginRight: 16,
    },

    highlightCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: "#eee",
      marginBottom: 4,
    },

    highlightText: {
      fontSize: 12,
    },

    tabs: {
      flexDirection: "row",
      borderTopWidth: 0.5,
      borderBottomWidth: 0.5,
      borderColor: "#ddd",
      marginTop: 16,
    },

    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
    },
  });
