-- Migration: 014_documents.sql
-- Phase 7: Document Context and Knowledge Base
-- Store uploaded documents for AI context enrichment

-- Create documents table
CREATE TABLE IF NOT EXISTS qa_loop_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    content TEXT,
    summary TEXT,
    chunk_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_qa_loop_documents_session ON qa_loop_documents(session_id);

-- Create index for active documents
CREATE INDEX IF NOT EXISTS idx_qa_loop_documents_active ON qa_loop_documents(session_id, is_active) WHERE is_active = true;

-- Add trigger to update session when documents change
CREATE OR REPLACE FUNCTION update_session_document_count()
RETURNS TRIGGER AS $$
BEGIN
    -- This could be used to track document count on sessions if needed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE qa_loop_documents IS 'Uploaded documents providing context to the AI for better exploration';
COMMENT ON COLUMN qa_loop_documents.filename IS 'Original filename of the uploaded document';
COMMENT ON COLUMN qa_loop_documents.file_type IS 'Document type: pdf, markdown, text, html, unknown';
COMMENT ON COLUMN qa_loop_documents.content IS 'Extracted/parsed text content of the document';
COMMENT ON COLUMN qa_loop_documents.summary IS 'AI-generated or extracted summary of the document';
COMMENT ON COLUMN qa_loop_documents.chunk_count IS 'Number of chunks the document was split into for context management';
COMMENT ON COLUMN qa_loop_documents.is_active IS 'Whether this document is included in the AI context';
