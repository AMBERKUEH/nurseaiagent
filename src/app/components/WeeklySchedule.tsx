import { Nurse } from '../data/mockData';
import { AlertCircle } from 'lucide-react';

interface WeeklyScheduleProps {
  nurses: Nurse[];
  schedule?: any;
  staffingRequirements?: any;
  highlightCell?: { day: string; shift: string };
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const shifts = ['Morning', 'Afternoon', 'Night'];
const shiftKeys = ['morning', 'afternoon', 'night'];

const wardColors = {
  ICU: '#00D4FF',
  ER: '#FF3D5A',
  General: '#00E5A0',
  Pediatrics: '#FF6B35',
};

export function WeeklySchedule({ nurses, schedule, staffingRequirements, highlightCell }: WeeklyScheduleProps) {
  const getShiftNurses = (day: string, shift: string) => {
    // If schedule is provided, use it; otherwise fall back to nurse.shifts
    if (schedule) {
      const fullDay = fullDayNames[days.indexOf(day)];
      const shiftKey = shift.toLowerCase();
      const nurseNames = schedule[fullDay]?.[shiftKey] || [];
      return nurses.filter(nurse => nurseNames.includes(nurse.name));
    }
    // Fallback to old method
    return nurses.filter((nurse) =>
      nurse.shifts?.some((s: any) => s.day === day && s.shift === shift)
    );
  };

  const getNurseCountForDay = (day: string) => {
    if (!schedule) return 0;
    const fullDay = fullDayNames[days.indexOf(day)];
    let count = 0;
    shiftKeys.forEach(shift => {
      count += (schedule[fullDay]?.[shift] || []).length;
    });
    return count;
  };

  const getRequiredNurses = (day: string, shift: string) => {
    if (!staffingRequirements) return 2;
    const fullDay = fullDayNames[days.indexOf(day)];
    return staffingRequirements[fullDay] || 2;
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
            {days.map((day) => {
              const count = getNurseCountForDay(day);
              return (
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
                  {day} ({count})
                </div>
              );
            })}
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
                const requiredNurses = getRequiredNurses(day, shift);
                const isUnderstaffed = shiftNurses.length < requiredNurses && shiftNurses.length > 0;
                const isEmpty = shiftNurses.length === 0;

                return (
                  <div
                    key={`${day}-${shift}`}
                    className="min-h-[80px] p-2 flex flex-wrap gap-1 content-start"
                    style={{
                      backgroundColor: highlighted ? 'rgba(255, 61, 90, 0.15)' : 
                                        isUnderstaffed ? 'rgba(255, 193, 7, 0.15)' : '#1A2235',
                      border: highlighted ? '1px solid #FF3D5A' : 
                              isUnderstaffed ? '1px solid #FFC107' : '1px solid rgba(107, 114, 128, 0.2)',
                      borderRadius: '4px',
                    }}
                  >
                    {isEmpty ? (
                      <span style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic' }}>
                        —
                      </span>
                    ) : (
                      <>
                        {isUnderstaffed && (
                          <div className="w-full flex items-center gap-1 mb-1">
                            <AlertCircle size={12} style={{ color: '#FFC107' }} />
                            <span style={{ fontSize: '10px', color: '#FFC107' }}>
                              Need {requiredNurses - shiftNurses.length} more
                            </span>
                          </div>
                        )}
                        {shiftNurses.map((nurse) => {
                          const ward = nurse.ward;
                          const isBlocked = (nurse as any).overtime_status === 'BLOCKED';
                          
                          return (
                            <div
                              key={nurse.id}
                              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${isBlocked ? 'opacity-40' : ''}`}
                              style={{
                                backgroundColor: isBlocked ? '#6B728033' : `${wardColors[ward]}33`,
                                color: isBlocked ? '#6B7280' : wardColors[ward],
                                fontSize: '11px',
                                fontWeight: 600,
                                textDecoration: isBlocked ? 'line-through' : 'none',
                              }}
                            >
                              {nurse.name.split(' ')[0]}
                            </div>
                          );
                        })}
                      </>
                    )}
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
