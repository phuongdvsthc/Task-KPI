import { AIEmbeddingResult } from '../../gateway/aiGateway.types';
import { AI_KNOWLEDGE_CHUNK_CONFIG } from '../../../../types/aiKnowledge';

export class VectorValidator {
  /**
   * Validates a single vector against dimensionality, finite values, and absence of NaN / null.
   */
  public static validateVector(
    vector: number[],
    expectedDimension: number = AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_DIMENSION
  ): { valid: boolean; error?: string } {
    if (!Array.isArray(vector)) {
      return { valid: false, error: 'Vector embedding phải là một mảng số thực (Array).' };
    }

    if (vector.length !== expectedDimension) {
      return {
        valid: false,
        error: `Số chiều vector (${vector.length}) không khớp với cấu hình cơ sở dữ liệu (${expectedDimension}).`
      };
    }

    for (let i = 0; i < vector.length; i++) {
      const val = vector[i];
      if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
        return {
          valid: false,
          error: `Vector chứa giá trị không hợp lệ (không phải số hữu hạn hoặc NaN/Infinity) tại vị trí [${i}]: ${val}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validates an entire batch embedding result against expected count and dimension.
   */
  public static validateBatch(
    result: AIEmbeddingResult,
    expectedCount: number,
    expectedDimension: number = AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_DIMENSION
  ): { valid: boolean; error?: string } {
    if (!result || !Array.isArray(result.embeddings)) {
      return { valid: false, error: 'Kết quả embedding từ AI Gateway rỗng hoặc không có mảng embeddings.' };
    }

    if (result.embeddings.length !== expectedCount) {
      return {
        valid: false,
        error: `Số lượng vector trả về (${result.embeddings.length}) không khớp với số chunk yêu cầu (${expectedCount}).`
      };
    }

    for (let i = 0; i < result.embeddings.length; i++) {
      const v = result.embeddings[i];
      const check = this.validateVector(v, expectedDimension);
      if (!check.valid) {
        return { valid: false, error: `Lỗi vector tại chunk thứ ${i}: ${check.error}` };
      }
    }

    return { valid: true };
  }
}
