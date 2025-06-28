
import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

interface JournalViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationNumber: string;
}

const JournalViewerModal: React.FC<JournalViewerModalProps> = ({
  isOpen,
  onClose,
  applicationNumber
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
        className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10 flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <ExternalLink className="w-6 h-6 text-gray-500" />
            <div className="text-xl font-poppins font-bold text-black dark:text-white">
              Trademark Journal - {applicationNumber}
            </div>
          </div>
          <Button
            variant="outline" 
            size="icon"
            onClick={onClose}
            className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="bg-gray-50 dark:bg-gray-950 rounded-xl p-8 h-full flex items-center justify-center border border-gray-200 dark:border-gray-800">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <ExternalLink className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-poppins font-bold text-black dark:text-white mb-4">
                Trademark Journal Viewer
              </h3>
              <p className="font-poppins text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                This is a mock journal viewer for application <strong>{applicationNumber}</strong>. 
                In a real implementation, this would display the actual trademark journal page with detailed application information, images, and legal status.
              </p>
              <div className="space-y-4 text-left max-w-lg mx-auto">
                <div className="bg-white dark:bg-black rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                  <div className="font-poppins font-semibold text-black dark:text-white mb-2">Application Details</div>
                  <div className="space-y-2 text-sm font-poppins text-gray-600 dark:text-gray-400">
                    <div>Application Number: {applicationNumber}</div>
                    <div>Status: Published</div>
                    <div>Filing Date: Various dates</div>
                    <div>Publication Date: Various dates</div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-black rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                  <div className="font-poppins font-semibold text-black dark:text-white mb-2">Integration Note</div>
                  <div className="text-sm font-poppins text-gray-600 dark:text-gray-400">
                    This modal would integrate with official trademark journal APIs to display actual legal documents and application details.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalViewerModal;
