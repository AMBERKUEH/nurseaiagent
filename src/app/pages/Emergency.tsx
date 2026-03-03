import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Navbar } from '../components/Navbar';
import { StaffList } from '../components/StaffList';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { FatigueIndex } from '../components/FatigueIndex';
import { ComplianceBar } from '../components/ComplianceBar';
import { NurseModal } from '../components/NurseModal';
import { AgentActivity } from '../components/AgentActivity';
import { nurses, emergencyMessages, Nurse } from '../data/mockData';
import { ArrowLeft, RotateCcw } from 'lucide-react';

export default function Emergency() {
  const navigate = useNavigate();
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);

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
          <ArrowLeft size={16} />
          <span>Back to Chat View</span>
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded transition-opacity hover:opacity-80"
          style={{
            backgroundColor: '#111827',
            color: '#00E5A0',
            fontSize: '13px',
            border: '1px solid #00E5A0',
          }}
        >
          <RotateCcw size={16} />
          <span>Reset to Normal</span>
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
            <WeeklySchedule 
              nurses={nurses}
              highlightCell={{ day: 'Wed', shift: 'Night' }}
            />
          </div>

          {/* Right Column - Fatigue Index (25%) */}
          <div className="col-span-3">
            <FatigueIndex nurses={nurses} />
          </div>
        </div>

        {/* Compliance Bar - Violation State */}
        <ComplianceBar
          isCompliant={false}
          message="✗ VIOLATIONS DETECTED — ICU Wednesday Night Understaffed"
        />

        {/* Agent Activity Panel with Emergency Message */}
        <AgentActivity messages={emergencyMessages} />
      </div>

      {/* Nurse Modal */}
      {selectedNurse && (
        <NurseModal nurse={selectedNurse} onClose={() => setSelectedNurse(null)} />
      )}
    </div>
  );
}