import React, { useState } from 'react';
import { Upload, Play, FileText, Settings, Target, Type, Layers } from 'lucide-react';
import { startAnalysis, AnalysisStartRequest } from '../services/api';
import { toast } from 'react-toastify';

interface JournalUploadSectionProps {
  onAnalysisStart: (sessionId: string) => void;
  isAnalyzing: boolean;
  onUploadSuccess?: () => void;
}

const JournalUploadSection: React.FC<JournalUploadSectionProps> = ({
  onAnalysisStart,
  isAnalyzing,
  onUploadSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // FIXED: Added analysis_type and reasonable default limits
  const [analysisConfig, setAnalysisConfig] = useState<{
    analysis_type: 'device_marks' | 'word_marks' | 'both';
    client_device_limit: number;
    client_word_limit: number;
    visual_weight: number;
    text_weight: number;
  }>({
    analysis_type: 'both', // ADDED: Required field
    client_device_limit: 20,        // FIXED: Reasonable limit instead of 1 trillion
    client_word_limit: 20,          // FIXED: Reasonable limit instead of 500 trillion
    visual_weight: 0.5,
    text_weight: 0.5
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        onUploadSuccess?.();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        onUploadSuccess?.();
      }
    }
};

// FIXED: Include analysis_type in the request
  // In JournalUploadSection.tsx - Update the handleStartAnalysis function
const handleStartAnalysis = async () => {
  if (!selectedFile) {
    toast.error('Please select a PDF file first');
    return;
  }

  // Validate analysis configuration
  if (!analysisConfig.analysis_type) {
    toast.error('Please select an analysis type');
    return;
  }

  // Ensure weights sum to 1.0
  const totalWeight = analysisConfig.visual_weight + analysisConfig.text_weight;
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    setAnalysisConfig(prev => ({
      ...prev,
      text_weight: 1.0 - prev.visual_weight
    }));
  }

  try {
    console.log('🔬 Starting analysis with config:', analysisConfig);

    // Create the analysis request
    const analysisRequest: AnalysisStartRequest = {
      journal_pdf: selectedFile,
      analysis_type: analysisConfig.analysis_type as 'device_marks' | 'word_marks' | 'both',
      client_device_limit: analysisConfig.client_device_limit,
      client_word_limit: analysisConfig.client_word_limit,
      visual_weight: analysisConfig.visual_weight,
      text_weight: analysisConfig.text_weight
    };

    console.log('📋 Analysis request:', {
      fileName: analysisRequest.journal_pdf.name,
      analysisType: analysisRequest.analysis_type,
      deviceLimit: analysisRequest.client_device_limit,
      wordLimit: analysisRequest.client_word_limit,
      visualWeight: analysisRequest.visual_weight,
      textWeight: analysisRequest.text_weight
    });

    // Call the API
    const response = await startAnalysis(analysisRequest);
    console.log('✅ Analysis response:', response);

    if (!response.session_id) {
      throw new Error('No session ID received from server');
    }

    // Clear the form
    setSelectedFile(null);
    setAnalysisConfig({
      analysis_type: 'both',
      client_device_limit: 20,
      client_word_limit: 20,
      visual_weight: 0.7,
      text_weight: 0.3
    });

    toast.success(`Analysis started successfully! Session ID: ${response.session_id}`);
    
    // Notify parent component with the session ID
    onAnalysisStart(response.session_id);
    
  } catch (error) {
    console.error('❌ Failed to start analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start analysis';
    toast.error(errorMessage);
  }
};


  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-poppins font-bold text-black dark:text-white mb-2">
          Journal Upload
        </h2>
        <p className="text-gray-500 dark:text-gray-400 font-poppins">
          Upload your journal PDF to start the trademark analysis process.
        </p>
      </div>

      {/* File Upload Area */}
      <div 
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-900'
            : 'border-gray-300 dark:border-gray-700'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="space-y-3">
            <FileText className="w-12 h-12 text-green-500 mx-auto" />
            <div>
              <p className="font-poppins font-medium text-black dark:text-white">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-poppins">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="w-12 h-12 text-gray-400 mx-auto" />
            <div>
              <p className="font-poppins font-medium text-black dark:text-white">
                Upload Journal PDF
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-poppins">
                Drag and drop your journal PDF here, or click to browse
              </p>
            </div>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* ADDED: Analysis Type Selection */}
      {selectedFile && (
        <div className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-poppins font-medium text-black dark:text-white mb-3">
              <Target className="w-4 h-4 inline mr-2" />
              Analysis Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAnalysisConfig(prev => ({ ...prev, analysis_type: 'device_marks' }))}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  analysisConfig.analysis_type === 'device_marks'
                    ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-900'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <span className="font-poppins font-medium text-black dark:text-white">
                    Device Marks
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-poppins">
                  Compare logos and visual elements
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAnalysisConfig(prev => ({ ...prev, analysis_type: 'word_marks' }))}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  analysisConfig.analysis_type === 'word_marks'
                    ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-900'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Type className="w-4 h-4 text-green-500" />
                  <span className="font-poppins font-medium text-black dark:text-white">
                    Word Marks
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-poppins">
                  Compare text and brand names
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAnalysisConfig(prev => ({ ...prev, analysis_type: 'both' }))}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  analysisConfig.analysis_type === 'both'
                    ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-900'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Layers className="w-4 h-4 text-purple-500" />
                  <span className="font-poppins font-medium text-black dark:text-white">
                    Both
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-poppins">
                  Comprehensive analysis
                </p>
              </button>
            </div>
          </div>

          {/* UPDATED: Advanced Configuration with reasonable defaults */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm font-poppins font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
            >
              <Settings className="w-4 h-4" />
              <span>Advanced Settings</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <label className="block text-sm font-poppins font-medium text-black dark:text-white mb-2">
                    Device Marks Limit (Max: 100)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={analysisConfig.client_device_limit}
                    onChange={(e) => setAnalysisConfig(prev => ({ 
                      ...prev, 
                      client_device_limit: Math.min(100, Math.max(1, parseInt(e.target.value) || 1))
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-black text-black dark:text-white font-poppins"
                  />
                </div>

                <div>
                  <label className="block text-sm font-poppins font-medium text-black dark:text-white mb-2">
                    Word Marks Limit (Max: 100)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={analysisConfig.client_word_limit}
                    onChange={(e) => setAnalysisConfig(prev => ({ 
                      ...prev, 
                      client_word_limit: Math.min(100, Math.max(1, parseInt(e.target.value) || 1))
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-black text-black dark:text-white font-poppins"
                  />
                </div>

                {analysisConfig.analysis_type === 'device_marks' || analysisConfig.analysis_type === 'both' ? (
                  <>
                    <div>
                      <label className="block text-sm font-poppins font-medium text-black dark:text-white mb-2">
                        Visual Weight ({analysisConfig.visual_weight})
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={analysisConfig.visual_weight}
                        onChange={(e) => setAnalysisConfig(prev => ({ 
                          ...prev, 
                          visual_weight: parseFloat(e.target.value) 
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-poppins font-medium text-black dark:text-white mb-2">
                        Text Weight ({analysisConfig.text_weight})
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={analysisConfig.text_weight}
                        onChange={(e) => setAnalysisConfig(prev => ({ 
                          ...prev, 
                          text_weight: parseFloat(e.target.value) 
                        }))}
                        className="w-full"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Start Analysis Button */}
          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-6 rounded-lg font-poppins font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>{isAnalyzing ? 'Starting Analysis...' : 'Start Analysis'}</span>
          </button>

          {/* Analysis Summary */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm font-poppins text-blue-800 dark:text-blue-200">
              <strong>Selected:</strong> {analysisConfig.analysis_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} analysis
              {analysisConfig.analysis_type === 'device_marks' && ` with up to ${analysisConfig.client_device_limit} device marks`}
              {analysisConfig.analysis_type === 'word_marks' && ` with up to ${analysisConfig.client_word_limit} word marks`}
              {analysisConfig.analysis_type === 'both' && ` with up to ${analysisConfig.client_device_limit} device marks and ${analysisConfig.client_word_limit} word marks`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalUploadSection;
