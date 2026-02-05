import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { DocumentChunk } from './rag.types';

const DEFAULT_CHUNK_SIZE = 400;
const DEFAULT_CHUNK_OVERLAP = 50;

export async function chunkDocument(
  content: string,
  sourceType: string,
  sourceId: string,
  options?: { chunkSize?: number; chunkOverlap?: number }
): Promise<DocumentChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options?.chunkSize ?? DEFAULT_CHUNK_SIZE,
    chunkOverlap: options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  const chunks = await splitter.splitText(content);

  return chunks.map((chunk, index) => ({
    content: chunk,
    metadata: {
      chunkIndex: index,
      totalChunks: chunks.length,
      sourceType,
      sourceId,
    },
  }));
}
