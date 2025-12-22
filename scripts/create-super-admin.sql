-- Create Super Admin User
-- Note: Replace the password hash with your own generated hash
-- Run: ts-node scripts/hash-password.ts your-password
-- Then use the generated hash below

INSERT INTO users (firstName, lastName, email, phoneNo, password, role, createdAt, updatedAt)
VALUES (
  'Super',
  'Admin',
  'admin@example.com',
  '9999999999',
  '$2b$10$YourHashedPasswordHere', -- Replace with actual hash
  'super_admin',
  NOW(),
  NOW()
);

-- Verify the user was created
SELECT id, firstName, lastName, email, phoneNo, role FROM users WHERE email = 'admin@example.com';
