import { useState } from 'react';
import { Nurse } from '../data/mockData';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface WeeklyScheduleProps {
  nurses: Nurse[];
  schedule?: any;
  staffingRequirements?: any;
  highlightCell?: { day: string; shift: string };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TOTAL_HOURS = 24;

// Timeline starts at 23:00 (night shift beginning) and goes for 24 hours
// Order: Night (23:00-07:00) → Morning (07:00-15:00) → Afternoon (15:00-23:00)
const TIMELINE_OFFSET = 23; // Start timeline at 23:00

const SHIFT_BANDS = [
  {
    key: 'night',
    label: 'Night',
    range: '23–07',
    // Night: 23:00-07:00 (8 hours) - positioned at start of timeline
    visStart: 23, visEnd: 31, // 23:00 to 07:00 next day (virtual 31 = 24+7)
    // For display purposes, map to 0-8 on the visual timeline
    displayStart: 0, displayEnd: 8,
    color: 'rgba(255,107,53,0.12)',
    accent: 'rgba(255,107,53,0.45)',
    text: '#FF6B35',
    glow: 'rgba(255,107,53,0.35)',
    dimColor: 'rgba(255,107,53,0.05)',
    wraps: false,
  },
  {
    key: 'morning',
    label: 'Morning',
    range: '07–15',
    // Morning: 07:00-15:00 (8 hours) - positioned after night
    visStart: 7, visEnd: 15,
    // Map to 8-16 on visual timeline
    displayStart: 8, displayEnd: 16,
    color: 'rgba(0,212,255,0.10)',
    accent: 'rgba(0,212,255,0.45)',
    text: '#00D4FF',
    glow: 'rgba(0,212,255,0.35)',
    dimColor: 'rgba(0,212,255,0.04)',
    wraps: false,
  },
  {
    key: 'afternoon',
    label: 'Afternoon',
    range: '15–23',
    // Afternoon: 15:00-23:00 (8 hours) - positioned after morning
    visStart: 15, visEnd: 23,
    // Map to 16-24 on visual timeline
    displayStart: 16, displayEnd: 24,
    color: 'rgba(139,92,246,0.10)',
    accent: 'rgba(139,92,246,0.45)',
    text: '#8B5CF6',
    glow: 'rgba(139,92,246,0.35)',
    dimColor: 'rgba(139,92,246,0.04)',
    wraps: false,
  },
];

const WARD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ICU:        { bg: 'rgba(0,212,255,0.15)',  text: '#00D4FF', border: 'rgba(0,212,255,0.5)' },
  ER:         { bg: 'rgba(255,61,90,0.15)',   text: '#FF3D5A', border: 'rgba(255,61,90,0.5)' },
  General:    { bg: 'rgba(0,229,160,0.15)',   text: '#00E5A0', border: 'rgba(0,229,160,0.5)' },
  Pediatrics: { bg: 'rgba(255,107,53,0.15)',  text: '#FF6B35', border: 'rgba(255,107,53,0.5)' },
};

// Ruler ticks in actual hour values (23:00 start)
const RULER_TICKS = [23, 0, 3, 6, 7, 9, 12, 15, 18, 21, 23];

// Convert hour to percentage position on timeline
// Timeline starts at 23:00 (which is position 0%)
// 23:00 -> 0%, 00:00 -> 4.17%, 07:00 -> 33.33%, 15:00 -> 66.67%, 23:00 -> 100%
function pct(h: number) { 
  // Normalize hour to 0-24 range starting from 23:00
  let normalized = h - TIMELINE_OFFSET;
  if (normalized < 0) normalized += 24;
  return (normalized / TOTAL_HOURS) * 100; 
}

// Get display position for a shift band (uses displayStart/displayEnd)
function displayPct(band: any) {
  return {
    left: (band.displayStart / 24) * 100,
    width: ((band.displayEnd - band.displayStart) / 24) * 100,
  };
}
function fmtHour(h: number) { return h === 24 ? '00:00' : `${String(h).padStart(2,'0')}:00`; }

// Derive shift label for a nurse on a given day
function getNurseShift(nurseName: string, fullDay: string, schedule: any): string | null {
  if (!schedule) return null;
  const dayData = schedule[fullDay];
  if (!dayData) return null;
  if (dayData.morning?.includes(nurseName)) return 'morning';
  if (dayData.afternoon?.includes(nurseName)) return 'afternoon';
  if (dayData.night?.includes(nurseName)) return 'night';
  return null;
}

// Count total shifts for a nurse across the week
function getNurseWeeklyShifts(nurseName: string, schedule: any): { total: number; morning: number; afternoon: number; night: number } {
  if (!schedule) return { total: 0, morning: 0, afternoon: 0, night: 0 };
  let morning = 0, afternoon = 0, night = 0;
  FULL_DAY_NAMES.forEach(day => {
    if (schedule[day]?.morning?.includes(nurseName)) morning++;
    if (schedule[day]?.afternoon?.includes(nurseName)) afternoon++;
    if (schedule[day]?.night?.includes(nurseName)) night++;
  });
  return { total: morning + afternoon + night, morning, afternoon, night };
}

// Shift pill component
function ShiftPill({ shiftKey, size = 'md' }: { shiftKey: string; size?: 'sm' | 'md' }) {
  const band = SHIFT_BANDS.find(b => b.key === shiftKey);
  if (!band) return null;
  return (
    <div style={{
      padding: size === 'sm' ? '1px 6px' : '3px 8px',
      borderRadius: '4px',
      fontSize: size === 'sm' ? '9px' : '11px',
      fontWeight: 700,
      color: band.text,
      background: band.color,
      border: `1px solid ${band.accent}`,
      whiteSpace: 'nowrap',
      letterSpacing: '0.3px',
    }}>
      {band.label[0]}
    </div>
  );
}

// Timeline bar for a single nurse row (shows their shift block on the 24h axis)
function NurseTimelineBar({
  shiftKey,
  highlighted,
  isOff,
}: {
  shiftKey: string | null;
  highlighted: boolean;
  isOff: boolean;
}) {
  const band = SHIFT_BANDS.find(b => b.key === shiftKey);

  return (
    <div style={{
      position: 'relative',
      height: '32px',
      flex: 1,
      borderRadius: '5px',
      background: 'rgba(255,255,255,0.018)',
      border: highlighted ? '1px solid rgba(255,61,90,0.5)' : '1px solid rgba(255,255,255,0.04)',
      overflow: 'hidden',
    }}>
      {/* Faint band backgrounds always visible - using display positions */}
      {SHIFT_BANDS.map(b => {
        const pos = displayPct(b);
        return (
          <div key={b.key} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${pos.left}%`,
            width: `${pos.width}%`,
            background: b.dimColor,
          }} />
        );
      })}

      {/* Shift boundary lines at display positions */}
      {/* Night(0-33.33%) | Morning(33.33-66.67%) | Afternoon(66.67-100%) */}
      {[33.33, 66.67].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${pos}%`, width: '1px',
          background: 'rgba(255,255,255,0.12)',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Active shift block - using display positions */}
      {band && !isOff && (
        <div style={{
          position: 'absolute', top: '4px', bottom: '4px',
          left: `${displayPct(band).left}%`,
          width: `${displayPct(band).width}%`,
          background: band.color,
          borderRadius: '3px',
          border: `1px solid ${band.accent}`,
          boxShadow: `0 0 8px ${band.glow}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: '9px', color: band.text, fontWeight: 700, opacity: 0.8 }}>
            {band.label}
          </span>
        </div>
      )}

      {/* Day off indicator */}
      {isOff && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>DAY OFF</span>
        </div>
      )}

      {/* No shift (but not designated off) */}
      {!band && !isOff && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', paddingLeft: '8px',
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.1)' }}>—</span>
        </div>
      )}
    </div>
  );
}

export function WeeklySchedule({ nurses, schedule, staffingRequirements, highlightCell }: WeeklyScheduleProps) {
  const [activeDay, setActiveDay] = useState(0); // index into DAYS
  const [tooltip, setTooltip] = useState<{ nurse: Nurse; shifts: ReturnType<typeof getNurseWeeklyShifts>; x: number; y: number } | null>(null);

  const fullDay = FULL_DAY_NAMES[activeDay];
  const shortDay = DAYS[activeDay];

  // Get nurses working on the active day (for shift count badge)
  const getDayNurseCount = (dayIdx: number) => {
    const fd = FULL_DAY_NAMES[dayIdx];
    if (!schedule || !schedule[fd]) return 0;
    const seen = new Set<string>();
    ['morning', 'afternoon', 'night'].forEach(k => {
      (schedule[fd]?.[k] || []).forEach((n: string) => seen.add(n));
    });
    return seen.size;
  };

  // Get shift count per shift type for the active day (for understaffed detection)
  const getShiftCount = (shiftKey: string) => {
    if (!schedule) return 0;
    return schedule[fullDay]?.[shiftKey]?.length || 0;
  };

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Title */}
      <h3 style={{
        fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '11px',
        color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px',
      }}>
        Weekly Schedule
      </h3>

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '14px' }}>
        {DAYS.map((day, idx) => {
          const count = getDayNurseCount(idx);
          const isActive = idx === activeDay;
          const isWeekend = idx >= 5;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(idx)}
              style={{
                flex: 1,
                padding: '7px 4px',
                borderRadius: '6px',
                border: isActive
                  ? '1px solid rgba(0,212,255,0.5)'
                  : '1px solid rgba(255,255,255,0.05)',
                background: isActive
                  ? 'rgba(0,212,255,0.12)'
                  : isWeekend ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.025)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              }}
            >
              <span style={{
                fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700,
                letterSpacing: '0.8px',
                color: isActive ? '#00D4FF' : isWeekend ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.5)',
              }}>
                {day.toUpperCase()}
              </span>
              <span style={{
                fontSize: '9px',
                color: isActive ? 'rgba(0,212,255,0.7)' : 'rgba(255,255,255,0.2)',
              }}>
                {count} staff
              </span>
            </button>
          );
        })}
      </div>

      {/* Shift coverage summary for active day */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {SHIFT_BANDS.map(band => {
          const count = getShiftCount(band.key);
          const under = count < 3 && count > 0;
          const empty = count === 0;
          return (
            <div key={band.key} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 8px', borderRadius: '5px',
              background: empty ? 'rgba(255,61,90,0.08)' : under ? 'rgba(255,193,7,0.08)' : band.color,
              border: `1px solid ${empty ? 'rgba(255,61,90,0.3)' : under ? 'rgba(255,193,7,0.3)' : band.accent}`,
            }}>
              <span style={{ fontSize: '9px', color: empty ? '#FF3D5A' : under ? '#FFC107' : band.text, fontWeight: 600 }}>
                {band.label}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: empty ? '#FF3D5A' : under ? '#FFC107' : band.text,
              }}>
                {count}
              </span>
              {empty && <AlertCircle size={10} style={{ color: '#FF3D5A' }} />}
              {under && <span style={{ fontSize: '9px', color: '#FFC107' }}>⚠</span>}
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {SHIFT_BANDS.map(b => (
            <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: b.color, border: `1px solid ${b.accent}` }} />
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{b.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time ruler */}
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', marginBottom: '4px' }}>
        <div />
        <div style={{ position: 'relative', height: '20px' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '4px', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          {RULER_TICKS.map(h => (
            <div key={h} style={{
              position: 'absolute', left: `${pct(h)}%`, bottom: '4px',
              transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <span style={{
                fontSize: '8px', marginBottom: '2px', fontVariantNumeric: 'tabular-nums',
                color: [0, 7, 15, 23, 24].includes(h) ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)',
                fontWeight: [7, 15, 23].includes(h) ? 700 : 400,
              }}>
                {fmtHour(h)}
              </span>
              <div style={{
                width: '1px',
                height: [0, 7, 15, 23, 24].includes(h) ? '5px' : '3px',
                background: [0, 7, 15, 23, 24].includes(h) ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)',
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Nurse rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {nurses.map(nurse => {
          const wc = WARD_COLORS[nurse.ward] || WARD_COLORS.General;
          const shiftKey = getNurseShift(nurse.name, fullDay, schedule);
          const weeklyShifts = getNurseWeeklyShifts(nurse.name, schedule);
          const isBlocked = (nurse as any).overtime_status === 'BLOCKED';
          const isHighlightDay = highlightCell?.day?.toLowerCase().startsWith(shortDay.toLowerCase());
          const isHighlightShift = isHighlightDay && highlightCell?.shift?.toLowerCase() === shiftKey;

          // Determine if this is their designated day off
          const isOff = !shiftKey && (nurse as any).unavailable_days?.some(
            (d: string) => d.toLowerCase().startsWith(FULL_DAY_NAMES[activeDay].toLowerCase().slice(0, 3))
          );

          return (
            <div
              key={nurse.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {/* Nurse info card */}
              <div
                onMouseEnter={e => setTooltip({ nurse, shifts: weeklyShifts, x: e.clientX, y: e.clientY })}
                onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '5px 8px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)',
                  border: isHighlightDay ? '1px solid rgba(255,61,90,0.3)' : '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Avatar dot */}
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                  background: wc.bg, border: `1.5px solid ${wc.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: wc.text }}>
                    {nurse.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, color: isBlocked ? 'rgba(255,255,255,0.35)' : '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: isBlocked ? 'line-through' : 'none',
                    }}>
                      {nurse.name.split(' ')[0]}
                    </span>
                    {isBlocked && <AlertCircle size={9} style={{ color: '#FF3D5A', flexShrink: 0 }} />}
                  </div>
                  <div style={{ display: 'flex', gap: '3px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '8px', padding: '0px 4px', borderRadius: '3px',
                      background: wc.bg, color: wc.text, fontWeight: 700,
                    }}>
                      {(nurse as any).skillLevel ? `N${nurse.skillLevel}` : nurse.skillLevel}
                    </span>
                    <span style={{
                      fontSize: '8px', padding: '0px 4px', borderRadius: '3px',
                      background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
                    }}>
                      {nurse.ward}
                    </span>
                  </div>
                </div>

                {/* Today's shift pill */}
                <div style={{ flexShrink: 0 }}>
                  {shiftKey ? (
                    <ShiftPill shiftKey={shiftKey} size="sm" />
                  ) : (
                    <div style={{
                      fontSize: '8px', color: isOff ? '#6B7280' : 'rgba(255,255,255,0.15)',
                      padding: '1px 4px', borderRadius: '3px',
                      background: isOff ? 'rgba(107,114,128,0.1)' : 'transparent',
                      border: isOff ? '1px solid rgba(107,114,128,0.2)' : 'none',
                    }}>
                      {isOff ? 'OFF' : '—'}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <NurseTimelineBar
                shiftKey={shiftKey}
                highlighted={isHighlightShift}
                isOff={isOff}
              />
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10,
          zIndex: 9999,
          background: 'rgba(8,14,28,0.97)',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: '10px', padding: '12px 14px',
          pointerEvents: 'none',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          minWidth: '170px',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            {tooltip.nurse.name}
          </p>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '9px', padding: '2px 6px', borderRadius: '3px',
              background: WARD_COLORS[tooltip.nurse.ward]?.bg,
              color: WARD_COLORS[tooltip.nurse.ward]?.text, fontWeight: 700,
            }}>
              {tooltip.nurse.ward}
            </span>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              Fatigue {tooltip.nurse.fatigue}%
            </span>
          </div>
          {/* Weekly shift breakdown */}
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            This week
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {SHIFT_BANDS.map(b => {
              const count = tooltip.shifts[b.key as keyof typeof tooltip.shifts] as number;
              return (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '1px', background: b.color, border: `1px solid ${b.accent}` }} />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', width: '60px' }}>{b.label}</span>
                  <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ width: `${(count / 7) * 100}%`, height: '100%', borderRadius: '2px', background: b.accent }} />
                  </div>
                  <span style={{ fontSize: '10px', color: b.text, fontWeight: 700, width: '14px', textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Total</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{tooltip.shifts.total} / 5</span>
            </div>
          </div>
          {(tooltip.nurse as any).overtime_status === 'BLOCKED' && (
            <p style={{ fontSize: '10px', color: '#FF3D5A', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={10} /> Overtime blocked
            </p>
          )}
        </div>
      )}
    </div>
  );
}