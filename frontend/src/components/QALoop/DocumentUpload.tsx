import React, { useState, useRef, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Upload, File, X, Check, Eye, Trash2, FileText, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

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
        return <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
      case 'pdf':
        return <File className="h-4 w-4 text-red-500 dark:text-red-400" />;
      case 'html':
        return <File className="h-4 w-4 text-orange-500 dark:text-orange-400" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getFileTypeBadgeClass = (fileType: string): string => {
    switch (fileType) {
      case 'markdown': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'pdf': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'html': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
      default: return 'bg-muted text-muted-foreground';
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
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed p-6 text-center cursor-pointer transition-colors duration-150',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
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
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-primary">
                Click to upload
              </span>
              {' '}or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {acceptedTypes.join(', ')} up to {formatFileSize(maxFileSize)}
            </p>
          </>
        )}
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
          <X className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setError(null)}
            className="ms-auto h-6 w-6 text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">
            Uploaded Documents ({documents.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className={cn(
                  'flex items-center gap-3 p-3',
                  !doc.isActive && 'opacity-60'
                )}
              >
                {/* File Icon */}
                <div className="flex-shrink-0">
                  {getFileTypeIcon(doc.fileType)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.fileSizeBytes)}
                    {doc.estimatedTokens && ` \u00B7 ~${doc.estimatedTokens.toLocaleString()} tokens`}
                    {doc.chunkCount > 1 && ` \u00B7 ${doc.chunkCount} chunks`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Toggle Active */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggle(doc.id, !doc.isActive)}
                    className={cn(
                      'h-8 w-8',
                      doc.isActive
                        ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
                        : 'text-muted-foreground'
                    )}
                    title={doc.isActive ? 'Click to disable' : 'Click to enable'}
                  >
                    <Check className="h-4 w-4" />
                  </Button>

                  {/* Preview */}
                  {onPreview && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onPreview(doc)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(doc.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-muted-foreground">
        Upload PRDs, specifications, or documentation to help the AI understand your application better.
        Active documents will be included in the AI&apos;s context.
      </p>
    </div>
  );
};

export default DocumentUpload;
