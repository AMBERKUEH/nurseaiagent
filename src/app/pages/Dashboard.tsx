import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Navbar } from '../components/Navbar';
import { StaffList } from '../components/StaffList';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { FatigueIndex } from '../components/FatigueIndex';
import { ComplianceBar } from '../components/ComplianceBar';
import { NurseModal } from '../components/NurseModal';
import { MessageSquare, AlertTriangle, Loader2 } from 'lucide-react';

interface Nurse {
  name: string;
  skill: string;
  ward: string;
  unavailable_days: string[];
  fatigue_score: number;
}

interface ScheduleData {
  schedule: any;
  compliance: {
    passed: boolean;
    violations: any[];
    compliance_score: number;
  };
  forecast: any;
  retry_count: number;
  bright_data: any;
  memory_insights: string[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load data from localStorage
    const loadData = () => {
      try {
        const nursesData = localStorage.getItem('nurses');
        const scheduleDataStr = localStorage.getItem('scheduleData');

        if (nursesData) {
          setNurses(JSON.parse(nursesData));
        } else {
          setError('No nurse data found. Please upload a PDF first.');
        }

        if (scheduleDataStr) {
          setScheduleData(JSON.parse(scheduleDataStr));
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0F1E' }}>
        <Loader2 size={48} className="animate-spin" style={{ color: '#00D4FF' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#0A0F1E' }}>
        <p style={{ color: '#FF3D5A', marginBottom: '16px' }}>{error}</p>
        <button
          onClick={() => navigate('/')}
          style={{
            backgroundColor: '#00D4FF',
            color: '#0A0F1E',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Go to Upload
        </button>
      </div>
    );
  }

  const isCompliant = scheduleData?.compliance?.passed ?? true;
  const complianceMessage = isCompliant
    ? `✓ SCHEDULE COMPLIANT — ${scheduleData?.compliance?.compliance_score ?? 100}% RULES PASSED`
    : `✗ VIOLATIONS DETECTED — ${scheduleData?.compliance?.violations?.length ?? 0} ISSUES FOUND`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0F1E' }}>
      <Navbar onFileRemove={() => navigate('/')} />

      {/* Navigation Helper */}
      <div className="px-6 pt-4 flex gap-3">
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 px-4 py-2 rounded transition-opacity hover:opacity-80"
          style={{
            backgroundColor: '#111827',
            color: '#00D4FF',
            fontSize: '13px',
            border: '1px solid #00D4FF',
          }}
        >
          <MessageSquare size={16} />
          <span>View Agent Activity</span>
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
            <StaffList 
              nurses={nurses.map((n, idx) => ({
                id: String(idx),
                name: n.name,
                skillLevel: Math.min(Math.max(parseInt(n.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
                ward: (n.ward as any) || 'General',
                shifts: [],
                fatigue: n.fatigue_score || 50
              }))} 
              onNurseClick={(nurse) => setSelectedNurse(nurses.find(n => n.name === nurse.name) || null)} 
            />
          </div>

          {/* Center Column - Schedule (55%) */}
          <div className="col-span-7">
            <WeeklySchedule 
              nurses={nurses.map((n, idx) => ({
                id: String(idx),
                name: n.name,
                skillLevel: Math.min(Math.max(parseInt(n.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
                ward: (n.ward as any) || 'General',
                fatigue: n.fatigue_score || 50,
                shifts: []
              }))} 
            />
          </div>

          {/* Right Column - Fatigue Index (25%) */}
          <div className="col-span-3">
            <FatigueIndex 
              nurses={nurses.map((n, idx) => ({
                id: String(idx),
                name: n.name,
                skillLevel: Math.min(Math.max(parseInt(n.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
                ward: (n.ward as any) || 'General',
                shifts: [],
                fatigue: n.fatigue_score || 50
              }))} 
            />
          </div>
        </div>

        {/* Compliance Bar */}
        <ComplianceBar
          isCompliant={isCompliant}
          message={complianceMessage}
        />
      </div>

      {/* Nurse Modal */}
      {selectedNurse && (
        <NurseModal 
          nurse={{
            id: selectedNurse.name,
            name: selectedNurse.name,
            skillLevel: Math.min(Math.max(parseInt(selectedNurse.skill?.replace('N', '') || '1'), 1), 4) as 1 | 2 | 3 | 4,
            ward: (selectedNurse.ward as any) || 'General',
            shifts: [],
            fatigue: selectedNurse.fatigue_score || 50
          }} 
          onClose={() => setSelectedNurse(null)} 
        />
      )}
    </div>
  );
}
