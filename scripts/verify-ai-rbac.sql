SELECT r.slug, p.key
FROM roles r
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions p ON p.id = rp."permissionId"
WHERE p.key LIKE 'ai.routing%'
ORDER BY r.slug, p.key;
