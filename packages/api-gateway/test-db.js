#!/usr/bin/env node

/**
 * Test script for Phase 3 Database Integration
 */

const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧪 Testing database connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test querying (should return empty arrays initially)
    const userCount = await prisma.user.count();
    const tenantCount = await prisma.tenant.count();
    
    console.log(`📊 Current database state:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Tenants: ${tenantCount}`);
    
    console.log('🎉 Database integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Make sure PostgreSQL is running and DATABASE_URL is correct');
    
    if (error.code === 'P1001') {
      console.error('🔧 Common solutions:');
      console.error('   1. Start PostgreSQL service');
      console.error('   2. Check DATABASE_URL in .env file');
      console.error('   3. Verify database exists');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabaseConnection();
