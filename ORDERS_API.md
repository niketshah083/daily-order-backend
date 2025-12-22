# Orders API Documentation

## Overview
The Orders API allows distributors to create orders and super admins to manage all orders.

## Access Control
- **List Orders (GET)**: Authenticated users (distributors see only their orders, super_admin sees all)
- **Get Order by ID (GET)**: Authenticated users
- **Create Order (POST)**: Distributors (for themselves) and super_admin (for any distributor)
- **Update Order (PUT)**: Super admin only
- **Complete Orders (PUT)**: Super admin only
- **Get Current Window (GET)**: Authenticated users

## Entity Structure

### OrderEntity
- `id`: Primary key
- `orderNo`: Unique order number (auto-generated)
- `distributorId`: Foreign key to UserEntity (distributor)
- `status`: Order status (pending, completed)
- `totalAmount`: Total order amount (calculated)
- `deliveryWindow`: MORNING or EVENING
- `paymentStatus`: Payment status (default: pending)
- `createdAt`, `updatedAt`: Timestamps
- `createdBy`, `updatedBy`: User IDs

### OrderItemEntity
- `id`: Primary key
- `orderId`: Foreign key to OrderEntity
- `itemId`: Foreign key to ItemMasterEntity
- `qty`: Quantity ordered
- `rate`: Item rate at time of order
- `amount`: Line item amount (qty * rate)

## Time Windows

Orders can only be created during specific time windows:

- **Morning Window**: 10:00 AM - 4:59 PM (creates order for EVENING delivery)
- **Evening Window**: 5:00 PM - 11:00 PM (creates order for MORNING delivery)
- **Outside Windows**: Order creation is blocked

## API Endpoints

### 1. Get All Orders
**GET** `/orders`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
```
search (optional): Search by order number or distributor name
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "orderNo": "ORD-1234567890",
      "distributorId": 2,
      "distributor": {
        "id": 2,
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "status": "pending",
      "totalAmount": 1500.50,
      "deliveryWindow": "EVENING",
      "paymentStatus": "pending",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z"
    }
  ],
  "totalCount": 1,
  "message": "Orders fetched successfully!"
}
```

### 2. Get Order by ID
**GET** `/orders/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "orderNo": "ORD-1234567890",
    "distributorId": 2,
    "distributor": {
      "id": 2,
      "firstName": "John",
      "lastName": "Doe"
    },
    "status": "pending",
    "totalAmount": 1500.50,
    "deliveryWindow": "EVENING",
    "orderItems": [
      {
        "id": 1,
        "itemId": 1,
        "item": {
          "id": 1,
          "name": "Product A",
          "unit": "kg"
        },
        "qty": 10,
        "rate": 50.50,
        "amount": 505.00
      }
    ],
    "createdAt": "2024-01-01T10:00:00.000Z"
  },
  "message": "Order fetched successfully!"
}
```

### 3. Create Order
**POST** `/orders`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body (Distributor):**
```json
{
  "items": [
    {
      "itemId": 1,
      "qty": 10
    },
    {
      "itemId": 2,
      "qty": 5
    }
  ]
}
```

**Request Body (Super Admin - can specify distributorId):**
```json
{
  "distributorId": 2,
  "items": [
    {
      "itemId": 1,
      "qty": 10
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "orderNo": "ORD-1234567890",
    "distributorId": 2,
    "status": "pending",
    "totalAmount": 1500.50,
    "deliveryWindow": "EVENING",
    "orderItems": [...]
  },
  "message": "Order added successfully!"
}
```

**Notes:**
- If distributor already has a pending order for the same delivery window today, items will be merged
- Rates are fetched from ItemMaster at time of order creation
- Total amount is calculated automatically

### 4. Update Order
**PUT** `/orders/:id`

**Headers:**
```
Authorization: Bearer <super_admin_token>
```

**Request Body:**
```json
{
  "distributorId": 2,
  "items": [
    {
      "itemId": 1,
      "qty": 15
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "orderNo": "ORD-1234567890",
    "totalAmount": 2000.00,
    "orderItems": [...]
  },
  "message": "Order updated successfully!"
}
```

### 5. Complete Orders (Bulk)
**PUT** `/orders/complete`

**Headers:**
```
Authorization: Bearer <super_admin_token>
```

**Request Body:**
```json
{
  "ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "orderNo": "ORD-1234567890",
      "status": "completed"
    }
  ],
  "message": "Orders completed successfully"
}
```

### 6. Get Current Window
**GET** `/orders/current-window`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": "MORNING",
  "message": "Current window fetched successfully!"
}
```

**Possible Values:**
- `"MORNING"`: Currently in morning window (10 AM - 5 PM)
- `"EVENING"`: Currently in evening window (5 PM - 11 PM)
- `"NONE"`: Outside order creation windows

## cURL Examples

### Create Order (Distributor)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer YOUR_DISTRIBUTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"itemId": 1, "qty": 10},
      {"itemId": 2, "qty": 5}
    ]
  }'
```

### Create Order (Super Admin for Distributor)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "distributorId": 2,
    "items": [
      {"itemId": 1, "qty": 10}
    ]
  }'
```

### Get All Orders
```bash
curl -X GET "http://localhost:3000/orders?search=ORD-123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Complete Orders
```bash
curl -X PUT http://localhost:3000/orders/complete \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [1, 2, 3]
  }'
```

## Business Rules

1. **Time Window Validation**: Orders can only be created during morning (10 AM - 5 PM) or evening (5 PM - 11 PM) windows
2. **Delivery Window Assignment**: 
   - Orders created in morning window → EVENING delivery
   - Orders created in evening window → MORNING delivery
3. **Order Merging**: If distributor has pending order for same delivery window today, new items are merged with existing order
4. **Rate Locking**: Item rates are locked at time of order creation
5. **Auto Calculation**: Total amount is calculated automatically based on item rates and quantities
6. **Role-Based Access**:
   - Distributors can only create orders for themselves
   - Super admin can create orders for any distributor
   - Only super admin can update or complete orders

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "You are not allowed to create order right now! Please come back in next morning or evening",
  "error": "Bad Request"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Invalid role for creating orders",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Order not found",
  "error": "Not Found"
}
```

## Changes from Original

1. **Changed `customerId` to `distributorId`**: Orders are now linked to distributors (users with role='distributor')
2. **Aligned with existing structure**: Uses UserEntity, DistributorEntity, ItemMasterEntity from our system
3. **Simplified authentication**: Uses our JWT guards and decorators
4. **Role-based access**: Proper separation between distributor and super_admin capabilities
5. **Removed unused features**: Removed WhatsApp integration, GRN, Purchase Orders (can be added later if needed)
6. **Consistent response format**: Uses responseMessage utility for consistent API responses
