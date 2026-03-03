import { Nurse } from '../data/mockData';

interface WeeklyScheduleProps {
  nurses: Nurse[];
  highlightCell?: { day: string; shift: string };
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const shifts = ['Morning', 'Afternoon', 'Night'];

const wardColors = {
  ICU: '#00D4FF',
  ER: '#FF3D5A',
  General: '#00E5A0',
  Pediatrics: '#FF6B35',
};

export function WeeklySchedule({ nurses, highlightCell }: WeeklyScheduleProps) {
  const getShiftNurses = (day: string, shift: string) => {
    return nurses.filter((nurse) =>
      nurse.shifts.some((s) => s.day === day && s.shift === shift)
    );
  };

  const isHighlighted = (day: string, shift: string) => {
    return highlightCell?.day === day && highlightCell?.shift === shift;
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
        Weekly Schedule
      </h3>

      {/* Grid */}
      <div className="overflow-auto">
        <div className="inline-block min-w-full">
          {/* Header Row */}
          <div className="grid grid-cols-8 gap-px mb-px">
            <div style={{ padding: '8px' }} />
            {days.map((day) => (
              <div
                key={day}
                className="text-center"
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: '11px',
                  color: '#00D4FF',
                  textTransform: 'uppercase',
                  padding: '8px',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Shift Rows */}
          {shifts.map((shift) => (
            <div key={shift} className="grid grid-cols-8 gap-px mb-px">
              {/* Shift Label */}
              <div
                className="flex items-center"
                style={{
                  fontSize: '11px',
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  padding: '12px 8px',
                }}
              >
                {shift}
              </div>

              {/* Day Cells */}
              {days.map((day) => {
                const shiftNurses = getShiftNurses(day, shift);
                const highlighted = isHighlighted(day, shift);

                return (
                  <div
                    key={`${day}-${shift}`}
                    className="min-h-[80px] p-2 flex flex-wrap gap-1 content-start"
                    style={{
                      backgroundColor: highlighted ? 'rgba(255, 61, 90, 0.15)' : '#1A2235',
                      border: highlighted ? '1px solid #FF3D5A' : '1px solid rgba(107, 114, 128, 0.2)',
                      borderRadius: '4px',
                    }}
                  >
                    {shiftNurses.map((nurse) => {
                      const shiftData = nurse.shifts.find(
                        (s) => s.day === day && s.shift === shift
                      );
                      const ward = shiftData?.ward || nurse.ward;
                      
                      return (
                        <div
                          key={nurse.id}
                          className="px-2 py-1 rounded text-xs whitespace-nowrap"
                          style={{
                            backgroundColor: `${wardColors[ward]}33`,
                            color: wardColors[ward],
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          {nurse.name.split(' ')[0]}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
