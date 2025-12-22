"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const bcrypt = __importStar(require("bcrypt"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function createSuperAdmin() {
    const dataSource = new typeorm_1.DataSource({
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
        const password = 'Admin@123';
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await dataSource.query(`INSERT INTO users (firstName, lastName, email, phoneNo, password, role, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`, ['Super', 'Admin', 'admin@yopmail.com', '9999999999', hashedPassword, 'super_admin']);
        console.log('\n✅ Super Admin user created successfully!');
        console.log('\nLogin Credentials:');
        console.log('Email/Mobile: admin@yopmail.com or 9999999999');
        console.log('Password: Admin@123');
        console.log('\nUser ID:', result.insertId);
        const users = await dataSource.query('SELECT id, firstName, lastName, email, phoneNo, role FROM users WHERE email = ?', ['admin@oms.com']);
        console.log('\nCreated User:', users[0]);
        await dataSource.destroy();
    }
    catch (error) {
        console.error('Error creating super admin:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            console.log('\n⚠️  Super admin user already exists!');
            const users = await dataSource.query('SELECT id, firstName, lastName, email, phoneNo, role FROM users WHERE email = ?', ['admin@oms.com']);
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
//# sourceMappingURL=create-super-admin.js.map