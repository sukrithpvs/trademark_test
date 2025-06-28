
import React, { useState } from 'react';
import { SimilarityRequest } from '../types/api';
import { Folder, Play } from 'lucide-react';

interface ConfigurationPanelProps {
  onStartAnalysis: (request: SimilarityRequest) => void;
  isAnalyzing: boolean;
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ 
  onStartAnalysis, 
  isAnalyzing 
}) => {
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
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-6 rounded-xl">
      <div className="mb-4">
        <h2 className="text-xl font-poppins font-bold text-black dark:text-white mb-1">Analysis Configuration</h2>
        <p className="text-sm font-poppins text-gray-500 dark:text-gray-400">
          Set up your logo analysis parameters and folder paths.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-black dark:text-white text-sm font-poppins font-medium">
              <Folder className="inline w-4 h-4 mr-1" />
              Reference Logos Path
            </label>
            <input
              type="text"
              value={referencePath}
              onChange={(e) => setReferencePath(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 text-black dark:text-white border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white text-sm font-poppins rounded-xl"
              placeholder="C:\Users\YourName\Desktop\Reference_Logos"
              required
            />
            <p className="text-xs font-poppins text-gray-500 dark:text-gray-400">
              Path to your company's reference logo files
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-black dark:text-white text-sm font-poppins font-medium">
              <Folder className="inline w-4 h-4 mr-1" />
              Comparison Database Path
            </label>
            <input
              type="text"
              value={comparisonPath}
              onChange={(e) => setComparisonPath(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 text-black dark:text-white border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white text-sm font-poppins rounded-xl"
              placeholder="C:\Data\Logo_Database"
              required
            />
            <p className="text-xs font-poppins text-gray-500 dark:text-gray-400">
              Path to the logo database for comparison
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-black dark:text-white text-sm font-poppins font-medium">
            Infringement Threshold: {threshold}%
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-1 bg-gray-200 dark:bg-gray-800 appearance-none cursor-pointer accent-black dark:accent-white"
            />
            <div className="flex justify-between text-gray-500 dark:text-gray-400 text-xs font-poppins">
              <span>0% (Very Strict)</span>
              <span>50% (Balanced)</span>
              <span>100% (Very Loose)</span>
            </div>
          </div>
          <p className="text-xs font-poppins text-gray-500 dark:text-gray-400">
            Similarity threshold for detecting potential infringements. Lower values are more strict.
          </p>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
          <button
            type="submit"
            disabled={isAnalyzing}
            className={`flex items-center justify-center space-x-2 px-6 py-2 text-sm font-poppins font-medium transition-all border rounded-xl ${
              isAnalyzing 
                ? 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800 cursor-not-allowed' 
                : 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>{isAnalyzing ? 'Starting Analysis...' : 'Start Analysis'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigurationPanel;
