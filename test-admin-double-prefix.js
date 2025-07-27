#!/usr/bin/env node

const axios = require('axios');

async function testAdminLogin() {
  const baseUrl = 'http://localhost:4000';
  
  console.log('Testing Admin API with double prefix hypothesis...\n');
  
  const testData = {
    email: 'info@zencr.org',
    password: 'Jay889931!'
  };
  
  // Test the double prefix path
  try {
    console.log('Testing: POST /api/api/v1/admin/login');
    const response = await axios.post(`${baseUrl}/api/api/v1/admin/login`, testData);
    console.log('✅ SUCCESS: Double prefix route works!');
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ Double prefix failed:', error.response?.status, error.response?.data?.message || error.message);
  }
  
  // Test the intended path
  try {
    console.log('\nTesting: POST /api/v1/admin/login');
    const response = await axios.post(`${baseUrl}/api/v1/admin/login`, testData);
    console.log('✅ SUCCESS: Intended route works!');
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ Intended route failed:', error.response?.status, error.response?.data?.message || error.message);
  }
}

testAdminLogin().catch(console.error);