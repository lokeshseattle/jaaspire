import { queryClient } from "@/src/lib/query-client";
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
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["story"] });
    },
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
  { uri: string }
> => {
  return useMutation({
    mutationFn: async (image: { uri: string }) => {
      const formData = new FormData();

      formData.append("file", {
        uri: image.uri,
        name: "photo.png",
        type: "image/png",
      } as any);
      const { data } = await apiClient.post("/stories", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return data;
    },
  });
};
