/**
 * Text Extractor Types for AI Knowledge Documents (AI-C2)
 */

export interface ExtractedBlock {
  text: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
}

export interface ExtractedDocument {
  blocks: ExtractedBlock[];
  fullText: string;
  pageCount?: number;
  metadata?: Record<string, any>;
}

export interface ITextExtractor {
  extract(buffer: Buffer, originalFileName: string): Promise<ExtractedDocument>;
}
