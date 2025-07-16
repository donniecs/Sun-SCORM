/**
 * Admin User Creation Script
 * Creates a test admin user for Phase 14 testing
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function createAdminUser() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Creating admin user...');
    
    // Admin user credentials
    const adminEmail = 'admin@rustici-killer.com';
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Create tenant first
    const tenant = await prisma.tenant.upsert({
      where: { domain: 'rustici-killer.com' },
      update: {},
      create: {
        name: 'Rustici Killer Admin',
        domain: 'rustici-killer.com'
      }
    });
    
    // Create admin user
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashedPassword,
        role: 'admin'
      },
      create: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        tenantId: tenant.id
      }
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('Email: admin@rustici-killer.com');
    console.log('Password: admin123');
    console.log('');
    console.log('🌐 Access the admin panel at:');
    console.log('http://localhost:3006/admin/dispatch');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
