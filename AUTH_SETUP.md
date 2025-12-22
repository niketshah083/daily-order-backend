# Authentication Setup

## Overview
The authentication system uses JWT tokens with role-based access control.

## User Roles
- `super_admin`: Administrator with full access
- `distributor`: Distributor user with limited access

## Entities

### UserEntity
- `id`: Primary key
- `firstName`: User's first name
- `lastName`: User's last name
- `email`: Unique email address
- `phoneNo`: Unique phone number
- `password`: Hashed password
- `role`: User role (super_admin | distributor)

### DistributorEntity
- Created when a user with role `distributor` is added via User API
- `userId`: Foreign key to UserEntity
- `gstin`: GST Identification Number (required)
- `businessName`: Business name (required)
- One-to-one relationship with User

## API Endpoints

### POST /auth/login
Login with email or phone number.

**Request Body:**
```json
{
  "emailOrMobile": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**JWT Payload:**
```json
{
  "id": 1,
  "role": "distributor"
}
```

### POST /users (Super Admin Only)
Create a new user.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phoneNo": "9876543210",
  "password": "password123",
  "role": "distributor",
  "gstin": "27AABCU9603R1ZM",
  "businessName": "ABC Distributors Pvt Ltd"
}
```

**Note:** `gstin` and `businessName` are required when role is `distributor`.

### GET /users (Super Admin Only)
Get list of all users.

### GET /users/:id (Super Admin Only)
Get user details by ID.

### PATCH /users/:id (Super Admin Only)
Update user details.

### DELETE /users/:id (Super Admin Only)
Delete a user.

## Usage

### Protect Routes
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user) {
  return user;
}
```

### Role-Based Access
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Get('admin-only')
adminOnly() {
  return 'Admin only content';
}
```

## Environment Variables
```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
```

## Testing
1. Create a user in the database with hashed password
2. Use the login endpoint to get an access token
3. Include the token in subsequent requests: `Authorization: Bearer <token>`
