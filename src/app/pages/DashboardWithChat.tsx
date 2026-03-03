import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Navbar } from '../components/Navbar';
import { StaffList } from '../components/StaffList';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { FatigueIndex } from '../components/FatigueIndex';
import { ComplianceBar } from '../components/ComplianceBar';
import { NurseModal } from '../components/NurseModal';
import { AgentActivity } from '../components/AgentActivity';
import { nurses, agentMessages, Nurse } from '../data/mockData';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function DashboardWithChat() {
  const navigate = useNavigate();
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);

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
        <ComplianceBar
          isCompliant={true}
          message="✓ SCHEDULE COMPLIANT — 100% RULES PASSED"
        />

        {/* Agent Activity Panel */}
        <AgentActivity messages={agentMessages} />
      </div>

      {/* Nurse Modal */}
      {selectedNurse && (
        <NurseModal nurse={selectedNurse} onClose={() => setSelectedNurse(null)} />
      )}
    </div>
  );
}