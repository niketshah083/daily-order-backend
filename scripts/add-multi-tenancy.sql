-- Multi-Tenancy Database Migration Script
-- This script adds tenantId columns to existing tables and sets up the default tenant

-- Step 1: Add tenantId column to tables
ALTER TABLE categories ADD COLUMN tenantId INT NULL;
ALTER TABLE item_masters ADD COLUMN tenantId INT NULL;
ALTER TABLE order_master ADD COLUMN tenantId INT NULL;

-- Step 2: Add foreign key constraints
ALTER TABLE categories ADD CONSTRAINT fk_category_tenant 
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE item_masters ADD CONSTRAINT fk_item_tenant 
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE order_master ADD CONSTRAINT fk_order_tenant 
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE SET NULL;

-- Step 3: Create default tenant
INSERT INTO tenants (name, slug, description, isActive, createdAt, updatedAt) 
VALUES ('Default Tenant', 'default', 'Default tenant for existing data', true, NOW(), NOW());

-- Step 4: Get the default tenant ID and assign to existing data
SET @defaultTenantId = LAST_INSERT_ID();

-- Step 5: Assign existing data to default tenant
UPDATE users SET tenantId = @defaultTenantId WHERE role != 'master_admin' AND role IS NOT NULL;
UPDATE categories SET tenantId = @defaultTenantId WHERE tenantId IS NULL;
UPDATE item_masters SET tenantId = @defaultTenantId WHERE tenantId IS NULL;
UPDATE order_master SET tenantId = @defaultTenantId WHERE tenantId IS NULL;

-- Step 6: Create or update master_admin user
-- OPTION 1: Update existing super_admin user (ID 1) to master_admin
-- Uncomment the line below if you want to convert an existing user
-- UPDATE users SET role = 'master_admin', tenantId = NULL WHERE id = 1;

-- OPTION 2: Create new master_admin user
-- Uncomment and modify the values below to create a new master_admin user
-- Note: You need to hash the password using bcrypt before inserting
-- INSERT INTO users (firstName, lastName, email, phoneNo, password, role, tenantId, createdAt, updatedAt)
-- VALUES ('Master', 'Admin', 'master@example.com', '1234567890', '$2b$10$YOUR_HASHED_PASSWORD_HERE', 'master_admin', NULL, NOW(), NOW());

-- Step 7: Verify the migration
SELECT 'Migration completed successfully!' AS status;
SELECT COUNT(*) AS total_tenants FROM tenants;
SELECT COUNT(*) AS users_with_tenant FROM users WHERE tenantId IS NOT NULL;
SELECT COUNT(*) AS categories_with_tenant FROM categories WHERE tenantId IS NOT NULL;
SELECT COUNT(*) AS items_with_tenant FROM item_masters WHERE tenantId IS NOT NULL;
SELECT COUNT(*) AS orders_with_tenant FROM order_master WHERE tenantId IS NOT NULL;
