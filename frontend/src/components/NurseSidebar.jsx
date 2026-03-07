import React from 'react';

const NurseSidebar = ({ nurses = [] }) => {
  // Map skill levels to badge colors
  const getSkillColor = (skill) => {
    const colors = {
      N1: 'bg-gray-400',
      N2: 'bg-yellow-400',
      N3: 'bg-blue-500',
      N4: 'bg-red-500'
    };
    return colors[skill] || 'bg-gray-400';
  };

  // Determine fatigue bar color based on score
  const getFatigueColor = (score) => {
    if (score < 60) return 'bg-green-500';
    if (score <= 80) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Determine text color for fatigue label
  const getFatigueTextColor = (score) => {
    if (score < 60) return 'text-green-600';
    if (score <= 80) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto h-full p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Nurses</h2>
      
      <div className="space-y-3">
        {nurses.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No nurses assigned</p>
        ) : (
          nurses.map((nurse, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              {/* Nurse Name and Skill Badge */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 text-sm">{nurse.name}</h3>
                <span
                  className={`${getSkillColor(
                    nurse.skill
                  )} text-white text-xs font-bold px-2.5 py-1 rounded-full`}
                >
                  {nurse.skill}
                </span>
              </div>

              {/* Ward */}
              <p className="text-xs text-gray-500 mb-3">{nurse.ward}</p>

              {/* Fatigue Score and Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Fatigue</label>
                  <span
                    className={`text-xs font-semibold ${getFatigueTextColor(
                      nurse.fatigue_score
                    )}`}
                  >
                    {nurse.fatigue_score}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getFatigueColor(
                      nurse.fatigue_score
                    )}`}
                    style={{ width: `${Math.min(nurse.fatigue_score, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NurseSidebar;
