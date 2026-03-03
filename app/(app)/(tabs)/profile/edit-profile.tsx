import { ThemedText as Text } from "@/src/components/themed-text";
import FormInput from "@/src/components/ui/input";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import React from "react";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useMediaPicker } from "@/hooks/use-media-picker";
import { useToast } from "@/src/components/toast/ToastProvider";
import {
  useGetCountries,
  useGetGenders,
  useGetProfile,
  useUpdateAvatar,
  useUpdateProfile,
} from "@/src/features/profile/profile.hooks";
import { UpdateProfileRequest } from "@/src/services/api/api.types";
import { setServerErrors } from "@/src/utils/form-errors";
import { getDirtyValues } from "@/src/utils/helpers";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

type EditProfileFormValues = {
  email: string;
  username: string;
  name: string;
  bio: string;
  birthdate: Date | undefined;
  gender_id: string;
  gender_pronoun: string;
  country_id: string;
  location: string;
  website: string;
};

const FIELD_MAP = {
  email: "email",
  username: "username",
  name: "name",
  bio: "bio",
  birthdate: "birthdate",
  gender: "gender_id",
  pronoun: "gender_pronoun",
  country: "country_id",
  location: "location",
  website: "website",
};

export default function EditProfileScreen() {
  const toast = useToast();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const updateProfile = useUpdateProfile();

  const profileMutation = useUpdateProfile();
  const { data, isLoading } = useGetProfile();
  const avatarMutation = useUpdateAvatar();

  const countryQuery = useGetCountries();
  const genderQuery = useGetGenders();

  const countryOptions = countryQuery.isSuccess
    ? countryQuery.data.data.countries.map((item) => ({
      label: item.name,
      value: item.id.toString(),
    }))
    : [];

  const genderOptions = genderQuery.isSuccess
    ? genderQuery.data.data.genders.map((item) => ({
      label: item.gender_name,
      value: item.id.toString(),
    }))
    : [];

  const profile = data?.data;
  const { openMediaPicker } = useMediaPicker();

  const handlePickProfileImage = () => {
    openMediaPicker({
      circular: true, // forces 1:1 crop
      mediaTypes: ["images"],
      onChange: (file) => {
        // avatarMutation.mutate(
        //   {
        //     name: file.name,
        //     type: file.type,
        //     uri: file.uri,
        //   },
        //   {
        //     onSuccess: () => {
        //       console.log("Success");
        //     },
        //   }
        // );
        router.push({
          pathname: "/profile/profile-crop",
          params: { uri: file.uri },
        });
      },
    });
  };

  if (isLoading && !profile) return <ActivityIndicator />;

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { dirtyFields, isDirty },
  } = useForm<EditProfileFormValues>({
    defaultValues: {
      email: "",
      username: "",
      name: "",
      bio: "",
      birthdate: undefined,
      gender_id: "",
      gender_pronoun: "",
      country_id: "",
      location: "",
      website: "",
    },
  });

  React.useEffect(() => {
    if (profile) {
      reset({
        email: profile.email ?? "",
        username: profile.username ?? "",
        name: profile.name ?? "",
        bio: profile.bio ?? "",
        birthdate: profile.birthdate ? new Date(profile.birthdate) : undefined,
        gender_id: profile.gender_id?.toString() ?? "",
        gender_pronoun: profile.gender_pronoun ?? "",
        country_id: profile.country_id?.toString() ?? "",
        location: profile.location ?? "",
        website: profile.website ?? "",
      });
    }
  }, [profile, reset]);

  const onSubmit = (data: EditProfileFormValues) => {
    const changedData: UpdateProfileRequest = getDirtyValues(dirtyFields, data);

    // Add these debug logs:
    if (changedData.birthdate instanceof Date) {
      console.log(new Date(changedData.birthdate));
      changedData.birthdate = new Date(changedData.birthdate)
        .toISOString()
        .split("T")[0];
    }

    updateProfile.mutate(changedData, {
      onSuccess: () => {
        // toast.trigger("Profile Updated");
        router.back();
      },
      onError: (e) => {
        setServerErrors<EditProfileFormValues>(e.data?.errors, setError, FIELD_MAP);
      },
    });
  };

  const handleImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "livePhotos"],
    });
    console.log(result);
  };

  const submitButtonDisabled =
    !isDirty || profileMutation.isPending || isLoading;

  if (profile)
    return (
      // <SafeAreaView
      //   // edges={["bottom","top"]}
      //   style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      // >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Pressable
              onPress={router.back}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={theme.colors.textPrimary}
              />
            </Pressable>

            <Pressable
              disabled={submitButtonDisabled}
              onPress={handleSubmit(onSubmit)}
            >
              <Text
                style={{
                  color: submitButtonDisabled
                    ? theme.colors.textSecondary
                    : theme.colors.primary,
                  fontWeight: "600",
                }}
              >
                Save
              </Text>
            </Pressable>
          </View>

          {/* AVATAR SECTION */}
          <View style={styles.avatarSection}>
            <Image
              source={{
                uri: profile.avatar,
              }}
              style={[
                styles.avatar,
                {
                  borderColor: theme.colors.border,
                },
              ]}
            />

            <Pressable onPress={handlePickProfileImage}>
              <Text
                style={{
                  color: theme.colors.primary,
                  fontWeight: "600",
                  marginTop: theme.spacing.sm,
                }}
              >
                Change Profile Photo
              </Text>
            </Pressable>
          </View>

          {/* BASIC INFO */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <FormInput
              control={control}
              name="email"
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              rules={{
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Please enter a valid email address",
                },
                maxLength: {
                  value: 254,
                  message: "Email is too long",
                },
              }}
            />

            <FormInput
              control={control}
              name="username"
              label="Username"
              autoCapitalize="none"
            />

            <FormInput control={control} name="name" label="Full Name" />
          </View>

          {/* PERSONAL INFO */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <FormInput
              control={control}
              name="bio"
              label="Bio"
              multiline
              numberOfLines={4}
              style={{ textAlignVertical: "top" }}
            />

            {/* Date / Gender / Country will go here next */}

            <FormInput
              control={control}
              name="birthdate"
              label="BirthDate"
              pickerType="date"
            />

            <FormInput
              control={control}
              name="gender_id"
              label="Gender"
              pickerType="select"
              options={genderOptions}
            />

            <FormInput
              control={control}
              pickerType="select"
              name="gender_pronoun"
              label="Pronoun"
              options={[
                { label: "He/Him", value: "he/him" },
                { label: "She/Her", value: "she/her" },
                { label: "They/Them", value: "they/them" },
              ]}
            />

            <FormInput
              control={control}
              name="country_id"
              pickerType="select"
              label="Country"
              options={countryOptions}
            />
          </View>

          {/* LOCATION */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <FormInput control={control} name="location" label="Location" />

            <FormInput
              control={control}
              name="website"
              label="Website"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      // </SafeAreaView>
    );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      // backgroundColor: "red",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      alignItems: "center",
    },
    avatarSection: {
      alignItems: "center",
    },
    avatar: {
      width: 110,
      height: 110,
      borderRadius: 999,
      borderWidth: 1,
    },
    card: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      gap: 16,
    },
    inputContainer: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 48,
      justifyContent: "center",
    },
  });
