const BASE_URL = 'http://localhost:8000';

export interface AnalysisStartRequest {
  journal_pdf: File;
  analysis_type: 'device_marks' | 'word_marks' | 'both'; // ← Fixed union type
  client_device_limit: number;
  client_word_limit: number;
  visual_weight: number;
  text_weight: number;
}

export interface AnalysisStartResponse {
  session_id: string;
  status: string;
  analysis_type: string;  // Added analysis_type to response
  estimated_time: string;
}

export interface AnalysisStatus {
  session_id: string;
  status: string;
  progress_percent: number;
  current_step: string;
  total_comparisons: number;
  processed_comparisons: number;
  high_risk_found: number;
  medium_risk_found: number;
  no_risk_found: number;
  processing_time: number;
}

export interface BatchResult {
  id: string;
  risk_level: string;
  comparison_type: string;
  final_score: number;
  visual_score?: number;
  text_score?: number;
  logo_name: string;
  logo_path: string;
  text1?: string;
  text2?: string;
  infringement_detected?: boolean;
  client_mark: any;
  journal_mark: any;
  client_text_display?: string;
  journal_text_display?: string;
  text_details?: string;
  visual_details?: string;
}

export interface AnalysisResults {
  session_id: string;
  total_reference_images: number;
  processed_reference_images: number;
  total_processing_time: number;
  summary: {
    total_comparisons: number;
    high_risk_found: number;
    medium_risk_found: number;
    low_risk_found: number;
    no_risk_found: number;
    device_mark_count: number;
    word_mark_count: number;
    filtered_total: number;
    total_infringements: number;
  };
  batch_results: BatchResult[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total: number;
  };
}

// New interface for analysis summary
export interface AnalysisSummary {
  session_id: string;
  status: string;
  progress?: number;
  current_step?: string;
  total_comparisons?: number;
  processing_time?: number;
  device_marks?: {
    total: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
  };
  word_marks?: {
    total: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
  };
}

export interface AnalysisRecord {
  id: string;
  date: string;
  journalName: string;
  totalComparisons: number;
  highRiskFound: number;
  mediumRiskFound: number;
  noRiskFound: number;
  infringements: number;
  infringementRate: number;
  processingTime: number;
  status: 'completed' | 'running' | 'failed';
}

export interface AnalysisHistoryItem {
  id: string;
  date: string;
  journalName: string;
  totalComparisons: number;
  highRiskFound: number;
  mediumRiskFound: number;
  noRiskFound: number;
  infringements: number;
  infringementRate: number;
  processingTime: number;
  status: 'completed' | 'running' | 'failed';
}

export interface JournalUploadResponse {
  journal_id: string;
  filename: string;
  device_entries: number;
  word_entries: number;
  status: string;
}

export interface Journal {
  id: string;
  journal_no: string;
  journal_date: string;
  upload_date: string;
  total_device_entries: number;
  total_word_entries: number;
  status: string;
  pdf_filename: string;
}

export interface JournalRecord {
  id: string;
  journal_no: string;
  journal_date: string;
  total_device_entries: number;
  total_word_entries: number;
  status: string;
  upload_date: string;
  pdf_filename: string;
  pdf_path?: string;
}

export interface JournalData {
  journal_info: Journal;
  entries: any[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface Report {
  id: string;
  session_id: string;
  title: string;
  type: string;
  format: string;
  created_at: string;
  total_results: number;
}

export interface ClientData {
  device_marks: number;
  word_marks: number;
  total: number;
}

// Enhanced error handling
const handleApiError = async (response: Response, endpoint: string) => {
  let errorMessage = `API Error at ${endpoint}: ${response.status}`;
  
  try {
    const errorText = await response.text();
    if (errorText) {
      errorMessage += ` - ${errorText}`;
    }
  } catch (e) {
    console.warn('Could not parse error response');
  }
  
  console.error(errorMessage);
  throw new Error(errorMessage);
};

const makeApiCall = async (url: string, options?: RequestInit) => {
  try {
    console.log(`Making API call to: ${url}`);
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      await handleApiError(response, url);
    }

    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Load failed') {
      console.error(`Network error - Backend not available at ${url}`);
      throw new Error(`Backend server is not running or not accessible at ${BASE_URL}. Please start your backend server.`);
    }
    throw error;
  }
};

// ================================
// ANALYSIS API - UPDATED
// ================================

// Updated startAnalysis function with analysis_type
export const startAnalysis = async (data: AnalysisStartRequest): Promise<AnalysisStartResponse> => {
  try {
    console.log('🚀 Starting analysis with data:', {
      fileName: data.journal_pdf.name,
      fileSize: data.journal_pdf.size,
      analysisType: data.analysis_type,
      deviceLimit: data.client_device_limit,
      wordLimit: data.client_word_limit,
      visualWeight: data.visual_weight,
      textWeight: data.text_weight
    });

    // Validate inputs
    if (!data.journal_pdf) {
      throw new Error('No PDF file provided');
    }

    if (!data.analysis_type || !['device_marks', 'word_marks', 'both'].includes(data.analysis_type)) {
      throw new Error('Invalid analysis type');
    }

    // Create FormData
    const formData = new FormData();
    formData.append('journal_pdf', data.journal_pdf);
    formData.append('analysis_type', data.analysis_type);
    formData.append('client_device_limit', data.client_device_limit.toString());
    formData.append('client_word_limit', data.client_word_limit.toString());
    formData.append('visual_weight', data.visual_weight.toString());
    formData.append('text_weight', data.text_weight.toString());

    console.log('📤 Sending FormData to backend...');

    const response = await fetch(`${BASE_URL}/api/analysis/start`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - let browser set it with boundary
    });

    console.log(`📥 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend error:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.detail || errorText);
      } catch {
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
    }

    const result = await response.json();
    console.log('✅ Analysis started successfully:', result);
    
    // Ensure we return the expected format
    return {
      session_id: result.session_id,
      status: result.status || 'started',
      analysis_type: result.analysis_type || data.analysis_type,
      estimated_time: result.estimated_time || '5-10 minutes'
    };

  } catch (error) {
    console.error('❌ Failed to start analysis:', error);
    throw error;
  }
};

export const getAnalysisStatus = async (sessionId: string): Promise<AnalysisStatus> => {
  try {
    console.log('Fetching analysis status for session:', sessionId);
    const response = await makeApiCall(`${BASE_URL}/api/analysis/${sessionId}/status`);
    
    const result = await response.json();
    console.log('Analysis status received:', result);
    return result;
  } catch (error) {
    console.error('Failed to get analysis status:', error);
    throw error;
  }
};

// Main results endpoint (all results with filtering)
export const getAnalysisResults = async (
  sessionId: string,
  page: number = 1,
  perPage: number = 50,
  comparisonType?: string,  // ← Changed parameter order to match backend
  excludeNoRisk: boolean = true
): Promise<AnalysisResults> => {
  try {
    // Build URL with proper parameter order
    let url = `${BASE_URL}/api/analysis/${sessionId}/results?page=${page}&per_page=${perPage}&exclude_no_risk=${excludeNoRisk}`;
    if (comparisonType) {
      url += `&comparison_type=${comparisonType}`;
    }
    
    console.log(`🔍 API Call: ${url}`);
    
    const response = await makeApiCall(url);
    const result = await response.json();
    
    console.log(`📊 API Response:`, result);
    console.log(`📊 Batch results count: ${result.batch_results?.length || 0}`);
    
    return {
      session_id: result.session_id,
      total_reference_images: result.total_reference_images || 0,
      processed_reference_images: result.processed_reference_images || 0,
      total_processing_time: result.total_processing_time || 0,
      summary: result.summary,
      batch_results: result.batch_results,
      pagination: result.pagination
    };
  } catch (error) {
    console.error('❌ Failed to get analysis results:', error);
    throw error;
  }
};

// NEW: Device results specific endpoint
export const getDeviceResults = async (
  sessionId: string,
  page: number = 1,
  perPage: number = 50,
  excludeNoRisk: boolean = true
): Promise<AnalysisResults> => {
  return getAnalysisResults(sessionId, page, perPage, 'device', excludeNoRisk);
};

// NEW: Word results specific endpoint
export const getWordResults = async (
  sessionId: string,
  page: number = 1,
  perPage: number = 50,
  excludeNoRisk: boolean = true
): Promise<AnalysisResults> => {
  return getAnalysisResults(sessionId, page, perPage, 'word', excludeNoRisk);
};

// NEW: Analysis summary endpoint
export const getAnalysisSummary = async (sessionId: string): Promise<AnalysisSummary> => {
  try {
    console.log('Fetching analysis summary for session:', sessionId);
    const response = await makeApiCall(`${BASE_URL}/api/analysis/${sessionId}/summary`);
    
    const result = await response.json();
    console.log('Analysis summary received:', result);
    return result;
  } catch (error) {
    console.error('Failed to get analysis summary:', error);
    throw error;
  }
};

export const getAnalysisHistory = async (): Promise<AnalysisRecord[]> => {
  try {
    console.log('Fetching analysis history from backend...');
    const response = await makeApiCall(`${BASE_URL}/api/analysis/history`);
    
    const data = await response.json();
    console.log('Analysis history fetched:', data);
    
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: item.id,
        date: item.date,
        journalName: item.journalName,
        totalComparisons: item.totalComparisons || 0,
        highRiskFound: item.highRiskFound || 0,
        mediumRiskFound: item.mediumRiskFound || 0,
        noRiskFound: item.noRiskFound || 0,
        infringements: item.infringements || 0,
        infringementRate: item.infringementRate || 0,
        processingTime: item.processingTime || 0,
        status: item.status || 'unknown'
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Failed to get analysis history:', error);
    return [];
  }
};

// ================================
// JOURNAL API
// ================================

export const uploadJournal = async (journalPdf: File): Promise<JournalUploadResponse> => {
  console.log('Journal upload not yet implemented in backend');
  // For now, return mock data
  return {
    journal_id: `journal-${Date.now()}`,
    filename: journalPdf.name,
    device_entries: Math.floor(Math.random() * 100),
    word_entries: Math.floor(Math.random() * 50),
    status: 'uploaded'
  };
};

export const getJournals = async (): Promise<JournalRecord[]> => {
  try {
    console.log('Fetching journals from API...');
    const response = await makeApiCall(`${BASE_URL}/api/journals`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Journal data received:', data);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to get journals:', error);
    throw error;
  }
};

export const getJournalData = async (journalId: string, page = 1, perPage = 50, entryType = 'all'): Promise<JournalData | null> => {
  try {
    console.log('Journal data endpoint not yet implemented in backend');
    return null;
  } catch (error) {
    console.error('Failed to get journal data:', error);
    return null;
  }
};

export const getJournalById = async (journalId: string): Promise<JournalRecord | null> => {
  try {
    console.log(`Fetching journal with ID: ${journalId}`);
    const response = await makeApiCall(`${BASE_URL}/api/journals/${journalId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error('Journal not found');
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Journal data received:', data);
    
    return data;
  } catch (error) {
    console.error('Failed to get journal by ID:', error);
    throw error;
  }
};

// ================================
// REPORT API
// ================================

export const exportReport = async (data: {
  session_id: string;
  format: string;
  title: string;
  selected_results: any[];
}): Promise<{ report_id: string; download_url: string; format: string; total_results: number }> => {
  try {
    console.log('Exporting report...', data);
    const formData = new FormData();
    formData.append('session_id', data.session_id);
    formData.append('title', data.title);
    formData.append('report_type', 'analysis');
    formData.append('format', data.format);

    const response = await makeApiCall(`${BASE_URL}/api/reports/export`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log('Report exported successfully:', result);
    
    return {
      report_id: result.report_id,
      download_url: `${BASE_URL}/api/reports/${result.report_id}/download`,
      format: data.format,
      total_results: data.selected_results.length
    };
  } catch (error) {
    console.error('Failed to export report:', error);
    // Fallback to mock for now
    return {
      report_id: `report-${Date.now()}`,
      download_url: '#',
      format: data.format,
      total_results: data.selected_results.length
    };
  }
};

export const getReports = async (): Promise<Report[]> => {
  try {
    console.log('Fetching reports from backend...');
    const response = await makeApiCall(`${BASE_URL}/api/reports`);
    
    const data = await response.json();
    console.log('Reports fetched:', data);
    
    if (data.reports && Array.isArray(data.reports)) {
      return data.reports;
    }
    
    return [];
  } catch (error) {
    console.error('Failed to get reports:', error);
    return [];
  }
};

export const downloadReport = async (reportId: string): Promise<Blob> => {
  throw new Error('Download report endpoint not yet implemented');
};

export const deleteReport = async (reportId: string): Promise<{ message: string }> => {
  throw new Error('Delete report endpoint not yet implemented');
};

// ================================
// CLIENT DATA API
// ================================

export const getClientData = async (): Promise<ClientData> => {
  try {
    console.log('Fetching client data from backend database...');
    const response = await makeApiCall(`${BASE_URL}/api/clients`);
    
    const data = await response.json();
    console.log('Client data fetched from database:', data);
    
    return {
      device_marks: data.device_marks || 0,
      word_marks: data.word_marks || 0,
      total: data.total || 0
    };
  } catch (error) {
    console.error('Failed to get client data:', error);
    return { device_marks: 0, word_marks: 0, total: 0 };
  }
};

export const getClientDeviceMarks = async (): Promise<any[]> => {
  try {
    console.log('Fetching client device marks...');
    const response = await makeApiCall(`${BASE_URL}/api/clients/device-marks`);
    
    const data = await response.json();
    console.log('Client device marks fetched:', data);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to get client device marks:', error);
    return [];
  }
};

export const getClientWordMarks = async (): Promise<any[]> => {
  try {
    console.log('Fetching client word marks...');
    const response = await makeApiCall(`${BASE_URL}/api/clients/word-marks`);
    
    const data = await response.json();
    console.log('Client word marks fetched:', data);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to get client word marks:', error);
    return [];
  }
};

// ================================
// UTILITY FUNCTIONS
// ================================

export const healthCheck = async (): Promise<{ status: string; timestamp: string; version: string }> => {
  try {
    const response = await makeApiCall(`${BASE_URL}/api/health`);
    const result = await response.json();
    console.log('Health check successful:', result);
    return result;
  } catch (error) {
    console.error('Failed to check health:', error);
    throw error;
  }
};

// WebSocket connection for real-time progress
export const connectToProgressWebSocket = (sessionId: string, onMessage: (data: any) => void): WebSocket => {
  try {
    const ws = new WebSocket(`ws://localhost:8000/api/analysis/${sessionId}/progress`);
    
    ws.onopen = () => {
      console.log('WebSocket connected for session:', sessionId);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket disconnected for session:', sessionId, 'Code:', event.code, 'Reason:', event.reason);
    };
    
    return ws;
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
    // Return a mock WebSocket that doesn't do anything
    return {
      close: () => {},
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    } as any;
  }
};

// ================================
// CONVENIENCE FUNCTIONS
// ================================

// Convenience function to start device mark analysis
export const startDeviceAnalysis = async (
  journal_pdf: File,
  client_device_limit: number = 20,
  visual_weight: number = 0.5,
  text_weight: number = 0.5
): Promise<AnalysisStartResponse> => {
  return startAnalysis({
    journal_pdf,
    analysis_type: 'device_marks',
    client_device_limit,
    client_word_limit: 0, // Not used for device analysis
    visual_weight,
    text_weight
  });
};

// Convenience function to start word mark analysis
export const startWordAnalysis = async (
  journal_pdf: File,
  client_word_limit: number = 20
): Promise<AnalysisStartResponse> => {
  return startAnalysis({
    journal_pdf,
    analysis_type: 'word_marks',
    client_device_limit: 0, // Not used for word analysis
    client_word_limit,
    visual_weight: 0.5, // Default values
    text_weight: 0.5
  });
};

// Convenience function to start combined analysis
export const startCombinedAnalysis = async (
  journal_pdf: File,
  client_device_limit: number = 20,
  client_word_limit: number = 20,
  visual_weight: number = 0.5,
  text_weight: number = 0.5
): Promise<AnalysisStartResponse> => {
  return startAnalysis({
    journal_pdf,
    analysis_type: 'both',
    client_device_limit,
    client_word_limit,
    visual_weight,
    text_weight
  });
};

