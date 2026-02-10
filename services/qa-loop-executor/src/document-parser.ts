import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('document-parser');

/**
 * Supported document types
 */
export type DocumentType = 'pdf' | 'markdown' | 'text' | 'html' | 'unknown';

/**
 * Parsed document result
 */
export interface ParsedDocument {
  filename: string;
  fileType: DocumentType;
  fileSizeBytes: number;
  content: string;
  summary: string;
  chunks: DocumentChunk[];
  chunkCount: number;
  metadata: DocumentMetadata;
}

/**
 * A chunk of document content for context window management
 */
export interface DocumentChunk {
  index: number;
  content: string;
  tokenEstimate: number;
  startLine?: number;
  endLine?: number;
}

/**
 * Document metadata extracted during parsing
 */
export interface DocumentMetadata {
  title?: string;
  headings: string[];
  wordCount: number;
  characterCount: number;
  estimatedTokens: number;
  hasCodeBlocks: boolean;
  hasTables: boolean;
  language?: string;
}

/**
 * Parser options
 */
export interface ParserOptions {
  maxChunkTokens?: number;
  includeMetadata?: boolean;
  generateSummary?: boolean;
  preserveFormatting?: boolean;
}

const DEFAULT_OPTIONS: Required<ParserOptions> = {
  maxChunkTokens: 4000,
  includeMetadata: true,
  generateSummary: true,
  preserveFormatting: true
};

/**
 * Estimate token count for a string (rough approximation)
 * Claude uses ~4 characters per token on average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Detect document type from filename and content
 */
export function detectDocumentType(filename: string, content?: string): DocumentType {
  const extension = filename.toLowerCase().split('.').pop() || '';

  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'txt':
      return 'text';
    case 'html':
    case 'htm':
      return 'html';
    default:
      // Try to detect from content
      if (content) {
        if (content.startsWith('%PDF')) return 'pdf';
        if (content.includes('<!DOCTYPE html') || content.includes('<html')) return 'html';
        if (content.includes('# ') || content.includes('## ')) return 'markdown';
      }
      return 'unknown';
  }
}

/**
 * Parse a document from buffer/string
 */
export async function parseDocument(
  filename: string,
  content: string | Buffer,
  options: ParserOptions = {}
): Promise<ParsedDocument> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  logger.info('Parsing document', { filename, contentLength: content.length });

  // Convert buffer to string if needed
  let textContent: string;
  if (Buffer.isBuffer(content)) {
    textContent = content.toString('utf-8');
  } else {
    textContent = content;
  }

  const fileType = detectDocumentType(filename, textContent);

  // Parse based on type
  let parsedContent: string;
  switch (fileType) {
    case 'pdf':
      parsedContent = await parsePDF(textContent);
      break;
    case 'markdown':
      parsedContent = parseMarkdown(textContent, opts.preserveFormatting);
      break;
    case 'html':
      parsedContent = parseHTML(textContent);
      break;
    case 'text':
    default:
      parsedContent = textContent;
      break;
  }

  // Extract metadata
  const metadata = extractMetadata(parsedContent, fileType);

  // Generate chunks
  const chunks = chunkContent(parsedContent, opts.maxChunkTokens);

  // Generate summary
  const summary = opts.generateSummary
    ? generateSummary(parsedContent, metadata)
    : '';

  return {
    filename,
    fileType,
    fileSizeBytes: Buffer.byteLength(content),
    content: parsedContent,
    summary,
    chunks,
    chunkCount: chunks.length,
    metadata
  };
}

/**
 * Parse PDF content (basic text extraction)
 * Note: For production, use a proper PDF parser like pdf-parse
 */
async function parsePDF(content: string): Promise<string> {
  // Basic PDF text extraction - in production, use pdf-parse library
  // This is a placeholder that handles text-based PDFs

  // Try to extract text between stream and endstream
  const textParts: string[] = [];
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;

  while ((match = streamRegex.exec(content)) !== null) {
    // Try to decode the stream content
    const streamContent = match[1];
    // Extract readable ASCII text
    const readable = streamContent.replace(/[^\x20-\x7E\n]/g, ' ').trim();
    if (readable.length > 10) {
      textParts.push(readable);
    }
  }

  if (textParts.length === 0) {
    // Fallback: extract any readable text
    const readable = content.replace(/[^\x20-\x7E\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return readable.length > 100 ? readable : '[PDF content could not be extracted - consider using plain text or markdown format]';
  }

  return textParts.join('\n\n');
}

/**
 * Parse Markdown content
 */
function parseMarkdown(content: string, preserveFormatting: boolean): string {
  if (preserveFormatting) {
    return content;
  }

  // Strip markdown formatting but preserve structure
  let parsed = content
    // Remove code block markers but keep content
    .replace(/```[\w]*\n([\s\S]*?)```/g, '\n$1\n')
    // Convert headers to plain text with emphasis
    .replace(/^#{1,6}\s+(.+)$/gm, '\n$1\n')
    // Remove bold/italic markers
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove link formatting but keep text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remove image references
    .replace(/!\[.*?\]\(.*?\)/g, '[image]')
    // Clean up excessive whitespace
    .replace(/\n{3,}/g, '\n\n');

  return parsed.trim();
}

/**
 * Parse HTML content
 */
function parseHTML(content: string): string {
  // Strip HTML tags and extract text
  let text = content
    // Remove script and style content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Add newlines for block elements
    .replace(/<\/?(div|p|h[1-6]|li|tr|br)[^>]*>/gi, '\n')
    // Remove all other tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n');

  return text.trim();
}

/**
 * Extract metadata from parsed content
 */
function extractMetadata(content: string, fileType: DocumentType): DocumentMetadata {
  const lines = content.split('\n');
  const headings: string[] = [];

  // Extract headings (for markdown and text)
  if (fileType === 'markdown') {
    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) {
        headings.push(headingMatch[1].trim());
      }
    }
  } else {
    // Look for lines that might be headings (short, possibly uppercase)
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 100 && !trimmed.includes('.') &&
        (trimmed === trimmed.toUpperCase() || /^[A-Z]/.test(trimmed))) {
        headings.push(trimmed);
      }
    }
  }

  // Check for code blocks
  const hasCodeBlocks = content.includes('```') || content.includes('    ') && /\n {4}[a-zA-Z]/m.test(content);

  // Check for tables
  const hasTables = content.includes('|') && /\|[\s-]+\|/.test(content);

  // Word count
  const words = content.split(/\s+/).filter(w => w.length > 0);

  return {
    title: headings[0],
    headings: headings.slice(0, 10),
    wordCount: words.length,
    characterCount: content.length,
    estimatedTokens: estimateTokens(content),
    hasCodeBlocks,
    hasTables
  };
}

/**
 * Split content into chunks that fit within token limits
 */
function chunkContent(content: string, maxTokens: number): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const lines = content.split('\n');

  let currentChunk = '';
  let currentTokens = 0;
  let startLine = 0;
  let lineIndex = 0;

  for (const line of lines) {
    const lineTokens = estimateTokens(line + '\n');

    if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        index: chunks.length,
        content: currentChunk.trim(),
        tokenEstimate: currentTokens,
        startLine,
        endLine: lineIndex - 1
      });

      // Start new chunk
      currentChunk = line + '\n';
      currentTokens = lineTokens;
      startLine = lineIndex;
    } else {
      currentChunk += line + '\n';
      currentTokens += lineTokens;
    }

    lineIndex++;
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      index: chunks.length,
      content: currentChunk.trim(),
      tokenEstimate: currentTokens,
      startLine,
      endLine: lineIndex - 1
    });
  }

  return chunks;
}

/**
 * Generate a summary of the document
 */
function generateSummary(content: string, metadata: DocumentMetadata): string {
  const parts: string[] = [];

  // Add title if available
  if (metadata.title) {
    parts.push(`Title: ${metadata.title}`);
  }

  // Add structure info
  if (metadata.headings.length > 1) {
    parts.push(`Sections: ${metadata.headings.slice(0, 5).join(', ')}${metadata.headings.length > 5 ? '...' : ''}`);
  }

  // Add content stats
  parts.push(`Length: ~${metadata.wordCount} words (~${metadata.estimatedTokens} tokens)`);

  // Add content type indicators
  const indicators: string[] = [];
  if (metadata.hasCodeBlocks) indicators.push('contains code');
  if (metadata.hasTables) indicators.push('contains tables');
  if (indicators.length > 0) {
    parts.push(`Note: ${indicators.join(', ')}`);
  }

  // Add first paragraph as preview (up to 200 chars)
  const firstParagraph = content.split('\n\n')[0]?.trim();
  if (firstParagraph && firstParagraph.length > 50) {
    const preview = firstParagraph.length > 200
      ? firstParagraph.substring(0, 200) + '...'
      : firstParagraph;
    parts.push(`Preview: "${preview}"`);
  }

  return parts.join('\n');
}

/**
 * Combine multiple document summaries for system prompt injection
 */
export function combineDocuments(
  documents: ParsedDocument[],
  maxTotalTokens: number = 50000
): string {
  if (documents.length === 0) return '';

  let combined = '=== USER-PROVIDED DOCUMENTS ===\n\n';
  let totalTokens = estimateTokens(combined);

  for (const doc of documents) {
    // Add document header
    const header = `--- Document: ${doc.filename} ---\n`;
    const headerTokens = estimateTokens(header);

    if (totalTokens + headerTokens + doc.metadata.estimatedTokens <= maxTotalTokens) {
      // Include full document
      combined += header + doc.content + '\n\n';
      totalTokens += headerTokens + doc.metadata.estimatedTokens;
    } else if (totalTokens + headerTokens + estimateTokens(doc.summary) <= maxTotalTokens) {
      // Include summary only
      combined += header + `[Summary: ${doc.summary}]\n\n`;
      totalTokens += headerTokens + estimateTokens(doc.summary);
    } else {
      // Skip document
      combined += header + `[Document too large to include - ${doc.metadata.wordCount} words]\n\n`;
      totalTokens += headerTokens + 50;
    }
  }

  combined += '=== END DOCUMENTS ===\n';

  return combined;
}

export default {
  parseDocument,
  detectDocumentType,
  estimateTokens,
  combineDocuments
};
