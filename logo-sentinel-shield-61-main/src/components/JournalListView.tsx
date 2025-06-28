import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Calendar, FileText, Eye, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { getJournalById, JournalRecord } from '../services/api';

interface JournalData {
  id: string;
  journal_no: string;
  journal_date: string;
  total_device_entries: number;
  total_word_entries: number;
  status: string;
  upload_date: string;
  pdf_filename: string;
}

interface JournalListViewProps {
  journals: JournalData[];
  onSelectJournal: (journalId: string) => void;
  onAddJournal: () => void;
}

const JournalListView: React.FC<JournalListViewProps> = ({
  journals,
  onSelectJournal,
  onAddJournal
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredJournals = journals.filter(journal =>
    journal.journal_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    journal.journal_date.includes(searchTerm) ||
    journal.pdf_filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTotalEntries = (journal: JournalData) => {
    return (journal.total_device_entries || 0) + (journal.total_word_entries || 0);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-poppins font-bold text-black dark:text-white mb-2">Journal Management</h2>
          <p className="font-poppins text-gray-600 dark:text-gray-400">
            Manage and view all journal entries ({journals.length} journals found)
          </p>
        </div>
        
        <Button
          onClick={onAddJournal}
          className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Journal</span>
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Input
          placeholder="Search journals by number, date, or filename..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Journal List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJournals.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-xl font-poppins font-semibold text-gray-600 dark:text-gray-400 mb-4">
              {journals.length === 0 ? 'No journals found' : 'No matching journals'}
            </h3>
            <p className="font-poppins text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {searchTerm ? 'Try adjusting your search terms.' : 'Add your first journal to get started.'}
            </p>
          </div>
        ) : (
          filteredJournals.map((journal) => (
            <div key={journal.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white dark:text-black" />
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-poppins ${
                  journal.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                }`}>
                  {journal.status}
                </span>
              </div>

              <h3 className="text-lg font-poppins font-semibold text-black dark:text-white mb-2">
                Journal No: {journal.journal_no}
              </h3>

              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-poppins text-gray-600 dark:text-gray-400">
                    Date: {formatDate(journal.journal_date)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-poppins text-gray-600 dark:text-gray-400">
                    {getTotalEntries(journal)} total entries
                  </span>
                </div>
                <div className="text-xs font-poppins text-gray-500 dark:text-gray-400">
                  Device: {journal.total_device_entries || 0} | Word: {journal.total_word_entries || 0}
                </div>
                <div className="text-xs font-poppins text-gray-500 dark:text-gray-400 truncate">
                  File: {journal.pdf_filename}
                </div>
                <div className="text-xs font-poppins text-gray-500 dark:text-gray-400">
                  Uploaded: {formatDate(journal.upload_date)}
                </div>
              </div>

              <Button
                onClick={() => {
                  console.log('Selected journal ID:', journal.id);
                  console.log('Full journal object:', journal);
                  onSelectJournal(journal.id);
                }}
                className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Journal
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface JournalDetailViewProps {
  journalId: string;
  onBack: () => void;
}

const JournalDetailView: React.FC<JournalDetailViewProps> = ({ journalId, onBack }) => {
  const [journal, setJournal] = useState<JournalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJournal();
  }, [journalId]);

  const fetchJournal = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching journal:', journalId);
      const journalData = await getJournalById(journalId);
      
      if (!journalData) {
        setError('Journal not found');
        return;
      }
      
      setJournal(journalData);
    } catch (err) {
      console.error('Error fetching journal:', err);
      setError(err instanceof Error ? err.message : 'Failed to load journal');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading journal...</div>
      </div>
    );
  }

  if (error || !journal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Journal not found</h1>
        <p className="text-gray-600 mb-6">The requested journal could not be loaded.</p>
        <button
          onClick={onBack}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Back to Journal List
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center space-x-2 text-blue-500 hover:text-blue-700"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Journals</span>
      </button>

      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-6">Journal Details</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <span className="text-sm text-gray-500">Journal No:</span>
            <div className="font-medium text-lg">{journal.journal_no}</div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Date:</span>
            <div className="font-medium">{journal.journal_date}</div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Status:</span>
            <div className={`font-medium ${
              journal.status === 'active' ? 'text-green-600' : 'text-gray-600'
            }`}>
              {journal.status}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Device Entries:</span>
            <div className="font-medium">{journal.total_device_entries?.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Word Entries:</span>
            <div className="font-medium">{journal.total_word_entries?.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Total Entries:</span>
            <div className="font-medium text-lg">
              {((journal.total_device_entries || 0) + (journal.total_word_entries || 0)).toLocaleString()}
            </div>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-sm text-gray-500">Upload Date:</span>
            <div className="font-medium">{journal.upload_date}</div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Filename:</span>
            <div className="font-mono text-sm">{journal.pdf_filename}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalListView;
