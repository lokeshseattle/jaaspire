// hooks/useVideoUpload.ts
import { queryClient } from '@/src/lib/query-client';
import { apiClient } from '@/src/services/api/api.client';
import { CreateStoryResponse, PossibleErrorResponse, StoryTrimResult } from '@/src/services/api/api.types';
import { useMutation, UseMutationResult, useMutationState } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

// ✅ Separate keys for different flows
export const VIDEO_UPLOAD_KEY = ['video-upload'];
export const STORY_UPLOAD_KEY = ['story-upload'];
export const POST_UPLOAD_KEY = ['post-upload'];

export interface MergeChunksResponse {
    success: boolean;
    message: string;
    mergedFile: string;
    videoUID: string;
    totalSize: number;
    isComplete?: boolean;
}

// ✅ Reusable upload function (not a hook)
export async function uploadVideoInChunks(
    fileUri: string,
    fileName: string,
): Promise<MergeChunksResponse> {
    const file = new File(fileUri);
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let isComplete = false;
    const handle = file.open();

    try {
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const length = Math.min(CHUNK_SIZE, totalSize - start);

            handle.offset = start;
            const bytes = handle.readBytes(length);

            const tempFile = new File(Paths.cache, `chunk_${i}_${uploadId}.bin`);
            tempFile.write(bytes);

            const formData = new FormData();
            formData.append('chunk', {
                uri: tempFile.uri,
                name: fileName,
                type: 'application/octet-stream',
            } as any);
            formData.append('chunkIndex', String(i));
            formData.append('totalChunks', String(totalChunks));
            formData.append('videoUID', uploadId);
            formData.append('fileName', fileName);

            await apiClient.post('/stories/upload-chunk', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            tempFile.delete();
        }
    } finally {
        handle.close();
    }

    const finalizeRes = await apiClient.post('/stories/merge-chunks', {
        videoUID: uploadId,
        fileName,
    });

    isComplete = true;
    console.log(isComplete, finalizeRes.data);

    return { ...finalizeRes.data, isComplete };
}

// ✅ Basic upload hook (if you ever need just upload without create)
export function useVideoUpload(): UseMutationResult<
    MergeChunksResponse,
    PossibleErrorResponse,
    { fileUri: string; fileName: string },
    unknown
> {
    return useMutation({
        mutationKey: VIDEO_UPLOAD_KEY,
        mutationFn: ({ fileUri, fileName }) => uploadVideoInChunks(fileUri, fileName),
    });
}

// ============================================
// STORY
// ============================================

interface UploadAndCreateStoryParams {
    fileUri: string;
    fileName: string;
    trimVideoData: string
}

interface UploadAndCreateStoryResponse extends MergeChunksResponse {
    story: StoryTrimResult;
}

export function useUploadAndCreateStory(): UseMutationResult<
    UploadAndCreateStoryResponse,
    PossibleErrorResponse,
    UploadAndCreateStoryParams,
    unknown
> {
    return useMutation({
        mutationKey: STORY_UPLOAD_KEY,
        mutationFn: async ({ fileUri, fileName, trimVideoData }) => {
            // Step 1: Reusable upload
            const mergeResult = await uploadVideoInChunks(fileUri, fileName);

            // Step 2: Create story
            const { data } = await apiClient.post<CreateStoryResponse>('/stories/create-chunk-story', {
                videoUID: mergeResult.videoUID,
                fileName: mergeResult.mergedFile,
                trimVideoData
            });

            return {
                ...mergeResult,
                story: data.trimResult,
            };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["all_stories"] })
        }
    });
}

export function useIsStoryUploading(): boolean {
    const mutations = useMutationState({
        filters: { mutationKey: STORY_UPLOAD_KEY, status: 'pending' },
        select: (mutation) => mutation.state.status,
    });
    return mutations.length > 0;
}

// ============================================
// POST (for future use)
// ============================================

interface UploadAndCreatePostParams {
    fileUri: string;
    fileName: string;
    caption?: string;
    // Add other post-specific fields
}

interface UploadAndCreatePostResponse extends MergeChunksResponse {
    post: any; // Replace with your Post type
}

export function useUploadAndCreatePost(): UseMutationResult<
    UploadAndCreatePostResponse,
    PossibleErrorResponse,
    UploadAndCreatePostParams,
    unknown
> {
    return useMutation({
        mutationKey: POST_UPLOAD_KEY,
        mutationFn: async ({ fileUri, fileName, caption }) => {
            // Step 1: Reusable upload
            const mergeResult = await uploadVideoInChunks(fileUri, fileName);

            // Step 2: Create post
            const { data } = await apiClient.post('/posts/create', {
                videoUID: mergeResult.videoUID,
                fileName: mergeResult.mergedFile,
                caption,
            });

            return {
                ...mergeResult,
                post: data,
            };
        },
    });
}

export function useIsPostUploading(): boolean {
    const mutations = useMutationState({
        filters: { mutationKey: POST_UPLOAD_KEY, status: 'pending' },
        select: (mutation) => mutation.state.status,
    });
    return mutations.length > 0;
}

// ============================================
// Combined check (any upload in progress)
// ============================================

export function useIsAnyUploadInProgress(): boolean {
    const storyUploading = useIsStoryUploading();
    const postUploading = useIsPostUploading();
    return storyUploading || postUploading;
}