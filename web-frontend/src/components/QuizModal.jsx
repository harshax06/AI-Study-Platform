import { useState } from 'react';
import toast from 'react-hot-toast';
import { aiAPI } from '../api';
import './QuizModal.css';

const QuizModal = ({ topic, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [quizData, setQuizData] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);

    const generateQuiz = async () => {
        setLoading(true);
        try {
            const res = await aiAPI.generateQuiz({ topic });
            if (res.data.questions && res.data.questions.length > 0) {
                setQuizData(res.data.questions);
            } else {
                toast.error('Failed to generate questions. Try again.');
            }
        } catch (err) {
            console.error('Quiz generation failed:', err);
            toast.error('AI service error. Could not generate quiz.');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (optionIndex) => {
        if (isAnswered) {
            return;
        }

        setSelectedOption(optionIndex);
        setIsAnswered(true);

        const correctIndex = quizData[currentQuestion].correctIndex;
        const actualCorrect = correctIndex !== undefined
            ? correctIndex
            : quizData[currentQuestion].correct_option_index;

        if (optionIndex === actualCorrect) {
            setScore((prev) => prev + 1);
            toast.success('Correct', { duration: 1000 });
        } else {
            toast.error('Wrong answer', { duration: 1000 });
        }
    };

    const handleNext = () => {
        if (currentQuestion < quizData.length - 1) {
            setCurrentQuestion((prev) => prev + 1);
            setSelectedOption(null);
            setIsAnswered(false);
            return;
        }

        setShowResult(true);
    };

    return (
        <div className="modal-overlay">
            <div className="modal quiz-modal">
                <div className="quiz-header">
                    <h2>AI Quiz: {topic}</h2>
                    <button className="close-btn" onClick={onClose}>X</button>
                </div>

                <div className="quiz-content">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Generating questions with AI...</p>
                        </div>
                    ) : !quizData ? (
                        <div className="quiz-start-view">
                            <span className="quiz-icon">QZ</span>
                            <h3>Test your knowledge</h3>
                            <p>Generate a 5-question quiz based on the meeting agenda.</p>
                            <button className="generate-btn" onClick={generateQuiz}>
                                Generate Quiz
                            </button>
                        </div>
                    ) : showResult ? (
                        <div className="quiz-result">
                            <div className="score-circle">
                                <span className="score-number">{score}/{quizData.length}</span>
                            </div>
                            <h3>Quiz Completed</h3>
                            <p className="score-message">
                                {score === quizData.length
                                    ? 'Perfect score'
                                    : score > quizData.length / 2
                                        ? 'Great work'
                                        : 'Keep practicing'}
                            </p>
                            <button className="generate-btn" onClick={onClose}>Close</button>
                        </div>
                    ) : (
                        <div className="question-card">
                            <div className="question-header">
                                <span>Question {currentQuestion + 1} of {quizData.length}</span>
                                <span>Score: {score}</span>
                            </div>

                            <h3 className="question-text">{quizData[currentQuestion].question}</h3>

                            <div className="options-grid">
                                {quizData[currentQuestion].options.map((option, index) => {
                                    let className = 'option-btn';
                                    if (isAnswered) {
                                        const actualCorrect = quizData[currentQuestion].correctIndex
                                            ?? quizData[currentQuestion].correct_option_index;
                                        if (index === actualCorrect) {
                                            className += ' correct';
                                        } else if (index === selectedOption) {
                                            className += ' wrong';
                                        }
                                    } else if (selectedOption === index) {
                                        className += ' selected';
                                    }

                                    return (
                                        <button
                                            key={index}
                                            className={className}
                                            onClick={() => handleAnswer(index)}
                                            disabled={isAnswered}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>

                            {isAnswered && (
                                <div className="quiz-footer">
                                    <button className="next-btn" onClick={handleNext}>
                                        {currentQuestion === quizData.length - 1 ? 'See Results' : 'Next Question'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizModal;
