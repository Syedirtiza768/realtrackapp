export declare const PIPELINE_CONDITION_OPTIONS: Record<string, string>;
export type PipelineDisplayStatus = 'queued' | 'processing' | 'uploaded' | 'failed';
export declare function mapPipelineDisplayStatus(status: string): PipelineDisplayStatus;
