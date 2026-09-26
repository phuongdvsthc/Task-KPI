/**
 * Centralized Configuration for AI-C3 RAG (Retrieval-Augmented Generation).
 * Defines constants, limits, thresholds, and model requirements.
 * Frontends and callers are strictly forbidden from overriding these server boundaries.
 */

export const RAG_CONFIG = {
  // Model specification matching AI-A3 & AI-C2
  EMBEDDING_MODEL: 'text-embedding-004',
  EMBEDDING_DIMENSION: 768,
  DISTANCE_METRIC: 'cosine', // cosine distance <=> where similarity = 1 - cosine_distance

  // Vector retrieval boundaries
  CANDIDATE_TOP_K: 10,       // Max candidate chunks returned by vector search
  MAX_CANDIDATE_LIMIT: 20,   // Absolute ceiling for DB vector query
  CONTEXT_TOP_K: 5,          // Final chunks included in AI prompt context
  SIMILARITY_THRESHOLD: 0.62, // Minimum similarity score (1 - cosine distance)

  // Document diversity: limit max chunks from the same document
  MAX_CHUNKS_PER_DOC: 3,

  // Token budgets
  CONTEXT_TOKEN_BUDGET: 2500, // Maximum total tokens dedicated to reference context
  CHUNK_MAX_TOKENS: 900,      // Maximum token estimate for a single chunk

  // Query limits
  QUERY_MAX_LENGTH: 1000,     // Max character length for user query preparation
  QUERY_MIN_LENGTH: 2,        // Minimum length to warrant semantic retrieval

  // Timeouts (milliseconds)
  TIMEOUT_EMBEDDING_MS: 5000,
  TIMEOUT_SEARCH_MS: 5000,

  // Status labels for client streaming
  STATUS: {
    SEARCHING: 'searching',
    SOURCES_FOUND: 'sources_found',
    NO_SOURCES: 'no_sources',
    UNAVAILABLE: 'unavailable',
  },
} as const;

export type RagRetrievalStatus =
  | 'searching'
  | 'sources_found'
  | 'no_sources'
  | 'unavailable';
