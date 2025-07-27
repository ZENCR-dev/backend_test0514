const axios = require('axios');

async function testAdminAPIs() {
  try {
    console.log('🔐 Testing Admin Login...');
    
    // Test admin login
    const loginResponse = await axios.post('http://localhost:4000/api/v1/admin/login', {
      email: 'info@zencr.org',
      password: 'Jay889931!'
    });
    
    console.log('✅ Admin login successful!');
    console.log('Token:', loginResponse.data.accessToken.substring(0, 20) + '...');
    
    const token = loginResponse.data.accessToken;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // Test admin profile
    console.log('\n👤 Testing Admin Profile...');
    const profileResponse = await axios.get('http://localhost:4000/api/v1/admin/profile', { headers });
    console.log('✅ Admin profile:', profileResponse.data);
    
    // Test practitioners list
    console.log('\n🩺 Testing Practitioners List...');
    const practitionersResponse = await axios.get('http://localhost:4000/api/v1/admin/practitioners', { headers });
    console.log('✅ Practitioners:', practitionersResponse.data.data.length, 'found');
    
    // Test practitioners statistics
    console.log('\n📊 Testing Practitioners Statistics...');
    const practitionersStatsResponse = await axios.get('http://localhost:4000/api/v1/admin/practitioners/statistics', { headers });
    console.log('✅ Practitioners stats:', practitionersStatsResponse.data);
    
    // Test pharmacies list
    console.log('\n🏥 Testing Pharmacies List...');
    const pharmaciesResponse = await axios.get('http://localhost:4000/api/v1/admin/pharmacies', { headers });
    console.log('✅ Pharmacies:', pharmaciesResponse.data.data.length, 'found');
    
    // Test pharmacies statistics
    console.log('\n📈 Testing Pharmacies Statistics...');
    const pharmaciesStatsResponse = await axios.get('http://localhost:4000/api/v1/admin/pharmacies/statistics', { headers });
    console.log('✅ Pharmacies stats:', pharmaciesStatsResponse.data);
    
    // Test email service health
    console.log('\n📧 Testing Email Service Health...');
    const emailHealthResponse = await axios.get('http://localhost:4000/api/v1/admin/health/email', { headers });
    console.log('✅ Email service:', emailHealthResponse.data);
    
    console.log('\n🎉 All Admin API tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testAdminAPIs();