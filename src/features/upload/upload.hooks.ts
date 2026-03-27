// hooks/useVideoUpload.ts
import { queryClient } from "@/src/lib/query-client";
import { apiClient } from "@/src/services/api/api.client";
import {
  CreateStoryResponse,
  PossibleErrorResponse,
  StoryTrimResult,
} from "@/src/services/api/api.types";
import {
  useMutation,
  UseMutationResult,
  useMutationState,
} from "@tanstack/react-query";
import { File, Paths } from "expo-file-system/next";

const CHUNK_SIZE = 4 * 1024 * 1024; // 5MB per chunk

// Dynamic chunk size for post video uploads (2 MB–30 MB)
const MIN_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_BYTES = 30 * 1024 * 1024;
const TARGET_CHUNKS = 10;

function getDynamicChunkSize(totalSize: number): number {
  return Math.min(
    MAX_CHUNK_BYTES,
    Math.max(MIN_CHUNK_BYTES, Math.ceil(totalSize / TARGET_CHUNKS)),
  );
}

// import mime from 'mime';

// ✅ Separate keys for different flows
export const VIDEO_UPLOAD_KEY = ["video-upload"];
export const STORY_UPLOAD_KEY = ["story-upload"];
export const POST_UPLOAD_KEY = ["post-upload"];
// const API_BASE_URL = "https://stgx.jaaspire.com/api/v1";
// const MAX_RETRIES = 3;
export interface MergeChunksResponse {
  success: boolean;
  message: string;
  mergedFile: string;
  videoUID: string;
  totalSize: number;
  isComplete?: boolean;
}

export interface UploadPostChunkResponse {
  success: boolean;
  merged_path: string;
  file_id: string;
  original_name: string;
}

export interface ProcessUploadResponse {
  success: boolean;
  isVideo: boolean;
  attachmentID: string;
  path: string;
  type: string;
  thumbnail?: string;
  preview_url?: string;
}

/** Response from POST /attachments/upload (single image file) */
export interface UploadImageAttachmentResponse {
  success: boolean;
  attachmentID: string;
  path: string;
  original_name: string;
  trimVideo: string;
  type: string;
  thumbnail?: string;
  coconut_id: string | null;
  has_thumbnail: number;
}

export interface CreatePostRequest {
  text: string;
  price: number;
  is_exclusive: boolean;
  attachments: string[];
}

export interface CreatePostResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    status: number;
    status_label: string;
    created_at: string;
  };
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
      formData.append("chunk", {
        uri: tempFile.uri,
        name: fileName,
        type: "application/octet-stream",
      } as any);
      formData.append("chunkIndex", String(i));
      formData.append("totalChunks", String(totalChunks));
      formData.append("videoUID", uploadId);
      formData.append("fileName", fileName);

      await apiClient.post("/stories/upload-chunk", formData);

      tempFile.delete();
    }
  } catch (error) {
    console.error("Error uploading video in chunks", error);
    throw error;
  } finally {
    handle.close();
  }

  const finalizeRes = await apiClient.post("/stories/merge-chunks", {
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
    mutationFn: ({ fileUri, fileName }) =>
      uploadVideoInChunks(fileUri, fileName),
  });
}

// ============================================
// STORY
// ============================================

interface UploadAndCreateStoryParams {
  fileUri: string;
  fileName: string;
  trimVideoData: string;
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
      const { data } = await apiClient.post<CreateStoryResponse>(
        "/stories/create-chunk-story",
        {
          videoUID: mergeResult.videoUID,
          fileName: mergeResult.mergedFile,
          trimVideoData,
        },
      );

      return {
        ...mergeResult,
        story: data.trimResult,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_stories"] });
    },
  });
}

export function useIsStoryUploading(): boolean {
  const mutations = useMutationState({
    filters: { mutationKey: STORY_UPLOAD_KEY, status: "pending" },
    select: (mutation) => mutation.state.status,
  });
  return mutations.length > 0;
}

// ============================================
// POST (for future use)
// ============================================

interface UploadAndCreatePostParams {
  /**
   * Backward-compatible single attachment input (current UI).
   * Prefer `attachments` for future multi-attachment posts.
   */
  fileUri: string;
  fileName: string;

  /**
   * Future-proof: multiple attachments (processed sequentially).
   * When provided, `fileUri/fileName/selectedThumbnailFile` are ignored.
   */
  attachments?: Array<{
    fileUri: string;
    fileName: string;
    previewDuration?: number;
    selectedThumbnailFile: { uri: string; name: string; type: string };
  }>;
  text: string;
  price: number;
  is_exclusive: boolean;
  previewDuration?: number;
  selectedThumbnailFile: { uri: string; name: string; type: string };
  /** Called with 0–1 during chunked upload. Optional. */
  onProgress?: (progress: number) => void;
}

// export async function uploadVideoPostInChunks(
//   fileUri: string,
//   fileName: string,
// ): Promise<UploadPostChunkResponse> {
//   const file = new File(fileUri);
//   const totalSize = file.size;
//   const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
//   const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
//   let isComplete = false;
//   const handle = file.open();

//   console.log("formData398");

//   try {
//     for (let i = 1; i <= totalChunks; i++) {
//       // Fixed: Use (i - 1) to calculate the correct byte offset
//       const start = (i - 1) * CHUNK_SIZE;
//       const length = Math.min(CHUNK_SIZE, totalSize - start);

//       handle.offset = start;
//       const bytes = handle.readBytes(length);

//       const tempFile = new File(Paths.cache, `chunk_${i}_${uploadId}.bin`);

//       tempFile.write(bytes);

//       console.log("tempFile", tempFile);
//       //   const fileUri =
//       //     Platform.OS === "ios"
//       //       ? tempFile.uri.replace("file://", "")
//       //       : tempFile.uri;
//       const formData = new FormData();
//       formData.append("file", {
//         uri: tempFile.uri,
//         name: fileName,
//         type: "application/octet-stream",
//       } as any);
//       formData.append("chunk_index", String(i)); // Sends 1, 2, 3, ...
//       formData.append("total_chunks", String(totalChunks));
//       formData.append("file_id", uploadId);
//       formData.append("original_name", fileName);

//       await apiClient.post("/attachments/upload-chunk", formData);

//       tempFile.delete();
//     }
//   } finally {
//     handle.close();
//   }

//   const finalizeRes = await apiClient.post("/attachments/merge-chunks", {
//     file_id: uploadId,
//     original_name: fileName,
//     total_chunks: totalChunks,
//   });

//   isComplete = true;
//   console.log(isComplete, finalizeRes.data);

//   return { ...finalizeRes.data, isComplete };
// }

export async function uploadThumbnailPostInChunks(
  fileUri: string,
  fileName: string,
): Promise<UploadPostChunkResponse> {
  // Uses the same chunked attachment endpoints as video uploads.
  const file = new File(fileUri);
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  const uploadId = `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let isComplete = false;
  const handle = file.open();

  try {
    for (let i = 1; i <= totalChunks; i++) {
      const start = (i - 1) * CHUNK_SIZE;
      const length = Math.min(CHUNK_SIZE, totalSize - start);

      handle.offset = start;
      const bytes = handle.readBytes(length);

      const tempFile = new File(
        Paths.cache,
        `thumb_chunk_${i}_${uploadId}.bin`,
      );
      tempFile.write(bytes);

      const formData = new FormData();
      formData.append("file", {
        uri: tempFile.uri,
        name: fileName,
        type: "application/octet-stream",
      } as any);
      formData.append("chunk_index", String(i));
      formData.append("total_chunks", String(totalChunks));
      formData.append("file_id", uploadId);
      formData.append("original_name", fileName);

      await apiClient.post("/attachments/upload-chunk", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      tempFile.delete();
    }
  } finally {
    handle.close();
  }

  const finalizeRes = await apiClient.post("/attachments/merge-chunks", {
    file_id: uploadId,
    original_name: fileName,
    total_chunks: totalChunks,
  });

  isComplete = true;
  console.log(isComplete, finalizeRes.data);

  return { ...finalizeRes.data, isComplete };
}

interface UploadAndCreatePostResponse {
  merged: UploadPostChunkResponse & { isComplete?: boolean };
  processed: ProcessUploadResponse;
  post: CreatePostResponse["data"];
}

async function processUploadedAttachment(params: {
  file_id: string;
  original_name: string;
  previewDuration: number;
  type: "post";
  selectedThumbnailFile: { uri: string; name: string; type: string };
}): Promise<ProcessUploadResponse> {
  const formData = new FormData();
  formData.append("file_id", params.file_id);
  formData.append("original_name", params.original_name);
  formData.append("previewDuration", String(params.previewDuration));
  formData.append("type", params.type);
  formData.append("selectedThumbnailFile", {
    uri: params.selectedThumbnailFile.uri,
    name: params.selectedThumbnailFile.name,
    type: params.selectedThumbnailFile.type,
  } as any);

  const { data } = await apiClient.post<ProcessUploadResponse>(
    "/attachments/process-upload",
    formData,
  );
  return data;
}

async function createPost(
  payload: CreatePostRequest,
): Promise<CreatePostResponse> {
  const { data } = await apiClient.post<CreatePostResponse>("/posts", payload);
  return data;
}

export async function uploadImageAttachment(
  fileUri: string,
  fileName: string,
  fileType: string,
): Promise<UploadImageAttachmentResponse> {
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: fileType,
  } as any);

  const { data } = await apiClient.post<UploadImageAttachmentResponse>(
    "/attachments/upload",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export function useUploadImageAndCreatePost(): UseMutationResult<
  { attachment: UploadImageAttachmentResponse; post: CreatePostResponse["data"] },
  PossibleErrorResponse,
  {
    fileUri: string;
    fileName: string;
    fileType: string;
    text: string;
    price: number;
    is_exclusive: boolean;
  },
  unknown
> {
  return useMutation({
    mutationKey: POST_UPLOAD_KEY,
    mutationFn: async ({
      fileUri,
      fileName,
      fileType,
      text,
      price,
      is_exclusive,
    }) => {
      const attachment = await uploadImageAttachment(
        fileUri,
        fileName,
        fileType,
      );
      const postRes = await createPost({
        text,
        price,
        is_exclusive,
        attachments: [attachment.attachmentID],
      });
      return { attachment, post: postRes.data };
    },
  });
}

export async function uploadAndProcessPostAttachment(params: {
  fileUri: string;
  fileName: string;
  previewDuration?: number;
  selectedThumbnailFile: { uri: string; name: string; type: string };
  onProgress?: (progress: number) => void;
}): Promise<{
  merged: UploadPostChunkResponse & { isComplete?: boolean };
  processed: ProcessUploadResponse;
}> {
  const merged = await uploadVideoPostInChunks(
    params.fileUri,
    params.fileName,
    params.onProgress,
  );
  const processed = await processUploadedAttachment({
    file_id: merged.file_id,
    original_name: merged.original_name,
    previewDuration: params.previewDuration ?? 6,
    type: "post",
    selectedThumbnailFile: params.selectedThumbnailFile,
  });
  return { merged, processed };
}

export function useUploadAndCreatePost(): UseMutationResult<
  UploadAndCreatePostResponse,
  PossibleErrorResponse,
  UploadAndCreatePostParams,
  unknown
> {
  return useMutation({
    mutationKey: POST_UPLOAD_KEY,
    mutationFn: async ({
      fileUri,
      fileName,
      attachments,
      text,
      price,
      is_exclusive,
      previewDuration = 6,
      selectedThumbnailFile,
      onProgress,
    }) => {
      const attachmentInputs =
        attachments && attachments.length > 0
          ? attachments
          : [
              {
                fileUri,
                fileName,
                previewDuration,
                selectedThumbnailFile,
              },
            ];

      // Step 1-3 per attachment (sequential; safer on mobile)
      const processedAttachments: Array<{
        merged: UploadPostChunkResponse & { isComplete?: boolean };
        processed: ProcessUploadResponse;
      }> = [];

      const totalAttachments = attachmentInputs.length;
      for (let idx = 0; idx < totalAttachments; idx++) {
        const a = attachmentInputs[idx];
        const attachmentProgress =
          totalAttachments > 1
            ? (p: number) =>
                onProgress?.((idx + p) / totalAttachments)
            : onProgress;
        processedAttachments.push(
          await uploadAndProcessPostAttachment({
            fileUri: a.fileUri,
            fileName: a.fileName,
            previewDuration: a.previewDuration,
            selectedThumbnailFile: a.selectedThumbnailFile,
            onProgress: attachmentProgress,
          }),
        );
      }

      // Step 4: Create post
      const postRes = await createPost({
        text,
        price,
        is_exclusive,
        attachments: processedAttachments.map((x) => x.processed.attachmentID),
      });

      // Keep return shape compatible with current single-attachment UI
      const first = processedAttachments[0];
      return {
        merged: first.merged,
        processed: first.processed,
        post: postRes.data,
      };
    },
  });
}

export function useIsPostUploading(): boolean {
  const mutations = useMutationState({
    filters: { mutationKey: POST_UPLOAD_KEY, status: "pending" },
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

// ====================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY_MS,
  context: string = "operation",
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (__DEV__ && attempt > 1) {
        console.log(
          `[Upload] Retry attempt ${attempt}/${retries} for ${context}`,
        );
      }
      return await fn();
    } catch (error) {
      lastError = error;
      if (__DEV__) {
        console.warn(
          `[Upload] Attempt ${attempt}/${retries} failed for ${context}:`,
          error instanceof Error ? error.message : error,
        );
      }

      if (attempt < retries) {
        const backoffDelay = delay * Math.pow(2, attempt - 1);
        if (__DEV__) {
          console.log(`[Upload] Waiting ${backoffDelay}ms before retry...`);
        }
        await sleep(backoffDelay);
      }
    }
  }

  throw lastError;
}

export async function uploadVideoPostInChunks(
  fileUri: string,
  fileName: string,
  onProgress?: (progress: number) => void,
): Promise<UploadPostChunkResponse> {
  if (__DEV__) {
    console.log("[Upload] Starting chunked upload");
    console.log("[Upload] File URI:", fileUri);
    console.log("[Upload] File Name:", fileName);
  }

  const file = new File(fileUri);
  const totalSize = file.size;
  const chunkSize = getDynamicChunkSize(totalSize);
  const totalChunks = Math.ceil(totalSize / chunkSize);
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let isComplete = false;
  const handle = file.open();

  if (__DEV__) {
    console.log("[Upload] Total file size:", totalSize, "bytes");
    console.log("[Upload] Chunk size:", chunkSize, "bytes");
    console.log("[Upload] Total chunks:", totalChunks);
    console.log("[Upload] Upload ID:", uploadId);
  }

  try {
    for (let i = 1; i <= totalChunks; i++) {
      const start = (i - 1) * chunkSize;
      const length = Math.min(chunkSize, totalSize - start);

      if (__DEV__) {
        console.log(`[Upload] Processing chunk ${i}/${totalChunks}`);
        console.log(
          `[Upload] Chunk range: ${start} - ${start + length} (${length} bytes)`,
        );
      }

      handle.offset = start;
      const bytes = handle.readBytes(length);

      const tempFile = new File(Paths.cache, `chunk_${i}_${uploadId}.bin`);
      tempFile.write(bytes);

      if (__DEV__) {
        console.log("[Upload] Temp file created:", tempFile.uri);
      }

      const formData = new FormData();
      formData.append("file", {
        uri: tempFile.uri,
        name: fileName,
        type: "application/octet-stream",
      } as any);
      formData.append("chunk_index", String(i));
      formData.append("total_chunks", String(totalChunks));
      formData.append("file_id", uploadId);
      formData.append("original_name", fileName);

      try {
        await retryWithBackoff(
          () => apiClient.post("/attachments/upload-chunk", formData),
          MAX_RETRIES,
          RETRY_DELAY_MS,
          `chunk ${i}/${totalChunks}`,
        );

        if (__DEV__) {
          console.log(
            `[Upload] Chunk ${i}/${totalChunks} uploaded successfully`,
          );
        }
        onProgress?.(i / totalChunks);
      } finally {
        // Always clean up temp file
        if (tempFile.exists) {
          tempFile.delete();
          if (__DEV__) {
            console.log("[Upload] Temp file deleted:", tempFile.uri);
          }
        }
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[Upload] Chunk upload failed after all retries:", error);
    }
    throw error;
  } finally {
    handle.close();
    if (__DEV__) {
      console.log("[Upload] File handle closed");
    }
  }

  if (__DEV__) {
    console.log("[Upload] All chunks uploaded, finalizing...");
  }

  const finalizeRes = await retryWithBackoff(
    () =>
      apiClient.post("/attachments/merge-chunks", {
        file_id: uploadId,
        original_name: fileName,
        total_chunks: totalChunks,
      }),
    MAX_RETRIES,
    RETRY_DELAY_MS,
    "merge-chunks",
  );

  isComplete = true;

  if (__DEV__) {
    console.log("[Upload] Upload complete!");
    console.log(
      "[Upload] Response:",
      JSON.stringify(finalizeRes.data, null, 2),
    );
  }

  return { ...finalizeRes.data, isComplete };
}
