import { Nurse } from '../data/mockData';

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
        {nurses.map((nurse) => (
          <div
            key={nurse.id}
            className="cursor-pointer transition-all hover:border-[#00D4FF]"
            style={{
              backgroundColor: '#111827',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid transparent',
            }}
            onClick={() => onNurseClick?.(nurse)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 600 }}>
                  {nurse.name}
                </span>
                <div
                  className="rounded-full"
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: getFatigueColor(nurse.fatigue),
                  }}
                />
              </div>
            </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}