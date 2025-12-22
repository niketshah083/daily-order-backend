# Super Admin Credentials

## Default Super Admin Account

A super admin user has been created in the database with the following credentials:

### Login Information
- **Email**: `admin@oms.com`
- **Mobile**: `9999999999`
- **Password**: `Admin@123`

### User Details
- **Name**: Super Admin
- **Role**: super_admin
- **User ID**: 1

## Usage

You can login using either:
1. Email: `admin@oms.com`
2. Mobile: `9999999999`

Both will work with the password: `Admin@123`

## Security Note

⚠️ **IMPORTANT**: Please change this password after first login in production environments!

## Creating Additional Super Admin Users

If you need to create additional super admin users, you can:

1. **Using the script**:
   ```bash
   npm run ts-node scripts/create-super-admin.ts
   ```

2. **Using the API** (after logging in as super admin):
   - POST `/users`
   - Set `role: 'super_admin'`

3. **Manually with SQL**:
   ```bash
   # First, hash your password
   npm run ts-node scripts/hash-password.ts YourPassword
   
   # Then use the SQL script
   # Edit scripts/create-super-admin.sql with the hashed password
   ```

## Troubleshooting

If you get a "duplicate entry" error, the user already exists. You can:
- Try logging in with the existing credentials
- Reset the password in the database
- Delete the existing user and recreate it
