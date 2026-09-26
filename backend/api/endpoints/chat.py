from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services.llm_agent import process_chat_message
import json
from services.tools import run_sql
from sqlalchemy.orm import Session
from database import get_db
from models import Session as DBSession, Message as DBMessage

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    table_schemas: List[Dict[str, Any]]
    history: List[Dict[str, Any]] = []
    session_id: Optional[int] = None

@router.post("/chat")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        # Create or fetch session
        if request.session_id:
            db_session = db.query(DBSession).filter(DBSession.id == request.session_id).first()
            if not db_session:
                raise HTTPException(status_code=404, detail="Session not found")
        else:
            title = request.message[:50] + "..." if len(request.message) > 50 else request.message
            db_session = DBSession(title=title)
            db.add(db_session)
            db.commit()
            db.refresh(db_session)

        # Save user message
        user_msg = DBMessage(session_id=db_session.id, role="user", content=request.message)
        db.add(user_msg)
        db.commit()

        # Generate response
        response = await process_chat_message(
            user_message=request.message,
            table_schemas=request.table_schemas,
            conversation_history=request.history
        )

        # Save assistant message
        chart_data = None
        if response.get('trace'):
            chart_call = next((t for t in response['trace'] if t.get('tool') == 'generate_chart_tool'), None)
            if chart_call and chart_call.get('tool_result') and not chart_call.get('tool_result', {}).get('error'):
                try:
                    chart_data = json.loads(chart_call['tool_result']) if isinstance(chart_call['tool_result'], str) else chart_call['tool_result']
                except:
                    pass

        assistant_msg = DBMessage(
            session_id=db_session.id,
            role="assistant",
            content=response['answer'],
            trace=response.get('trace'),
            chart=chart_data
        )
        db.add(assistant_msg)
        db.commit()

        response['session_id'] = db_session.id
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
def get_sessions(db: Session = Depends(get_db)):
    sessions = db.query(DBSession).order_by(DBSession.created_at.desc()).all()
    return [{"id": s.id, "title": s.title, "created_at": s.created_at} for s in sessions]

@router.get("/sessions/{session_id}/history")
def get_session_history(session_id: int, db: Session = Depends(get_db)):
    messages = db.query(DBMessage).filter(DBMessage.session_id == session_id).order_by(DBMessage.id.asc()).all()
    history = []
    for m in messages:
        history.append({
            "role": m.role,
            "content": m.content,
            "trace": m.trace,
            "chart": m.chart
        })
    return history

@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    db_session = db.query(DBSession).filter(DBSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.query(DBMessage).filter(DBMessage.session_id == session_id).delete()
    db.delete(db_session)
    db.commit()
    return {"status": "success"}
