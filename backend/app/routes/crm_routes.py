from fastapi import APIRouter, HTTPException, BackgroundTasks
from bson import ObjectId
from datetime import datetime
from app.config.database import crm_lead_collection, crm_meeting_collection
from app.models.crm_model import Lead, Meeting
from app.websocket.events import broadcast_crm_event, trigger_and_broadcast_notification
from app.services.email_service import send_lead_created_notification, send_email, load_template
import asyncio

router = APIRouter()

# GET CRM Leads
@router.get("/crm/leads")
async def get_crm_leads():
    leads = []
    for l in crm_lead_collection.find():
        l["_id"] = str(l["_id"])
        leads.append(l)
    return leads

# CREATE Lead
@router.post("/create-lead")
@router.post("/crm/leads")
async def create_lead(lead: Lead, background_tasks: BackgroundTasks):

    lead_dict = lead.dict()
    current_date = datetime.utcnow().isoformat().split("T")[0]
    
    # Generate unique numeric-based ID if not present
    if not lead_dict.get("id"):
        lead_dict["id"] = int(datetime.utcnow().timestamp() * 1000)
    if not lead_dict.get("date"):
        lead_dict["date"] = current_date
        
    res = crm_lead_collection.insert_one(lead_dict)
    lead_dict["_id"] = str(res.inserted_id)
    
    # Broadcast to all CRM WS clients
    asyncio.create_task(broadcast_crm_event("lead_created", lead_dict))
    
    # Trigger notification
    asyncio.create_task(trigger_and_broadcast_notification(
        "lead_registered",
        "New Lead Registered",
        f"Lead '{lead_dict['name']}' has been registered with a value of ₹{lead_dict.get('value', 0)}."
    ))
    
    # Trigger WhatsApp Welcome Message Automation
    try:
        from app.whatsapp.services.automation_service import trigger_welcome_message
        asyncio.create_task(trigger_welcome_message(lead_dict))
    except Exception as wa_e:
        print(f"[WhatsApp] Welcome message trigger error: {wa_e}")
    
    # 1. Send Employee Assignment Email (Keep employee email workflow unchanged)
    employee_sent = False
    try:
        employee_sent = await send_lead_created_notification(lead_dict)
    except Exception as emp_e:
        print("Employee assignment email exception:", str(emp_e))

    # 2. Send Client Welcome Email immediately after employee email sending
    print("CLIENT EMAIL SEND STARTED")
    print("CLIENT EMAIL:", lead.email)
    client_sent = False
    try:
        client_html_template = load_template(
            "lead_client_welcome.html",
            subject="Welcome to DelegateX CRM",
            customer_name=lead_dict.get("name") or "Valued Client",
            client_name=lead_dict.get("name") or "Valued Client",
            customer_email=lead_dict.get("email"),
            client_email=lead_dict.get("email"),
            customer_phone=lead_dict.get("phone") or "N/A",
            project_type=lead_dict.get("projectType") or "Residential",
            employee_name=lead_dict.get("assignedTo") or "Sarah Jenkins"
        )
        
        # Inject the verified automated email paragraph dynamically into the email body
        verified_msg = "<p>This is a verified automated email from DelegateX CRM.</p>"
        if "Welcome to DelegateX" in client_html_template:
            client_html_template = client_html_template.replace(
                "Welcome to DelegateX.",
                f"Welcome to DelegateX.{verified_msg}"
            )
        
        await send_email(
            lead.email,
            "Welcome to DelegateX CRM",
            client_html_template
        )
        client_sent = True
        print("CLIENT EMAIL SENT SUCCESSFULLY")
    except Exception as e:
        print("EMAIL ERROR:", str(e))

    print(f"client={client_sent}")
    print(f"employee={employee_sent}")
    
    return {
        "message": "Lead registered successfully",
        "lead": lead_dict
    }

# UPDATE Lead Status
@router.put("/crm/leads/{lead_id}")
async def update_lead_status(lead_id: str, payload: dict):
    status = payload.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="Status is required")
        
    res = crm_lead_collection.update_one(
        {"_id": ObjectId(lead_id)},
        {"$set": {"status": status}}
    )
    
    # Also fetch full lead to broadcast
    updated_lead = crm_lead_collection.find_one({"_id": ObjectId(lead_id)})
    if not updated_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    updated_lead["_id"] = str(updated_lead["_id"])
    
    event_name = "lead_updated"
    if status.lower() == "converted":
        event_name = "lead_converted"
    elif status.lower() == "lost":
        event_name = "lead_lost"
        
    asyncio.create_task(broadcast_crm_event(event_name, updated_lead))
    
    return {"message": f"Lead status updated to {status}", "lead": updated_lead}


# GET Meetings
@router.get("/crm/meetings")
async def get_crm_meetings():
    meetings = []
    for m in crm_meeting_collection.find():
        m["_id"] = str(m["_id"])
        meetings.append(m)
    return meetings

# CREATE Meeting
@router.post("/crm/meetings")
async def create_meeting(meeting: Meeting):
    mtg_dict = meeting.dict()
    res = crm_meeting_collection.insert_one(mtg_dict)
    mtg_dict["_id"] = str(res.inserted_id)
    
    asyncio.create_task(broadcast_crm_event("followup_scheduled", mtg_dict))
    
    return {
        "message": "Meeting scheduled successfully",
        "meeting": mtg_dict
    }

# UPDATE Meeting (Status/MOM)
@router.put("/crm/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, payload: dict):
    res = crm_meeting_collection.update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": payload}
    )
    
    updated_mtg = crm_meeting_collection.find_one({"_id": ObjectId(meeting_id)})
    if not updated_mtg:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    updated_mtg["_id"] = str(updated_mtg["_id"])
    asyncio.create_task(broadcast_crm_event("meeting_status_updated", updated_mtg))
    
    return {"message": "Meeting updated successfully", "meeting": updated_mtg}
