// upload/readChunk.ts

import { apiClient } from "@/src/services/api/api.client";
import { ChunkUploadResponse } from "../videoEditor/types";
const createChunks = async (uri: string, chunkSize = 2 * 1024 * 1024) => {
    const response = await fetch(uri);
    const blob = await response.blob();

    const chunks: Blob[] = [];

    for (let start = 0; start < blob.size; start += chunkSize) {
        chunks.push(blob.slice(start, start + chunkSize));
    }

    return chunks;
};


export const uploadChunk = async ({
    chunk,
    chunkIndex,
    totalChunks,
    videoUID,
    fileName,
}: {
    chunk: Blob;
    chunkIndex: number;
    totalChunks: number;
    videoUID: string;
    fileName: string;
}) => {
    const form = new FormData();

    await FileSystem

    form.append("chunk", chunk, `chunk_${chunkIndex}`);
    form.append("chunkIndex", String(chunkIndex));
    form.append("totalChunks", String(totalChunks));
    form.append("videoUID", videoUID);
    form.append("fileName", fileName);

    const { data } = await apiClient.post<ChunkUploadResponse>(
        "/stories/upload-chunk",
        form
    );
    return data;
};

export const uploadVideo = async ({
    uri,
    videoUID,
    fileName,
    onProgress,
}: {
    uri: string;
    videoUID: string;
    fileName: string;
    onProgress?: (progress: number) => void;
}) => {
    const chunks = await createChunks(uri);

    const totalChunks = chunks.length;
    let lastResponse: ChunkUploadResponse | undefined;

    for (let i = 0; i < chunks.length; i++) {
        lastResponse = await uploadChunk({
            chunk: chunks[i],
            chunkIndex: i,
            totalChunks,
            videoUID,
            fileName,
        });

        onProgress?.((i + 1) / totalChunks);
    }

    if (!lastResponse) {
        throw new Error("Failed to upload video: No chunks created");
    }

    return lastResponse;
};