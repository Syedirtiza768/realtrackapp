INSERT INTO ebay_categories (
  ebay_category_id,
  tree_id,
  parent_category_id,
  category_name,
  category_path,
  depth,
  is_leaf,
  required_aspects,
  recommended_aspects,
  supports_compatibility,
  created_at,
  updated_at
)
SELECT
  m."ebayCategoryId",
  '0',
  m."parentCategoryId",
  m."ebayCategoryName",
  CASE
    WHEN m."parentCategoryName" IS NOT NULL AND m."parentCategoryName" <> ''
      THEN m."parentCategoryName" || ' > ' || m."ebayCategoryName"
    ELSE m."ebayCategoryName"
  END,
  2,
  true,
  '[]'::jsonb,
  '[]'::jsonb,
  COALESCE(m."supportsCompatibility", false),
  NOW(),
  NOW()
FROM ebay_category_mappings m
WHERE m.active = true
ON CONFLICT (ebay_category_id, tree_id) DO UPDATE SET
  category_name = EXCLUDED.category_name,
  category_path = EXCLUDED.category_path,
  is_leaf = EXCLUDED.is_leaf,
  supports_compatibility = EXCLUDED.supports_compatibility,
  updated_at = NOW();
