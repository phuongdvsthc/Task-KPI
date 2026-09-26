import mammoth from 'mammoth';
import { ExtractedBlock, ExtractedDocument, ITextExtractor } from './textExtractor.types';

export class DocxExtractor implements ITextExtractor {
  async extract(buffer: Buffer, _originalFileName: string): Promise<ExtractedDocument> {
    try {
      // 1. Extract HTML to identify headings and paragraph structure
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const html = htmlResult.value;

      if (!html || html.trim().length === 0) {
        // Fallback to extractRawText
        const rawResult = await mammoth.extractRawText({ buffer });
        const raw = rawResult.value.trim();
        return {
          blocks: raw ? [{ text: raw, pageNumber: null, sectionTitle: null }] : [],
          fullText: raw,
          pageCount: 1
        };
      }

      // Parse HTML tags to extract headings and paragraphs
      // Split on block boundaries: </h1>, </h2>, </h3>, </h4>, </p>, </li>
      const tagRegex = /<(h[1-6]|p|li)[^>]*>(.*?)<\/\1>/gis;
      const blocks: ExtractedBlock[] = [];
      let match: RegExpExecArray | null;
      let currentSectionTitle: string | null = null;
      const fullTextParts: string[] = [];

      while ((match = tagRegex.exec(html)) !== null) {
        const tagName = match[1].toLowerCase();
        // Strip inner tags
        const textContent = match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        
        if (!textContent) continue;

        if (tagName.startsWith('h')) {
          currentSectionTitle = textContent;
        } else {
          blocks.push({
            text: textContent,
            pageNumber: null,
            sectionTitle: currentSectionTitle
          });
          fullTextParts.push(textContent);
        }
      }

      // If no blocks were found via regex (e.g. non-standard html), fallback to raw text
      if (blocks.length === 0) {
        const rawResult = await mammoth.extractRawText({ buffer });
        const raw = rawResult.value.trim();
        if (raw) {
          const paragraphs = raw.split(/\r?\n\r?\n/).map(p => p.trim()).filter(Boolean);
          for (const p of paragraphs) {
            blocks.push({
              text: p,
              pageNumber: null,
              sectionTitle: null
            });
          }
          return {
            blocks,
            fullText: raw,
            pageCount: 1
          };
        }
      }

      return {
        blocks,
        fullText: fullTextParts.join('\n\n'),
        pageCount: 1
      };
    } catch (err: any) {
      throw new Error(`Không thể trích xuất văn bản từ tệp Word (.docx): ${err.message || 'Tệp bị lỗi hoặc định dạng không hợp lệ'}`);
    }
  }
}
