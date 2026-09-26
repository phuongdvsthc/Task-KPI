const decodeJwtPayload = (token) => {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payloadStr);
    } catch {
      return null;
    }
  };
console.log(decodeJwtPayload('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.fakeSignature'));
