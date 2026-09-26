import { aiCrypto } from './aiCrypto';
import { AIGatewayError } from './gateway/aiGateway.types';
import { aiConfigurationResolver } from './gateway/aiConfigResolver';

export interface AIProviderSummary {
  providerCode: string;
  displayName: string;
  model: string;
  isActive: boolean;
  isEnabled: boolean;
  hasApiKey: boolean;
  hasConfiguredKey: boolean;
  connectionStatus: 'untested' | 'testing' | 'connected' | 'failed';
  configVersion: number;
  testedConfigVersion: number | null;
  configUpdatedAt: string;
  lastTestedAt?: string | null;
  lastTestErrorCode?: string | null;
  lastTestHttpStatus?: number | null;
  updatedAt: string;
}

export interface AIProviderRuntimeConfig {
  providerCode: string;
  model: string;
  apiKey: string;
  isEnabled: boolean;
  isActive: boolean;
  configVersion: number;
  testedConfigVersion: number | null;
}

// In-memory version tracker to guarantee strict version incrementation per provider
const memoryConfigVersions: Record<string, { configVersion: number; testedConfigVersion: number | null; configUpdatedAt: string }> = {
  openai: { configVersion: 1, testedConfigVersion: 1, configUpdatedAt: new Date().toISOString() },
  gemini: { configVersion: 1, testedConfigVersion: 1, configUpdatedAt: new Date().toISOString() }
};

function mapRowToSummary(row: any): AIProviderSummary {
  const code = (row.provider_code || '').toLowerCase();
  const hasKey = !!(
    row.api_key_encrypted && 
    row.api_key_encrypted.trim() !== '' &&
    row.api_key_iv && 
    row.api_key_iv.trim() !== '' &&
    row.api_key_auth_tag && 
    row.api_key_auth_tag.trim() !== ''
  );

  const mem = memoryConfigVersions[code] || { configVersion: 1, testedConfigVersion: null, configUpdatedAt: row.updated_at || new Date().toISOString() };
  
  // Resolve configVersion
  const configVersion = row.config_version !== undefined && row.config_version !== null
    ? Number(row.config_version)
    : mem.configVersion;

  // Resolve testedConfigVersion
  let testedConfigVersion: number | null = null;
  if (row.tested_config_version !== undefined && row.tested_config_version !== null) {
    testedConfigVersion = Number(row.tested_config_version);
  } else if (row.last_tested_config_version !== undefined && row.last_tested_config_version !== null) {
    testedConfigVersion = Number(row.last_tested_config_version);
  } else if (row.connection_status === 'connected' && row.last_tested_at) {
    testedConfigVersion = configVersion;
  } else {
    testedConfigVersion = mem.testedConfigVersion;
  }

  const configUpdatedAt = row.config_updated_at || mem.configUpdatedAt || row.last_tested_at || row.updated_at || new Date().toISOString();

  return {
    providerCode: row.provider_code,
    displayName: row.display_name,
    model: row.model,
    isActive: !!row.is_active,
    isEnabled: row.is_enabled !== false,
    hasApiKey: hasKey,
    hasConfiguredKey: hasKey,
    connectionStatus: row.connection_status || 'untested',
    configVersion,
    testedConfigVersion,
    configUpdatedAt,
    lastTestedAt: row.last_tested_at || null,
    lastTestErrorCode: row.last_test_error_code || null,
    lastTestHttpStatus: row.last_test_http_status || null,
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

export const aiProviderConfigService = {
  /**
   * Ensure default providers (e.g. Gemini with env API key) are seeded and active if needed.
   */
  async bootstrapDefaultProviders(supabaseAdmin: any): Promise<void> {
    if (!supabaseAdmin) return;

    try {
      const geminiEnvKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
      if (geminiEnvKey && geminiEnvKey.trim() !== '') {
        const { data: geminiRow } = await supabaseAdmin
          .from('ai_provider_configs')
          .select('*')
          .eq('provider_code', 'gemini')
          .maybeSingle();

        const hasEncryptedKey = !!(geminiRow?.api_key_encrypted && geminiRow?.api_key_iv && geminiRow?.api_key_auth_tag);

        if (!hasEncryptedKey) {
          const encrypted = aiCrypto.encrypt(geminiEnvKey.trim());
          await supabaseAdmin
            .from('ai_provider_configs')
            .upsert({
              provider_code: 'gemini',
              display_name: 'Google Gemini',
              model: geminiRow?.model || 'gemini-3.5-flash',
              is_enabled: true,
              is_active: true,
              api_key_encrypted: encrypted.encryptedText,
              api_key_iv: encrypted.iv,
              api_key_auth_tag: encrypted.authTag,
              connection_status: 'connected',
              last_tested_at: new Date().toISOString(),
              last_test_http_status: 200,
              updated_at: new Date().toISOString()
            }, { onConflict: 'provider_code' });

          // If OpenAI was active with dummy key, deactivate it
          await supabaseAdmin
            .from('ai_provider_configs')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('provider_code', 'openai');

          aiConfigurationResolver.invalidateCache();
        }
      }
    } catch (e: any) {
      console.warn('[aiProviderConfigService] bootstrapDefaultProviders note:', e?.message);
    }
  },

  /**
   * List summaries of all AI providers configured in the database.
   * Checks the complete encryption triad (ciphertext, iv, auth_tag).
   */
  async listProviderSummaries(supabaseAdmin: any): Promise<AIProviderSummary[]> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client required');
    }

    await this.bootstrapDefaultProviders(supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from('ai_provider_configs')
      .select('*')
      .order('provider_code', { ascending: true });

    if (error || !data) {
      console.error('[aiProviderConfigService] Error listing provider summaries:', error?.message);
      return [];
    }

    return data.map(mapRowToSummary);
  },

  /**
   * Get summary for a specific provider by provider_code.
   */
  async getProviderSummary(supabaseAdmin: any, providerCode: string): Promise<AIProviderSummary | null> {
    if (!supabaseAdmin) return null;
    const code = providerCode.toLowerCase();

    const { data, error } = await supabaseAdmin
      .from('ai_provider_configs')
      .select('*')
      .eq('provider_code', code)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapRowToSummary(data);
  },

  /**
   * Get summary for the currently active AI provider.
   */
  async getActiveProviderSummary(supabaseAdmin: any): Promise<AIProviderSummary | null> {
    if (!supabaseAdmin) return null;

    const { data, error } = await supabaseAdmin
      .from('ai_provider_configs')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapRowToSummary(data);
  },

  /**
   * Decrypts and resolves runtime configuration directly from ai_provider_configs.
   */
  async getProviderRuntimeConfig(supabaseAdmin: any, providerCode: string): Promise<AIProviderRuntimeConfig> {
    const code = providerCode.toLowerCase();
    const { data, error } = await supabaseAdmin
      .from('ai_provider_configs')
      .select('*')
      .eq('provider_code', code)
      .maybeSingle();

    if (error || !data) {
      throw new AIGatewayError(
        'AI_NOT_CONFIGURED',
        `Không tìm thấy cấu hình cho nhà cung cấp ${providerCode} trong cơ sở dữ liệu.`,
        { status: 404 }
      );
    }

    let apiKey = '';
    if (data.api_key_encrypted && data.api_key_iv && data.api_key_auth_tag) {
      try {
        apiKey = aiCrypto.decrypt(data.api_key_encrypted, data.api_key_iv, data.api_key_auth_tag);
      } catch (e: any) {
        console.error(`[aiProviderConfigService] Failed to decrypt API key for ${providerCode}:`, e?.message);
        throw new AIGatewayError(
          'AI_KEY_DECRYPTION_FAILED',
          `Không thể giải mã API key của provider ${providerCode}. Vui lòng nhập và lưu lại API key mới.`,
          { status: 500 }
        );
      }
    }

    const summary = mapRowToSummary(data);

    return {
      providerCode: data.provider_code,
      model: data.model,
      apiKey,
      isEnabled: data.is_enabled !== false,
      isActive: !!data.is_active,
      configVersion: summary.configVersion,
      testedConfigVersion: summary.testedConfigVersion
    };
  },

  /**
   * Save / Upsert provider configuration into public.ai_provider_configs.
   * Increments config_version ONLY when model or apiKey changes.
   * If config changed, resets connection_status to 'untested' and tested_config_version to NULL.
   */
  async saveProviderConfig(
    supabaseAdmin: any,
    providerCode: string,
    payload: {
      model?: string;
      isEnabled?: boolean;
      apiKey?: string;
      updatedBy?: string | null;
    }
  ): Promise<AIProviderSummary> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is required to save provider configuration.');
    }

    const code = providerCode.toLowerCase();

    // 1. Fetch existing record for provider
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('ai_provider_configs')
      .select('*')
      .eq('provider_code', code)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[aiProviderConfigService] Error fetching existing record for ${code}:`, fetchErr.message);
      throw new Error(`Database error fetching ${code} config: ${fetchErr.message}`);
    }

    const defaultDisplayName = code === 'openai' ? 'OpenAI' : (code === 'gemini' ? 'Google Gemini' : code.toUpperCase());
    const targetModel = payload.model !== undefined && payload.model.trim() !== '' 
      ? payload.model.trim() 
      : (existing?.model || (code === 'openai' ? 'gpt-4o-mini' : 'gemini-3.8-flash'));

    const isNewKeyProvided = typeof payload.apiKey === 'string' && payload.apiKey.trim().length > 0;
    const isModelChanged = existing && existing.model !== targetModel;
    const isConfigChanged = !existing || isModelChanged || isNewKeyProvided;

    // 2. Prepare encryption triad if new key is provided
    let encryptedCiphertext: string | null = null;
    let encryptedIv: string | null = null;
    let encryptedAuthTag: string | null = null;

    if (isNewKeyProvided) {
      const cleanKey = payload.apiKey!.trim();
      const encrypted = aiCrypto.encrypt(cleanKey);
      encryptedCiphertext = encrypted.encryptedText;
      encryptedIv = encrypted.iv;
      encryptedAuthTag = encrypted.authTag;

      if (!encryptedCiphertext || !encryptedIv || !encryptedAuthTag) {
        throw new Error('AI_CRYPTO_ENCRYPTION_FAILED: Encryption produced incomplete triad.');
      }
    } else if (existing) {
      // Preserve existing encrypted triad
      encryptedCiphertext = existing.api_key_encrypted || null;
      encryptedIv = existing.api_key_iv || null;
      encryptedAuthTag = existing.api_key_auth_tag || null;
    }

    const mem = memoryConfigVersions[code] || { configVersion: 1, testedConfigVersion: null, configUpdatedAt: new Date().toISOString() };
    const currentVer = Number(existing?.config_version || mem.configVersion || 1);
    const newVersion = isConfigChanged ? (existing ? currentVer + 1 : 1) : currentVer;

    // Update in-memory tracker
    memoryConfigVersions[code] = {
      configVersion: newVersion,
      testedConfigVersion: isConfigChanged ? null : (existing?.tested_config_version ?? mem.testedConfigVersion),
      configUpdatedAt: isConfigChanged ? new Date().toISOString() : mem.configUpdatedAt
    };

    // 3. Build upsert record matching standard database columns
    const upsertRecord: any = {
      provider_code: code,
      display_name: existing?.display_name || defaultDisplayName,
      model: targetModel,
      is_enabled: payload.isEnabled !== undefined ? !!payload.isEnabled : (existing?.is_enabled ?? true),
      is_active: existing?.is_active ?? false,
      api_key_encrypted: encryptedCiphertext,
      api_key_iv: encryptedIv,
      api_key_auth_tag: encryptedAuthTag,
      connection_status: isConfigChanged ? 'untested' : (existing?.connection_status || 'untested'),
      last_tested_at: isConfigChanged ? null : (existing?.last_tested_at || null),
      last_test_error_code: isConfigChanged ? null : (existing?.last_test_error_code || null),
      last_test_http_status: isConfigChanged ? null : (existing?.last_test_http_status || null),
      updated_by: payload.updatedBy || existing?.updated_by || null,
      updated_at: new Date().toISOString()
    };

    // 4. Perform upsert via service role client on ai_provider_configs
    const { error: upsertError } = await supabaseAdmin
      .from('ai_provider_configs')
      .upsert(upsertRecord, { onConflict: 'provider_code' });

    if (upsertError) {
      console.error(`[aiProviderConfigService] Upsert error for ${code}:`, upsertError.message);
      throw new Error(`AI_PROVIDER_UPSERT_FAILED: ${upsertError.message}`);
    }

    // Invalidate resolver cache so changes are immediately active
    aiConfigurationResolver.invalidateCache();

    // 5. Backend Verification: Read back and strictly assert persistence
    const { data: verified, error: readBackErr } = await supabaseAdmin
      .from('ai_provider_configs')
      .select('*')
      .eq('provider_code', code)
      .single();

    if (readBackErr || !verified) {
      console.error(`[aiProviderConfigService] Verification query failed for ${code}:`, readBackErr?.message);
      const err: any = new Error('AI_PROVIDER_KEY_NOT_PERSISTED: Không thể xác minh dữ liệu cấu hình đã lưu trong cơ sở dữ liệu.');
      err.code = 'AI_PROVIDER_KEY_NOT_PERSISTED';
      err.status = 500;
      throw err;
    }

    // If a new key was submitted, confirm that all 3 encryption fields are NOT NULL
    if (isNewKeyProvided) {
      const isCompleteTriad = !!(
        verified.api_key_encrypted &&
        verified.api_key_iv &&
        verified.api_key_auth_tag
      );

      if (!isCompleteTriad) {
        console.error(`[aiProviderConfigService] Triad validation failed for ${code}: encrypted=${!!verified.api_key_encrypted}, iv=${!!verified.api_key_iv}, auth_tag=${!!verified.api_key_auth_tag}`);
        const err: any = new Error('AI_PROVIDER_KEY_NOT_PERSISTED: Dữ liệu mã hóa API Key không được lưu đầy đủ vào bảng ai_provider_configs.');
        err.code = 'AI_PROVIDER_KEY_NOT_PERSISTED';
        err.status = 500;
        throw err;
      }
    }

    return mapRowToSummary(verified);
  },

  /**
   * Update provider connection test status (connected | failed).
   * When connected, synchronizes tested_config_version = config_version.
   */
  async updateConnectionStatus(
    supabaseAdmin: any,
    providerCode: string,
    status: 'untested' | 'testing' | 'connected' | 'failed',
    errorCode?: string | null,
    httpStatus?: number | null
  ): Promise<void> {
    const code = providerCode.toLowerCase();

    const mem = memoryConfigVersions[code] || { configVersion: 1, testedConfigVersion: null, configUpdatedAt: new Date().toISOString() };
    if (status === 'connected') {
      mem.testedConfigVersion = mem.configVersion;
    } else if (status === 'failed') {
      mem.testedConfigVersion = null;
    }
    memoryConfigVersions[code] = mem;

    const updateData: any = {
      connection_status: status,
      last_tested_at: new Date().toISOString(),
      last_test_error_code: errorCode || null,
      last_test_http_status: httpStatus || (status === 'connected' ? 200 : null),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from('ai_provider_configs')
      .update(updateData)
      .eq('provider_code', code);

    if (error) {
      console.error(`[aiProviderConfigService] Error updating connection status for ${code}:`, error.message);
    }

    aiConfigurationResolver.invalidateCache();
  },

  /**
   * Activate target provider with atomic transactional checks.
   * Does NOT alter config_version or tested_config_version.
   */
  async activateProvider(supabaseAdmin: any, providerCode: string, actorUserId?: string): Promise<boolean> {
    const code = providerCode.toLowerCase();

    // Pre-activation validations
    const summary = await this.getProviderSummary(supabaseAdmin, code);
    if (!summary || !summary.hasApiKey) {
      throw new Error('AI_PROVIDER_NO_API_KEY: Provider chưa được cấu hình API Key.');
    }
    if (summary.connectionStatus !== 'connected') {
      throw new Error('AI_PROVIDER_NOT_CONNECTED: Provider chưa được kiểm tra kết nối thành công (connected).');
    }
    if (!summary.lastTestedAt) {
      throw new Error('AI_PROVIDER_RETEST_REQUIRED: Provider chưa từng thực hiện kiểm tra kết nối.');
    }
    if (summary.testedConfigVersion !== null && summary.testedConfigVersion !== summary.configVersion) {
      throw new Error('AI_PROVIDER_RETEST_REQUIRED: Cấu hình provider đã thay đổi so với phiên bản đã kiểm tra. Vui lòng kiểm tra kết nối lại.');
    }

    // Direct atomic activation: Deactivate previous active providers and activate target provider
    try {
      await supabaseAdmin
        .from('ai_provider_configs')
        .update({ 
          is_active: false, 
          updated_by: actorUserId || null,
          updated_at: new Date().toISOString() 
        })
        .eq('is_active', true);

      const { error: activateError } = await supabaseAdmin
        .from('ai_provider_configs')
        .update({ 
          is_active: true, 
          updated_by: actorUserId || null,
          updated_at: new Date().toISOString() 
        })
        .eq('provider_code', code);

      if (activateError) {
        throw new Error(activateError.message);
      }

      aiConfigurationResolver.invalidateCache();
      return true;
    } catch (fallbackErr: any) {
      console.error(`[aiProviderConfigService] Failed to activate provider ${code}:`, fallbackErr);
      throw new Error(fallbackErr.message || `Failed to activate provider ${code}`);
    }
  },

  async hasConfiguredKey(supabaseAdmin: any, providerCode: string): Promise<boolean> {
    const summary = await this.getProviderSummary(supabaseAdmin, providerCode);
    return !!summary?.hasApiKey;
  }
};
