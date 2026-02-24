import { apiClient } from "@/src/services/api/api.client";
import {
  CountriesResponse,
  GendersResponse,
  PossibleErrorResponse,
  ProfileResponse,
  UpdateAvatarRequest,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "@/src/services/api/api.types";
import {
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
