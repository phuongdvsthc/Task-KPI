export const aiContextSanitizer = {
  sanitizeContext(data: any): any {
    if (!data) return data;
    
    // Deep clone to avoid mutating original
    const clone = JSON.parse(JSON.stringify(data));
    
    this.recursivelySanitize(clone);
    return clone;
  },

  recursivelySanitize(obj: any) {
    if (typeof obj !== 'object' || obj === null) return;

    if (Array.isArray(obj)) {
      obj.forEach(item => this.recursivelySanitize(item));
      return;
    }

    const forbiddenKeys = [
      'api_key', 'apikey', 'password', 'hash', 'secret', 
      'token', 'access_token', 'refresh_token', 'service_role_key',
      'TEST_AI_SECRET_B1', // for B1.15
      'authorization', 'encrypted_secret', 'encryption_iv', 'auth_tag',
      'test_ai_api_key_b5', 'test_service_role_b5', 'test_access_token_b5', 'test_auth_header_b5', 'test_encryption_key_b5'
    ];

    const piiKeys = ['phone', 'email', 'address', 'personal_id'];

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const lowerKey = key.toLowerCase();
        
        // Remove secrets
        if (forbiddenKeys.some(fk => lowerKey.includes(fk))) {
          delete obj[key];
          continue;
        }

        // Remove unnecessary PII for generic context
        if (piiKeys.some(pk => lowerKey === pk)) {
           delete obj[key];
           continue;
        }

        this.recursivelySanitize(obj[key]);
      }
    }
  }
};
