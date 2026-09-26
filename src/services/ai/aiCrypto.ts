import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Returns a 32-byte Buffer key for AES-256-GCM encryption.
 * Priority:
 * 1. process.env.AI_CONFIG_ENCRYPTION_KEY
 * 2. process.env.SUPABASE_SERVICE_ROLE_KEY (hashed)
 * 3. Consistent internal fallback key
 */
function getNormalizedKey(): Buffer {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY || 
                 process.env.SUPABASE_SERVICE_ROLE_KEY || 
                 'ai_studio_system_ai_config_encryption_key_32b!';

  return crypto.createHash('sha256').update(String(secret)).digest();
}

export const aiCrypto = {
  /**
   * Encrypts plaintext using AES-256-GCM.
   * Returns ciphertext, 12-byte IV, and 16-byte AuthTag as hex strings.
   */
  encrypt(text: string): { encryptedText: string; iv: string; authTag: string } {
    if (!text || typeof text !== 'string') {
      throw new Error('AI_CRYPTO_INVALID_INPUT: Text to encrypt must be a non-empty string.');
    }

    const key = getNormalizedKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
      encryptedText: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag
    };
  },

  /**
   * Decrypts ciphertext using AES-256-GCM with IV and AuthTag.
   */
  decrypt(encryptedText: string, ivHex: string, authTagHex: string): string {
    if (!encryptedText || !ivHex || !authTagHex) {
      throw new Error('AI_CRYPTO_INVALID_TRIAD: All three encryption components (encryptedText, iv, authTag) are required.');
    }

    const key = getNormalizedKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM, 
      key, 
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
};
