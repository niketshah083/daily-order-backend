import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function createSuperAdmin() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected successfully');

    // Hash the password
    const password = 'Admin@123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert super admin user
    const result = await dataSource.query(
      `INSERT INTO users (firstName, lastName, email, phoneNo, password, role, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['Super', 'Admin', 'admin@yopmail.com', '9999999999', hashedPassword, 'super_admin']
    );

    console.log('\n✅ Super Admin user created successfully!');
    console.log('\nLogin Credentials:');
    console.log('Email/Mobile: admin@yopmail.com or 9999999999');
    console.log('Password: Admin@123');
    console.log('\nUser ID:', result.insertId);

    // Verify the user was created
    const users = await dataSource.query(
      'SELECT id, firstName, lastName, email, phoneNo, role FROM users WHERE email = ?',
      ['admin@oms.com']
    );
    console.log('\nCreated User:', users[0]);

    await dataSource.destroy();
  } catch (error) {
    console.error('Error creating super admin:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('\n⚠️  Super admin user already exists!');
      
      // Show existing user
      const users = await dataSource.query(
        'SELECT id, firstName, lastName, email, phoneNo, role FROM users WHERE email = ?',
        ['admin@oms.com']
      );
      if (users.length > 0) {
        console.log('\nExisting User:', users[0]);
        console.log('\nYou can use these credentials:');
        console.log('Email/Mobile: admin@oms.com or 9999999999');
        console.log('Password: Admin@123 (if not changed)');
      }
    }
    await dataSource.destroy();
    process.exit(1);
  }
}

createSuperAdmin();
