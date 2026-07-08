/** Upload-level condition labels → eBay condition IDs */
export const PIPELINE_CONDITION_OPTIONS: Record<string, string> = {
  Used: '3000',
  New: '1000',
  Refurbished: '2500',
};

export type PipelineDisplayStatus =
  | 'queued'
  | 'processing'
  | 'uploaded'
  | 'failed';

export function mapPipelineDisplayStatus(
  status: string,
): PipelineDisplayStatus {
  if (status === 'pending') return 'queued';
  if (status === 'completed') return 'uploaded';
  if (status === 'failed' || status === 'cancelled') return 'failed';
  return 'processing';
}
