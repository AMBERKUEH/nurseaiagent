import { Nurse } from '../data/mockData';

interface FatigueIndexProps {
  nurses: Nurse[];
  schedule?: any;
}

const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getNurseWeeklyBreakdown(nurseName: string, schedule: any) {
  if (!schedule) return { morning: 0, afternoon: 0, night: 0, total: 0, hours: 0 };
  let morning = 0, afternoon = 0, night = 0;
  FULL_DAY_NAMES.forEach(day => {
    if (schedule[day]?.morning?.includes(nurseName)) morning++;
    if (schedule[day]?.afternoon?.includes(nurseName)) afternoon++;
    if (schedule[day]?.night?.includes(nurseName)) night++;
  });
  const total = morning + afternoon + night;
  const hours = total * 8; // each shift = 8h
  return { morning, afternoon, night, total, hours };
}

function getFatigueColor(fatigue: number) {
  if (fatigue >= 80) return { bar: '#FF3D5A', glow: 'rgba(255,61,90,0.4)', text: '#FF3D5A' };
  if (fatigue >= 60) return { bar: '#FF6B35', glow: 'rgba(255,107,53,0.4)', text: '#FF6B35' };
  if (fatigue >= 40) return { bar: '#FFC107', glow: 'rgba(255,193,7,0.3)', text: '#FFC107' };
  return { bar: '#00E5A0', glow: 'rgba(0,229,160,0.3)', text: '#00E5A0' };
}

function getFatigueLabel(fatigue: number) {
  if (fatigue >= 80) return 'HIGH';
  if (fatigue >= 60) return 'MED';
  if (fatigue >= 40) return 'LOW';
  return 'OK';
}

export function FatigueIndex({ nurses, schedule }: FatigueIndexProps) {
  return (
    <div style={{ height: '100%' }}>
      {/* Title */}
      <h3 style={{
        fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '11px',
        color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px',
      }}>
        Fatigue Index
      </h3>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 36px 60px',
        gap: '6px',
        paddingBottom: '6px',
        marginBottom: '4px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Nurse</span>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', textTransform: 'uppercase' }}>Score</span>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', textAlign: 'right', textTransform: 'uppercase' }}>Shifts</span>
      </div>

      {/* Nurse rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {nurses.map(nurse => {
          const fatigue = nurse.fatigue ?? 50;
          const fc = getFatigueColor(fatigue);
          const label = getFatigueLabel(fatigue);
          const breakdown = getNurseWeeklyBreakdown(nurse.name, schedule);
          const isBlocked = (nurse as any).overtime_status === 'BLOCKED';
          const isWarning = (nurse as any).overtime_status === 'WARNING';

          return (
            <div key={nurse.id}>
              {/* Nurse row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 36px 60px',
                gap: '6px',
                alignItems: 'center',
                marginBottom: '3px',
              }}>
                {/* Name */}
                <div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600,
                    color: isBlocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.75)',
                    textDecoration: isBlocked ? 'line-through' : 'none',
                    display: 'block',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {nurse.name.split(' ')[0]}
                  </span>
                </div>

                {/* Score badge */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    color: fc.text,
                  }}>
                    {fatigue}%
                  </span>
                </div>

                {/* Total shifts */}
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                  {isBlocked && (
                    <span style={{ fontSize: '8px', color: '#FF3D5A', padding: '1px 3px', borderRadius: '2px', background: 'rgba(255,61,90,0.1)', border: '1px solid rgba(255,61,90,0.3)' }}>OT</span>
                  )}
                  {isWarning && !isBlocked && (
                    <span style={{ fontSize: '8px', color: '#FFC107', padding: '1px 3px', borderRadius: '2px', background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)' }}>⚠</span>
                  )}
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isBlocked ? '#FF3D5A' : 'rgba(255,255,255,0.6)' }}>
                    {breakdown.total}
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>/5</span>
                  </span>
                </div>
              </div>

              {/* Fatigue bar */}
              <div style={{
                height: '4px', borderRadius: '2px',
                background: 'rgba(255,255,255,0.05)',
                marginBottom: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${fatigue}%`, height: '100%', borderRadius: '2px',
                  background: fc.bar,
                  boxShadow: `0 0 6px ${fc.glow}`,
                  transition: 'width 0.4s ease',
                }} />
              </div>

              {/* Shift type breakdown mini-bar */}
              <div style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
                {/* Morning blocks */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`m${i}`} style={{
                    flex: 1, height: '3px', borderRadius: '1px',
                    background: i < breakdown.morning
                      ? 'rgba(0,212,255,0.6)'
                      : 'rgba(255,255,255,0.04)',
                  }} />
                ))}
                <div style={{ width: '1px', background: 'transparent' }} />
                {/* Afternoon blocks */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`a${i}`} style={{
                    flex: 1, height: '3px', borderRadius: '1px',
                    background: i < breakdown.afternoon
                      ? 'rgba(139,92,246,0.6)'
                      : 'rgba(255,255,255,0.04)',
                  }} />
                ))}
                <div style={{ width: '1px', background: 'transparent' }} />
                {/* Night blocks */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`n${i}`} style={{
                    flex: 1, height: '3px', borderRadius: '1px',
                    background: i < breakdown.night
                      ? 'rgba(255,107,53,0.6)'
                      : 'rgba(255,255,255,0.04)',
                  }} />
                ))}
              </div>

              {/* Shift label row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '8px', color: 'rgba(0,212,255,0.5)' }}>M:{breakdown.morning}</span>
                <span style={{ fontSize: '8px', color: 'rgba(139,92,246,0.5)' }}>A:{breakdown.afternoon}</span>
                <span style={{ fontSize: '8px', color: 'rgba(255,107,53,0.5)' }}>N:{breakdown.night}</span>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.2)' }}>{breakdown.hours}h</span>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', marginBottom: '2px' }} />
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Fatigue key</p>
        {[
          { label: 'Critical ≥80%', color: '#FF3D5A' },
          { label: 'High ≥60%',     color: '#FF6B35' },
          { label: 'Medium ≥40%',   color: '#FFC107' },
          { label: 'Normal <40%',   color: '#00E5A0' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '3px', borderRadius: '1px', background: color }} />
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Shift type legend */}
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px' }}>Shift breakdown</p>
        {[
          { label: 'M = Morning',   color: 'rgba(0,212,255,0.6)' },
          { label: 'A = Afternoon', color: 'rgba(139,92,246,0.6)' },
          { label: 'N = Night',     color: 'rgba(255,107,53,0.6)' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '3px', borderRadius: '1px', background: color }} />
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}