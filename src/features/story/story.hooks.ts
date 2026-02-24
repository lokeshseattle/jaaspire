import { apiClient } from "@/src/services/api/api.client";
import {
  PossibleErrorResponse,
  StoriesResponse,
  StoryByUsernameResponse,
  StoryImageUpload,
  StoryViewersResponse,
} from "@/src/services/api/api.types";
import {
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { ImagePickerAsset } from "expo-image-picker";

export const useGetStoryByUsername = (
  username: string,
): UseQueryResult<StoryByUsernameResponse["data"], PossibleErrorResponse> => {
  return useQuery({
    queryKey: ["story", username],
    queryFn: () =>
      apiClient.get(`/users/${username}/stories`).then((s) => s.data.data),
    enabled: !!username,
    staleTime: 0,
  });
};

export const useGetAllStories = (): UseQueryResult<
  StoriesResponse,
  PossibleErrorResponse
> => {
  return useQuery({
    queryKey: ["all_stories"],
    queryFn: () => apiClient.get(`/stories`).then((d) => d.data),
    staleTime: 0,
    meta: {
      persist: true,
    },
  });
};

export const useDeleteStory = (): UseMutationResult<
  null,
  PossibleErrorResponse,
  { id: number }
> => {
  return useMutation({
    mutationFn: (payload) =>
      apiClient.delete(`/stories/${payload.id}`).then((d) => d.data),
  });
};

export const useGetStoryViewers = (
  id: number,
): UseQueryResult<StoryViewersResponse, PossibleErrorResponse> => {
  return useQuery({
    queryKey: ["story_viewers", id],
    queryFn: () => apiClient.get(`stories/${id}/viewers`).then((d) => d.data),
    enabled: !!id,
    staleTime: 0,
  });
};

export const usePostStoryImage = (): UseMutationResult<
  StoryImageUpload,
  PossibleErrorResponse,
  ImagePickerAsset
> => {
  return useMutation({
    mutationFn: async (image: ImagePickerAsset) => {
      const formData = new FormData();

      formData.append("file", {
        uri: image.uri,
        name: image.fileName ?? "photo.jpg",
        type: image.mimeType ?? "image/jpeg",
      } as any);
      const { data } = await apiClient.post("/stories", image);
      return data;
    },
  });
};
