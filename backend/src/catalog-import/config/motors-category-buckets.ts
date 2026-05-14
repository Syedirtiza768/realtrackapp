/**
 * Maps logical “super-categories” to eBay category IDs from your catalog.
 * Empty arrays = filter disabled until ops fills IDs (no guessing from titles).
 */
export const MOTORS_CATEGORY_BUCKETS: Record<string, readonly string[]> = {
  vehicle_body: [],
  lighting: [],
  interior: [],
  mechanical: [],
  electrical: [],
  brake: [],
  suspension: [],
};

export type MotorsCategoryBucket = keyof typeof MOTORS_CATEGORY_BUCKETS;
