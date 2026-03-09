import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Navbar } from '../components/Navbar';
import { StaffList } from '../components/StaffList';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { FatigueIndex } from '../components/FatigueIndex';
import { ComplianceBar } from '../components/ComplianceBar';
import { NurseModal } from '../components/NurseModal';
import { AgentActivity } from '../components/AgentActivity';
import { Nurse, AgentMessage } from '../data/mockData';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';

export default function DashboardWithChat() {
  const navigate = useNavigate();
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [schedule, setSchedule] = useState<any>(null);
  const [activityLog, setActivityLog] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [complianceFlash, setComplianceFlash] = useState(false);
  const [isCompliant, setIsCompliant] = useState(true);

  useEffect(() => {
    // Load data from localStorage
    const loadData = () => {
      try {
        const nursesData = localStorage.getItem('nurses');
        const scheduleResultStr = localStorage.getItem('scheduleResult');

        if (nursesData) {
          setNurses(JSON.parse(nursesData));
        }

        if (scheduleResultStr) {
          const result = JSON.parse(scheduleResultStr);
          setSchedule(result.schedule);
          setIsCompliant(result.compliance?.status === 'PASSED');
          
          // Build real activity log from API response
          const newActivityLog: AgentMessage[] = [];
          const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          // [FORECAST] message with staffing numbers
          if (result.staffing_requirements) {
            const staffingStr = Object.entries(result.staffing_requirements)
              .map(([day, count]) => `${day.slice(0, 3)} ${count}`)
              .join(', ');
            newActivityLog.push({
              id: Date.now().toString(),
              type: 'FORECAST',
              message: `Forecasted staffing: ${staffingStr}`,
              timestamp: currentTime
            });
          }
          
          // [COMPLIANCE] message from response
          if (result.compliance) {
            const complianceStatus = result.compliance.status;
            const violationCount = result.compliance.reasons?.length || 0;
            const score = result.compliance.score || 100;
            newActivityLog.push({
              id: (Date.now() + 1).toString(),
              type: 'COMPLIANCE',
              message: complianceStatus === 'PASSED' 
                ? `PASSED — ${score}% rules met`
                : `FAILED — ${violationCount} violations found`,
              timestamp: currentTime
            });
          }
          
          // [SCHEDULING] messages for each alert
          if (result.alerts && result.alerts.length > 0) {
            result.alerts.forEach((alert: string, idx: number) => {
              newActivityLog.push({
                id: (Date.now() + 2 + idx).toString(),
                type: 'SCHEDULING',
                message: alert,
                timestamp: currentTime
              });
            });
          }
          
          // Also add agent_activity messages if present
          if (result.agent_activity && result.agent_activity.length > 0) {
            result.agent_activity.forEach((activity: any, idx: number) => {
              newActivityLog.push({
                id: (Date.now() + 10 + idx).toString(),
                type: activity.agent?.toUpperCase() || 'INFO',
                message: activity.message,
                timestamp: currentTime
              });
            });
          }
          
          setActivityLog(newActivityLog);
        }
      } catch (err) {
        console.error('Failed to load data', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle emergency message from AgentActivity
  const handleEmergencyMessage = (message: AgentMessage) => {
    setActivityLog(prev => [message, ...prev].slice(0, 10)); // Keep max 10 items, newest first
  };

  // Handle schedule update from emergency
  const handleScheduleUpdate = (newSchedule: any) => {
    setSchedule(newSchedule);
    // Update localStorage
    const scheduleResultStr = localStorage.getItem('scheduleResult');
    if (scheduleResultStr) {
      const result = JSON.parse(scheduleResultStr);
      result.schedule = newSchedule;
      localStorage.setItem('scheduleResult', JSON.stringify(result));
    }
  };

  // Handle high severity emergency
  const handleHighSeverity = (severity: string) => {
    if (severity === 'HIGH') {
      setComplianceFlash(true);
      setTimeout(() => setComplianceFlash(false), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0F1E' }}>
        <Loader2 size={48} className="animate-spin" style={{ color: '#00D4FF' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0F1E' }}>
      <Navbar onFileRemove={() => navigate('/')} />

      {/* Navigation Helper */}
      <div className="px-6 pt-4 flex gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded transition-opacity hover:opacity-80"
          style={{
            backgroundColor: '#111827',
            color: '#00D4FF',
            fontSize: '13px',
            border: '1px solid #00D4FF',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        <button
          onClick={() => navigate('/emergency')}
          className="flex items-center gap-2 px-4 py-2 rounded transition-opacity hover:opacity-80"
          style={{
            backgroundColor: '#111827',
            color: '#FF3D5A',
            fontSize: '13px',
            border: '1px solid #FF3D5A',
          }}
        >
          <AlertTriangle size={16} />
          <span>Simulate Emergency</span>
        </button>
      </div>

      <div className="p-6">
        {/* 3 Column Layout */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          {/* Left Column - Staff List (20%) */}
          <div className="col-span-2">
            <StaffList nurses={nurses} onNurseClick={setSelectedNurse} />
          </div>

          {/* Center Column - Schedule (55%) */}
          <div className="col-span-7">
            <WeeklySchedule nurses={nurses} />
          </div>

          {/* Right Column - Fatigue Index (25%) */}
          <div className="col-span-3">
            <FatigueIndex nurses={nurses} />
          </div>
        </div>

        {/* Compliance Bar */}
        <div style={{
          animation: complianceFlash ? 'flashRed 0.5s ease-in-out 6' : 'none'
        }}>
          <ComplianceBar
            isCompliant={isCompliant && !complianceFlash}
            message={isCompliant && !complianceFlash 
              ? "✓ SCHEDULE COMPLIANT — 100% RULES PASSED" 
              : "✗ VIOLATIONS DETECTED — CHECK ACTIVITY LOG"}
          />
        </div>

        {/* Agent Activity Panel with real data */}
        <AgentActivity 
          messages={activityLog}
          schedule={schedule}
          onScheduleUpdate={handleScheduleUpdate}
          onEmergency={handleHighSeverity}
        />
      </div>

      {/* Nurse Modal */}
      {selectedNurse && (
        <NurseModal nurse={selectedNurse} onClose={() => setSelectedNurse(null)} />
      )}
      
      <style>{`
        @keyframes flashRed {
          0%, 100% { border-color: transparent; }
          50% { border: 2px solid #FF3D5A; }
        }
      `}</style>
    </div>
  );
}