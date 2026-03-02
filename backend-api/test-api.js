// apps/backend-api/test-api.js
const axios = require('axios');

async function testAPI() {
    try {
        // Test 1: Root endpoint
        const root = await axios.get('http://localhost:5000/');
        console.log('✅ Root:', root.data);

        // Test 2: Login (update with your credentials)
        const login = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'test@example.com',
            password: 'password123'
        });
        console.log('✅ Login successful');

        const token = login.data.token;

        // Test 3: Get tasks
        const tasks = await axios.get('http://localhost:5000/api/tasks/student', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Tasks:', tasks.data);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testAPI();