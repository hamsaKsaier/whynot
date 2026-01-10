import uuid
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class ChatSession:
    """Manages a chat session with context and message history"""
    
    def __init__(
        self,
        session_id: Optional[str] = None,
        test_case_id: Optional[str] = None,
        step_id: Optional[str] = None,
        execution_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        self.session_id = session_id or str(uuid.uuid4())
        self.test_case_id = test_case_id
        self.step_id = step_id
        self.execution_id = execution_id
        self.context = context or {}
        self.messages: List[Dict[str, str]] = []
        self.created_at = datetime.utcnow().isoformat()
        self.updated_at = datetime.utcnow().isoformat()
    
    def addMessage(self, role: str, content: str, metadata: Optional[Dict[str, Any]] = None):
        """Add a message to the session"""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        self.messages.append(message)
        self.updated_at = datetime.utcnow().isoformat()
    
    def getContext(self) -> Dict[str, Any]:
        """Get full context including messages"""
        return {
            "session_id": self.session_id,
            "test_case_id": self.test_case_id,
            "step_id": self.step_id,
            "execution_id": self.execution_id,
            "context": self.context,
            "messages": self.messages,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    def toDict(self) -> Dict[str, Any]:
        """Convert session to dictionary for storage"""
        return {
            "id": self.session_id,
            "test_case_id": self.test_case_id,
            "step_id": self.step_id,
            "execution_id": self.execution_id,
            "context": self.context,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }


class ChatSessionManager:
    """Manages chat sessions (in-memory for now, can be extended to database)"""
    
    def __init__(self):
        self.sessions: Dict[str, ChatSession] = {}
    
    def createSession(
        self,
        test_case_id: Optional[str] = None,
        step_id: Optional[str] = None,
        execution_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> ChatSession:
        """Create a new chat session"""
        session = ChatSession(
            test_case_id=test_case_id,
            step_id=step_id,
            execution_id=execution_id,
            context=context or {}
        )
        self.sessions[session.session_id] = session
        logger.info(f"Created chat session: {session.session_id}")
        return session
    
    def getSession(self, session_id: str) -> Optional[ChatSession]:
        """Get a session by ID"""
        return self.sessions.get(session_id)
    
    def updateSession(self, session_id: str, context: Optional[Dict[str, Any]] = None):
        """Update session context"""
        session = self.sessions.get(session_id)
        if session:
            if context:
                session.context.update(context)
            session.updated_at = datetime.utcnow().isoformat()
    
    def deleteSession(self, session_id: str):
        """Delete a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Deleted chat session: {session_id}")
    
    def getSessionsByTestCase(self, test_case_id: str) -> List[ChatSession]:
        """Get all sessions for a test case"""
        return [s for s in self.sessions.values() if s.test_case_id == test_case_id]
    
    def getSessionsByExecution(self, execution_id: str) -> List[ChatSession]:
        """Get all sessions for an execution"""
        return [s for s in self.sessions.values() if s.execution_id == execution_id]


# Global session manager instance
_session_manager = ChatSessionManager()

def getSessionManager() -> ChatSessionManager:
    """Get the global session manager"""
    return _session_manager






