# apps/ai-service/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer, util
from typing import List, Optional
import uvicorn
import logging
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Study Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
embedding_model: Optional[SentenceTransformer] = None
model_loaded = False

@app.on_event("startup")
async def startup_event():
    """Load the AI model on startup"""
    global embedding_model, model_loaded
    try:
        logger.info("🔄 Loading AI Model...")
        # Load model synchronously but in startup event
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        model_loaded = True
        logger.info("✅ AI Model Loaded Successfully!")
    except Exception as e:
        logger.error(f"❌ Failed to load model: {e}")
        model_loaded = False

class TopicRequest(BaseModel):
    agenda: str = Field(..., min_length=3, max_length=500)
    text: str = Field(..., min_length=5, max_length=5000)

class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=200)
    difficulty: str = "medium"
    num_questions: int = Field(default=5, ge=3, le=10)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "AI Study Service is running",
        "status": "healthy",
        "version": "1.0.0",
        "model_loaded": model_loaded
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy" if model_loaded else "loading",
        "model_loaded": model_loaded,
        "model_type": "sentence-transformers" if embedding_model else None
    }

@app.post("/check-topic")
async def check_topic(req: TopicRequest):
    """Check if discussion is on-topic"""
    # Check if model is loaded
    if not model_loaded or embedding_model is None:
        raise HTTPException(
            status_code=503, 
            detail="AI model is still loading. Please try again in a few seconds."
        )
    
    try:
        # Encode agenda and text
        logger.info(f"Checking topic: agenda='{req.agenda}', text='{req.text[:50]}...'")
        
        agenda_emb = embedding_model.encode(req.agenda, convert_to_tensor=True)
        text_emb = embedding_model.encode(req.text, convert_to_tensor=True)
        
        # Compute similarity
        score = util.cos_sim(agenda_emb, text_emb).item()
        is_off_topic = score < 0.3
        
        logger.info(f"Similarity score: {score:.3f}")
        
        # Generate response based on score
        if score >= 0.5:
            message = "✅ Excellent! Staying on topic."
            suggestions = ["Keep up the great discussion!"]
            confidence = "high"
        elif score >= 0.3:
            message = "⚠️ Somewhat related, but could be more focused."
            suggestions = [f"Try relating back to: {req.agenda}"]
            confidence = "medium"
        else:
            message = "❌ Discussion is off-topic. Please refocus!"
            suggestions = [
                f"Return to discussing: {req.agenda}",
                "Ask yourself: How does this relate to the main topic?"
            ]
            confidence = "high"
        
        return {
            "score": round(score, 3),
            "is_off_topic": is_off_topic,
            "message": message,
            "suggestions": suggestions,
            "confidence": confidence
        }
        
    except Exception as e:
        logger.error(f"Error in check_topic: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@app.post("/generate-quiz")
async def generate_quiz(req: QuizRequest):
    """Generate a quiz on the given topic"""
    try:
        logger.info(f"Generating quiz: topic='{req.topic}', difficulty='{req.difficulty}'")
        
        questions = []
        
        # Question templates based on difficulty
        if req.difficulty == "easy":
            templates = [
                f"What is {req.topic}?",
                f"Which describes {req.topic}?",
                f"What is the main idea of {req.topic}?",
                f"Why is {req.topic} important?",
                f"Which statement about {req.topic} is correct?"
            ]
        elif req.difficulty == "hard":
            templates = [
                f"How would you apply {req.topic} in a complex scenario?",
                f"What are the advanced implications of {req.topic}?",
                f"Analyze the relationship between {req.topic} and related concepts.",
                f"What challenges exist when implementing {req.topic}?",
                f"How does {req.topic} compare to alternative approaches?"
            ]
        else:  # medium
            templates = [
                f"What is the main purpose of {req.topic}?",
                f"Which best describes {req.topic}?",
                f"How does {req.topic} work?",
                f"What is a key benefit of {req.topic}?",
                f"Which statement about {req.topic} is true?"
            ]
        
        # Generate questions
        for i in range(min(req.num_questions, len(templates))):
            questions.append({
                "question": templates[i],
                "options": [
                    f"It helps understand {req.topic}",
                    f"It's fundamental to {req.topic}",
                    f"It applies {req.topic} concepts",
                    f"It demonstrates {req.topic} principles"
                ],
                "correct": 0,
                "explanation": f"This answer correctly addresses the core concept of {req.topic}."
            })
        
        logger.info(f"Generated {len(questions)} questions")
        
        return {
            "quiz": questions,
            "topic": req.topic,
            "difficulty": req.difficulty,
            "num_questions": len(questions)
        }
        
    except Exception as e:
        logger.error(f"Quiz generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting AI Study Service...")
    print("📍 Server will be available at: http://localhost:8000")
    print("📚 API Documentation: http://localhost:8000/docs")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )