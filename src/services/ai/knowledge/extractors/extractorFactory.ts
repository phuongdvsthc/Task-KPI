import { ITextExtractor } from './textExtractor.types';
import { PdfExtractor } from './pdfExtractor';
import { DocxExtractor } from './docxExtractor';
import { PlainTextExtractor } from './plainTextExtractor';

export class ExtractorFactory {
  private static pdfExtractor = new PdfExtractor();
  private static docxExtractor = new DocxExtractor();
  private static textExtractor = new PlainTextExtractor();

  public static getExtractor(mimeType: string, fileName: string): ITextExtractor {
    const ext = (fileName.split('.').pop() || '').toLowerCase();

    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return this.pdfExtractor;
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      ext === 'docx' ||
      ext === 'doc'
    ) {
      return this.docxExtractor;
    }

    if (
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      ext === 'txt' ||
      ext === 'md'
    ) {
      return this.textExtractor;
    }

    throw new Error(
      `Định dạng tệp không được hỗ trợ để trích xuất văn bản (MIME: ${mimeType}, Extension: .${ext}). Hệ thống chỉ hỗ trợ PDF, DOCX, DOC, TXT, MD.`
    );
  }
}
