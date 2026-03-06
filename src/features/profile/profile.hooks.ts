import { queryClient } from "@/src/lib/query-client";
import { apiClient } from "@/src/services/api/api.client";
import {
  CountriesResponse,
  FollowersResponse,
  FollowingResponse,
  FollowUserResponse,
  GendersResponse,
  PossibleErrorResponse,
  ProfileResponse,
  TUserProfileResponse,
  UpdateAvatarRequest,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "@/src/services/api/api.types";
import { getNextButtonStatus } from "@/src/utils/helpers";
import {
  useInfiniteQuery,
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";

export const useGetProfile = (): UseQueryResult<
  ProfileResponse,
  PossibleErrorResponse
> => {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiClient.get("/auth/me").then((d) => d.data),
    staleTime: 1000 * 60 * 10, //10 min
    meta: {
      persist: true,
    },
  });
};

export const useGetProfileByUsername = (username: string): UseQueryResult<
  TUserProfileResponse,
  PossibleErrorResponse
> => {
  return useQuery({
    queryKey: ["profile", username],
    queryFn: () => apiClient.get(`/users/${username}`).then((d) => d.data),
    staleTime: 1000 * 60 * 10, //10 min
    enabled: !!username,
  });
};

export const useGetGenders = (): UseQueryResult<
  GendersResponse,
  PossibleErrorResponse
> => {
  return useQuery({
    queryKey: ["genders"],
    queryFn: () => apiClient.get("/profile/genders").then((d) => d.data),
    staleTime: Infinity,
  });
};

export const useGetCountries = (): UseQueryResult<
  CountriesResponse,
  PossibleErrorResponse
> => {
  return useQuery({
    queryKey: ["countries"],
    queryFn: () => apiClient.get("/profile/countries").then((d) => d.data),
    staleTime: Infinity,
  });
};

export const useUpdateProfile = (): UseMutationResult<
  UpdateProfileResponse,
  PossibleErrorResponse,
  UpdateProfileRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (d) => apiClient.put("/profile", d).then((d) => d.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

export const useUpdateAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: UpdateAvatarRequest) => {
      const formData = new FormData();
      formData.append("file", file as any);

      return apiClient
        .post("/profile/assets/avatar", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((d) => d.data);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

export const useDeleteAvatar = (): UseMutationResult => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient.delete("/profile/assets/avatar").then((d) => d.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};


export const useGetFollowersQuery = (username: string, enabled: boolean) => {
  return useInfiniteQuery({
    queryKey: ["followers", username],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await apiClient.get<FollowersResponse>(
        `users/${username}/followers`,
        {
          params: { page: pageParam },
        }
      );

      return data;
    },

    initialPageParam: 1,

    getNextPageParam: (lastPage) => {
      if (lastPage.data.pagination.has_more) {
        return lastPage.data.pagination.current_page + 1;
      }
      return undefined;
    },
  });
};

export const useGetFollowingQuery = (username: string, enabled: boolean) => {
  return useInfiniteQuery({
    queryKey: ["following", username],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await apiClient.get<FollowingResponse>(
        `users/${username}/following`,
        {
          params: { page: pageParam },
        }
      );

      return data;
    },

    initialPageParam: 1,

    getNextPageParam: (lastPage) => {
      if (lastPage.data.pagination.has_more) {
        return lastPage.data.pagination.current_page + 1;
      }
      return undefined;
    },
  });
};

export const useFollowToggleMutation = () => {
  return useMutation<FollowUserResponse, Error, string, {
    previousProfile?: TUserProfileResponse;
  }>({
    mutationFn: (username) =>
      apiClient
        .post<FollowUserResponse>(`/users/${username}/follow`)
        .then((d) => d.data),

    onMutate: (username) => {
      queryClient.cancelQueries({ queryKey: ["profile", username] });
      const previousProfile = queryClient.getQueryData<TUserProfileResponse>([
        "profile",
        username,
      ]);

      queryClient.setQueryData(["profile", username], (prev: TUserProfileResponse) => {
        if (!prev) return prev;
        const currentFollowStatus = prev.data.viewer.follow_status
        const isOpenProfile = prev.data.open_profile

        const newFollowStatus = getNextButtonStatus(isOpenProfile, currentFollowStatus)

        return {
          ...prev,
          data: {
            ...prev.data,
            viewer: {
              ...prev.data.viewer,
              follow_status: newFollowStatus,
            }
          }
        }
      });

      return { previousProfile };
    },
    onError: (err, username, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(
          ["profile", username],
          context?.previousProfile
        );
      }
    },

    onSuccess: (data, username) => {
      // ✅ Full intellisense here
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
      queryClient.invalidateQueries({ queryKey: ["profile", username] });
    },
  });
};