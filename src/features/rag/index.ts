/**
 * RAG feature - Document indexing and similarity search.
 *
 * @module features/rag
 */

// Chunking
export { chunkDocument } from './rag.chunker';
// Service
export {
  deleteEmbeddingsBySource,
  findSimilarDocuments,
  findSimilarDocumentsInOrg,
  indexDocument,
} from './rag.service';
// Types
export type {
  ChunkMetadata,
  DocumentChunk,
  IndexDocumentInput,
  SimilarDocument,
} from './rag.types';
