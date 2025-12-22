# API Examples

## Authentication Flow

### 1. Create Super Admin User (Direct DB Insert)
First, you need to create a super admin user directly in the database:

```sql
-- Hash password using bcrypt with salt rounds 10
-- Password: admin123
-- Hashed: $2b$10$... (use bcrypt to generate)

INSERT INTO users (firstName, lastName, email, phoneNo, password, role, createdAt, updatedAt)
VALUES ('Admin', 'User', 'admin@example.com', '9999999999', '$2b$10$YourHashedPasswordHere', 'super_admin', NOW(), NOW());
```

### 2. Login as Super Admin
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrMobile": "admin@example.com",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Create Distributor User (Super Admin Only)
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phoneNo": "9876543210",
    "password": "password123",
    "role": "distributor",
    "gstin": "27AABCU9603R1ZM",
    "businessName": "ABC Distributors Pvt Ltd"
  }'
```

### 4. Get All Users (Super Admin Only)
```bash
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 5. Get User by ID (Super Admin Only)
```bash
curl -X GET http://localhost:3000/users/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 6. Update User (Super Admin Only)
```bash
curl -X PATCH http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "firstName": "Jane",
    "businessName": "XYZ Distributors"
  }'
```

### 7. Delete User (Super Admin Only)
```bash
curl -X DELETE http://localhost:3000/users/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 8. Login as Distributor
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrMobile": "john@example.com",
    "password": "password123"
  }'
```

## Testing with Swagger

1. Start the server: `npm run start:dev`
2. Open Swagger UI: http://localhost:3000/api
3. Click "Authorize" button
4. Enter: `Bearer YOUR_ACCESS_TOKEN`
5. Test all endpoints through the UI

## Role-Based Access

- **Super Admin**: Can access all `/users` endpoints
- **Distributor**: Cannot access `/users` endpoints (403 Forbidden)
- **Public**: Can only access `/auth/login` endpoint

## Notes

- All user management endpoints require super_admin role
- Distributor users must provide `gstin` and `businessName` during creation
- Passwords are automatically hashed before storage
- JWT tokens expire after 24 hours (configurable in .env)
