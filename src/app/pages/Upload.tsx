import { Upload, FileText, Brain, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState, useRef, useEffect } from 'react';
import { uploadPDF, generateSchedule, fetchNurses, healthCheck } from '../services/api';

// Badge states
interface BadgeState {
  ocr: 'idle' | 'loading' | 'done' | 'error';
  scheduling: 'idle' | 'loading' | 'done' | 'error';
  compliance: 'idle' | 'loading' | 'done' | 'error';
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [extractedNurses, setExtractedNurses] = useState<any[] | null>(null);
  const [apiNurses, setApiNurses] = useState<any[] | null>(null);
  const [badgeStates, setBadgeStates] = useState<BadgeState>({
    ocr: 'idle',
    scheduling: 'idle',
    compliance: 'idle'
  });
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      const health = await healthCheck();
      if (health && health.status === 'ok') {
        setBackendStatus('connected');
        // Fetch nurses from API
        const nursesData = await fetchNurses();
        if (nursesData && nursesData.nurses) {
          setApiNurses(nursesData.nurses);
        }
      } else {
        setBackendStatus('error');
        setError('Backend not connected — make sure uvicorn is running on port 8000');
      }
    };
    checkBackend();
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a PDF file only');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setExtractedNurses(null);
    
    // Auto-start OCR extraction
    await extractPDF(selectedFile);
  };

  const extractPDF = async (pdfFile: File) => {
    setIsUploading(true);
    setSuccess('Extracting data from PDF...');
    setBadgeStates(prev => ({ ...prev, ocr: 'loading' }));
    
    const result = await uploadPDF(pdfFile);
    
    if (result && result.nurses) {
      setExtractedNurses(result.nurses);
      setSuccess(`✅ PDF extracted successfully — ${result.nurses_found} nurses found`);
      setBadgeStates(prev => ({ ...prev, ocr: 'done' }));
    } else {
      setError('OCR Agent failed — PDF may be unreadable or backend error');
      setSuccess(null);
      setBadgeStates(prev => ({ ...prev, ocr: 'error' }));
    }
    
    setIsUploading(false);
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

  const animateBadges = async () => {
    // OCR is already done or skipped
    setBadgeStates(prev => ({ ...prev, scheduling: 'loading' }));
    
    // Scheduling badge (2 seconds)
    await new Promise(r => setTimeout(r, 2000));
    setBadgeStates(prev => ({ ...prev, scheduling: 'done', compliance: 'loading' }));
    
    // Compliance badge (1 second)
    await new Promise(r => setTimeout(r, 1000));
    setBadgeStates(prev => ({ ...prev, compliance: 'done' }));
  };

  const handleGenerate = async () => {
    if (backendStatus !== 'connected') {
      setError('Backend not connected — cannot generate schedule');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    // Start badge animation
    await animateBadges();
    
    // Use extracted nurses from OCR, or nurses from API
    const nursesToUse = extractedNurses || apiNurses;
    
    if (!nursesToUse || nursesToUse.length === 0) {
      setError('No nurse data available — upload a PDF or wait for API to load');
      setIsGenerating(false);
      return;
    }
    
    // Call generate schedule API
    const result = await generateSchedule(nursesToUse);
    
    if (result) {
      // Store result in localStorage for dashboard
      localStorage.setItem('scheduleResult', JSON.stringify(result));
      localStorage.setItem('nurses', JSON.stringify(nursesToUse));
      
      // Navigate to dashboard
      navigate('/dashboard');
    } else {
      setError('Schedule generation failed — check agent status in backend');
      setIsGenerating(false);
    }
  };

  const handleDemoClick = async () => {
    if (backendStatus !== 'connected') {
      setError('Backend not connected — cannot run demo');
      return;
    }

    // Use nurses from API (fetched on mount)
    if (apiNurses && apiNurses.length > 0) {
      setExtractedNurses(apiNurses);
      setSuccess(`✅ Demo data loaded — ${apiNurses.length} nurses from API`);
      
      // Wait 0.5 seconds then trigger generate
      setTimeout(async () => {
        await handleGenerate();
      }, 500);
    } else {
      setError('No nurse data available from API — cannot run demo');
    }
  };

  const getBadgeStyle = (state: 'idle' | 'loading' | 'done' | 'error') => {
    if (state === 'done') {
      return { backgroundColor: '#1A3A2F', border: '1px solid #00E5A0' };
    }
    if (state === 'error') {
      return { backgroundColor: '#3A1A1F', border: '1px solid #FF3D5A' };
    }
    return { backgroundColor: '#1A2235' };
  };

  const getBadgeTextColor = (state: 'idle' | 'loading' | 'done' | 'error') => {
    if (state === 'done') return '#00E5A0';
    if (state === 'error') return '#FF3D5A';
    return '#00D4FF';
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

        {/* Backend Status */}
        <div 
          className="mb-4 p-2 rounded-lg text-center"
          style={{ 
            backgroundColor: backendStatus === 'connected' ? 'rgba(0, 229, 160, 0.1)' : 
                            backendStatus === 'error' ? 'rgba(255, 61, 90, 0.1)' : 'rgba(0, 212, 255, 0.1)',
            border: `1px solid ${backendStatus === 'connected' ? '#00E5A0' : 
                                 backendStatus === 'error' ? '#FF3D5A' : '#00D4FF'}`
          }}
        >
          <p style={{ fontSize: '12px', color: backendStatus === 'connected' ? '#00E5A0' : 
                                                   backendStatus === 'error' ? '#FF3D5A' : '#00D4FF' }}>
            {backendStatus === 'checking' ? '⏳ Checking backend connection...' :
             backendStatus === 'connected' ? '✅ Backend connected — all agents ready' :
             '❌ Backend disconnected — start uvicorn on port 8000'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="mb-4 p-3 rounded-lg flex items-center gap-2"
            style={{ 
              backgroundColor: 'rgba(255, 61, 90, 0.2)',
              border: '1px solid #FF3D5A'
            }}
          >
            <AlertCircle size={16} style={{ color: '#FF3D5A' }} />
            <p style={{ fontSize: '14px', color: '#FF3D5A' }}>{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div 
            className="mb-4 p-3 rounded-lg"
            style={{ 
              backgroundColor: 'rgba(0, 229, 160, 0.1)',
              border: '1px solid #00E5A0'
            }}
          >
            <p style={{ fontSize: '14px', color: '#00E5A0' }}>{success}</p>
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
            border: extractedNurses 
              ? '2px solid #00E5A0'  // Solid green when extracted
              : `2px dashed ${isDragging ? '#00D4FF' : file ? '#00E5A0' : 'rgba(0, 212, 255, 0.4)'}`,
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
          <Upload 
            size={32} 
            style={{ 
              color: extractedNurses ? '#00E5A0' : file ? '#00E5A0' : '#00D4FF', 
              marginBottom: '12px' 
            }} 
          />
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
            style={getBadgeStyle(badgeStates.ocr)}
          >
            {badgeStates.ocr === 'loading' ? (
              <Loader2 size={14} className="animate-spin" style={{ color: '#00D4FF' }} />
            ) : badgeStates.ocr === 'error' ? (
              <AlertCircle size={14} style={{ color: '#FF3D5A' }} />
            ) : (
              <FileText size={14} style={{ color: getBadgeTextColor(badgeStates.ocr) }} />
            )}
            <span style={{ fontSize: '13px', color: getBadgeTextColor(badgeStates.ocr) }}>
              {badgeStates.ocr === 'done' ? '✅ OCR Extraction' : 
               badgeStates.ocr === 'error' ? '❌ OCR Failed' : '📄 OCR Extraction'}
            </span>
          </div>
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
            style={getBadgeStyle(badgeStates.scheduling)}
          >
            {badgeStates.scheduling === 'loading' ? (
              <Loader2 size={14} className="animate-spin" style={{ color: '#00D4FF' }} />
            ) : (
              <Brain size={14} style={{ color: getBadgeTextColor(badgeStates.scheduling) }} />
            )}
            <span style={{ fontSize: '13px', color: getBadgeTextColor(badgeStates.scheduling) }}>
              {badgeStates.scheduling === 'done' ? '✅ AI Scheduling' : '🤖 AI Scheduling'}
            </span>
          </div>
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
            style={getBadgeStyle(badgeStates.compliance)}
          >
            {badgeStates.compliance === 'loading' ? (
              <Loader2 size={14} className="animate-spin" style={{ color: '#00D4FF' }} />
            ) : (
              <CheckCircle size={14} style={{ color: getBadgeTextColor(badgeStates.compliance) }} />
            )}
            <span style={{ fontSize: '13px', color: getBadgeTextColor(badgeStates.compliance) }}>
              {badgeStates.compliance === 'done' ? '✅ Compliance Check' : '✅ Compliance Check'}
            </span>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || backendStatus !== 'connected'}
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
            cursor: isGenerating || backendStatus !== 'connected' ? 'not-allowed' : 'pointer',
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generating...
            </>
          ) : (
            'GENERATE SCHEDULE'
          )}
        </button>

        {/* Demo Hint Bar */}
        <div 
          className="mt-4 p-3 rounded-lg text-center cursor-pointer transition-all hover:opacity-80"
          style={{ 
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.3)'
          }}
          onClick={handleDemoClick}
        >
          <p style={{ fontSize: '12px', color: '#00D4FF' }}>
            💡 This is a demo — click anywhere to see the AI in action
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
