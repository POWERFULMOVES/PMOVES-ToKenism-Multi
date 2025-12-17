/**
 * PMOVES-DoX API Type Definitions
 * Replaces `any` types with proper interfaces for type safety
 */

/** Upload response from DoX */
export interface DoXUploadResponse {
  success: boolean;
  document_id: string;
  filename: string;
  message?: string;
}

/** Query response from DoX */
export interface DoXQueryResponse {
  success: boolean;
  results: DoXQueryResult[];
  total: number;
}

/** Individual query result */
export interface DoXQueryResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

/** Analysis response from DoX */
export interface DoXAnalysisResponse {
  success: boolean;
  analysis: {
    summary: string;
    entities: string[];
    topics: string[];
  };
}

/** Generic API response wrapper */
export interface DoXApiResponse<T> {
  data: T;
  status?: number;
  message?: string;
}

/** Search result */
export interface DoXSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
}

/** Source reference */
export interface DoXSource {
  page?: number;
  location?: string;
  confidence: number;
}

/** Document cluster */
export interface DoXCluster {
  id: number;
  documents: string[];
  centroid: number[];
  size: number;
}

/** Cluster metrics */
export interface DoXClusterMetrics {
  silhouette: number;
  inertia: number;
}

/** Fact extracted from document */
export interface DoXFact {
  id: string;
  content: string;
  confidence: number;
  source: DoXSource;
  metadata: Record<string, unknown>;
}

/** Health check response */
export interface DoXHealthResponse {
  status: 'healthy' | 'unhealthy';
  version?: string;
  uptime?: number;
}
