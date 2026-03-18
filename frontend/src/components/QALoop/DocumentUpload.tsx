import React, { useState, useRef, useCallback } from 'react';
import { FiUpload, FiFile, FiX, FiCheck, FiEye, FiTrash2, FiFileText } from 'react-icons/fi';

export interface UploadedDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSizeBytes: number;
  summary?: string;
  chunkCount: number;
  estimatedTokens?: number;
  isActive: boolean;
  createdAt: string;
}

interface DocumentUploadProps {
  sessionId?: string;
  documents: UploadedDocument[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onToggle: (documentId: string, isActive: boolean) => Promise<void>;
  onPreview?: (document: UploadedDocument) => void;
  disabled?: boolean;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ACCEPTED_TYPES = ['.txt', '.md', '.markdown', '.pdf', '.html'];

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  sessionId,
  documents,
  onUpload,
  onDelete,
  onToggle,
  onPreview,
  disabled = false,
  maxFileSize = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeIcon = (fileType: string): React.ReactNode => {
    switch (fileType) {
      case 'markdown':
        return <FiFileText className="text-blue-500" />;
      case 'pdf':
        return <FiFile className="text-red-500" />;
      case 'html':
        return <FiFile className="text-orange-500" />;
      default:
        return <FiFile className="text-gray-500" />;
    }
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File too large. Maximum size is ${formatFileSize(maxFileSize)}`;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(extension)) {
      return `Unsupported file type. Accepted: ${acceptedTypes.join(', ')}`;
    }

    return null;
  };

  const handleFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      await onUpload(file);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteClick = async (documentId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await onDelete(documentId);
      } catch (err: any) {
        setError(err.message || 'Failed to delete document');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging
            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-sky-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mb-2" />
            <span className="text-sm text-gray-500">Uploading...</span>
          </div>
        ) : (
          <>
            <FiUpload className="mx-auto h-10 w-10 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium text-sky-600 dark:text-sky-400">
                Click to upload
              </span>
              {' '}or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {acceptedTypes.join(', ')} up to {formatFileSize(maxFileSize)}
            </p>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
          <FiX className="flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto hover:bg-red-100 dark:hover:bg-red-900/40 p-1 rounded"
          >
            <FiX />
          </button>
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Uploaded Documents ({documents.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border transition-colors
                  ${doc.isActive
                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60'
                  }
                `}
              >
                {/* File Icon */}
                <div className="flex-shrink-0">
                  {getFileTypeIcon(doc.fileType)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(doc.fileSizeBytes)}
                    {doc.estimatedTokens && ` • ~${doc.estimatedTokens.toLocaleString()} tokens`}
                    {doc.chunkCount > 1 && ` • ${doc.chunkCount} chunks`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Toggle Active */}
                  <button
                    onClick={() => onToggle(doc.id, !doc.isActive)}
                    className={`
                      p-1.5 rounded-lg transition-colors
                      ${doc.isActive
                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }
                    `}
                    title={doc.isActive ? 'Click to disable' : 'Click to enable'}
                  >
                    <FiCheck />
                  </button>

                  {/* Preview */}
                  {onPreview && (
                    <button
                      onClick={() => onPreview(doc)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Preview"
                    >
                      <FiEye />
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteClick(doc.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Upload PRDs, specifications, or documentation to help the AI understand your application better.
        Active documents will be included in the AI&apos;s context.
      </p>
    </div>
  );
};

export default DocumentUpload;
