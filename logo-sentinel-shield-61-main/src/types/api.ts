
export interface SimilarityRequest {
  reference_folder_path: string;
  comparison_folder_path: string;
  infringement_threshold: number;
}

export interface ComparisonResult {
  id: string;
  risk_level: string;
  comparison_type: string;
  client_mark: any;
  journal_mark: any;
  client_text_display: string;
  journal_text_display: string;
  logo_name?: string;
  logo_path?: string;
  text1?: string;
  text2?: string;
  text_similarity?: number;
  vit_similarity?: number;
  final_similarity?: number;
  infringement_detected?: boolean;
}

// Update the BatchResult interface to match the new API structure

export interface BatchResult {
  id: string;
  risk_level: string;                    // "High", "Medium", "Low", "No Risk"
  comparison_type: string;               // "device_mark" or "word_mark"
  final_score: number;
  visual_score?: number;                 // Optional for word marks
  text_score?: number;
  logo_name: string;
  logo_path: string;
  text1?: string;                        // Optional
  text2?: string;                        // Optional
  infringement_detected?: boolean;
  client_mark: {
    app_no?: string;
    application_number?: string;
    date_of_app?: string;
    class?: string;
    status?: string;
    tm_applied_for?: string;
    user_detail?: string;
    valid_upto?: string;
    prop_name?: string;
    business_name?: string;
    image_path?: string;
    goods_services?: string;
    class_description?: string;
  };
  journal_mark: {
    application_number?: string;
    application_date?: string;
    company_name?: string;
    address?: string;
    goods_services?: string;
    image_path?: string;
    class?: string;
    entity_type?: string;
    address_for_service?: string;
    usage_details?: string;
    location_of_use?: string;
    journal_date?: string;
    class_description?: string;
    word_mark?: string;
    tm_applied_for?: string;
  };
  client_text_display?: string;
  journal_text_display?: string;
  text_details?: string;
  visual_details?: string;
}

export interface AnalysisSummary {
  total_comparisons: number;
  high_risk_found: number;
  medium_risk_found: number;
  no_risk_found: number;
  total_infringements?: number;
  avg_processing_time_per_reference?: number;
  images_per_second?: number;
  infringement_rate_percent?: number;
  processing_time?: number;
}

export interface AnalysisResponse {
  session_id: string;
  total_reference_images: number;
  processed_reference_images: number;
  total_processing_time: number;
  reference_folder_path?: string;
  comparison_folder_path?: string;
  summary: AnalysisSummary;
  batch_results: ComparisonResult[];
  pagination?: {
    page: number;
    per_page: number;
    total_pages: number;
    total: number;
  };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export interface RootResponse {
  message: string;
  version: string;
}

// Backend-specific interfaces to match your API
export interface BackendAnalysisResult {
  session_id: string;
  total_reference_images: number;
  processed_reference_images: number;
  total_processing_time: number;
  summary: {
    total_comparisons: number;
    high_risk_found: number;
    medium_risk_found: number;
    no_risk_found: number;
  };
  batch_results: BackendComparisonResult[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total: number;
  };
}

export interface BackendComparisonResult {
  id: string;
  risk_level: 'high' | 'medium' | 'low';
  comparison_type: string;
  client_mark: any;
  journal_mark: any;
  client_text_display: string;
  journal_text_display: string;
}

export interface BackendAnalysisStatus {
  session_id: string;
  status: 'started' | 'processing' | 'completed' | 'failed';
  progress_percent: number;
  current_step: string;
  total_comparisons: number;
  processed_comparisons: number;
  high_risk_found: number;
  medium_risk_found: number;
  no_risk_found: number;
  processing_time: number;
}

export interface BackendClientData {
  device_marks: number;
  word_marks: number;
  total: number;
}

export interface BackendDeviceMark {
  API_appno: string;
  API_dateOfApp: string;
  API_class: string;
  API_status: string;
  API_tmAppliedFor: string;
  API_userDetail: string;
  API_validUpto: string;
  API_propName: string;
  API_buisnessName: string;
  API_imagepath: string;
  API_goodsAndserice: string;
}

export interface BackendWordMark {
  API_appno: string;
  API_dateOfApp: string;
  API_class: string;
  API_status: string;
  API_tmAppliedFor: string;
  API_userDetail: string;
  API_validUpto: string;
  API_propName: string;
  API_buisnessName: string;
  API_goodsAndSerice: string;
}
