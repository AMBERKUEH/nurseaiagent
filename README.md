# NurseFlow

AI-powered multi-agent nurse scheduling system with OCR, demand forecasting, compliance monitoring, and emergency response capabilities.

## Tech Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 6.3.5
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI (shadcn/ui)
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend
- **Framework**: Python FastAPI
- **AI/LLM**: Groq API (llama-3.3-70b-versatile)
- **PDF Processing**: pdf2image + Poppler
- **Image Processing**: Pillow

### Multi-Agent System
- **OCR Agent**: Extracts nurse data from PDF rosters using vision models
- **Forecasting Agent**: Predicts staffing demand
- **Scheduling Agent**: Generates optimized schedules with rest-day enforcement
- **Compliance Agent**: Validates against labor regulations
- **Emergency Agent**: Handles disruptions and finds replacements

## Features

- **PDF Upload**: Extract nurse information from roster PDFs
- **Smart Scheduling**: Automatic shift assignment with 2 rest days per week
- **Real-time Updates**: Live schedule adjustments via Agent Activity chat
- **Emergency Response**: Handle nurse call-outs with automatic replacement finding
- **Compliance Monitoring**: Ensure KKM (Malaysian Ministry of Health) compliance

## Running the Application

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Note**: Poppler must be installed for PDF OCR functionality. Download from https://github.com/oschwartz10612/poppler-windows/releases/ and add to PATH.

---

*Original Figma design: https://www.figma.com/design/b9hFPnS9eWtJ7UevpKcwWK/NurseAI-App-Design*
