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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMediaPicker } from "@/hooks/use-media-picker";
import { useToast } from "@/src/components/toast/ToastProvider";
import {
  useGetCountries,
  useGetGenders,
  useGetProfile,
  useUpdateProfile,
} from "@/src/features/profile/profile.hooks";
import { UpdateProfileRequest } from "@/src/services/api/api.types";
import { setServerErrors } from "@/src/utils/form-errors";
import { getDirtyValues } from "@/src/utils/helpers";
import Ionicons from "@expo/vector-icons/Ionicons";
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
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const updateProfile = useUpdateProfile();
  const { data, isLoading, isError } = useGetProfile();

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

  const handlePickProfileImage = () => {
    openMediaPicker({
      circular: true,
      mediaTypes: ["images"],
      onChange: (file) => {
        router.push({
          pathname: "/profile/profile-crop",
          params: { uri: encodeURIComponent(file.uri) },
        });
      },
    });
  };

  const onSubmit = (formData: EditProfileFormValues) => {
    const changedData: UpdateProfileRequest = getDirtyValues(
      dirtyFields,
      formData,
    );

    if (changedData.birthdate instanceof Date) {
      changedData.birthdate = new Date(changedData.birthdate)
        .toISOString()
        .split("T")[0];
    }

    updateProfile.mutate(changedData, {
      onSuccess: () => {
        toast.trigger("Profile updated", "success");
        router.back();
      },
      onError: (e) => {
        setServerErrors<EditProfileFormValues>(
          e.data?.errors,
          setError,
          FIELD_MAP,
        );
      },
    });
  };

  const submitButtonDisabled = !isDirty || updateProfile.isPending;

  if (isLoading && !profile) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingHorizontal: theme.spacing.lg,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            onPress={router.back}
            style={styles.headerBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={theme.colors.textPrimary}
            />
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <Text
            style={{ color: theme.colors.textSecondary, textAlign: "center" }}
          >
            {isError
              ? "Could not load your profile. Try again later."
              : "Unable to load profile."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 24}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,

            paddingBottom: theme.spacing.xl + insets.bottom,
            gap: theme.spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              onPress={router.back}
              style={styles.headerBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
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
              accessibilityRole="button"
              accessibilityLabel="Save profile"
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

          <View style={styles.avatarSection}>
            {profile.avatar ? (
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
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                  { borderColor: theme.colors.border },
                ]}
              >
                <Ionicons
                  name="person"
                  size={48}
                  color={theme.colors.textSecondary}
                />
              </View>
            )}

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

            <FormInput
              control={control}
              name="birthdate"
              label="Birth date"
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
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerBack: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
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
    avatarPlaceholder: {
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    card: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      gap: 16,
    },
  });
