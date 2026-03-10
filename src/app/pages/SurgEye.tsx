import { useEffect, useState, useRef, useCallback } from 'react';
import { MainNavbar } from '../components/MainNavbar';
import { AlertTriangle, Camera, CheckCircle, XCircle, Clock, FileText, Loader2 } from 'lucide-react';

interface InstrumentInfo {
  count: number;
  avg_confidence?: number;
}

interface TimelineEvent {
  time: string;
  instrument: string;
  action: string;
  confidence?: number;
}

interface CheckResult {
  passed: boolean;
  mismatches?: Array<{
    class: string;
    expected: number;
    actual: number;
    difference: number;
  }>;
}

interface Investigation {
  id: string;
  nurse_id: string;
  nurse_name: string;
  surgery_id: string;
  missing_items: Record<string, number>;
  status: string;
  created_at: string;
}

export default function SurgEyePage() {
  const [counts, setCounts] = useState<Record<string, InstrumentInfo>>({});
  const [alerts, setAlerts] = useState<string[]>([]);
  const [frame, setFrame] = useState('');
  const [connected, setConnected] = useState(false);
  const [procedureStarted, setProcedureStarted] = useState(false);
  const [procedureEnded, setProcedureEnded] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [baseline, setBaseline] = useState<Record<string, InstrumentInfo> | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting');
  
  // Investigation state
  const [investigationId, setInvestigationId] = useState<string | null>(null);
  const [flaggedNurse, setFlaggedNurse] = useState<string | null>(null);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [showInvestigationModal, setShowInvestigationModal] = useState(false);
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);
  const [investigationEvidence, setInvestigationEvidence] = useState<any>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect to WebSocket with auto-reconnect
  useEffect(() => {
    const connect = () => {
      console.log('[WS] Connecting...');
      setWsStatus('connecting');
      
      wsRef.current = new WebSocket('ws://localhost:8005/ws');
      
      wsRef.current.onopen = () => {
        console.log('[WS] Connected!');
        setWsStatus('connected');
        setConnected(true);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            console.error('[WS] Error:', data.error);
            return;
          }
          
          setFrame(data.frame);
          setCounts(data.counts);
          setProcedureStarted(data.procedure_started);
          setProcedureEnded(data.procedure_ended);
          
          if (data.baseline) {
            setBaseline(data.baseline);
          }
          
          if (data.alerts?.length > 0) {
            setAlerts(data.alerts);
          } else {
            setAlerts([]);
          }
          
          // Handle investigation trigger
          if (data.investigation_id) {
            setInvestigationId(data.investigation_id);
            setFlaggedNurse(data.flagged_nurse);
            fetchInvestigations();
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('[WS] Disconnected, retrying in 2s...');
        setWsStatus('reconnecting');
        setConnected(false);
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };
      
      wsRef.current.onerror = () => {
        wsRef.current?.close();
      };
    };
    
    connect();
    
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  // Fetch investigations
  const fetchInvestigations = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8005/api/investigations');
      const data = await response.json();
      setInvestigations(data.investigations || []);
    } catch (error) {
      console.error('Error fetching investigations:', error);
    }
  }, []);

  // Fetch timeline periodically
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await fetch('http://localhost:8005/timeline');
        const data = await response.json();
        setTimeline(data.timeline || []);
      } catch (error) {
        console.error('Error fetching timeline:', error);
      }
    };

    if (procedureStarted) {
      fetchTimeline();
      const interval = setInterval(fetchTimeline, 2000);
      return () => clearInterval(interval);
    }
  }, [procedureStarted]);

  // Set baseline (pre-op)
  const setBaselineCount = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8005/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.status === 'baseline set') {
        setProcedureStarted(true);
        setBaseline(data.counts);
      } else {
        alert('⚠️ ' + data.message);
      }
    } catch (error) {
      console.error('Error setting baseline:', error);
      alert('❌ Failed to set baseline');
    }
  }, []);

  // Post-op check
  const performCheck = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8005/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setCheckResult(data);
      setProcedureEnded(true);
    } catch (error) {
      console.error('Error performing check:', error);
      alert('❌ Failed to perform check');
    }
  }, []);

  // Reset for new procedure
  const resetProcedure = useCallback(async () => {
    try {
      await fetch('http://localhost:8005/reset', { method: 'POST' });
      setProcedureStarted(false);
      setProcedureEnded(false);
      setCheckResult(null);
      setBaseline(null);
      setAlerts([]);
      setCounts({});
      setTimeline([]);
      setInvestigationId(null);
      setFlaggedNurse(null);
    } catch (error) {
      console.error('Error resetting:', error);
    }
  }, []);

  // View investigation evidence
  const viewEvidence = async (investigation: Investigation) => {
    try {
      const response = await fetch(`http://localhost:8005/api/investigations/${investigation.id}`);
      const data = await response.json();
      setSelectedInvestigation(investigation);
      setInvestigationEvidence(data);
      setShowInvestigationModal(true);
    } catch (error) {
      console.error('Error fetching evidence:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <MainNavbar />
      
      <div className="flex-1 flex">
        {/* Main Video Section */}
        <div className="flex-1 p-4 flex flex-col">
          {/* Investigation Alert Banner */}
          {investigationId && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-400" size={24} />
                <div>
                  <span className="text-red-400 font-bold">MISSING INSTRUMENT — Investigation Opened</span>
                  <p className="text-red-300 text-sm">Nurse <strong>{flaggedNurse}</strong> has been flagged</p>
                </div>
              </div>
              <button 
                onClick={() => viewEvidence(investigations[0])}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                View Investigation
              </button>
            </div>
          )}

          {/* Video Feed */}
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
            {frame ? (
              <img 
                src={`data:image/jpeg;base64,${frame}`} 
                alt="Surgical Feed" 
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-400">
                <Camera size={48} className="mx-auto mb-4 opacity-50" />
                <p>Waiting for video feed...</p>
                <p className="text-sm mt-2">Ensure camera is connected and server is running</p>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="mt-4 flex gap-4 justify-center">
            {!procedureStarted ? (
              <button 
                onClick={setBaselineCount}
                disabled={!connected}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle size={20} />
                Set Baseline (Pre-op)
              </button>
            ) : (
              <>
                {!procedureEnded ? (
                  <button 
                    onClick={performCheck}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                  >
                    <Camera size={20} />
                    End Procedure & Check
                  </button>
                ) : (
                  <button 
                    onClick={resetProcedure}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
                  >
                    New Procedure
                  </button>
                )}
              </>
            )}
          </div>

          {/* Check Result */}
          {checkResult && (
            <div className={`mt-4 p-4 rounded-lg ${checkResult.passed ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'}`}>
              <div className="flex items-center gap-2">
                {checkResult.passed ? (
                  <CheckCircle className="text-green-400" size={24} />
                ) : (
                  <XCircle className="text-red-400" size={24} />
                )}
                <span className={`font-bold ${checkResult.passed ? 'text-green-400' : 'text-red-400'}`}>
                  {checkResult.passed ? 'PASS - All instruments accounted for' : 'FAIL - Instrument count mismatch'}
                </span>
              </div>
              {checkResult.mismatches && checkResult.mismatches.length > 0 && (
                <div className="mt-2 text-sm text-gray-300">
                  {checkResult.mismatches.map((m, i) => (
                    <div key={i}>
                      <strong>{m.class}</strong>: Expected {m.expected}, Found {m.actual}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 p-4 overflow-y-auto">
          {/* Connection Status */}
          <div className="mb-4 p-3 rounded-lg bg-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Status</span>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                wsStatus === 'connected' ? 'bg-green-500 text-white' :
                wsStatus === 'reconnecting' ? 'bg-yellow-500 text-black' : 
                'bg-red-500 text-white'
              }`}>
                {wsStatus === 'connected' ? '🟢 Live' :
                 wsStatus === 'reconnecting' ? '🟡 Reconnecting' : 
                 '🔴 Offline'}
              </span>
            </div>
          </div>

          {/* Instrument Count */}
          <div className="mb-4 p-3 rounded-lg bg-gray-700">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <FileText size={18} />
              Instrument Count
            </h3>
            {Object.keys(counts).length === 0 ? (
              <p className="text-gray-400 text-sm">No instruments detected</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(counts).map(([cls, info]) => (
                  <div key={cls} className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">{cls.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${
                        baseline && baseline[cls]?.count !== info.count ? 'text-red-400' : 'text-white'
                      }`}>
                        {info.count}
                        {baseline && baseline[cls] && (
                          <span className="text-gray-500 text-xs ml-1">/ {baseline[cls].count}</span>
                        )}
                      </span>
                      {info.avg_confidence && (
                        <span className={`text-xs px-1 rounded ${
                          info.avg_confidence >= 0.8 ? 'bg-green-500/20 text-green-400' : 
                          info.avg_confidence >= 0.6 ? 'bg-yellow-500/20 text-yellow-400' : 
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {(info.avg_confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500">
              <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                <AlertTriangle size={18} />
                Alerts
              </h3>
              {alerts.map((alert, i) => (
                <p key={i} className="text-red-300 text-sm">{alert}</p>
              ))}
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-gray-700">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Clock size={18} />
                Timeline ({timeline.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {timeline.slice(-10).reverse().map((event, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{event.time}</span>
                    <span className="text-gray-300">{event.instrument}</span>
                    <span className={`text-xs px-1 rounded ${
                      event.action === 'missing' ? 'bg-red-500/20 text-red-400' :
                      event.action === 'returned' ? 'bg-green-500/20 text-green-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {event.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Investigations */}
          {investigations.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50">
              <h3 className="text-red-400 font-bold mb-3">Active Investigations</h3>
              <div className="space-y-2">
                {investigations.map((inv) => (
                  <div key={inv.id} className="p-2 bg-gray-800 rounded text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-white">{inv.nurse_name}</span>
                      <button 
                        onClick={() => viewEvidence(inv)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs"
                      >
                        View Evidence
                      </button>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">
                      {Object.entries(inv.missing_items).map(([k, v]) => `${v}x ${k}`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Investigation Evidence Modal */}
      {showInvestigationModal && selectedInvestigation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Investigation Report</h2>
              <button 
                onClick={() => setShowInvestigationModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Nurse Info */}
              <div className="p-4 bg-gray-700 rounded-lg">
                <h3 className="text-gray-400 text-sm mb-2">Flagged Nurse</h3>
                <p className="text-white font-bold">{selectedInvestigation.nurse_name}</p>
                <p className="text-gray-400 text-sm">ID: {selectedInvestigation.nurse_id}</p>
              </div>
              
              {/* Surgery Info */}
              <div className="p-4 bg-gray-700 rounded-lg">
                <h3 className="text-gray-400 text-sm mb-2">Surgery ID</h3>
                <p className="text-white">{selectedInvestigation.surgery_id}</p>
              </div>
            </div>

            {/* Missing Instruments */}
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg">
              <h3 className="text-red-400 font-bold mb-2">Missing Instruments</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(selectedInvestigation.missing_items).map(([instrument, count]) => (
                  <div key={instrument} className="text-white">
                    <span className="font-bold">{count}x</span> {instrument}
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence Images */}
            {investigationEvidence && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-gray-400 text-sm mb-2">Baseline Scan (Pre-op)</h3>
                  {investigationEvidence.baseline_image ? (
                    <img 
                      src={`data:image/png;base64,${investigationEvidence.baseline_image}`}
                      alt="Baseline"
                      className="w-full rounded-lg"
                    />
                  ) : (
                    <div className="bg-gray-700 rounded-lg h-48 flex items-center justify-center text-gray-500">
                      No image
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-gray-400 text-sm mb-2">Post-op Scan</h3>
                  {investigationEvidence.postop_image ? (
                    <img 
                      src={`data:image/png;base64,${investigationEvidence.postop_image}`}
                      alt="Post-op"
                      className="w-full rounded-lg"
                    />
                  ) : (
                    <div className="bg-gray-700 rounded-lg h-48 flex items-center justify-center text-gray-500">
                      No image
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            {investigationEvidence?.report?.timeline && (
              <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                <h3 className="text-white font-bold mb-2">Event Timeline</h3>
                <div className="space-y-2">
                  {investigationEvidence.report.timeline.map((event: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">{event.time}</span>
                      <span className="text-gray-300">{event.instrument}</span>
                      <span className="text-gray-400">{event.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setShowInvestigationModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
              <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
                Export Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
