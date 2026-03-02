// testAuth.js - using native http module
const http = require('http');

const makeRequest = (options, data) => {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ status: res.statusCode, data: parsed });
                    } else {
                        reject({ status: res.statusCode, data: parsed });
                    }
                } catch (e) {
                    reject({ status: res.statusCode, error: 'Invalid JSON response', body });
                }
            });
        });

        req.on('error', (e) => reject({ error: e.message }));

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
};

const testAuth = async () => {
    try {
        console.log('1. Registering test user...');
        const uniqueEmail = `test${Date.now()}@test.com`;
        const registerData = {
            name: 'Test User',
            email: uniqueEmail,
            password: 'password123',
            role: 'student',
            studentYear: '1st Year'
        };

        const regOptions = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const regRes = await makeRequest(regOptions, registerData);
        console.log('✅ Registration successful');
        const token = regRes.data.token;
        console.log('🔑 Token received:', token ? 'Yes' : 'No');

        console.log('\n2. Testing /me endpoint...');
        const meOptions = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/me',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const meRes = await makeRequest(meOptions);
        console.log('✅ /me endpoint success:', meRes.data.user.email);

    } catch (err) {
        console.error('❌ Error:', err.data || err.error || err);
    }
};

testAuth();
