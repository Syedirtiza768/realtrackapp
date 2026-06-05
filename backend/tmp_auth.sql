SELECT cea.id, cea.sellerpundit_account_name, cea.sellerpundit_token_id,
       cea.connection_status, cea.last_token_refresh_at, cea.last_error_message,
       eot.access_token_expires_at, eot.last_refreshed_at, eot.reconnect_required,
       s.id as store_id, s.store_name,
       length(eot.access_token_encrypted) as token_cipher_len
FROM connected_ebay_accounts cea
LEFT JOIN ebay_oauth_tokens eot ON eot.ebay_account_id = cea.id
LEFT JOIN stores s ON s.id = cea.primary_store_id
WHERE s.store_name ILIKE '%All About Mercedes%';
