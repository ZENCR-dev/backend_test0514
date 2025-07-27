#!/usr/bin/env node

const axios = require('axios');

async function testActualRoutes() {
  const baseUrl = 'http://localhost:4000';
  
  console.log('Testing actual routes from Swagger documentation...\n');
  
  const testData = {
    email: 'info@zencr.org',
    password: 'Jay889931!'
  };
  
  try {
    // Test the double v1 route that appears in Swagger
    console.log('Testing: POST /api/v1/v1/admin/login');
    const loginResponse = await axios.post(`${baseUrl}/api/v1/v1/admin/login`, testData);
    console.log('✅ LOGIN SUCCESS (with double v1)');
    console.log('Response:', loginResponse.data);
    
    const token = loginResponse.data.token;
    
    // Test profile with double v1
    console.log('\nTesting: GET /api/v1/v1/admin/profile');
    const profileResponse = await axios.get(`${baseUrl}/api/v1/v1/admin/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ PROFILE SUCCESS (with double v1)');
    console.log('Response:', profileResponse.data);
    
    console.log('\n🎉 Admin API works with double v1 paths!');
    console.log('Issue identified: NestJS versioning is adding v1 to controller paths that already include v1');
    
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data?.message || error.message);
    console.log('Full error:', error.response?.data);
  }
}

testActualRoutes().catch(console.error);