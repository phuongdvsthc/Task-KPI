import { PDFParse } from 'pdf-parse';
import { ExtractedBlock, ExtractedDocument, ITextExtractor } from './textExtractor.types';

export class PdfExtractor implements ITextExtractor {
  async extract(buffer: Buffer, _originalFileName: string): Promise<ExtractedDocument> {
    let parser: PDFParse | null = null;
    try {
      // PDFParse takes data: Buffer or Uint8Array
      parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      
      const blocks: ExtractedBlock[] = [];
      const pages = textResult.pages || [];

      for (const page of pages) {
        const pageText = (page.text || '').trim();
        if (!pageText) continue;

        // Split page content into paragraphs
        const paragraphs = pageText.split(/\r?\n\r?\n/).map(p => p.trim()).filter(Boolean);
        
        let currentSectionTitle: string | null = null;

        for (const para of paragraphs) {
          // Identify heading-like lines: short, uppercase or starting with Chapter/Mục/Điều
          const firstLine = para.split(/\r?\n/)[0].trim();
          if (
            (firstLine.length < 120 && /^(chương|phần|mục|điều|bài|kết luận|phụ lục|quy định|hướng dẫn)\s+[0-9ivxabc]+/i.test(firstLine)) ||
            (firstLine.length < 80 && firstLine === firstLine.toUpperCase() && /[A-ZÀ-Ỹ]/.test(firstLine))
          ) {
            currentSectionTitle = firstLine;
          }

          blocks.push({
            text: para,
            pageNumber: page.num,
            sectionTitle: currentSectionTitle
          });
        }
      }

      const fullText = textResult.text || blocks.map(b => b.text).join('\n\n');

      return {
        blocks,
        fullText,
        pageCount: textResult.total || pages.length || 1
      };
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('password') || msg.includes('PasswordException')) {
        throw new Error('Tệp PDF được bảo vệ bằng mật khẩu. Vui lòng gỡ mật khẩu trước khi xử lý.');
      }
      if (msg.includes('FormatError') || msg.includes('InvalidPDFException')) {
        throw new Error('Định dạng tệp PDF không hợp lệ hoặc bị lỗi hư hỏng.');
      }
      throw new Error(`Lỗi khi trích xuất tài liệu PDF: ${msg || 'Không thể đọc nội dung PDF'}`);
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}
