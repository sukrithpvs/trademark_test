
import React from 'react';
import { X, Download, Maximize2 } from 'lucide-react';
import { Button } from './ui/button';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceImage: string;
  matchImage: string;
  referenceName: string;
  matchName: string;
  result?: any;
}

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  isOpen,
  onClose,
  referenceImage,
  matchImage,
  referenceName,
  matchName,
  result
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10 flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center space-x-4">
            <Maximize2 className="w-6 h-6 text-gray-500" />
            <div className="text-xl font-poppins font-bold text-black dark:text-white">
              Logo Comparison - Detailed View
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline" 
              size="sm"
              className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Images
            </Button>
            <Button
              variant="outline" 
              size="icon"
              onClick={onClose}
              className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-auto">
          {/* Images Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="flex flex-col space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-poppins font-semibold text-black dark:text-white mb-2">Reference Logo</h3>
                <p className="text-sm font-poppins text-gray-500 dark:text-gray-400">{referenceName}</p>
              </div>
              <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-950 rounded-xl p-8 min-h-[400px] border border-gray-200 dark:border-gray-800">
                <img
                  src={referenceImage}
                  alt="Reference logo"
                  className="max-w-full max-h-full object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-poppins font-semibold text-black dark:text-white mb-2">Potential Match</h3>
                <p className="text-sm font-poppins text-gray-500 dark:text-gray-400">{matchName}</p>
              </div>
              <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-950 rounded-xl p-8 min-h-[400px] border border-gray-200 dark:border-gray-800">
                <img
                  src={matchImage}
                  alt="Match logo"
                  className="max-w-full max-h-full object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          </div>

          {/* Similarity Scores */}
          {result && (
            <div className="bg-gray-50 dark:bg-gray-950 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
              <h4 className="text-lg font-poppins font-semibold text-black dark:text-white mb-4">Similarity Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="text-2xl font-poppins font-bold text-black dark:text-white">
                    {result.text_similarity?.toFixed(1)}%
                  </div>
                  <div className="text-sm font-poppins text-gray-500 dark:text-gray-400">Text Similarity</div>
                </div>
                <div className="text-center p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="text-2xl font-poppins font-bold text-black dark:text-white">
                    {result.vit_similarity?.toFixed(1)}%
                  </div>
                  <div className="text-sm font-poppins text-gray-500 dark:text-gray-400">Visual Similarity</div>
                </div>
                <div className="text-center p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="text-2xl font-poppins font-bold text-black dark:text-white">
                    {result.final_similarity?.toFixed(1)}%
                  </div>
                  <div className="text-sm font-poppins text-gray-500 dark:text-gray-400">Final Score</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageZoomModal;
