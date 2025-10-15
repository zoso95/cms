# Task-Based Workflow Architecture

## Overview
This document outlines the new task-based workflow system where each patient case has a set of tasks that track progress through the medical records retrieval pipeline. Workflows automatically update task statuses and provide fine-grained status updates for visibility.

## Architecture Principles
1. **Keep Legacy Workflows**: Existing workflows (`endToEndWorkflow`, `patientOutreachWorkflow`, `recordsRetrievalWorkflow`) remain unchanged
2. **New Task-Based Workflows**: Create new production workflows that manage tasks
3. **Granular Status Updates**: Workflows update both task status AND detailed status messages for real-time visibility
4. **Default Task Template**: Every case starts with 7 default tasks
5. **Mixed Automation**: Some tasks are automated (AI-driven), others are manual (human-driven)

---

## Default Tasks Per Case

| # | Task Name | Assigned To | Automation | Updated By |
|---|-----------|-------------|------------|------------|
| 1 | Intake Call | AI | Automated | `IntakeCallWorkflow` |
| 2 | Case Evaluation | AI | Automated | `IntakeCallWorkflow` (after analysis) |
| 3 | Extract Providers | AI | Automated | `IntakeCallWorkflow` (after extraction) |
| 4 | Follow up call (pitch advocacy) | Ben | Manual | Frontend UI |
| 5 | Verify Providers | Ben | Manual | Frontend UI (triggered after Extract Providers) |
| 6 | Gather Releases | AI | Automated | `ProviderRecordsWorkflow` (per provider) |
| 7 | Send Out Records Requests | AI | Automated | `ProviderRecordsWorkflow` (per provider) |

### Task Statuses
- `not_started` - Task hasn't begun
- `in_progress` - Task is actively being worked on
- `completed` - Task finished successfully
- `blocked` - Task cannot proceed (requires manual intervention)
- `failed` - Task failed (requires review)

---

## New Workflow Architecture

### 1. IntakeCallWorkflow (Production)
**Purpose**: Contact patient, collect transcript, analyze case, extract providers

**Tasks Updated**:
- Task 1: "Intake Call"
  - Set to `in_progress` when starting patient outreach
  - Set to `completed` when patient answers or responds
  - Set to `failed` if max attempts reached
- Task 2: "Case Evaluation"
  - Set to `in_progress` when analyzing transcript
  - Set to `completed` after Claude analysis completes
- Task 3: "Extract Providers"
  - Set to `in_progress` when extracting providers
  - Set to `completed` after providers saved to database
  - Include count in notes: "Found 3 providers"

**Status Updates** (fine-grained):
- "Starting patient outreach"
- "Attempt 1/7: Sending SMS"
- "Attempt 1/7: Waiting 1 minute before call"
- "Attempt 1/7: Placing call"
- "Attempt 1/7: Patient answered call!"
- "Collecting call transcript"
- "Analyzing transcript with AI"
- "Extracting provider information"
- "Complete: Found 3 provider(s)"

**Child Workflows**: None

**Corresponds to existing**: `patientOutreachWorkflow` + transcript analysis + provider extraction from `endToEndWorkflow`

---

### 2. ProviderRecordsWorkflow (Production)
**Purpose**: For a single verified provider, gather patient signature and send records request

**Tasks Updated**:
- Task 6: "Gather Releases"
  - Set to `in_progress` when creating signature request
  - Set to `completed` when patient signs
  - Set to `failed` if signature declined/expired
- Task 7: "Send Out Records Requests"
  - Set to `in_progress` when sending fax/email
  - Set to `completed` after delivery confirmation
  - Set to `failed` if delivery fails

**Status Updates** (fine-grained):
- "Creating signature request for Dr. Smith"
- "Waiting for patient signature"
- "Signature received"
- "Finding contact info for Dr. Smith"
- "Waiting for manual verification of contact"
- "Contact verified"
- "Sending fax to Dr. Smith"
- "Waiting for fax delivery confirmation"
- "Fax delivered successfully"
- "Complete: Records request sent to Dr. Smith"

**Child Workflows**: None (this is a leaf workflow)

**Triggered By**: Manually started for each verified provider (after Task 5 completed)

**Corresponds to existing**: `recordsRetrievalWorkflow`

---

### 3. MasterCaseWorkflow (Production) - Optional Orchestrator
**Purpose**: Top-level orchestrator that manages the entire case from start to finish

**Flow**:
1. Initialize default tasks
2. Start `IntakeCallWorkflow` as child
3. Wait for Task 3 completion (providers extracted)
4. Wait for Task 5 completion (providers verified - manual step by Ben)
5. Start one `ProviderRecordsWorkflow` child per verified provider (parallel execution)
6. Wait for all provider workflows to complete
7. Mark case as complete

**Status Updates**:
- "Initializing case tasks"
- "Starting intake call workflow"
- "Waiting for provider verification (manual step)"
- "Starting records retrieval for 3 providers"
- "All records requests sent - Case complete"

**Note**: This workflow can be optional initially. We can start workflows manually and add orchestration later.

---

## Database Schema

### New Table: `case_tasks`

```sql
CREATE TABLE case_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id BIGINT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  assigned_to TEXT NOT NULL, -- 'AI' or 'Ben' or user name
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked', 'failed')),
  notes TEXT, -- Additional context (e.g., "Found 3 providers", "Waiting for fax confirmation")
  sort_order INTEGER NOT NULL, -- Display order (1-7 for default tasks)
  metadata JSONB DEFAULT '{}', -- Flexible field for task-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(patient_case_id, task_name)
);

CREATE INDEX idx_case_tasks_patient_case_id ON case_tasks(patient_case_id);
CREATE INDEX idx_case_tasks_status ON case_tasks(status);
CREATE INDEX idx_case_tasks_assigned_to ON case_tasks(assigned_to);

-- Trigger for updated_at
CREATE TRIGGER update_case_tasks_updated_at
  BEFORE UPDATE ON case_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Updates to `workflow_executions`
No changes needed. The `status_message` field already exists for fine-grained status updates.

---

## Implementation TODOs

### Phase 1: Database & Activities ✅
- [ ] **TODO-DB-1**: Create migration `013_add_case_tasks.sql` with table schema above
- [ ] **TODO-DB-2**: Run migration in Supabase
- [ ] **TODO-ACTIVITY-1**: Add activity `initializeDefaultTasks(patientCaseId: number)` in `activities.ts`
  - Creates 7 default tasks if they don't exist
  - Sets all to `not_started` status
  - Returns array of created task IDs
- [ ] **TODO-ACTIVITY-2**: Add activity `updateTaskStatus(patientCaseId: number, taskName: string, status: string, notes?: string)` in `activities.ts`
  - Updates task status and timestamp
  - Optionally updates notes field
  - Logs to console
- [ ] **TODO-ACTIVITY-3**: Add activity `getTaskByName(patientCaseId: number, taskName: string)` in `activities.ts`
  - Helper to retrieve current task state
  - Used for conditional logic in workflows

### Phase 2: New Workflows 🚀
- [ ] **TODO-WORKFLOW-1**: Create `worker/src/workflows/intakeCallWorkflow.ts`
  - Copy logic from `patientOutreachWorkflow` + transcript analysis + provider extraction
  - Add task status updates at each phase
  - Add fine-grained status messages
  - Register in workflow registry as `category: 'production'`
- [ ] **TODO-WORKFLOW-2**: Create `worker/src/workflows/providerRecordsWorkflow.ts`
  - Copy logic from `recordsRetrievalWorkflow`
  - Add task status updates for "Gather Releases" and "Send Out Records Requests"
  - Add fine-grained status messages
  - Register in workflow registry as `category: 'production'`
- [ ] **TODO-WORKFLOW-3**: Update `worker/src/workflows/registry.ts`
  - Add `intakeCallWorkflow` with category 'production'
  - Add `providerRecordsWorkflow` with category 'production'
  - Move old workflows to category 'legacy' or keep as 'test'
- [ ] **TODO-WORKFLOW-4**: Build and test new workflows
  - Test task initialization
  - Test status updates at each step
  - Verify task state persists correctly

### Phase 3: Backend API 🔌
- [ ] **TODO-API-1**: Add controller `getPatientTasks(req, res)` in `patientController.ts`
  - GET `/api/patient-cases/:id/tasks`
  - Returns array of tasks sorted by `sort_order`
  - Include status, assigned_to, notes, updated_at
- [ ] **TODO-API-2**: Add controller `updatePatientTask(req, res)` in `patientController.ts`
  - PATCH `/api/patient-cases/:id/tasks/:taskId`
  - Update status and/or notes
  - Validate status transitions
  - Return updated task
- [ ] **TODO-API-3**: Update `backend/src/routes/patients.ts`
  - Add route: `router.get('/:id/tasks', patientController.getPatientTasks)`
  - Add route: `router.patch('/:id/tasks/:taskId', patientController.updatePatientTask)`
- [ ] **TODO-API-4**: Build and test backend
  - Test GET tasks endpoint
  - Test PATCH task endpoint
  - Verify error handling

### Phase 4: Frontend UI 🎨
- [ ] **TODO-FRONTEND-1**: Update `frontend/src/api/client.ts`
  - Add `getPatientTasks(id: string)` method
  - Add `updatePatientTask(patientCaseId: string, taskId: string, updates: { status?: string; notes?: string })` method
- [ ] **TODO-FRONTEND-2**: Add "Tasks" tab to `PatientCaseDetail.tsx`
  - Add tab next to "workflows", "communications", etc.
  - Show task table when selected
- [ ] **TODO-FRONTEND-3**: Create `frontend/src/components/TasksTable.tsx`
  - Table with columns: Task Name, Assigned To, Status, Last Update, Actions
  - Status badge with colors: gray (not_started), blue (in_progress), green (completed), yellow (blocked), red (failed)
  - For manual tasks (Ben's tasks): Show dropdown or button to change status
  - For automated tasks (AI): Read-only with explanation tooltip
  - Show notes in expandable detail row
- [ ] **TODO-FRONTEND-4**: Add helper functions to `utils/taskHelpers.ts`
  - `getTaskStatusColor(status: string): string` - Return hex color for badge
  - `getTaskStatusLabel(status: string): string` - Return display label
  - `isManualTask(taskName: string): boolean` - Determine if task is manual
- [ ] **TODO-FRONTEND-5**: Build and test frontend
  - Verify tasks load correctly
  - Test status updates for manual tasks
  - Check real-time updates from workflows

### Phase 5: Integration & Testing 🧪
- [ ] **TODO-TEST-1**: End-to-end test: Start `IntakeCallWorkflow`
  - Verify tasks 1, 2, 3 update correctly
  - Check status messages appear in real-time
  - Confirm task timestamps update
- [ ] **TODO-TEST-2**: End-to-end test: Manual task updates
  - Update "Follow up call" to in_progress
  - Update "Verify Providers" to completed
  - Verify changes persist and display correctly
- [ ] **TODO-TEST-3**: End-to-end test: Start `ProviderRecordsWorkflow`
  - Verify tasks 6, 7 update correctly
  - Test signature flow updates task status
  - Test fax/email flow updates task status
- [ ] **TODO-TEST-4**: Verify WebSocket updates (if enabled)
  - Task status changes trigger real-time UI updates
  - No need to refresh page to see task changes

### Phase 6: Production Migration 🚀
- [ ] **TODO-PROD-1**: Update workflow registry category labels
  - Mark `endToEndWorkflow`, `patientOutreachWorkflow`, `recordsRetrievalWorkflow` as `test`
  - Mark `intakeCallWorkflow`, `providerRecordsWorkflow` as `production`
- [ ] **TODO-PROD-2**: Update WorkflowSelector UI
  - Show Production tab first (instead of Test)
  - Add description explaining new task-based workflows
- [ ] **TODO-PROD-3**: Add migration path for existing cases
  - Script to initialize tasks for cases already in progress
  - Infer task status from workflow state
- [ ] **TODO-PROD-4**: Documentation
  - Update user guide with task-based workflow
  - Document manual task procedures (when to mark tasks complete)
  - Add screenshots of new Tasks tab

---

## Example Task Flow

### Case: Patient John Doe (ID: 123)

**Initial State** (Tasks created when case starts):
```
1. Intake Call          | AI  | not_started | -
2. Case Evaluation      | AI  | not_started | -
3. Extract Providers    | AI  | not_started | -
4. Follow up call       | Ben | not_started | -
5. Verify Providers     | Ben | not_started | -
6. Gather Releases      | AI  | not_started | -
7. Send Out Records Req | AI  | not_started | -
```

**After IntakeCallWorkflow completes**:
```
1. Intake Call          | AI  | completed   | 2025-10-15 2:30pm
2. Case Evaluation      | AI  | completed   | 2025-10-15 2:35pm
3. Extract Providers    | AI  | completed   | "Found 3 providers" | 2025-10-15 2:36pm
4. Follow up call       | Ben | not_started | -
5. Verify Providers     | Ben | not_started | - (Ben needs to verify the 3 providers)
6. Gather Releases      | AI  | not_started | -
7. Send Out Records Req | AI  | not_started | -
```

**Ben completes manual tasks**:
```
4. Follow up call       | Ben | completed   | "Pitched advocacy services" | 2025-10-15 3:00pm
5. Verify Providers     | Ben | completed   | "All 3 verified via NPI" | 2025-10-15 3:15pm
```

**ProviderRecordsWorkflow started for Dr. Smith (1 of 3 providers)**:
```
6. Gather Releases      | AI  | in_progress | "Waiting for signature (Dr. Smith)" | 2025-10-15 3:20pm
```

**Patient signs release**:
```
6. Gather Releases      | AI  | in_progress | "Sending fax to Dr. Smith" | 2025-10-15 4:00pm
7. Send Out Records Req | AI  | in_progress | "Fax sent to Dr. Smith" | 2025-10-15 4:01pm
```

**Fax confirmed delivered**:
```
7. Send Out Records Req | AI  | completed   | "Fax delivered to Dr. Smith" | 2025-10-15 4:05pm
```

**When all 3 providers complete**:
```
6. Gather Releases      | AI  | completed   | "3/3 providers - All signatures collected" | 2025-10-15 5:00pm
7. Send Out Records Req | AI  | completed   | "3/3 providers - All requests sent" | 2025-10-15 5:05pm
```

---

## UI Mockup: Tasks Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│ Patient Case Detail: John Doe                                       │
├─────────────────────────────────────────────────────────────────────┤
│ [Workflows] [Communications] [Providers] [Tasks] [Transcripts] ... │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tasks                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Task                    │ Assigned │ Status      │ Updated   │  │
│  ├─────────────────────────┼──────────┼─────────────┼───────────┤  │
│  │ Intake Call             │ AI       │ ● Completed │ 2:30pm    │  │
│  │ Case Evaluation         │ AI       │ ● Completed │ 2:35pm    │  │
│  │ Extract Providers       │ AI       │ ● Completed │ 2:36pm    │  │
│  │   └ Found 3 providers   │          │             │           │  │
│  │ Follow up call          │ Ben      │ ○ Not Started [▼ Update]│  │
│  │ Verify Providers        │ Ben      │ ○ Not Started [▼ Update]│  │
│  │ Gather Releases         │ AI       │ ○ Not Started  -        │  │
│  │ Send Out Records Req    │ AI       │ ○ Not Started  -        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Status Colors**:
- ○ Not Started (Gray - #9ca3af)
- ◐ In Progress (Blue - #3b82f6)
- ● Completed (Green - #10b981)
- ⬤ Blocked (Yellow - #f59e0b)
- ✖ Failed (Red - #ef4444)

---

## Future Enhancements

### Notifications
- Email Ben when manual tasks are ready (e.g., providers extracted and need verification)
- Slack integration for task status changes
- Dashboard showing all pending manual tasks across all cases

### Analytics
- Task completion time tracking
- Bottleneck identification (which tasks take longest)
- Success rate per task
- AI vs manual task ratio

### Dynamic Tasks
- Allow adding custom tasks per case
- Task templates for different case types
- Task dependencies (Task B can't start until Task A completes)

### Workflow Orchestration
- Implement `MasterCaseWorkflow` as orchestrator
- Auto-start `ProviderRecordsWorkflow` when providers verified
- Smart retry logic for failed tasks
- Parallel execution optimization

---

## Questions & Decisions

### Q1: Should we auto-start ProviderRecordsWorkflow after verification?
**Decision**: Manual trigger initially. Ben will start workflows from the UI after verifying providers. We can add auto-start orchestration in Phase 6.

### Q2: How do we handle multiple providers for tasks 6 & 7?
**Decision**: Task shows aggregate status. Notes field shows "2/3 providers completed". Each provider gets their own `ProviderRecordsWorkflow` child.

### Q3: What if a task needs to be restarted?
**Decision**: Allow status change from `failed` → `not_started` via UI. Workflow can then be manually re-triggered.

### Q4: Do we need task history/audit log?
**Future**: For now, use `updated_at` timestamp. Can add full audit log later if needed.

---

## Success Criteria

✅ Default tasks automatically created for each new case
✅ IntakeCallWorkflow updates tasks 1, 2, 3 correctly
✅ Ben can manually update tasks 4, 5 from UI
✅ ProviderRecordsWorkflow updates tasks 6, 7 correctly
✅ Tasks tab shows real-time status with color-coded badges
✅ Status messages provide fine-grained pipeline visibility
✅ Legacy workflows remain functional for existing cases
✅ New production workflows visible in WorkflowSelector

---

**Document Version**: 1.0
**Created**: 2025-10-15
**Last Updated**: 2025-10-15
**Owner**: Engineering Team
