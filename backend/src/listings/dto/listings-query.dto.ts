export class ListingsQueryDto {
  limit?: number;
  offset?: number;
  search?: string;
  sku?: string;
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  cType?: string;
  conditionId?: string;
  sourceFile?: string;
  hasImage?: string; // '1' = only with images
}
