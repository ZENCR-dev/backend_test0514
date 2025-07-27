#!/usr/bin/env node

const axios = require('axios');

async function testAdminAPI() {
  const baseUrl = 'http://localhost:4000';
  
  console.log('Testing Admin API after controller fixes...\n');
  
  const testData = {
    email: 'info@zencr.org',
    password: 'Jay889931!'
  };
  
  try {
    console.log('Testing: POST /api/v1/admin/login');
    const loginResponse = await axios.post(`${baseUrl}/api/v1/admin/login`, testData);
    console.log('✅ LOGIN SUCCESS');
    console.log('Response:', loginResponse.data);
    
    const token = loginResponse.data.token;
    
    // Test authenticated endpoint
    console.log('\nTesting: GET /api/v1/admin/profile');
    const profileResponse = await axios.get(`${baseUrl}/api/v1/admin/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ PROFILE SUCCESS');
    console.log('Response:', profileResponse.data);
    
    // Test practitioners endpoint
    console.log('\nTesting: GET /api/v1/admin/practitioners');
    const practitionersResponse = await axios.get(`${baseUrl}/api/v1/admin/practitioners`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ PRACTITIONERS SUCCESS');
    console.log('Total practitioners:', practitionersResponse.data.totalCount);
    
    // Test pharmacies endpoint
    console.log('\nTesting: GET /api/v1/admin/pharmacies');
    const pharmaciesResponse = await axios.get(`${baseUrl}/api/v1/admin/pharmacies`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ PHARMACIES SUCCESS');
    console.log('Total pharmacies:', pharmaciesResponse.data.totalCount);
    
    console.log('\n🎉 All Admin API tests passed!');
    
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data?.message || error.message);
    console.log('Full error:', error.response?.data);
  }
}

testAdminAPI().catch(console.error);