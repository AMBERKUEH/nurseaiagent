import { Nurse } from '../data/mockData';

interface FatigueIndexProps {
  nurses: Nurse[];
}

export function FatigueIndex({ nurses: allNurses }: FatigueIndexProps) {
  const nurses = allNurses.slice(0, 8); // Show first 8

  const getBarColor = (fatigue: number) => {
    if (fatigue < 60) return '#00E5A0';
    if (fatigue < 80) return '#FF6B35';
    return '#FF3D5A';
  };

  const maxHeight = 120;

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
        Fatigue Index
      </h3>

      {/* Bars */}
      <div className="flex items-end justify-between gap-2">
        {nurses.map((nurse) => (
          <div key={nurse.id} className="flex flex-col items-center">
            {/* Percentage */}
            <div 
              className="mb-2 text-center"
              style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600 }}
            >
              {nurse.fatigue}%
            </div>

            {/* Bar */}
            <div className="relative" style={{ width: '24px', height: `${maxHeight}px` }}>
              <div
                className="absolute bottom-0 w-full rounded-t"
                style={{
                  height: `${(nurse.fatigue / 100) * maxHeight}px`,
                  backgroundColor: getBarColor(nurse.fatigue),
                }}
              />
              <div
                className="absolute bottom-0 w-full rounded"
                style={{
                  height: '100%',
                  backgroundColor: '#1A2235',
                  zIndex: -1,
                }}
              />
            </div>

            {/* Name */}
            <div 
              className="mt-2 text-center"
              style={{ 
                fontSize: '10px', 
                color: '#6B7280',
                maxWidth: '40px',
                wordWrap: 'break-word',
              }}
            >
              {nurse.name.split(' ')[0]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
