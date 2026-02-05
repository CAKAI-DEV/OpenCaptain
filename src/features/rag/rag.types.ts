export type ChunkMetadata = {
  chunkIndex: number;
  totalChunks: number;
  sourceType: string;
  sourceId: string;
};

export type DocumentChunk = {
  content: string;
  metadata: ChunkMetadata;
};

export type IndexDocumentInput = {
  content: string;
  sourceType: 'document' | 'conversation' | 'memory';
  sourceId: string;
  organizationId: string;
  projectId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export type SimilarDocument = {
  id: string;
  content: string;
  sourceType: string;
  sourceId: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
};
