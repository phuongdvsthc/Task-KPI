import { ExtractedBlock, ExtractedDocument, ITextExtractor } from './textExtractor.types';

export class PlainTextExtractor implements ITextExtractor {
  async extract(buffer: Buffer, originalFileName: string): Promise<ExtractedDocument> {
    const rawText = buffer.toString('utf-8');
    if (!rawText || rawText.trim().length === 0) {
      return {
        blocks: [],
        fullText: '',
        pageCount: 1
      };
    }

    const isMarkdown = originalFileName.toLowerCase().endsWith('.md');
    const lines = rawText.split(/\r?\n/);
    const blocks: ExtractedBlock[] = [];

    let currentSectionTitle: string | null = null;
    let currentParagraphLines: string[] = [];

    const flushCurrentParagraph = () => {
      if (currentParagraphLines.length > 0) {
        const text = currentParagraphLines.join('\n').trim();
        if (text) {
          blocks.push({
            text,
            pageNumber: 1,
            sectionTitle: currentSectionTitle
          });
        }
        currentParagraphLines = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      // Check for Markdown heading or plain text title line
      if (isMarkdown && /^#{1,6}\s+/.test(trimmed)) {
        flushCurrentParagraph();
        currentSectionTitle = trimmed.replace(/^#{1,6}\s+/, '').trim();
        continue;
      } else if (!isMarkdown && /^(chương|phần|mục|điều|bài)\s+[0-9ivxabc]+/i.test(trimmed)) {
        flushCurrentParagraph();
        currentSectionTitle = trimmed;
        continue;
      }

      if (trimmed === '') {
        flushCurrentParagraph();
      } else {
        currentParagraphLines.push(line);
      }
    }

    flushCurrentParagraph();

    // If no blocks were created (e.g. single block of text), create one
    if (blocks.length === 0 && rawText.trim()) {
      blocks.push({
        text: rawText.trim(),
        pageNumber: 1,
        sectionTitle: null
      });
    }

    return {
      blocks,
      fullText: rawText,
      pageCount: 1
    };
  }
}
