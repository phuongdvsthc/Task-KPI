import crypto from 'crypto';
import { ExtractedBlock } from '../extractors/textExtractor.types';
import { AI_KNOWLEDGE_CHUNK_CONFIG, AIKnowledgeChunk } from '../../../../types/aiKnowledge';
import { TextNormalizer } from './textNormalizer';

export interface ChunkingOptions {
  minTargetTokens?: number;
  maxTargetTokens?: number;
  minOverlapTokens?: number;
  maxOverlapTokens?: number;
  defaultOverlapTokens?: number;
}

export class TextChunker {
  private options: Required<ChunkingOptions>;

  constructor(options?: ChunkingOptions) {
    this.options = {
      minTargetTokens: options?.minTargetTokens ?? AI_KNOWLEDGE_CHUNK_CONFIG.MIN_TARGET_TOKENS,
      maxTargetTokens: options?.maxTargetTokens ?? AI_KNOWLEDGE_CHUNK_CONFIG.MAX_TARGET_TOKENS,
      minOverlapTokens: options?.minOverlapTokens ?? AI_KNOWLEDGE_CHUNK_CONFIG.MIN_OVERLAP_TOKENS,
      maxOverlapTokens: options?.maxOverlapTokens ?? AI_KNOWLEDGE_CHUNK_CONFIG.MAX_OVERLAP_TOKENS,
      defaultOverlapTokens: options?.defaultOverlapTokens ?? AI_KNOWLEDGE_CHUNK_CONFIG.DEFAULT_OVERLAP_TOKENS
    };
  }

  /**
   * Fast, reliable token estimation for bilingual Vietnamese and English text.
   */
  public static estimateTokens(text: string): number {
    if (!text || !text.trim()) return 0;
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const charEstimate = Math.ceil(trimmed.length / 3.8);
    const wordEstimate = Math.ceil(words.length * 1.25);
    return Math.max(1, Math.round((charEstimate + wordEstimate) / 2));
  }

  public estimateTokens(text: string): number {
    return TextChunker.estimateTokens(text);
  }

  /**
   * Computes SHA-256 content hash of chunk content.
   */
  public computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Splits text into natural sentence/clause units.
   */
  public splitIntoSentences(text: string): string[] {
    if (!text) return [];

    // Protect common Vietnamese & academic abbreviations from splitting (TS., ThS., PGS., GS., TP., v.v.)
    const protectedText = text.replace(
      /\b(TS|ThS|Th\.S|PGS|GS|TP|P|Q|BS|DS|KS|Tr|St)\.\s+/gi,
      (match, p1) => `${p1}.__PROTECTED_SPACE__`
    );

    // Split on sentence boundaries: period, question mark, exclamation, or double newline
    // Keeps punctuation attached to previous segment
    const rawSegments = protectedText.split(/(?<=[.?!…\n])\s+/);
    const result: string[] = [];

    for (const seg of rawSegments) {
      const restored = seg.replace(/__PROTECTED_SPACE__/g, ' ').trim();
      if (!restored) continue;
      // If a single sentence is excessively long (e.g. unbroken legal clause > 400 tokens), split by comma or semicolon
      if (this.estimateTokens(restored) > 400) {
        const subClauses = restored.split(/(?<=[,;])\s+/);
        for (const sub of subClauses) {
          if (sub.trim()) result.push(sub.trim());
        }
      } else {
        result.push(restored);
      }
    }

    return result;
  }

  /**
   * Convenience method to chunk a raw text string directly.
   */
  public chunkDocument(
    text: string,
    documentId: string,
    embeddingModel: string = AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_MODEL,
    sectionTitle?: string
  ): AIKnowledgeChunk[] {
    const blocks: ExtractedBlock[] = [
      {
        text,
        pageNumber: 1,
        sectionTitle
      }
    ];
    return this.chunkBlocks(blocks, documentId, embeddingModel);
  }

  /**
   * Calculates overlap text from the tail of a completed chunk.
   * Aims for between minOverlapTokens and maxOverlapTokens, breaking at a sentence boundary.
   */
  private getOverlapPrefix(sentences: string[]): { text: string; usedSentences: string[] } {
    if (sentences.length === 0) return { text: '', usedSentences: [] };

    const overlapSentences: string[] = [];
    let currentTokens = 0;

    // Traverse sentences backwards from end of chunk
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      const tokens = this.estimateTokens(sentence);

      if (currentTokens + tokens > this.options.maxOverlapTokens && overlapSentences.length > 0) {
        break;
      }

      overlapSentences.unshift(sentence);
      currentTokens += tokens;

      if (currentTokens >= this.options.minOverlapTokens) {
        break;
      }
    }

    const text = overlapSentences.join(' ').trim();
    return { text, usedSentences: overlapSentences };
  }

  /**
   * Chunks a document represented by a sequence of extracted blocks into balanced chunks.
   */
  public chunkBlocks(
    blocks: ExtractedBlock[],
    documentId: string,
    modelName: string = AI_KNOWLEDGE_CHUNK_CONFIG.EMBEDDING_MODEL
  ): AIKnowledgeChunk[] {
    const rawChunks: Array<{
      content: string;
      pageNumber?: number | null;
      sectionTitle?: string | null;
    }> = [];

    let currentSentences: string[] = [];
    let currentTokenCount = 0;
    let currentSectionTitle: string | null = null;
    let currentPageNumber: number | null = null;

    // Flatten blocks into sentences while tracking metadata
    interface SentenceItem {
      text: string;
      pageNumber?: number | null;
      sectionTitle?: string | null;
    }

    const allSentences: SentenceItem[] = [];

    for (const block of blocks) {
      const rawText = block.text || (block as any).content || '';
      const normalizedBlockText = TextNormalizer.normalize(rawText);
      if (!normalizedBlockText) continue;

      const sentences = this.splitIntoSentences(normalizedBlockText);
      for (const sent of sentences) {
        allSentences.push({
          text: sent,
          pageNumber: block.pageNumber ?? null,
          sectionTitle: block.sectionTitle ?? null
        });
      }
    }

    if (allSentences.length === 0) {
      return [];
    }

    let i = 0;
    while (i < allSentences.length) {
      const item = allSentences[i];
      const itemTokens = this.estimateTokens(item.text);

      if (currentSentences.length === 0) {
        currentSectionTitle = item.sectionTitle || currentSectionTitle;
        currentPageNumber = item.pageNumber || currentPageNumber;
      }

      // Check if adding this sentence exceeds maxTargetTokens
      if (
        currentTokenCount + itemTokens > this.options.maxTargetTokens &&
        currentTokenCount >= this.options.minTargetTokens
      ) {
        // Emit current chunk
        const chunkContent = currentSentences.join(' ').trim();
        rawChunks.push({
          content: chunkContent,
          pageNumber: currentPageNumber,
          sectionTitle: currentSectionTitle
        });

        // Compute overlap for next chunk
        const { text: overlapText, usedSentences } = this.getOverlapPrefix(currentSentences);
        currentSentences = [...usedSentences];
        currentTokenCount = this.estimateTokens(overlapText);

        // Update metadata for next chunk based on current position
        currentSectionTitle = item.sectionTitle || currentSectionTitle;
        currentPageNumber = item.pageNumber || currentPageNumber;
      }

      currentSentences.push(item.text);
      currentTokenCount += itemTokens;
      if (!currentSectionTitle && item.sectionTitle) {
        currentSectionTitle = item.sectionTitle;
      }
      if (!currentPageNumber && item.pageNumber) {
        currentPageNumber = item.pageNumber;
      }
      i++;
    }

    // Flush any remaining text as the final chunk
    if (currentSentences.length > 0) {
      const finalContent = currentSentences.join(' ').trim();
      // Only discard if practically empty (< 5 chars)
      if (finalContent.length >= 5) {
        rawChunks.push({
          content: finalContent,
          pageNumber: currentPageNumber,
          sectionTitle: currentSectionTitle
        });
      }
    }

    // Convert into final AIKnowledgeChunk objects
    return rawChunks.map((rc, idx) => ({
      document_id: documentId,
      chunk_index: idx,
      content: rc.content,
      content_hash: this.computeHash(rc.content),
      token_count: this.estimateTokens(rc.content),
      page_number: rc.pageNumber ?? null,
      section_title: rc.sectionTitle ?? null,
      embedding_model: modelName
    }));
  }
}
