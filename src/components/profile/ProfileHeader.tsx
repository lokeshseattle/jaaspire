import { ThemedText as Text } from "@/src/components/themed-text";
import { WEB_ORIGIN } from "@/src/constants/app-env";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Link, router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";

function profileWebUrl(username: string): string {
  const base = WEB_ORIGIN.replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(username)}`;
}

const ProfileHeader = ({
  username,
  isOwnProfile,
  onShareProfile,
}: {
  username: string;
  isOwnProfile?: boolean;
  onShareProfile?: () => void;
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { data, isLoading, isSuccess, refetch } = useGetProfile();
  const profile = isSuccess ? data.data : null;

  // console.log(profile)

  const [activeTab, setActiveTab] = useState<
    "gallery" | "home_feed" | "premium"
  >("gallery");

  const navigateToFollowersFollowing = (type: "followers" | "following") => {
    router.push({
      pathname: "/(app)/followers-following",
      params: {
        type,
        username,
      },
    });
  };

  const handleShareProfile = useCallback(async () => {
    const webUrl = profileWebUrl(username);
    const appUrl = Linking.createURL(`/user/${username}`);
    const message = `Check out @${username} on Jaaspire`;
    try {
      await Share.share(
        Platform.OS === "android"
          ? { message: `${message}\n${webUrl}\n${appUrl}` }
          : { message: `${message}\n${appUrl}`, url: webUrl },
      );
    } catch {
      /* dismissed */
    }
  }, [username]);

  if (profile)
    return (
      <>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{profile?.username}</Text>
            {__DEV__ && profile?.id != null && (
              <Text style={styles.devUserId}> · id {profile.id}</Text>
            )}
          </View>
          <View style={styles.headerIcons}>
            {/* <Pressable onPress={forceLogout}>
              <Text>Logout</Text>
            </Pressable>
            <Ionicons name="add-circle-outline" size={24} /> */}
            <Link href="/settings">
              <Feather
                name="menu"
                size={24}
                color={theme.colors.textPrimary}
                style={{ marginLeft: 16 }}
              />
            </Link>
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

            {/* <Link href="/(app)/followers-following?type=followers" asChild> */}
            <Pressable
              onPress={() => navigateToFollowersFollowing("followers")}
              style={styles.stat}
            >
              <Text style={styles.statNumber}>{profile.counts.followers}</Text>
              <Text style={styles.statLabel}>{`Followers`}</Text>
            </Pressable>
            {/* </Link> */}

            {/* <Link href="/(app)/followers-following?type=following" asChild> */}
            <Pressable
              onPress={() => navigateToFollowersFollowing("following")}
              style={styles.stat}
            >
              <Text style={styles.statNumber}>{profile.counts.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>
            {/* </Link> */}
          </View>
        </View>

        {/* BIO */}
        <View style={styles.bioContainer}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={() => router.push("/profile/edit-profile")}
            style={styles.button}
          >
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
          <Pressable onPress={handleShareProfile} style={styles.button}>
            <Text style={styles.editText}>Share Profile</Text>
          </Pressable>
        </View>

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

          <Pressable style={styles.tab} onPress={() => setActiveTab("flicks")}>
            <Ionicons
              name="play-outline"
              size={22}
              color={activeTab === "flicks" ? "black" : "gray"}
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

    usernameRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "baseline",
      flex: 1,
    },

    username: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },

    devUserId: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.textSecondary,
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
      color: theme.colors.textPrimary,
    },

    statLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },

    bioContainer: {
      paddingHorizontal: 16,
      marginTop: 10,
    },

    name: {
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },

    bio: {
      marginTop: 4,
      color: theme.colors.textPrimary,
    },

    buttonContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      marginTop: 10,
      gap: 10,
    },

    button: {
      flex: 1,
      height: 40,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },

    editText: {
      fontWeight: "500",
      color: theme.colors.textPrimary,
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
