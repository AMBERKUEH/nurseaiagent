const API_BASE = "http://localhost:8000";

const showToast = (message: string, type: "error" | "success" = "error") => {
  console.error(`[${type.toUpperCase()}] ${message}`);
};

// POST /api/ocr - Upload PDF file and extract nurses
export async function uploadPDF(file: File): Promise<{ nurses: any[]; count: number; warning?: string } | null> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE}/api/ocr`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      showToast(error.error || "Upload failed");
      return null;
    }

    const data = await response.json();
    return {
      nurses: data.nurses,
      count: data.count || data.nurses.length,
      warning: data.warning
    };
  } catch (err) {
    showToast("Network error during upload");
    return null;
  }
}

// POST /api/generate-schedule - Generate schedule with nurses and rules
export async function generateSchedule(nurses?: any[], rules?: any): Promise<{
  schedule: any;
  staffing_requirements: any;
  compliance: { status: string; reasons: string[]; score: number };
  alerts: string[];
} | null> {
  try {
    const body: any = {};
    if (nurses) body.nurses = nurses;
    if (rules) body.rules = rules;

    const response = await fetch(`${API_BASE}/api/generate-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      showToast(error.error || "Schedule generation failed");
      return null;
    }

    return await response.json();
  } catch (err) {
    showToast("Network error during generation");
    return null;
  }
}

// POST /explain - Get nurse explanation
export async function explainNurse(
  nurseName: string,
  schedule: any
): Promise<{ explanation: string } | null> {
  try {
    const response = await fetch(`${API_BASE}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nurse_name: nurseName, schedule }),
    });

    if (!response.ok) {
      showToast("Failed to get explanation");
      return null;
    }

    return await response.json();
  } catch (err) {
    showToast("Network error getting explanation");
    return null;
  }
}

// POST /update - Handle disruption
export async function updateSchedule(
  currentSchedule: any,
  disruption: string
): Promise<{
  updated_schedule: any;
  action_taken: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
} | null> {
  try {
    const response = await fetch(`${API_BASE}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_schedule: currentSchedule, disruption }),
    });

    if (!response.ok) {
      showToast("Failed to process disruption");
      return null;
    }

    return await response.json();
  } catch (err) {
    showToast("Network error processing disruption");
    return null;
  }
}
