
import React, { useState } from 'react';
import { SimilarityRequest } from '../types/api';

interface ControlPanelProps {
  onStartAnalysis: (request: SimilarityRequest) => void;
  isAnalyzing: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onStartAnalysis, isAnalyzing }) => {
  const [referencePath, setReferencePath] = useState('C:\\Users\\YourName\\Desktop\\Reference_Logos');
  const [comparisonPath, setComparisonPath] = useState('C:\\Data\\Logo_Database');
  const [threshold, setThreshold] = useState(70);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartAnalysis({
      reference_folder_path: referencePath,
      comparison_folder_path: comparisonPath,
      infringement_threshold: threshold
    });
  };

  return (
    <div className="bg-black/80 backdrop-blur-sm rounded-lg p-12 mb-16 border border-gray-800 shadow-2xl">
      <h2 className="text-4xl font-bold text-white mb-12 text-center tracking-tight">
        Logo Analysis Configuration
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
        <div className="space-y-3">
          <label className="block text-white text-lg font-medium">
            Reference Logos Path
          </label>
          <input
            type="text"
            value={referencePath}
            onChange={(e) => setReferencePath(e.target.value)}
            className="w-full px-6 py-4 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:bg-gray-800 transition-all duration-200 border border-gray-700"
            placeholder="C:\Users\YourName\Desktop\Reference_Logos"
            required
          />
        </div>

        <div className="space-y-3">
          <label className="block text-white text-lg font-medium">
            Comparison Logos Path
          </label>
          <input
            type="text"
            value={comparisonPath}
            onChange={(e) => setComparisonPath(e.target.value)}
            className="w-full px-6 py-4 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:bg-gray-800 transition-all duration-200 border border-gray-700"
            placeholder="C:\Data\Logo_Database"
            required
          />
        </div>

        <div className="space-y-4">
          <label className="block text-white text-lg font-medium">
            Infringement Threshold: {threshold}%
          </label>
          <div className="px-2">
            <input
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider accent-white"
            />
            <div className="flex justify-between text-gray-400 text-sm mt-3">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={isAnalyzing}
            className={`w-full py-5 rounded-lg text-xl font-bold transition-all duration-300 ${
              isAnalyzing 
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                : 'bg-white text-black hover:bg-black hover:text-white border-2 border-white shadow-lg hover:shadow-2xl'
            }`}
          >
            {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
          </button>
          
          {isAnalyzing && (
            <div className="mt-6">
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-white h-2 rounded-full animate-pulse" style={{ width: '45%' }}></div>
              </div>
              <p className="text-gray-400 text-center mt-3">Processing your logos...</p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ControlPanel;
