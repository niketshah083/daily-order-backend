# Item Master API Documentation

## Overview
The Item Master API allows managing items with support for image/video assets stored in S3.

## Access Control
- **List Items (GET /item-master)**: Public access (no authentication required)
- **Get Item by ID (GET /item-master/:id)**: Authenticated users only
- **Create/Update/Delete**: Accessible only by super_admin

## Entity Structure

### ItemMasterEntity
- `id`: Primary key
- `name`: Item name
- `unit`: Unit of measurement (kg, pcs, etc.)
- `qty`: Quantity (decimal)
- `rate`: Rate/Price (decimal)
- `assets`: Array of S3 file paths (stored as JSON)
- `createdAt`: Creation timestamp
- `updatedAt`: Update timestamp

## API Endpoints

### 1. Create Item (Super Admin Only)
**POST** `/item-master`

**Headers:**
```
Authorization: Bearer <super_admin_token>
Content-Type: multipart/form-data
```

**Form Data:**
```
name: Product Name
unit: kg
qty: 100
rate: 50.5
assets: [file1.jpg, file2.mp4] (optional, max 10 files)
```

**Allowed File Types:**
- Images: .jpg, .jpeg, .png
- Videos: .mp4, .avi, .mov, .mkv

**Response:**
```json
{
  "id": 1,
  "name": "Product Name",
  "unit": "kg",
  "qty": 100,
  "rate": 50.5,
  "assets": ["items/1234567890-file1.jpg", "items/1234567890-file2.mp4"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. Get All Items (Public Access)
**GET** `/item-master`

**Headers:**
```
None required (public endpoint)
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Product Name",
    "unit": "kg",
    "qty": 100,
    "rate": 50.5,
    "assets": ["items/1234567890-file1.jpg", "items/1234567890-file2.mp4"],
    "assetsUrls": [
      "https://bucket.s3.amazonaws.com/items/1234567890-file1.jpg?X-Amz-...",
      "https://bucket.s3.amazonaws.com/items/1234567890-file2.mp4?X-Amz-..."
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Note:** `assetsUrls` contains pre-signed URLs valid for 1 hour.

### 3. Get Item by ID (Authenticated Users)
**GET** `/item-master/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "name": "Product Name",
  "unit": "kg",
  "qty": 100,
  "rate": 50.5,
  "assets": ["items/1234567890-file1.jpg"],
  "assetsUrls": [
    "https://bucket.s3.amazonaws.com/items/1234567890-file1.jpg?X-Amz-..."
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 4. Update Item (Super Admin Only)
**PATCH** `/item-master/:id`

**Headers:**
```
Authorization: Bearer <super_admin_token>
Content-Type: multipart/form-data
```

**Form Data:**
```
name: Updated Product Name (optional)
unit: pcs (optional)
qty: 150 (optional)
rate: 60.5 (optional)
assets: [file3.jpg] (optional, will be added to existing assets)
```

**Response:**
```json
{
  "id": 1,
  "name": "Updated Product Name",
  "unit": "pcs",
  "qty": 150,
  "rate": 60.5,
  "assets": ["items/1234567890-file1.jpg", "items/1234567891-file3.jpg"],
  "assetsUrls": [
    "https://bucket.s3.amazonaws.com/items/1234567890-file1.jpg?X-Amz-...",
    "https://bucket.s3.amazonaws.com/items/1234567891-file3.jpg?X-Amz-..."
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Note:** New assets are appended to existing ones.

### 5. Delete Item (Super Admin Only)
**DELETE** `/item-master/:id`

**Headers:**
```
Authorization: Bearer <super_admin_token>
```

**Response:**
```json
{
  "message": "Item deleted successfully"
}
```

**Note:** All associated S3 assets are automatically deleted.

## cURL Examples

### Create Item with Assets
```bash
curl -X POST http://localhost:3000/item-master \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -F "name=Product Name" \
  -F "unit=kg" \
  -F "qty=100" \
  -F "rate=50.5" \
  -F "assets=@/path/to/image1.jpg" \
  -F "assets=@/path/to/video1.mp4"
```

### Get All Items (Public)
```bash
curl -X GET http://localhost:3000/item-master
```

### Update Item
```bash
curl -X PATCH http://localhost:3000/item-master/1 \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -F "name=Updated Name" \
  -F "qty=150" \
  -F "assets=@/path/to/new-image.jpg"
```

### Delete Item
```bash
curl -X DELETE http://localhost:3000/item-master/1 \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

## Features

1. **File Upload to S3**: Assets are automatically uploaded to S3 with unique keys
2. **Signed URLs**: List and Get endpoints return pre-signed URLs for secure asset access
3. **Multiple File Support**: Upload up to 10 files per request
4. **File Type Validation**: Only images and videos are allowed
5. **File Size Limit**: Maximum 10MB per file
6. **Automatic Cleanup**: Local files are removed after S3 upload
7. **Asset Deletion**: S3 assets are deleted when item is removed
8. **Public List Access**: List all items endpoint is publicly accessible without authentication
9. **Role-Based Access**: Super admin for write operations, authenticated users for get by ID

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid file type. Allowed: .jpg, .jpeg, .png, .mp4, .avi, .mov, .mkv",
  "error": "Bad Request"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Item not found",
  "error": "Not Found"
}
```

## Notes

- Pre-signed URLs expire after 1 hour
- Assets are stored in S3 under the `items/` prefix
- File names are prefixed with timestamp to ensure uniqueness
- Update operation appends new assets to existing ones (doesn't replace)
- All decimal values (qty, rate) support 2 decimal places
