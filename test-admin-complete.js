#!/usr/bin/env node

const axios = require('axios');

async function testAdminAPIComplete() {
  const baseUrl = 'http://localhost:4000';
  
  console.log('Complete Admin API test with corrected token usage...\n');
  
  const testData = {
    email: 'info@zencr.org',
    password: 'Jay889931!'
  };
  
  try {
    console.log('Testing: POST /api/v1/v1/admin/login');
    const loginResponse = await axios.post(`${baseUrl}/api/v1/v1/admin/login`, testData);
    console.log('✅ LOGIN SUCCESS');
    console.log('Login response:', loginResponse.data);
    
    // Use the accessToken field, not token
    const token = loginResponse.data.accessToken;
    console.log('Using token:', token.substring(0, 50) + '...');
    
    // Test profile
    console.log('\nTesting: GET /api/v1/v1/admin/profile');
    const profileResponse = await axios.get(`${baseUrl}/api/v1/v1/admin/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ PROFILE SUCCESS');
    console.log('Profile response:', profileResponse.data);
    
    // Test email health check
    console.log('\nTesting: GET /api/v1/v1/admin/health/email');
    const emailResponse = await axios.get(`${baseUrl}/api/v1/v1/admin/health/email`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ EMAIL HEALTH SUCCESS');
    console.log('Email response:', emailResponse.data);
    
    // Test practitioners
    console.log('\nTesting: GET /api/v1/v1/admin/practitioners');
    const practitionersResponse = await axios.get(`${baseUrl}/api/v1/v1/admin/practitioners`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ PRACTITIONERS SUCCESS');
    console.log('Practitioners count:', practitionersResponse.data.totalCount || 'N/A');
    
    // Test pharmacies  
    console.log('\nTesting: GET /api/v1/v1/admin/pharmacies');
    const pharmaciesResponse = await axios.get(`${baseUrl}/api/v1/v1/admin/pharmacies`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ PHARMACIES SUCCESS');
    console.log('Pharmacies count:', pharmaciesResponse.data.totalCount || 'N/A');
    
    console.log('\n🎉 ALL ADMIN API ENDPOINTS WORKING!');
    console.log('Note: Routes are accessible at /api/v1/v1/admin/* due to double versioning');
    
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data?.message || error.message);
    console.log('Full error:', error.response?.data);
  }
}

testAdminAPIComplete().catch(console.error);