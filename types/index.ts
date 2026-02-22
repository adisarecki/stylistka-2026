export type TryOnStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TryOnState {
  userImage: string | null;
  dressImage: string | null;
  resultImage: string | null;
  status: TryOnStatus;
  errorMessage?: string;
}

export interface AnalyzeResponse {
  uiTitle: string;
  apiQuery: string;
  stylistComment: string;
  benefit?: string;
  tip?: string;
  avoid?: string;
}

export interface TryOnResponse {
  resultUrl: string;
  analysis?: AnalyzeResponse; // Opcjonalna analiza tekstowa
}
