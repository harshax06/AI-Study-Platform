import { useEffect, useState } from 'react';
import axios from 'axios';
import './Quiz.css';

const Quiz = ({ topic, onClose }) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);

    const AI_SERVICE_URL = 'http://localhost:8000';

    useEffect(() => {
        const generateQuiz = async () => {
            try {
                const res = await axios.post(`${AI_SERVICE_URL}/generate-quiz`, {
                    topic,
                    difficulty: 'medium'
                });
                setQuestions(res.data.quiz);
            } catch (err) {
                console.error('Quiz error:', err);
                setQuestions([
                    {
                        question: `What is the main idea of ${topic}?`,
                        options: ["It's random", "It's structured", "It's complex", 'None'],
                        correct: 1
                    }
                ]);
            } finally {
                setLoading(false);
            }
        };

        generateQuiz();
    }, [topic]);

    const handleAnswer = (index) => {
        if (index === questions[currentQuestion].correct) {
            setScore((prev) => prev + 1);
        }

        if (currentQuestion + 1 < questions.length) {
            setCurrentQuestion((prev) => prev + 1);
            return;
        }

        setShowResult(true);
    };

    if (loading) {
        return <div className="quiz-loading">Generating AI quiz on "{topic}"...</div>;
    }

    return (
        <div className="quiz-overlay">
            <div className="quiz-card">
                <button className="close-btn" onClick={onClose}>X</button>

                {!showResult ? (
                    <>
                        <h3>Quiz: {topic}</h3>
                        <div className="progress-bar">
                            <div style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}></div>
                        </div>

                        <div className="question-section">
                            <h4>Question {currentQuestion + 1}/{questions.length}</h4>
                            <p>{questions[currentQuestion].question}</p>
                        </div>

                        <div className="options-grid">
                            {questions[currentQuestion].options.map((option, idx) => (
                                <button key={idx} onClick={() => handleAnswer(idx)}>
                                    {option}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="result-section">
                        <h3>Quiz Completed</h3>
                        <div className="final-score">
                            {score} / {questions.length}
                        </div>
                        <p>{score === questions.length ? 'Perfect' : 'Keep practicing'}</p>
                        <button className="finish-btn" onClick={onClose}>Finish</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Quiz;
