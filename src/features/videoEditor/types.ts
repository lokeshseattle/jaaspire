// src/features/videoEditor/types.ts

export interface TrimRange {
    startTime: number; // in milliseconds
    endTime: number;   // in milliseconds
}

export interface VideoEditorResult {
    uri: string;
    startTime: number;
    endTime: number;
    duration: number;
}

export interface TrimmerDimensions {
    width: number;
    handleWidth: number;
    minTrimDuration: number;
}

export interface VideoEditorProps {
    videoUri: string;
    onConfirm: (result: VideoEditorResult) => void;
    onCancel: () => void;
}

// For future thumbnail support
export interface ThumbnailFrame {
    time: number;
    uri: string;
}

export type DragContext = 'left' | 'right' | 'middle';

export type ChunkUploadResponse = {
    success: boolean
    message: string
    chunkIndex: number
    totalChunks: number
    chunkSize: number
}
export type UploadVideoRequest = {
    uri: string;
    videoUID: string;
    fileName: string;
    onProgress?: (progress: number) => void;
};
