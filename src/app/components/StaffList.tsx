import { Nurse } from '../data/mockData';
import { AlertTriangle, AlertCircle, Check } from 'lucide-react';

interface StaffListProps {
  nurses: Nurse[];
  onNurseClick?: (nurse: Nurse) => void;
}

const skillColors = {
  1: '#6B7280',
  2: '#FF6B35',
  3: '#00D4FF',
  4: '#FF3D5A',
};

const skillLabels = {
  1: 'N1',
  2: 'N2',
  3: 'N3',
  4: 'N4',
};

const wardColors = {
  ICU: '#00D4FF',
  ER: '#FF3D5A',
  General: '#00E5A0',
  Pediatrics: '#FF6B35',
};

export function StaffList({ nurses, onNurseClick }: StaffListProps) {
  const getFatigueColor = (fatigue: number) => {
    if (fatigue < 60) return '#00E5A0';
    if (fatigue < 80) return '#FF6B35';
    return '#FF3D5A';
  };

  return (
    <div>
      {/* Title */}
      <h3 
        className="mb-4"
        style={{ 
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '11px',
          color: '#00D4FF',
          textTransform: 'uppercase',
          letterSpacing: '2px'
        }}
      >
        Staff On Duty
      </h3>

      {/* Hint */}
      <p className="mb-3" style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic' }}>
        Click a nurse card for details
      </p>

      {/* Nurse Cards */}
      <div className="flex flex-col gap-3">
        {nurses.map((nurse) => {
          const isHighFatigue = nurse.fatigue > 80;
          const isCriticalFatigue = nurse.fatigue > 95;
          
          return (
            <div
              key={nurse.id}
              className={`cursor-pointer transition-all hover:border-[#00D4FF] ${isCriticalFatigue ? 'animate-pulse' : ''}`}
              style={{
                backgroundColor: '#111827',
                borderRadius: '8px',
                padding: '12px',
                border: isCriticalFatigue ? '2px solid #FF3D5A' : '1px solid transparent',
              }}
              onClick={() => onNurseClick?.(nurse)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 600 }}>
                    {nurse.name}
                  </span>
                  {isCriticalFatigue && (
                    <AlertCircle size={14} style={{ color: '#FF3D5A' }} />
                  )}
                  {isHighFatigue && !isCriticalFatigue && (
                    <AlertTriangle size={14} style={{ color: '#FF6B35' }} />
                  )}
                  <div
                    className="rounded-full"
                    style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: getFatigueColor(nurse.fatigue),
                    }}
                  />
                </div>
                {isCriticalFatigue && (
                  <span style={{ fontSize: '10px', color: '#FF3D5A', fontWeight: 600 }}>
                    OVERTIME RISK
                  </span>
                )}
              </div>
              
              {/* Overtime Status Badge */}
              {(nurse as any).overtime_status === 'BLOCKED' && (
                <div 
                  className="mb-2 px-2 py-1 rounded text-xs flex items-center gap-1"
                  style={{ backgroundColor: '#FF3D5A20', color: '#FF3D5A', fontSize: '10px', fontWeight: 600 }}
                >
                  <span>⛔</span>
                  <span>MAX HOURS REACHED</span>
                </div>
              )}
              {(nurse as any).overtime_status === 'WARNING' && (
                <div 
                  className="mb-2 px-2 py-1 rounded text-xs flex items-center gap-1"
                  style={{ backgroundColor: '#FF6B3520', color: '#FF6B35', fontSize: '10px', fontWeight: 600 }}
                >
                  <span>⚠</span>
                  <span>Near Limit ({(nurse as any).weekly_hours || 0}hrs/40)</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: skillColors[nurse.skillLevel],
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {skillLabels[nurse.skillLevel]}
                </span>
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: `${wardColors[nurse.ward]}20`,
                    color: wardColors[nurse.ward],
                    fontSize: '11px',
                  }}
                >
                  {nurse.ward}
                </span>
              </div>
              
              {/* Pre-approved Requests Section */}
              {nurse.unavailable_days && nurse.unavailable_days.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <div className="flex items-center gap-1 mb-1">
                    <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                      Pre-approved requests
                    </span>
                    {nurse.requests_honored && (
                      <Check size={12} style={{ color: '#00E5A0' }} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {nurse.unavailable_days.map((day) => (
                      <span
                        key={day}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: '#374151',
                          color: '#9CA3AF',
                          fontSize: '10px',
                        }}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}