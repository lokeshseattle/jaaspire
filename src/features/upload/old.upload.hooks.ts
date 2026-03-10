// hooks/useVideoUpload.ts
// import { apiClient } from '@/src/services/api/api.client';
// import { CreateStoryResponse, PossibleErrorResponse, StoryTrimResult } from '@/src/services/api/api.types';
// import { useMutation, UseMutationResult } from '@tanstack/react-query';

// const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

// interface MergeChunksResponse {
//     success: boolean;
//     message: string;
//     mergedFile: string;
//     videoUID: string;
//     totalSize: number;
//     isComplete?: boolean
// }

// type UseVideoUploadReturn = UseMutationResult<
//     MergeChunksResponse,
//     PossibleErrorResponse,
//     any,
//     unknown
// >;

// async function uploadChunk({
//     fileUri,
//     chunk,
//     chunkIndex,
//     totalChunks,
//     uploadId,
//     fileName,
// }: {
//     fileUri: string;
//     chunk: Blob;
//     chunkIndex: number;
//     totalChunks: number;
//     uploadId: string;
//     fileName: string;
// }) {
//     const formData = new FormData();
//     formData.append('chunk', chunk, fileUri);
//     formData.append('chunkIndex', String(chunkIndex));
//     formData.append('totalChunks', String(totalChunks));
//     formData.append('videoUID', uploadId);
//     formData.append('fileName', fileName);

//     return apiClient.post('/stories/upload-chunk', formData, {
//         headers: { 'Content-Type': 'multipart/form-data' },
//     });
// }

// // async function uploadVideoInChunks(
// //     fileUri: string,
// //     fileName: string,
// //     onProgress?: (progress: number) => void
// // ) {
// //     console.log({ fileUri }, "fileUri")
// //     const file = new FileSystem.File(fileUri);
// //     // console.log({ size: file.size, exists: file.exists });
// //     const totalSize = file.size;
// //     const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

// //     console.log({ totalSize, totalChunks });
// //     const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// //     for (let i = 0; i < totalChunks; i++) {
// //         const start = i * CHUNK_SIZE;
// //         const end = Math.min(start + CHUNK_SIZE, totalSize);

// //         const info = file.info()

// //         console.log({ info }, "info");
// //         const chunk = file.slice(start, end) as unknown as Blob;

// //         console.log({ chunk }, "chunk");

// //         await uploadChunk({
// //             fileUri,
// //             chunk,
// //             chunkIndex: i,
// //             totalChunks,
// //             uploadId,
// //             fileName,
// //         });

// //         onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
// //     }

// //     const finalizeRes = await apiClient.post('/stories/merge-chunks', {
// //         videoUID: uploadId,
// //         fileName,
// //     });

// //     return finalizeRes.data;
// // }

// import { File, Paths } from 'expo-file-system';

// async function uploadVideoInChunks(
//     fileUri: string,
//     fileName: string,
//     onProgress?: (progress: number) => void
// ) {
//     const file = new File(fileUri);
//     const totalSize = file.size;
//     const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
//     const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
//     let isComplete = false
//     // Open a file handle for sequential reads
//     const handle = file.open();

//     try {
//         for (let i = 0; i < totalChunks; i++) {
//             const start = i * CHUNK_SIZE;
//             const length = Math.min(CHUNK_SIZE, totalSize - start);

//             // Seek to position and read bytes directly — no slice, no arrayBuffer
//             handle.offset = start;
//             const bytes = handle.readBytes(length);

//             // Write to temp file
//             const tempFile = new File(Paths.cache, `chunk_${i}_${uploadId}.bin`);
//             tempFile.write(bytes);

//             const formData = new FormData();
//             formData.append('chunk', {
//                 uri: tempFile.uri,
//                 name: fileName,
//                 type: 'application/octet-stream',
//             } as any);
//             formData.append('chunkIndex', String(i));
//             formData.append('totalChunks', String(totalChunks));
//             formData.append('videoUID', uploadId);
//             formData.append('fileName', fileName);

//             await apiClient.post('/stories/upload-chunk', formData, {
//                 headers: { 'Content-Type': 'multipart/form-data' },
//             });

//             tempFile.delete();

//             onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
//         }
//     } finally {
//         handle.close();
//     }

//     const finalizeRes = await apiClient.post('/stories/merge-chunks', {
//         videoUID: uploadId,
//         fileName,
//     });

//     isComplete = true

//     console.log(isComplete, finalizeRes.data)

//     return { ...finalizeRes.data, isComplete };
// }

// export function useVideoUpload(onProgress?: (progress: number) => void): UseVideoUploadReturn {
//     return useMutation({
//         mutationFn: ({
//             fileUri,
//             fileName,

//         }: {
//             fileUri: string;
//             fileName: string;
//         }) => uploadVideoInChunks(fileUri, fileName, onProgress),
//     });
// }

// export function useCreateStory(): UseMutationResult<
//     StoryTrimResult,
//     PossibleErrorResponse,
//     CreateStoryResponse
// > {
//     return useMutation({
//         mutationFn: async (d) => {
//             const { data } = await apiClient.post<CreateStoryResponse>('/stories/create-chunk-story', d)
//             return data.trimResult
//         }
//     });
// }



// ============================================================


// hooks/useVideoUpload.ts
import { apiClient } from '@/src/services/api/api.client';
import { CreateStoryResponse, PossibleErrorResponse, StoryTrimResult } from '@/src/services/api/api.types';
import { useMutation, UseMutationResult, useMutationState } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

// ✅ Unique key for tracking this mutation globally
export const VIDEO_UPLOAD_KEY = ['video-upload'];

interface MergeChunksResponse {
    success: boolean;
    message: string;
    mergedFile: string;
    videoUID: string;
    totalSize: number;
    isComplete?: boolean
}

type UseVideoUploadReturn = UseMutationResult<
    MergeChunksResponse,
    PossibleErrorResponse,
    any,
    unknown
>;

async function uploadVideoInChunks(
    fileUri: string,
    fileName: string,
) {
    const file = new File(fileUri);
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let isComplete = false
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

    isComplete = true

    console.log(isComplete, finalizeRes.data)

    return { ...finalizeRes.data, isComplete };
}

export function useVideoUpload(): UseVideoUploadReturn {
    return useMutation({
        mutationKey: VIDEO_UPLOAD_KEY,  // ✅ Add this
        mutationFn: ({
            fileUri,
            fileName,
        }: {
            fileUri: string;
            fileName: string;
        }) => uploadVideoInChunks(fileUri, fileName),
    });
}

// ✅ New hook - use this anywhere to check if upload is in progress
export function useIsVideoUploading(): boolean {
    const mutations = useMutationState({
        filters: { mutationKey: VIDEO_UPLOAD_KEY, status: 'pending' },
        select: (mutation) => mutation.state.status,
    });

    return mutations.length > 0;
}

export function useCreateStory(): UseMutationResult<
    StoryTrimResult,
    PossibleErrorResponse,
    CreateStoryResponse
> {
    return useMutation({
        mutationFn: async (d) => {
            const { data } = await apiClient.post<CreateStoryResponse>('/stories/create-chunk-story', d)
            return data.trimResult
        }
    });
}