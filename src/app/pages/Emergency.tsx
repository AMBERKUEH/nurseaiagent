import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Navbar } from '../components/Navbar';
import { StaffList } from '../components/StaffList';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { FatigueIndex } from '../components/FatigueIndex';
import { ComplianceBar } from '../components/ComplianceBar';
import { NurseModal } from '../components/NurseModal';
import { AgentActivity } from '../components/AgentActivity';
import { LiquidGradientBg } from '../components/LiquidGradientBg';
import { nurses, emergencyMessages, Nurse } from '../data/mockData';
import { ArrowLeft } from 'lucide-react';

export default function Emergency() {
  const navigate = useNavigate();
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#050d1a', position: 'relative' }}>
      <LiquidGradientBg />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <Navbar onFileRemove={() => navigate('/')} />

      {/* Navigation Helper with Date/Time */}
      <div className="px-6 pt-4 flex justify-between items-start">
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
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        {/* Live Date/Time */}
        <div style={{
          textAlign: 'right',
          fontFamily: 'Syne, sans-serif',
        }}>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.5px',
          }}>
            {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({currentTime.toLocaleDateString('en-US', { weekday: 'long' })})
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#FF3D5A',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '1px',
          }}>
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
        </div>
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
    </div>
  );
}