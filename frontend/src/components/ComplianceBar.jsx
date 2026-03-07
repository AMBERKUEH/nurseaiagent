import React from 'react';

const ComplianceBar = ({ compliance = {} }) => {
  const { passed = false, violations = [], compliance_score = 0 } = compliance;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Status Bar */}
      <div
        className={`rounded-lg shadow-md p-4 transition-all ${
          passed
            ? 'bg-green-100 border border-green-300'
            : 'bg-red-100 border border-red-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {passed ? (
              <>
                <div className="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-green-800">PASSED</p>
                  <p className="text-xs text-green-700">Schedule is compliant</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-red-800">FAILED</p>
                  <p className="text-xs text-red-700">{violations.length} violation(s) found</p>
                </div>
              </>
            )}
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${passed ? 'text-green-800' : 'text-red-800'}`}>
              {compliance_score}%
            </p>
            <p className="text-xs text-gray-600">Compliance Score</p>
          </div>
        </div>
      </div>

      {/* Violations List */}
      {!passed && violations.length > 0 && (
        <div className="mt-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Violations</h3>
          <ul className="space-y-2">
            {violations.map((violation, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-xs text-gray-700"
              >
                <span className="text-red-500 font-bold mt-0.5">•</span>
                <span>{violation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ComplianceBar;
