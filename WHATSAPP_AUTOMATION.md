# 📱 WhatsApp Automation Module — DelegateX CRM

An enterprise-grade, production-ready **WhatsApp Automation System** integrated into the DelegateX CRM application. Built with an abstract messaging provider architecture, it defaults to **Simulation Mode** for credentials-free demo execution while remaining 100% prepared for instant swapping to the official **Meta WhatsApp Cloud API** or **Maytapi**.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Module Structure](#-module-structure)
3. [Provider Abstraction & Simulation Mode](#-provider-abstraction--simulation-mode)
4. [Automation Workflows (Phases 1–3)](#-automation-workflows-phases-13)
5. [Database Schema (MongoDB Collections)](#-database-schema-mongodb-collections)
6. [Real-Time WebSocket Architecture](#-real-time-websocket-architecture)
7. [n8n Workflow Engine Integration](#-n8n-workflow-engine-integration)
8. [API Endpoints Reference](#-api-endpoints-reference)
9. [Local Setup & Testing Guide](#-local-setup--testing-guide)

---

## 🏗 Architecture Overview

```
Frontend (React.js + Tailwind CSS)
  ├── Pages: Dashboard | Inbox | Templates | Automation Logs | Settings
  ├── WebSocketContext: Shared singletons for real-time channel listeners
  └── API Service: axios calls to /api/whatsapp/*

FastAPI Backend (Python)
  ├── Routes: /api/whatsapp/* & /ws/whatsapp
  ├── Automation Engine: Phase 1, Phase 2, Phase 3 workflow orchestrator
  ├── Services: MessageService, TemplateService, n8nService, SchedulerService
  ├── Provider Interface: Abstract WhatsAppProvider class
  │     ├── SimulationProvider (Default — MongoDB lifecycle simulation)
  │     ├── MetaCloudProvider (Stub for official Meta Cloud API)
  │     └── MaytapiProvider (Stub for Maytapi API)
  └── Repository Layer: MongoDB CRUD & aggregation for 4 collections

Database (MongoDB Atlas)
  ├── whatsapp_messages
  ├── whatsapp_templates
  ├── automation_logs
  └── automation_settings
```

---

## 📂 Module Structure

The module is accessible from the main DelegateX sidebar under **WhatsApp Automation**:

### 1. Dashboard (`/whatsapp/dashboard`)
- **6 Key Metrics Cards**: Messages Sent Today, Pending Messages, Scheduled Messages, Successful Deliveries, Failed Messages, Total Automations.
- **Recent Activity Feed**: Real-time timeline of automation executions with duration metrics.
- **Automation Health Panel**: Live provider status, scheduler health, and last execution time.
- **Manual Workflow Triggers**: Direct execution buttons for Follow-up Reminders, Meeting Reminders, and Daily Lead Reports.

### 2. Inbox (`/whatsapp/inbox`)
- **Split-View WhatsApp UI**: Conversation list on left, chat window on right.
- **Conversation List**: Real-time last message preview, timestamps, unread badges, and search filtering.
- **Message Bubbles & Delivery Ticks**: Visual status indicators (🕒 Queued → ✓ Sent → ✓✓ Delivered → 🔵🔵 Read).
- **Simulate Incoming Message Modal**: Interactive modal to test client replies, AI auto-replies, and intent detection without real WhatsApp numbers.

### 3. Templates (`/whatsapp/templates`)
- **5 Default Pre-Seeded Templates**: Welcome Message, Follow-up Reminder, Meeting Reminder, Lead Converted, Task Assigned.
- **Full Template CRUD**: Create, Edit, Delete, and Preview modals.
- **Variable Engine**: Mustache-style placeholders (`{{client_name}}`, `{{project_type}}`, `{{assigned_to}}`).
- **Active/Inactive Toggles**: Enable or disable templates on demand.

### 4. Automation Logs (`/whatsapp/logs`)
- **Audit Logging**: Logs every execution with Workflow Name, Trigger, Execution Time, Status (*success/failed/skipped*), Recipient, Message Preview, and Execution Duration (ms).
- **Filter & Search**: Filter by status or workflow type; search by recipient name or preview content.

### 5. Settings (`/whatsapp/settings`)
- **Provider Selector**: Switch between Simulation Mode (Default), Meta WhatsApp Cloud API, or Maytapi.
- **Connection Health Indicator**: Shows active connection state.
- **Credential Fields**: Configure Webhook URL, API URL, API Key, Phone Number ID, and Business Account ID (disabled in Simulation Mode).

---

## 🔄 Provider Abstraction & Simulation Mode

The system uses an Object-Oriented **Strategy Pattern** for messaging providers:

```python
class WhatsAppProvider(ABC):
    @abstractmethod
    async def send_message(self, recipient_phone: str, content: str, ...) -> dict: pass
    
    @abstractmethod
    async def get_message_status(self, message_id: str) -> str: pass
    
    @abstractmethod
    async def validate_credentials(self) -> dict: pass
```

### Simulation Mode Mechanics:
1. When a message is sent, `SimulationProvider` saves the document into MongoDB with status `queued`.
2. Asynchronously schedules realistic background transitions:
   - **`queued` → `sent`** (after 0.5s)
   - **`sent` → `delivered`** (after 2.0s)
   - **`delivered` → `read`** (after 5.0s)
3. Every transition fires a WebSocket event (`message_status_updated`), updating the UI in real time without refreshing.

---

## ⚡ Automation Workflows (Phases 1–3)

### Phase 1 Automations
| Workflow Name | Trigger Event | Action Flow |
| :--- | :--- | :--- |
| **Welcome Message** | New CRM Lead Created | CRM Route Hook → Render Welcome Template → Trigger n8n Webhook → Save to MongoDB → Display in Inbox |
| **Follow-up Reminder** | Scheduled (Daily) | Find active leads → Render Follow-up Template → Trigger n8n → Save & Display |
| **Meeting Reminder** | Scheduled (Daily) | Query today's CRM meetings → Render Meeting Template → Trigger n8n → Save & Display |

### Phase 2 Automations
| Workflow Name | Trigger Event | Action Flow |
| :--- | :--- | :--- |
| **Auto Reply** | Incoming Client Message | Generate acknowledgment message → Send reply → Log execution |
| **Lead Status Update** | Lead Status → Converted | Trigger Converted template notification → Update Inbox & Logs |
| **Daily Lead Report** | Scheduled (24h) | Aggregate total, new, converted, & lost leads → Send summary report to Admin |
| **Task Assignment** | Delegation Task Created | Send WhatsApp notification to assigned employee with task details & deadline |

### Phase 3 Automations (AI Features)
| Workflow Name | Trigger Event | Action Flow |
| :--- | :--- | :--- |
| **AI FAQ Bot** | Incoming Client Query | Query existing **Gemini 2.5 + RAG** ChatbotService → Format answer → Reply on WhatsApp |
| **CRM Lookup** | Query contains "status" / "enquiry" | Lookup phone number in MongoDB `crm_leads` → Return live lead details |
| **AI Intent Detection** | Any Incoming Message | Parse message text → Route to CRM Lookup, FAQ Bot, Meeting info, or Agent Handoff |

---

## 🗄 Database Schema (MongoDB Collections)

### 1. `whatsapp_messages`
```json
{
  "_id": "ObjectId",
  "conversation_id": "md5_hash_of_phone",
  "direction": "outbound | inbound",
  "sender": "DelegateX",
  "sender_phone": "+91-DELEGATEX",
  "recipient": "John Doe",
  "recipient_phone": "+91-9876543210",
  "content": "Message body text...",
  "message_type": "text | template",
  "status": "queued | sent | delivered | read | failed",
  "template_id": "ObjectId",
  "automation_workflow": "Welcome Message",
  "created_at": "2026-07-23T15:00:00.000Z",
  "updated_at": "2026-07-23T15:00:05.000Z"
}
```

### 2. `whatsapp_templates`
```json
{
  "_id": "ObjectId",
  "name": "Welcome Message",
  "category": "onboarding",
  "content": "👋 Hello {{client_name}}! Welcome to DelegateX...",
  "variables": ["client_name", "project_type", "assigned_to"],
  "description": "Sent automatically when a new CRM lead is created.",
  "is_active": true,
  "created_at": "ISOString",
  "updated_at": "ISOString"
}
```

### 3. `automation_logs`
```json
{
  "_id": "ObjectId",
  "workflow_name": "Welcome Message",
  "trigger": "New CRM Lead Created",
  "status": "success | failed | skipped",
  "recipient": "John Doe",
  "recipient_phone": "+91-9876543210",
  "message_preview": "Hello John Doe...",
  "created_by": "system",
  "execution_duration_ms": 120,
  "execution_time": "ISOString"
}
```

### 4. `automation_settings`
```json
{
  "_id": "ObjectId",
  "provider": "simulation | meta_cloud | maytapi",
  "webhook_url": "http://localhost:5678/webhook",
  "api_url": "https://graph.facebook.com/v18.0",
  "api_key": "encrypted_token",
  "phone_number_id": "123456789",
  "business_account_id": "987654321",
  "is_active": true
}
```

---

## 📡 Real-Time WebSocket Architecture

- **Endpoint**: `/ws/whatsapp`
- **Singleton Connection Management**: Handled via `socketPool` Map in `frontend/src/websocket/socket.js`.
- **StrictMode Protection**: Prevents duplicate connections, reuses existing OPEN/CONNECTING sockets, and cleans up event listeners via `.off("message", ...)` on unmount without closing shared sockets.

### Broadcast Events
- `new_message`: Pushed whenever an outbound or inbound message is created.
- `message_status_updated`: Pushed when status transitions (queued → sent → delivered → read).
- `automation_log_created`: Pushed when a workflow execution completes.

---

## ⚙️ n8n Workflow Engine Integration

n8n is integrated as a workflow orchestrator via **Webhooks**. Business logic remains in FastAPI while n8n manages multi-step execution flows:

- **Webhook Base URL**: `N8N_WEBHOOK_BASE_URL` env variable (`http://localhost:5678/webhook`)
- **Endpoints Triggered**:
  - `POST /webhook/welcome-message`
  - `POST /webhook/followup-reminder`
  - `POST /webhook/meeting-reminder`
  - `POST /webhook/task-assigned`
  - `POST /webhook/lead-status-update`

---

## 🛠 Local Setup & Testing Guide

### 1. Start Servers
```bash
# Terminal 1: Backend
cd backend
.\venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Verify Functionality
1. **Welcome Message**: Go to `/crm/create-lead`, add a lead → navigate to `/whatsapp/inbox` → observe auto-generated message with status ticks.
2. **AI FAQ Bot**: Go to `/whatsapp/inbox` → click `+ Simulate Incoming Message` → ask `"What is the leave policy?"` → watch AI generate RAG response.
3. **CRM Lookup**: Simulate an incoming message `"check my status"` with a registered lead phone number → watch AI output live CRM profile data.
