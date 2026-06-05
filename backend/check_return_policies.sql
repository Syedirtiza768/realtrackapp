SELECT ebp.policy_type, ebp.marketplace_id, ebp.ebay_policy_id, ebp.name, ebp.is_default,
       ebp.raw_payload
FROM ebay_business_policies ebp
JOIN connected_ebay_accounts cea ON cea.id = ebp.ebay_account_id
WHERE cea.primary_store_id = 'aae79700-d256-4791-91a6-61b881a32fc8'
  AND ebp.policy_type = 'return'
ORDER BY ebp.is_default DESC, ebp.name;
