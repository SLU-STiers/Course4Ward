import axios, { AxiosInstance } from 'axios';

export interface OllamaOrder {
  id: string;
  text: string;
}

export interface OllamaSummaryResult {
  id: string;
  summary: string | null;
  success: boolean;
  processing_time_seconds: number;
  error: string | null;
}

export interface OllamaBatchResponse {
  batch_id: string;
  total: number;
  successful: number;
  failed: number;
  results: OllamaSummaryResult[];
}

export class OllamaClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000') {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: 150000,
    });
  }

  async health(): Promise<{ status: string; model: string }> {
    const { data } = await this.http.get('/health');
    return data;
  }

  async summarizeBatch(
    orders: OllamaOrder[],
    temperature = 0.1,
  ): Promise<OllamaBatchResponse> {
    const { data } = await this.http.post<OllamaBatchResponse>(
      '/generate-summary/batch',
      { orders, temperature },
    );
    return data;
  }
}