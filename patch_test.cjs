const fs = require('fs');
let content = fs.readFileSync('test_v0.4.6-A.cjs', 'utf8');

const jwtCode = `
const makeFakeJwt = (userId) => {
  const payload = { sub: userId, role: 'authenticated' };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');
  return \`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\${base64Payload}.fakeSignature\`;
};
`;

content = content.replace("async function makeRequest(path, method, userId, body = null) {", jwtCode + "\nasync function makeRequest(path, method, userId, body = null) {\n");
content = content.replace("\`Bearer fake-token-\${userId}\`", "\`Bearer \${makeFakeJwt(userId)}\`");
fs.writeFileSync('test_v0.4.6-A.cjs', content);
