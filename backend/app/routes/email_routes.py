from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from app.models.email_model import EmailRequest
from app.services.email_service import send_email_async

router = APIRouter()

@router.post("/send-email", status_code=status.HTTP_200_OK)
async def send_email(request: EmailRequest, background_tasks: BackgroundTasks):
    """
    Endpoint to send an email asynchronously.
    Can be run as a background task or awaited.
    """
    try:
        # Await the email send to ensure proper error handling and immediate response feedback
        await send_email_async(
            recipient=request.recipient,
            subject=request.subject,
            body=request.body
        )
        return {
            "success": True,
            "message": f"Email sent successfully to {request.recipient}"
        }
    except ValueError as ve:
        # Configuration error (missing credentials)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(ve)
        )
    except Exception as e:
        # SMTP or Network error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )
