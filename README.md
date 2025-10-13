# Afterimage CMS - Temporal Workflow Engine

A comprehensive workflow engine built with Temporal for managing medical records retrieval workflows. The system includes a Temporal worker for executing workflows, a backend API for workflow management, and a React frontend dashboard.

## 🏗️ Architecture

This is a monorepo with the following packages:

- **worker/** - Temporal worker that executes workflows and activities
- **backend/** - Express API server for workflow management and webhooks
- **frontend/** - React dashboard for viewing and managing patient cases
- **shared/** - Shared TypeScript types and schemas

## 📋 Prerequisites

- Node.js 18+ and npm
- Temporal Server (running locally or remote)
- Supabase account and project
- (Optional) Twilio account for SMS/calls
- (Optional) Email SMTP server

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

This will install dependencies for all workspaces.

### 2. Set Up Temporal Server

#### Option A: Using Temporal CLI (Recommended for Development)

```bash
# Install Temporal CLI
brew install temporal

# Start Temporal development server
temporal server start-dev
```

The dev server runs on `localhost:7233` by default.

#### Option B: Using Docker

```bash
git clone https://github.com/temporalio/docker-compose.git
cd docker-compose
docker-compose up
```

### 3. Set Up Supabase Database

1. Create a new Supabase project at https://supabase.com
2. Go to the SQL Editor in your Supabase dashboard
3. Run the schema from `supabase-schema.sql`:

```bash
# Copy the contents of supabase-schema.sql and run it in the Supabase SQL Editor
```

This creates the necessary tables:
- `workflow_executions` - Track workflow runs
- `communication_logs` - Log all SMS/call/email/fax communications
- `call_transcripts` - Store call transcripts and analysis
- `providers` - Track extracted healthcare providers
- `records_requests` - Track records requests per provider
- `webhook_events` - Store incoming webhook events

**Note:** The schema uses your existing `patient_cases` table.

### 4. Configure Environment Variables

Create `.env` files in each package:

#### worker/.env
```bash
cp worker/.env.example worker/.env
# Edit worker/.env with your credentials
```

#### backend/.env
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials
```

Required variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon/public key
- `TEMPORAL_ADDRESS` - Temporal server address (default: localhost:7233)

### 5. Start the Services

You'll need 3 terminal windows:

#### Terminal 1: Start the Temporal Worker
```bash
npm run dev:worker
```

#### Terminal 2: Start the Backend API
```bash
npm run dev:backend
```

#### Terminal 3: Start the Frontend
```bash
npm run dev:frontend
```

The services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Temporal UI: http://localhost:8233 (if using dev server)

## 📱 Using the Dashboard

### View Patient Cases
1. Navigate to http://localhost:3000
2. You'll see a list of all patient cases from your `patient_cases` table
3. Click "View Details" on any case to see more information

### Start a Workflow
1. Go to a patient case detail page
2. Click the "Start Workflow" button
3. The system will:
   - Create a workflow execution record in the database
   - Start the Temporal workflow
   - Begin attempting to contact the patient

### Monitor Workflow Progress
The detail page has tabs to view:
- **Workflows** - All workflow executions for this case
- **Communications** - SMS, calls, emails, faxes sent/received
- **Providers** - Healthcare providers extracted from conversations
- **Transcripts** - Call transcripts and AI analysis

## 🔄 The Records Workflow

The main workflow (`recordsWorkflow`) does the following:

### Phase 1: Contact Patient (Up to 7 days)
1. Sends an SMS asking patient to call back
2. Places an outbound call
3. Waits 24 hours (can be interrupted if patient texts back)
4. Repeats up to 7 times

### Phase 2: Handle Response
- If patient texts back → Schedule a callback
- If patient picks up → Continue to next phase
- If no contact after 7 days → Mark as failed

### Phase 3: Process Call
1. Collect call transcript
2. Analyze transcript with AI
3. Extract healthcare providers mentioned

### Phase 4: Request Records (Parallel)
For each provider:
1. Create a records request
2. Wait for patient signature
3. Find doctor office contact info
4. Manual verification step
5. Send request via fax or email
6. Wait for records to arrive
7. Ingest records into system

### Phase 5: Complete
Run downstream analysis and mark case as complete

## 📊 Database Schema

All workflow data is stored in Supabase with proper foreign key relationships:

```
patient_cases (your existing table)
  ├── workflow_executions
  │     ├── communication_logs
  │     ├── call_transcripts
  │     ├── providers
  │     │     └── records_requests
  │     └── webhook_events
```

## 🔧 API Endpoints

### Patient Cases
- `GET /api/patient-cases` - List all patient cases
- `GET /api/patient-cases/:id` - Get single patient case

### Workflows
- `POST /api/workflows/start` - Start a workflow for a patient case
  ```json
  { "patientCaseId": 123 }
  ```
- `GET /api/workflows/:workflowId` - Get workflow status from Temporal
- `GET /api/patient-cases/:id/workflows` - List workflows for a case
- `POST /api/workflows/:workflowId/signal` - Send a signal to a running workflow

### Data
- `GET /api/patient-cases/:id/communications` - Get communication logs
- `GET /api/patient-cases/:id/providers` - Get extracted providers
- `GET /api/patient-cases/:id/transcripts` - Get call transcripts

### Webhooks
- `POST /api/webhooks/twilio/sms` - Twilio SMS webhook
- `POST /api/webhooks/twilio/voice` - Twilio voice webhook
- `POST /api/webhooks/twilio/transcription` - Twilio transcription webhook

## 🎯 Current State & Next Steps

### ✅ Completed
- Full monorepo structure with TypeScript
- Temporal worker with activities and workflow
- Comprehensive database schema
- Backend API with all endpoints
- React frontend dashboard
- Workflow execution tracking
- Communication logging

### 🚧 To Be Implemented
- **ElevenLabs + Twilio Integration** - Real voice calls with AI
- **SMS Integration** - Connect Twilio for real SMS
- **Email Integration** - Configure SMTP for emails
- **Fax Integration** - Use a fax API service
- **AI Transcript Analysis** - Connect to OpenAI/Anthropic
- **Provider Database** - Build or integrate provider lookup
- **Signature Service** - Integrate DocuSign/HelloSign
- **Records Ingestion** - Parse and store medical records

### 📝 Notes on Mocked Functions

The following activities are currently mocked and return simulated data:
- `placeCall()` - Simulates call placement
- `sendSMS()` - Logs but doesn't actually send
- `sendEmail()` - Logs but doesn't actually send
- `collectTranscript()` - Returns mock transcript
- `analyzeTranscript()` - Returns mock analysis
- `extractProviders()` - Returns mock providers
- `findDoctorOffice()` - Returns mock contact info
- `manualVerify()` - Auto-approves
- `waitForSignature()` - Simulates delay
- `waitForRecords()` - Simulates delay

These will be replaced with real implementations as you integrate services.

## 🔍 Debugging

### View Temporal Workflows
Navigate to http://localhost:8233 to see:
- Running workflows
- Workflow history
- Event logs
- Stack traces

### View Database
Use the Supabase dashboard to:
- Query tables directly
- See real-time updates
- Monitor database performance

### Backend Logs
The backend logs all requests and errors to the console.

### Worker Logs
The worker logs all activity executions with detailed information.

## 🚀 Production Deployment

### Build All Packages
```bash
npm run build
```

### Deploy Considerations
- **Temporal Worker**: Deploy as a long-running service (Kubernetes, ECS, etc.)
- **Backend API**: Deploy as a web service (Vercel, Railway, Render, etc.)
- **Frontend**: Deploy static build to CDN (Vercel, Netlify, Cloudflare Pages)
- **Temporal Server**: Use Temporal Cloud or self-host
- **Database**: Use Supabase hosted or self-host PostgreSQL

## 📚 Learn More

- [Temporal Documentation](https://docs.temporal.io/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Query Documentation](https://tanstack.com/query)

## 🤝 Contributing

This is a custom CMS for Afterimage. Extend workflows and activities as needed for your use cases.
