import { aiConfigService } from '../aiConfigService';
import { aiProviderConfigService } from '../aiProviderConfig.service';
import { aiCrypto } from '../aiCrypto';
import { AIGatewayError } from './aiGateway.types';

export const ALLOWED_CHAT_MODELS: Record<string, string[]> = {
  gemini: [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ]
};

export const ALLOWED_EMBEDDING_MODELS: Record<string, { model: string; dimension: number }[]> = {
  gemini: [
    { model: 'text-embedding-004', dimension: 768 }
  ],
  openai: [
    { model: 'text-embedding-3-small', dimension: 1536 }
  ]
};

export interface ResolvedAIConfig {
  provider: string;
  model: string;
  embeddingModel: string;
  embeddingDimension: number;
  apiKey: string;
  enabled: boolean;
  configVersion: number;
}

export class AIConfigurationResolver {
  private cachedActiveConfig: { config: ResolvedAIConfig; fetchedAt: number } | null = null;
  private cacheTtlMs = 1500; // Fast 1.5s cache to avoid excessive DB reads while invalidating promptly

  constructor(private customConfigService = aiConfigService) {}

  async resolve(supabaseAdmin: any, options?: { forceRefresh?: boolean; taskType?: string; requestedModel?: string }): Promise<ResolvedAIConfig> {
    if (!options?.forceRefresh && !options?.requestedModel && this.cachedActiveConfig) {
      if (Date.now() - this.cachedActiveConfig.fetchedAt < this.cacheTtlMs) {
        return this.cachedActiveConfig.config;
      }
    }

    const configSource = process.env.AI_PROVIDER_CONFIG_SOURCE || 'provider_table';

    if (configSource === 'legacy') {
      const baseConfig = await this.customConfigService.resolve(supabaseAdmin, options?.forceRefresh);
      if (!baseConfig.enabled) {
        throw new AIGatewayError('AI_DISABLED', 'Tính năng AI hiện đang bị vô hiệu hóa trong cấu hình hệ thống.', { 
          status: 503, 
          retryable: false,
          details: { reason: 'SYSTEM_DISABLED' } 
        });
      }
      if (!baseConfig.apiKey || baseConfig.apiKey.trim() === '') {
        throw new AIGatewayError('AI_NOT_CONFIGURED', 'Chưa cấu hình API key cho nhà cung cấp AI trong hệ thống.', { 
          status: 503, 
          retryable: false,
          details: { reason: 'API_KEY_MISSING' } 
        });
      }
      return {
        provider: 'gemini',
        model: baseConfig.model || 'gemini-3.8-flash',
        embeddingModel: 'text-embedding-004',
        embeddingDimension: 768,
        apiKey: baseConfig.apiKey,
        enabled: true,
        configVersion: 1
      };
    }

    // Provider Table Mode (AI-D3 Active Provider Resolver)
    const { data: activeRows, error } = await supabaseAdmin
      .from('ai_provider_configs')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new AIGatewayError('AI_PROVIDER_CONFIG_UNAVAILABLE', `Không thể truy xuất cấu hình nhà cung cấp AI từ cơ sở dữ liệu: ${error.message}`, { 
        status: 500, 
        retryable: true 
      });
    }

    if (!activeRows || activeRows.length === 0) {
      throw new AIGatewayError('AI_PROVIDER_NOT_CONFIGURED', 'Chưa có nhà cung cấp AI nào được kích hoạt trong hệ thống.', { 
        status: 400, 
        retryable: false,
        details: { reason: 'PROVIDER_NOT_ACTIVE' } 
      });
    }

    if (activeRows.length > 1) {
      throw new AIGatewayError('AI_PROVIDER_STATE_INVALID', 'Phát hiện nhiều hơn một nhà cung cấp AI đang hoạt động đồng thời (vi phạm ràng buộc unique active).', { 
        status: 500, 
        retryable: false 
      });
    }

    const activeRow = activeRows[0];
    const providerCode = (activeRow.provider_code || '').toLowerCase();

    // AI-C1: If taskType is embedding, check if active provider supports embeddings.
    // If active provider (e.g. openai) does not support embeddings, resolve embedding-capable provider (gemini).
    if (options?.taskType === 'embedding') {
      const supportsEmbeddings = providerCode === 'gemini';
      if (!supportsEmbeddings) {
        const { data: embRows } = await supabaseAdmin
          .from('ai_provider_configs')
          .select('*')
          .eq('provider_code', 'gemini')
          .eq('connection_status', 'connected')
          .maybeSingle();

        if (embRows && embRows.api_key_encrypted && embRows.api_key_iv && embRows.api_key_auth_tag) {
          try {
            const embApiKey = aiCrypto.decrypt(embRows.api_key_encrypted, embRows.api_key_iv, embRows.api_key_auth_tag);
            const summary = await aiProviderConfigService.getProviderSummary(supabaseAdmin, 'gemini');
            const currentVersion = summary?.configVersion ?? Number(embRows.config_version || 1);
            return {
              provider: 'gemini',
              model: embRows.model || 'gemini-3.8-flash',
              embeddingModel: 'text-embedding-004',
              embeddingDimension: 768,
              apiKey: embApiKey,
              enabled: true,
              configVersion: currentVersion
            };
          } catch (e) {
            // Decryption failed, fall through to configuration error
          }
        }

        throw new AIGatewayError(
          'AI_EMBEDDING_PROVIDER_NOT_CONFIGURED',
          `Nhà cung cấp AI đang hoạt động ('${providerCode}') không hỗ trợ tạo embedding vector. Hệ thống yêu cầu cấu hình và kết nối nhà cung cấp hỗ trợ embedding (Google Gemini) để xử lý tài liệu tri thức.`,
          {
            status: 400,
            retryable: false,
            details: {
              activeChatProvider: providerCode,
              reason: 'EMBEDDING_PROVIDER_UNSUPPORTED'
            }
          }
        );
      }
    }

    // 1. Is enabled check
    if (activeRow.is_enabled === false) {
      throw new AIGatewayError('AI_PROVIDER_DISABLED', `Nhà cung cấp AI đang hoạt động (${providerCode}) đã bị vô hiệu hóa.`, { 
        status: 400, 
        retryable: false,
        details: { reason: 'PROVIDER_DISABLED' } 
      });
    }

    // 2. Encrypted API Key completeness check
    if (!activeRow.api_key_encrypted || !activeRow.api_key_iv || !activeRow.api_key_auth_tag) {
      throw new AIGatewayError('AI_KEY_NOT_CONFIGURED', `Chưa cấu hình đầy đủ API key mã hóa cho nhà cung cấp AI (${providerCode}).`, { 
        status: 400, 
        retryable: false,
        details: { reason: 'API_KEY_MISSING' } 
      });
    }

    // 3. Connection status check
    if (activeRow.connection_status !== 'connected') {
      throw new AIGatewayError('AI_PROVIDER_RETEST_REQUIRED', `Nhà cung cấp AI active (${providerCode}) chưa hoàn tất kiểm tra kết nối thành công (status: ${activeRow.connection_status}).`, { 
        status: 400, 
        retryable: false,
        details: { reason: 'CONNECTION_NOT_TESTED' } 
      });
    }

    // 4. Last tested timestamp check
    if (!activeRow.last_tested_at) {
      throw new AIGatewayError('AI_PROVIDER_RETEST_REQUIRED', `Nhà cung cấp AI active (${providerCode}) chưa từng thực hiện kiểm tra kết nối.`, { 
        status: 400, 
        retryable: false,
        details: { reason: 'CONNECTION_NOT_TESTED' } 
      });
    }

    // 5. Config version vs Tested config version check (NO comparison with updated_at)
    const summary = await aiProviderConfigService.getProviderSummary(supabaseAdmin, providerCode);
    const currentVersion = summary?.configVersion ?? Number(activeRow.config_version || 1);
    const testedVersion = summary?.testedConfigVersion ?? 
      (activeRow.tested_config_version !== undefined && activeRow.tested_config_version !== null
        ? Number(activeRow.tested_config_version)
        : (activeRow.last_tested_config_version !== undefined && activeRow.last_tested_config_version !== null
            ? Number(activeRow.last_tested_config_version)
            : (activeRow.connection_status === 'connected' && activeRow.last_tested_at ? currentVersion : null)));

    if (testedVersion === null || testedVersion !== currentVersion) {
      throw new AIGatewayError(
        'AI_PROVIDER_RETEST_REQUIRED',
        `Cấu hình của nhà cung cấp AI (${providerCode}) đã thay đổi. Cần kiểm tra kết nối lại trước khi sử dụng.`,
        { 
          status: 400, 
          retryable: false,
          details: { 
            reason: 'CONFIG_VERSION_MISMATCH', 
            currentVersion, 
            testedVersion 
          } 
        }
      );
    }

    // 6. Decrypt API Key
    let apiKey = '';
    try {
      apiKey = aiCrypto.decrypt(activeRow.api_key_encrypted, activeRow.api_key_iv, activeRow.api_key_auth_tag);
    } catch (e: any) {
      throw new AIGatewayError('AI_KEY_DECRYPTION_FAILED', `Không thể giải mã API key của nhà cung cấp AI (${providerCode}).`, { 
        status: 500, 
        retryable: false 
      });
    }

    let chosenModel = activeRow.model;
    if (options?.requestedModel) {
      const allowed = ALLOWED_CHAT_MODELS[providerCode] || [];
      if (!allowed.includes(options.requestedModel)) {
        throw new AIGatewayError('AI_MODEL_NOT_ALLOWED', `Mô hình '${options.requestedModel}' không nằm trong danh sách được phép của nhà cung cấp ${providerCode}.`, { 
          status: 400, 
          retryable: false 
        });
      }
      chosenModel = options.requestedModel;
    }

    const embeddingConfig = (ALLOWED_EMBEDDING_MODELS[providerCode] || [])[0] || {
      model: providerCode === 'openai' ? 'text-embedding-3-small' : 'text-embedding-004',
      dimension: providerCode === 'openai' ? 1536 : 768
    };

    const resolved: ResolvedAIConfig = {
      provider: providerCode,
      model: chosenModel,
      embeddingModel: embeddingConfig.model,
      embeddingDimension: embeddingConfig.dimension,
      apiKey,
      enabled: true,
      configVersion: currentVersion
    };

    if (!options?.requestedModel) {
      this.cachedActiveConfig = {
        config: resolved,
        fetchedAt: Date.now()
      };
    }

    return resolved;
  }

  invalidateCache() {
    this.cachedActiveConfig = null;
    this.customConfigService.invalidateCache();
  }
}

export const aiConfigurationResolver = new AIConfigurationResolver();
