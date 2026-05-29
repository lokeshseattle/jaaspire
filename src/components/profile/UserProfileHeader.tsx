import SubscribePaymentConfirmSheet from "@/src/components/payment/SubscribePaymentConfirmSheet";
// import { logSubscriptionDebug } from "@/src/features/wallet/iap-dev.store";
import TipBottomSheet from "@/src/components/payment/TipBottomSheet";
import StoryAvatar from "@/src/components/home/story/StoryAvatar";
import { ThemedText as Text } from "@/src/components/themed-text";
import {
  useFollowToggleMutation,
  useGetProfile,
  useGetProfileByUsername,
  useUnblockUserMutation,
} from "@/src/features/profile/profile.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { capitalize } from "@/src/utils/helpers";
import {
  isProfilePublicInAppSense,
  viewerIsAcceptedFollower,
} from "@/src/utils/profile-visibility";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const ProfileHeader = ({ username }: { username: string }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { data, isLoading, isSuccess, refetch } =
    useGetProfileByUsername(username);
  const followMutation = useFollowToggleMutation();
  const unblockMutation = useUnblockUserMutation();
  const { data: myProfileData } = useGetProfile();
  const myUsername = myProfileData?.data?.username;

  const profile = isSuccess ? data.data : null;
  const isDeletionPending = Boolean(profile?.deletion_requested_at);
  const blockedByYou = profile?.blocked_status === "blocked_by_you";
  const blockedByOther =
    !blockedByYou &&
    (profile?.blocked_status === "blocked_by_user" ||
      profile?.viewer?.is_blocked === true);

  const isOwnProfile = myUsername === username;

  const monthlySubscriptionPrice = profile?.subscription?.price_1_month ?? 0;
  const offersPaidSubscription =
    Boolean(profile?.paid_profile) || monthlySubscriptionPrice > 0;
  const isSubscribed = Boolean(profile?.viewer?.is_subscribed);
  const showSubscriptionRow =
    !isOwnProfile &&
    !blockedByYou &&
    !blockedByOther &&
    !isDeletionPending &&
    offersPaidSubscription;

  const [activeTab, setActiveTab] = useState<"posts" | "flicks" | "tagged">(
    "posts",
  );
  const [tipSheetOpen, setTipSheetOpen] = useState(false);
  const [subscribeSheetOpen, setSubscribeSheetOpen] = useState(false);

  const handleOpenTip = useCallback(() => setTipSheetOpen(true), []);
  const handleCloseTip = useCallback(() => setTipSheetOpen(false), []);

  const handleOpenSubscribe = useCallback(() => {
    // logSubscriptionDebug(
    //   "UserProfileHeader:subscribe tapped",
    //   { username, monthlySubscriptionPrice, isSubscribed },
    //   {
    //     phase: "ui",
    //     status: "success",
    //     summary: `Subscribe tapped @${username}`,
    //     payload: {
    //       username,
    //       monthlySubscriptionPrice,
    //       isSubscribed,
    //       offersPaidSubscription,
    //     },
    //   },
    // );
    setSubscribeSheetOpen(true);
  }, [
    username,
    monthlySubscriptionPrice,
    isSubscribed,
    offersPaidSubscription,
  ]);
  const handleCloseSubscribe = useCallback(
    () => setSubscribeSheetOpen(false),
    [],
  );

  const handleSubscribeSuccess = useCallback(() => {
    // logSubscriptionDebug(
    //   "UserProfileHeader:subscribe success",
    //   { username },
    //   {
    //     phase: "ui",
    //     status: "success",
    //     summary: `Subscribe success @${username}`,
    //     payload: { username },
    //   },
    // );
    setSubscribeSheetOpen(false);
    router.replace({
      pathname: "/user/[username]",
      params: {
        username,
        tab: "premium",
        subscribed: String(Date.now()),
      },
    });
  }, [username]);

  const navigateToFollowersFollowing = (type: "followers" | "following") => {
    router.push({
      pathname: "/(app)/followers-following",
      params: {
        type,
        username,
      },
    });
  };
  if (profile)
    return (
      <>
        {/* PROFILE INFO */}
        <View style={styles.profileRow}>
          <StoryAvatar
            uri={profile.avatar}
            username={profile.username}
            hasStory={profile.story_status?.has_stories ?? false}
            seen={profile.story_status?.all_viewed ?? true}
            size={90}
            disabled={blockedByYou || blockedByOther || isDeletionPending}
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
          {__DEV__ && (
            <Text style={styles.devUserMeta}>
              @{profile.username} · id {profile.id}
            </Text>
          )}
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>

        {/* ACTIONS / BLOCKED NOTICE */}
        <View style={styles.buttonContainer}>
          {isDeletionPending ? (
            <View style={styles.blockedNotice}>
              <Ionicons name="time-outline" size={22} color="#EF4444" />
              <Text style={styles.blockedNoticeTitle}>
                Account scheduled for deletion
              </Text>
              <Text style={styles.blockedNoticeSubtitle}>
                {profile.deletion_scheduled_for
                  ? `This profile will be permanently removed on ${new Date(profile.deletion_scheduled_for).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Content is no longer available.`
                  : "This profile is no longer available."}
              </Text>
            </View>
          ) : blockedByYou ? (
            <View style={styles.blockedNotice}>
              <Ionicons name="ban-outline" size={22} color="#EF4444" />
              <Text style={styles.blockedNoticeTitle}>User blocked</Text>
              <Text style={styles.blockedNoticeSubtitle}>
                You won&apos;t see their posts. Unblock from the menu to
                interact again.
              </Text>
            </View>
          ) : blockedByOther ? (
            <Pressable
              onPress={() => unblockMutation.mutateAsync(username)}
              style={[styles.button]}
              disabled={unblockMutation.isPending || isLoading}
            >
              <Text style={[styles.editText, { color: "white" }]}>Unblock</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => followMutation.mutateAsync(username)}
                style={[styles.button]}
                disabled={followMutation.isPending || isLoading}
              >
                <Text style={[styles.editText, { color: "white" }]}>
                  {capitalize(profile.viewer?.follow_status)}
                </Text>
              </Pressable>

              {(isProfilePublicInAppSense(profile) ||
                viewerIsAcceptedFollower(profile.viewer)) && (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/chat/[senderId]",
                      params: {
                        senderId: String(profile.id),
                        name: profile.name,
                        username: profile.username,
                        avatar: profile.avatar,
                      },
                    })
                  }
                  style={[styles.button, styles.buttonSecondary]}
                >
                  <Text style={styles.editTextSecondary}>Message</Text>
                </Pressable>
              )}

              {!isOwnProfile && (
                <Pressable
                  onPress={handleOpenTip}
                  style={[
                    styles.button,
                    styles.buttonSecondary,
                    styles.buttonIcon,
                  ]}
                >
                  <Ionicons
                    name="gift-outline"
                    size={18}
                    color={theme.colors.textPrimary}
                  />
                </Pressable>
              )}
            </>
          )}
        </View>

        {showSubscriptionRow ? (
          <View style={styles.subscribeContainer}>
            {isSubscribed ? (
              <View
                style={styles.subscribedBanner}
                accessibilityRole="text"
              >
                <View
                  style={[
                    styles.subscribedIconWrap,
                    { backgroundColor: theme.colors.primary + "18" },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.subscribedTextWrap}>
                  <Text style={styles.subscribedTitle}>Subscribed</Text>
                  <Text style={styles.subscribedSubtitle}>
                    You have access to exclusive posts from this creator.
                  </Text>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={handleOpenSubscribe}
                style={[styles.button, styles.subscribeButton]}
                disabled={subscribeSheetOpen}
              >
                <Ionicons name="star-outline" size={16} color="#fff" />
                <Text style={[styles.editText, { color: "white" }]}>
                  Subscribe ${monthlySubscriptionPrice}/mo
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}

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

        <TipBottomSheet
          visible={tipSheetOpen}
          onClose={handleCloseTip}
          username={profile.username}
        />

        {subscribeSheetOpen ? (
          <SubscribePaymentConfirmSheet
            visible
            onClose={handleCloseSubscribe}
            username={profile.username}
            amount={profile.subscription.price_1_month}
            onSuccess={handleSubscribeSuccess}
          />
        ) : null}
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
    buttonContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      marginTop: 10,
      gap: 10,
    },
    blockedNotice: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    blockedNoticeTitle: {
      fontWeight: "600",
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    blockedNoticeSubtitle: {
      fontSize: 13,
      textAlign: "center",
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      alignItems: "center",
    },

    button: {
      flex: 1,
      height: 40,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },

    buttonSecondary: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
    },

    buttonIcon: {
      flex: 0,
      width: 40,
      paddingHorizontal: 0,
    },

    subscribeContainer: {
      paddingHorizontal: 16,
      marginTop: 8,
    },

    subscribeButton: {
      alignSelf: "stretch",
      width: "100%",
      flexDirection: "row",
      gap: 6,
    },
    subscribedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.primary + "55",
      backgroundColor: theme.colors.surface,
    },
    subscribedIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    subscribedTextWrap: {
      flex: 1,
      gap: 2,
    },
    subscribedTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    subscribedSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
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

    devUserMeta: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.textSecondary,
    },

    bio: {
      marginTop: 4,
      color: theme.colors.textPrimary,
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
      color: "#fff",
    },

    editTextSecondary: {
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
