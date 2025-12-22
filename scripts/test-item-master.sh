#!/bin/bash

# Test Item Master API
# Usage: ./test-item-master.sh <super_admin_token>

TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo "Usage: ./test-item-master.sh <super_admin_token>"
  exit 1
fi

BASE_URL="http://localhost:3000"

echo "=== Testing Item Master API ==="
echo ""

# 1. Create Item without assets
echo "1. Creating item without assets..."
curl -X POST "$BASE_URL/item-master" \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Test Product" \
  -F "unit=kg" \
  -F "qty=100" \
  -F "rate=50.5"
echo -e "\n"

# 2. Get all items
echo "2. Getting all items..."
curl -X GET "$BASE_URL/item-master" \
  -H "Authorization: Bearer $TOKEN"
echo -e "\n"

# 3. Get item by ID
echo "3. Getting item by ID (1)..."
curl -X GET "$BASE_URL/item-master/1" \
  -H "Authorization: Bearer $TOKEN"
echo -e "\n"

# 4. Update item
echo "4. Updating item..."
curl -X PATCH "$BASE_URL/item-master/1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Updated Product" \
  -F "qty=150"
echo -e "\n"

# 5. Delete item
echo "5. Deleting item..."
curl -X DELETE "$BASE_URL/item-master/1" \
  -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "=== Tests completed ==="
