import { Upload, FileText, Brain, CheckCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState, useRef } from 'react';
import { uploadPDF } from '../services/api';

export default function UploadPage() {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a PDF file only');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    
    const result = await uploadPDF(file);
    
    if (result) {
      localStorage.setItem('nurses', JSON.stringify(result.nurses));
      navigate('/processing');
    } else {
      setError('Failed to upload PDF. Please try again.');
    }
    
    setIsUploading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#0A0F1E' }}>
      <div style={{ width: '520px' }}>
        {/* Logo */}
        <div className="mb-16">
          <h1 
            className="text-2xl tracking-tight"
            style={{ 
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              color: '#00D4FF'
            }}
          >
            NurseAI
          </h1>
        </div>

        {/* Hero Text */}
        <div className="mb-12">
          <h2 
            className="mb-4"
            style={{ 
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '36px',
              lineHeight: '1.2',
              color: '#FFFFFF'
            }}
          >
            Smart Rostering Starts With One File
          </h2>
          <p style={{ fontSize: '16px', color: '#6B7280' }}>
            Upload your existing roster PDF and let our AI agents optimize your scheduling
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="mb-4 p-3 rounded-lg"
            style={{ 
              backgroundColor: 'rgba(255, 61, 90, 0.2)',
              border: '1px solid #FF3D5A'
            }}
          >
            <p style={{ fontSize: '14px', color: '#FF3D5A' }}>{error}</p>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        {/* Upload Box */}
        <div
          className="mb-8 flex flex-col items-center justify-center cursor-pointer transition-all"
          style={{
            width: '480px',
            height: '200px',
            backgroundColor: '#111827',
            border: `2px dashed ${isDragging ? '#00D4FF' : file ? '#00E5A0' : 'rgba(0, 212, 255, 0.4)'}`,
            borderRadius: '12px',
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} style={{ color: file ? '#00E5A0' : '#00D4FF', marginBottom: '12px' }} />
          <p style={{ fontSize: '16px', color: '#FFFFFF', marginBottom: '4px' }}>
            {file ? file.name : 'Drop your PDF here'}
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            {file ? 'Click to change file' : 'Supports scanned & digital PDFs'}
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex gap-3 mb-8">
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ backgroundColor: '#1A2235' }}
          >
            <FileText size={14} style={{ color: '#00D4FF' }} />
            <span style={{ fontSize: '13px', color: '#00D4FF' }}>📋 OCR Extraction</span>
          </div>
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ backgroundColor: '#1A2235' }}
          >
            <Brain size={14} style={{ color: '#00D4FF' }} />
            <span style={{ fontSize: '13px', color: '#00D4FF' }}>🧠 AI Scheduling</span>
          </div>
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ backgroundColor: '#1A2235' }}
          >
            <CheckCircle size={14} style={{ color: '#00D4FF' }} />
            <span style={{ fontSize: '13px', color: '#00D4FF' }}>✅ Compliance Check</span>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!file || isUploading}
          className="w-full transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            width: '480px',
            height: '48px',
            backgroundColor: '#00D4FF',
            color: '#0A0F1E',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '1px',
            borderRadius: '8px',
            border: 'none',
            cursor: file && !isUploading ? 'pointer' : 'not-allowed',
          }}
        >
          {isUploading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Uploading...
            </>
          ) : (
            'GENERATE SCHEDULE'
          )}
        </button>

        {/* Demo Note */}
        <div 
          className="mt-4 p-3 rounded-lg text-center"
          style={{ 
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.3)'
          }}
        >
          <p style={{ fontSize: '12px', color: '#00D4FF' }}>
            💡 Upload a PDF with nurse roster data to get started
          </p>
        </div>

        {/* Footer Text */}
        <p 
          className="text-center mt-8"
          style={{ fontSize: '12px', color: '#6B7280' }}
        >
          Your data never leaves the hospital system
        </p>
      </div>
    </div>
  );
}
