import axios, { AxiosInstance } from 'axios';

export interface OllamaOrder {
  id: string;
  text: string;
  dateCreated?: string | null;
}

export interface OllamaAdmission {
  admissionId: string;
  admissionDate?: string | null;
  orders: OllamaOrder[];
}

/** One RAG reference: an approved Course-in-Ward summary plus its source orders. */
export interface OllamaReference {
  approvedSummary: string;
  sourceOrders?: string[];
  similarity?: number;
}

export interface SummarizeBatchOptions {
  temperature?: number;
  references?: OllamaReference[];
}

export interface OllamaSummaryResult {
  group_id?: string;
  id?: string;
  summary: string | null;
  orders?: { id: string; text: string; dateCreated?: string | null }[];
  success: boolean;
  processing_time_seconds: number;
  error: string | null;
}

export interface OllamaBatchResponse {
  batch_id: string;
  total_groups: number;
  successful: number;
  failed: number;
  results: OllamaSummaryResult[];
}

export interface OllamaEmbedResponse {
  model: string;
  dimension: number;
  embeddings: number[][];
  elapsed_seconds: number;
}

export class OllamaClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000') {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: 150000,
    });
  }

  async health(): Promise<{ status: string; model: string; embedding_model?: string }> {
    const { data } = await this.http.get('/health');
    return data;
  }

  /**
   * Summarize doctor's orders grouped per admission per day. The AI service
   * expects the `admissions` shape and optionally accepts RAG `references`
   * (prior APPROVED summaries of similar orders) to guide style only.
   */
  async summarizeBatch(
    admissions: OllamaAdmission[],
    options: SummarizeBatchOptions = {},
  ): Promise<OllamaBatchResponse> {
    const { data } = await this.http.post<OllamaBatchResponse>(
      '/generate-summary/batch',
      {
        admissions,
        temperature: options.temperature ?? 0.1,
        ...(options.references && options.references.length
          ? { references: options.references }
          : {}),
      },
    );
    return data;
  }

  /** Embed texts using the AI service's local sentence-transformers model. */
  async embedTexts(texts: string[]): Promise<OllamaEmbedResponse> {
    const { data } = await this.http.post<OllamaEmbedResponse>('/embed', { texts });
    return data;
  }

  /** Embed a single text into a 1-D vector (convenience wrapper). */
  async embed(text: string): Promise<number[]> {
    const res = await this.embedTexts([text]);
    return res.embeddings[0];
  }
}