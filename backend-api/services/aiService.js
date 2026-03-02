const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    }

    async detectTopicDrift(agenda, transcript) {
        if (!process.env.GEMINI_API_KEY) {
            return { is_off_topic: false, justification: "Mock: Gemini API Key missing" };
        }

        const prompt = `
        Context: An online study meeting.
        Agenda: "${agenda}"
        Transcript Segment: "${transcript}"

        Is the transcript significantly off-topic from the agenda?
        Ignore small talk or brief deviations.
        Respond ONLY with a JSON object:
        { "is_off_topic": boolean, "justification": string }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean JSON response
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('AI Drift Detection Error:', error);
            throw error;
        }
    }

    async generateQuiz(topic) {
        if (!process.env.GEMINI_API_KEY) {
            return {
                questions: [
                    {
                        question: "Mock Question 1: What is 2+2?",
                        options: ["3", "4", "5", "6"],
                        correctIndex: 1
                    }
                ]
            };
        }

        const prompt = `
        Generate a 5-question multiple choice quiz about: "${topic}".
        Respond ONLY with a JSON object in this format:
        {
            "questions": [
                {
                    "question": "Question text",
                    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                    "correctIndex": 0
                }
            ]
        }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('AI Quiz Generation Error:', error);
            throw error;
        }
    }
}

module.exports = new AIService();
