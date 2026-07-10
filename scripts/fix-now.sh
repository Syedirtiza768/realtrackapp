#!/bin/bash
set -e

TOKEN=$(curl -sf -X POST http://localhost:4191/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@realtrack.local","password":"ChangeMe123!"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

echo "Token: ${TOKEN:0:20}..."

echo "Calling fix endpoint..."
curl -v -X POST http://localhost:4191/api/catalog-products/fix-condition-titles \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"pipelineJobId":"1c3a0f2a-064c-4d86-8c37-c31f60ffd272"}' 2>&1

echo ""
echo "Done."
