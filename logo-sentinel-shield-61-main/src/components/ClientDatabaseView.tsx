import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Download, FileSpreadsheet, Search, Database, Maximize2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { getClientData } from '../services/api'; // Fixed import path

interface ClientRecord {
  id: string;
  sNo: number;
  applicationNumber: string;
  doaOrDou: string;
  proprietorName: string;
  companyName: string;
  class: string;
  deviceMark: string;
  address: string;
  locationOfUse: string;
  wordMark: string;
  legalStatus: string;
  entityType: string;
  addressForService: string;
  source: 'device' | 'word';
  goodsServices: string;
}

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}

interface ClientDatabaseViewProps {
  onExportToReports?: (exportData: any) => void;
}

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ isOpen, onClose, imageUrl, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-poppins font-semibold text-black dark:text-white">{title}</h3>
          <Button variant="outline" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-6 flex items-center justify-center">
          <img src={imageUrl} alt={title} className="max-w-full max-h-[60vh] object-contain" />
        </div>
      </div>
    </div>
  );
};

const ClientDatabaseView: React.FC<ClientDatabaseViewProps> = ({ onExportToReports }) => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [newClient, setNewClient] = useState<Partial<ClientRecord>>({});
  const [zoomModal, setZoomModal] = useState<{ isOpen: boolean; imageUrl: string; title: string }>({
    isOpen: false,
    imageUrl: '',
    title: ''
  });

  // Fetch client data from database
  const fetchClientRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Fetching client records from database...');

      // Fetch device marks
      const deviceResponse = await fetch('http://localhost:8000/api/clients/device-marks');
      const deviceMarks = deviceResponse.ok ? await deviceResponse.json() : [];

      // Fetch word marks  
      const wordResponse = await fetch('http://localhost:8000/api/clients/word-marks');
      const wordMarks = wordResponse.ok ? await wordResponse.json() : [];

      console.log('📊 Device marks:', deviceMarks.length);
      console.log('📊 Word marks:', wordMarks.length);

      // Convert to ClientRecord format
      const formattedClients: ClientRecord[] = [];

      // Process device marks
      deviceMarks.forEach((device: any, index: number) => {
        formattedClients.push({
          id: `device-${device.API_appno || index}`,
          sNo: formattedClients.length + 1,
          applicationNumber: device.API_appno || `DEV-${index}`,
          doaOrDou: device.API_dateOfApp || 'N/A',
          proprietorName: device.API_propName || 'Unknown',
          companyName: device.API_buisnessName || '',
          class: device.API_class?.toString() || 'N/A',
          deviceMark: device.API_imagepath || '/placeholder.svg',
          address: device.API_userDetail || '',
          locationOfUse: device.API_userDetail || '',
          wordMark: device.API_tmAppliedFor || '',
          legalStatus: device.API_status || 'Active',
          entityType: 'Company',
          addressForService: device.API_userDetail || '',
          source: 'device',
          goodsServices: device.API_goodsandservices || ''
        });
      });

      // Process word marks
      wordMarks.forEach((word: any, index: number) => {
        formattedClients.push({
          id: `word-${word.API_appno || index}`,
          sNo: formattedClients.length + 1,
          applicationNumber: word.API_appno || `WRD-${index}`,
          doaOrDou: word.API_dateOfApp || 'N/A',
          proprietorName: word.API_propName || 'Unknown',
          companyName: word.API_buisnessName || '',
          class: word.API_class?.toString() || 'N/A',
          deviceMark: '/placeholder.svg',
          address: word.API_userDetail || '',
          locationOfUse: word.API_userDetail || '',
          wordMark: word.API_tmAppliedFor || '',
          legalStatus: word.API_status || 'Active',
          entityType: 'Company',
          addressForService: word.API_userDetail || '',
          source: 'word',
          goodsServices: word.API_goodsandservices || ''
        });
      });

      setClients(formattedClients);
      console.log(`✅ Loaded ${formattedClients.length} client records from database`);

    } catch (error) {
      console.error('❌ Failed to load client data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load client data');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // Load client data on component mount
  useEffect(() => {
    fetchClientRecords();
  }, []);

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.proprietorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.wordMark.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.goodsServices.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(client => client.id));
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleAddClient = () => {
    if (newClient.proprietorName && newClient.applicationNumber) {
      const client: ClientRecord = {
        id: Date.now().toString(),
        sNo: clients.length + 1,
        applicationNumber: newClient.applicationNumber || '',
        doaOrDou: newClient.doaOrDou || '',
        proprietorName: newClient.proprietorName || '',
        companyName: newClient.companyName || '',
        class: newClient.class || '',
        deviceMark: newClient.deviceMark || '/placeholder.svg',
        address: newClient.address || '',
        locationOfUse: newClient.locationOfUse || '',
        wordMark: newClient.wordMark || '',
        legalStatus: newClient.legalStatus || 'Active',
        entityType: newClient.entityType || 'Individual',
        addressForService: newClient.addressForService || '',
        source: 'device',
        goodsServices: newClient.goodsServices || ''
      };
      setClients(prev => [...prev, client]);
      setNewClient({});
      setIsAddingClient(false);
    }
  };

  const handleEditClient = (client: ClientRecord) => {
    setEditingClient(client);
    setNewClient(client);
  };

  const handleUpdateClient = () => {
    if (editingClient && newClient.proprietorName && newClient.applicationNumber) {
      setClients(prev =>
        prev.map(client =>
          client.id === editingClient.id
            ? { ...client, ...newClient }
            : client
        )
      );
      setEditingClient(null);
      setNewClient({});
    }
  };

  const handleDeleteClient = (clientId: string) => {
    setClients(prev => prev.filter(client => client.id !== clientId));
    setSelectedClients(prev => prev.filter(id => id !== clientId));
  };

  const handleExportToExcel = () => {
    const exportData = selectedClients.length > 0
      ? clients.filter(client => selectedClients.includes(client.id))
      : clients;

    const csvContent = [
      'S.No,Application Number,DOA/DOU,Proprietor Name,Company Name,Class,Address,Location of Use,Word Mark,Legal Status,Entity Type,Address for Service,Source,Goods & Services',
      ...exportData.map(client => [
        client.sNo,
        `"${client.applicationNumber}"`,
        `"${client.doaOrDou}"`,
        `"${client.proprietorName}"`,
        `"${client.companyName}"`,
        `"${client.class}"`,
        `"${client.address}"`,
        `"${client.locationOfUse}"`,
        `"${client.wordMark}"`,
        `"${client.legalStatus}"`,
        `"${client.entityType}"`,
        `"${client.addressForService}"`,
        `"${client.source}"`,
        `"${client.goodsServices}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client_database_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Add to reports if callback provided
    if (onExportToReports) {
      const reportData = {
        title: `Client Database Export - ${new Date().toLocaleDateString()}`,
        type: 'client-database-export',
        format: 'excel',
        exportDate: new Date().toISOString(),
        data: exportData.map(client => ({
          ...client,
          exportType: 'Client Database'
        }))
      };
      onExportToReports(reportData);
    }
  };

  const handleImageClick = (imageUrl: string, title: string) => {
    setZoomModal({ isOpen: true, imageUrl, title });
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-black">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Database className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-xl font-poppins font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Loading Client Database
            </h3>
            <p className="font-poppins text-gray-500 dark:text-gray-400">
              Fetching data from backend database...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-black">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-poppins font-semibold text-red-600 dark:text-red-400 mb-2">
              Failed to Load Database
            </h3>
            <p className="font-poppins text-gray-500 dark:text-gray-400 mb-4">
              {error}
            </p>
            <Button 
              onClick={fetchClientRecords}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-poppins font-bold text-black dark:text-white mb-2">Client Database</h2>
          <p className="font-poppins text-gray-600 dark:text-gray-400">
            {clients.length} records loaded from backend database
            {clients.length > 0 && (
              <span className="ml-2">
                • {clients.filter(c => c.source === 'device').length} device marks 
                • {clients.filter(c => c.source === 'word').length} word marks
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={fetchClientRecords}
            variant="outline"
            className="flex items-center space-x-2 border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
          >
            <Database className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={handleExportToExcel}
            variant="outline"
            className="flex items-center space-x-2 border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
            disabled={clients.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </Button>
          <Button
            onClick={() => setIsAddingClient(true)}
            className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Client</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedClients.length > 0 && (
          <span className="text-sm font-poppins text-gray-600 dark:text-gray-400">
            {selectedClients.length} selected
          </span>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAddingClient || editingClient) && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-poppins font-semibold text-black dark:text-white mb-4">
            {editingClient ? 'Edit Client' : 'Add New Client'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              placeholder="Application Number *"
              value={newClient.applicationNumber || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, applicationNumber: e.target.value }))}
            />
            <Input
              placeholder="DOA/DOU"
              value={newClient.doaOrDou || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, doaOrDou: e.target.value }))}
            />
            <Input
              placeholder="Proprietor Name *"
              value={newClient.proprietorName || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, proprietorName: e.target.value }))}
            />
            <Input
              placeholder="Company Name"
              value={newClient.companyName || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, companyName: e.target.value }))}
            />
            <Input
              placeholder="Class"
              value={newClient.class || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, class: e.target.value }))}
            />
            <Input
              placeholder="Address"
              value={newClient.address || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, address: e.target.value }))}
            />
            <Input
              placeholder="Location of Use"
              value={newClient.locationOfUse || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, locationOfUse: e.target.value }))}
            />
            <Input
              placeholder="Word Mark"
              value={newClient.wordMark || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, wordMark: e.target.value }))}
            />
            <Input
              placeholder="Legal Status"
              value={newClient.legalStatus || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, legalStatus: e.target.value }))}
            />
            <select
              value={newClient.entityType || 'Individual'}
              onChange={(e) => setNewClient(prev => ({ ...prev, entityType: e.target.value }))}
              className="h-10 border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-black dark:text-white rounded-md px-3 py-2 text-sm font-poppins focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black"
            >
              <option value="Individual">Individual</option>
              <option value="Company">Company</option>
              <option value="Corporation">Corporation</option>
            </select>
            <Input
              placeholder="Address for Service"
              value={newClient.addressForService || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, addressForService: e.target.value }))}
            />
            <Input
              placeholder="Goods & Services"
              value={newClient.goodsServices || ''}
              onChange={(e) => setNewClient(prev => ({ ...prev, goodsServices: e.target.value }))}
            />
          </div>
          <div className="flex items-center space-x-3 mt-6">
            <Button
              onClick={editingClient ? handleUpdateClient : handleAddClient}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              {editingClient ? 'Update' : 'Add'} Client
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingClient(false);
                setEditingClient(null);
                setNewClient({});
              }}
              className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {clients.length > 0 ? (
        <div className="bg-white dark:bg-black border border-gray-300 dark:border-gray-700 rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-black dark:text-white font-semibold">S.No</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Application Number</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">DOA/DOU</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Proprietor Name</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Company Name</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Class</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Device Mark</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Word Mark</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Source</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Legal Status</TableHead>
                <TableHead className="text-black dark:text-white font-semibold">Goods & Services</TableHead>
                <TableHead className="w-20 text-black dark:text-white font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                  <TableCell>
                    <Checkbox
                      checked={selectedClients.includes(client.id)}
                      onCheckedChange={() => handleSelectClient(client.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-black dark:text-white">{client.sNo}</TableCell>
                  <TableCell className="text-black dark:text-white">{client.applicationNumber}</TableCell>
                  <TableCell className="text-black dark:text-white">{client.doaOrDou}</TableCell>
                  <TableCell className="font-medium text-black dark:text-white">{client.proprietorName}</TableCell>
                  <TableCell className="text-black dark:text-white">{client.companyName}</TableCell>
                  <TableCell className="text-black dark:text-white">{client.class}</TableCell>
                  <TableCell>
                    {client.source === 'device' && client.deviceMark !== '/placeholder.svg' ? (
                      <img 
                        src={client.deviceMark} 
                        alt="Device Mark" 
                        className="w-12 h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleImageClick(client.deviceMark, `${client.proprietorName} - Device Mark`)}
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-black dark:text-white">{client.wordMark}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      client.source === 'device' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {client.source === 'device' ? 'Device' : 'Word'}
                    </span>
                  </TableCell>
                  <TableCell className="text-black dark:text-white">{client.legalStatus}</TableCell>
                  <TableCell className="text-black dark:text-white max-w-xs truncate" title={client.goodsServices}>
                    {client.goodsServices}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClient(client)}
                        className="h-8 w-8 p-0 border-gray-300 dark:border-gray-700"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClient(client.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 border-gray-300 dark:border-gray-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-black">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-xl font-poppins font-semibold text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm ? 'No matching clients found' : 'No client data available'}
          </h3>
          <p className="font-poppins text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {searchTerm ? 'Try adjusting your search terms.' : 'Client data will be loaded from your backend database.'}
          </p>
          {!searchTerm && (
            <Button 
              onClick={fetchClientRecords}
              className="mt-4 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              <Database className="w-4 h-4 mr-2" />
              Load Data
            </Button>
          )}
        </div>
      )}

      <ImageZoomModal
        isOpen={zoomModal.isOpen}
        onClose={() => setZoomModal({ isOpen: false, imageUrl: '', title: '' })}
        imageUrl={zoomModal.imageUrl}
        title={zoomModal.title}
      />
    </div>
  );
};

export default ClientDatabaseView;