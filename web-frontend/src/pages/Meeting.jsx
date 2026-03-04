import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { aiAPI, tasksAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

import './Meeting.css';

const Meeting = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const socket = useSocket();

    const [task, setTask] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [transcription, setTranscription] = useState('');
    const [driftStatus, setDriftStatus] = useState({
        isDrift: false,
        score: 0,
        message: 'Moderator is listening to discussion.',
        suggestions: []
    });
    const [aiJoined, setAiJoined] = useState(false);

    const peersRef = useRef({});
    const localVideoRef = useRef(null);
    const videosRef = useRef(null);
    const localStreamRef = useRef(null);
    const transcriptRef = useRef('');
    const analyzingRef = useRef(false);
    const lastDriftToastAtRef = useRef(0);

    const isTeacher = user?.role === 'teacher';
    const taskId = task?.id;
    const taskAgenda = task?.agenda || task?.title || 'General topic';

    const rtcConfig = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    const applyLocalUnmirror = () => {
        if (!localVideoRef.current) {
            return;
        }

        localVideoRef.current.style.transform = 'scaleX(-1)';
        localVideoRef.current.style.webkitTransform = 'scaleX(-1)';
    };

    useEffect(() => {
        const fetchTask = async () => {
            try {
                const response = await tasksAPI.getByRoomId(roomId);
                const fetchedTask = response.data.task;
                setTask(fetchedTask);
                setAiJoined(fetchedTask?.status === 'active');
            } catch (error) {
                toast.error('Failed to load meeting details');
            }
        };

        fetchTask();
    }, [roomId]);

    useEffect(() => {
        if (!socket || !user?.id || !taskId) {
            return undefined;
        }

        let cleanupFn = null;
        let cancelled = false;

        const setup = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: true
            });
            localStreamRef.current = stream;

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.onloadedmetadata = () => {
                    applyLocalUnmirror();
                };
                applyLocalUnmirror();
            }

            if (user.role === 'student') {
                await tasksAPI.markAttendance(taskId);
            }

            socket.emit('join-room', {
                roomId,
                userId: user.id,
                name: user.name,
                role: user.role,
                taskId
            });

            const onParticipantList = (list) => setParticipants(list || []);

            const onUserConnected = ({ userId: peerUserId }) => {
                void createOfferForPeer(peerUserId, stream);
            };

            const onUserDisconnected = (peerUserId) => {
                if (peersRef.current[peerUserId]) {
                    peersRef.current[peerUserId].close();
                    delete peersRef.current[peerUserId];
                }

                const remoteWrapper = document.getElementById(`peer-wrap-${peerUserId}`);
                if (remoteWrapper) {
                    remoteWrapper.remove();
                }
            };

            const onOffer = async ({ offer, userId: peerUserId }) => {
                const connection = new RTCPeerConnection(rtcConfig);
                peersRef.current[peerUserId] = connection;

                stream.getTracks().forEach((track) => connection.addTrack(track, stream));

                connection.ontrack = (event) => addRemoteVideo(peerUserId, event.streams[0]);
                connection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('ice-candidate', { roomId, candidate: event.candidate, userId: peerUserId });
                    }
                };

                await connection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await connection.createAnswer();
                await connection.setLocalDescription(answer);

                socket.emit('answer', { roomId, answer, userId: peerUserId });
            };

            const onAnswer = async ({ answer, userId: peerUserId }) => {
                const connection = peersRef.current[peerUserId];
                if (connection) {
                    await connection.setRemoteDescription(new RTCSessionDescription(answer));
                }
            };

            const onIceCandidate = async ({ candidate, userId: peerUserId }) => {
                const connection = peersRef.current[peerUserId];
                if (connection && candidate) {
                    await connection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            };

            const onMeetingEndedByHost = () => {
                toast('Meeting ended by host');
                setAiJoined(false);
                navigate(user.role === 'teacher' ? '/teacher' : '/student');
            };

            const onMeetingStarted = (payload) => {
                if (payload?.roomId !== roomId) {
                    return;
                }

                setTask((prevTask) => (prevTask ? {
                    ...prevTask,
                    status: 'active',
                    startTime: payload.startTime || prevTask.startTime,
                    endTime: payload.endTime || prevTask.endTime
                } : prevTask));
                setAiJoined(true);
                toast.success('Meeting started. AI moderator joined.');
            };

            const onAiJoined = (payload) => {
                if (payload?.roomId && payload.roomId !== roomId) {
                    return;
                }

                setAiJoined(true);
            };

            socket.on('participant-list', onParticipantList);
            socket.on('user-connected', onUserConnected);
            socket.on('user-disconnected', onUserDisconnected);
            socket.on('offer', onOffer);
            socket.on('answer', onAnswer);
            socket.on('ice-candidate', onIceCandidate);
            socket.on('meeting-ended-by-host', onMeetingEndedByHost);
            socket.on('meeting-started', onMeetingStarted);
            socket.on('ai-joined', onAiJoined);

            const recognitionCleanup = setupSpeechRecognition();

            cleanupFn = () => {
                socket.off('participant-list', onParticipantList);
                socket.off('user-connected', onUserConnected);
                socket.off('user-disconnected', onUserDisconnected);
                socket.off('offer', onOffer);
                socket.off('answer', onAnswer);
                socket.off('ice-candidate', onIceCandidate);
                socket.off('meeting-ended-by-host', onMeetingEndedByHost);
                socket.off('meeting-started', onMeetingStarted);
                socket.off('ai-joined', onAiJoined);

                if (recognitionCleanup) {
                    recognitionCleanup();
                }
            };
        };

        setup().catch(() => {
            if (!cancelled) {
                toast.error('Camera/microphone access failed');
            }
        });

        return () => {
            cancelled = true;

            if (cleanupFn) {
                cleanupFn();
            }

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => track.stop());
                localStreamRef.current = null;
            }

            Object.values(peersRef.current).forEach((connection) => connection.close());
            peersRef.current = {};
        };
    }, [socket, user?.id, user?.name, user?.role, taskId, taskAgenda, roomId, navigate]);

    const createOfferForPeer = async (peerUserId, stream) => {
        if (!socket || !peerUserId || !user?.id || peerUserId === user.id) {
            return;
        }

        const connection = new RTCPeerConnection(rtcConfig);
        peersRef.current[peerUserId] = connection;

        stream.getTracks().forEach((track) => connection.addTrack(track, stream));

        connection.ontrack = (event) => addRemoteVideo(peerUserId, event.streams[0]);
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { roomId, candidate: event.candidate, userId: peerUserId });
            }
        };

        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        socket.emit('offer', { roomId, offer, userId: peerUserId });
    };

    const addRemoteVideo = (peerUserId, stream) => {
        if (!videosRef.current || document.getElementById(`peer-wrap-${peerUserId}`)) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.id = `peer-wrap-${peerUserId}`;
        wrapper.className = 'remote-video-container';

        const video = document.createElement('video');
        video.id = `peer-${peerUserId}`;
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.className = 'remote-video';

        const label = document.createElement('span');
        label.className = 'user-label';
        label.textContent = 'Participant';

        wrapper.appendChild(video);
        wrapper.appendChild(label);
        videosRef.current.appendChild(wrapper);
    };

    const setupSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setDriftStatus((prev) => ({
                ...prev,
                message: 'Speech recognition not supported in this browser.'
            }));
            return null;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let combined = '';
            for (let i = 0; i < event.results.length; i += 1) {
                combined += `${event.results[i][0].transcript} `;
            }

            const cleaned = combined.trim();
            transcriptRef.current = cleaned;
            setTranscription(cleaned);
        };

        recognition.onerror = () => {
            setDriftStatus((prev) => ({
                ...prev,
                message: 'Moderator temporarily unavailable. Continuing to listen...'
            }));
        };

        recognition.start();

        const interval = setInterval(async () => {
            const snapshot = transcriptRef.current.trim();
            if (snapshot.length < 25 || analyzingRef.current) {
                return;
            }

            analyzingRef.current = true;
            try {
                const response = await aiAPI.checkTopic({
                    agenda: taskAgenda,
                    text: snapshot.slice(-800)
                });

                const score = response.data.score || 0;
                const isDrift = Boolean(response.data.is_off_topic);
                const message = response.data.message
                    || (isDrift
                        ? 'Let us gently return to the topic. Please concentrate on the agenda.'
                        : 'Discussion is on-topic.');
                const suggestions = Array.isArray(response.data.suggestions) ? response.data.suggestions : [];

                setDriftStatus({
                    isDrift,
                    score,
                    message,
                    suggestions
                });

                if (isDrift) {
                    const now = Date.now();
                    if (now - lastDriftToastAtRef.current > 15000) {
                        lastDriftToastAtRef.current = now;
                        toast('AI Moderator: Please concentrate on the topic.', { duration: 4000 });
                    }
                }
            } catch {
                setDriftStatus({
                    isDrift: false,
                    score: 0,
                    message: 'Moderator service unavailable. Retrying...',
                    suggestions: []
                });
            } finally {
                analyzingRef.current = false;
            }
        }, 7000);

        return () => {
            clearInterval(interval);
            recognition.stop();
        };
    };

    const handleGenerateQuiz = async () => {
        if (!taskId) {
            return;
        }

        try {
            await aiAPI.generateQuizForTask(taskId);
            toast.success('Quiz is ready now.');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to generate quiz');
        }
    };

    const handleCopyInviteLink = async () => {
        const inviteLink = `${window.location.origin}/meet/${roomId}`;
        try {
            await navigator.clipboard.writeText(inviteLink);
            toast.success('Invite link copied. Users must login to join.');
        } catch {
            toast.error('Failed to copy invite link');
        }
    };

    const handleEndMeeting = () => {
        if (!socket || !taskId) {
            return;
        }

        socket.emit('end-meeting', { taskId, roomId });
        toast.success('Ending meeting...');
    };

    const displayedParticipants = aiJoined
        ? [...participants, { userId: 'ai-moderator', name: 'AI Moderator', role: 'ai' }]
        : participants;

    return (
        <div className="meeting-container">
            <header className="meeting-header">
                <div className="meeting-title-block">
                    <h2>Study Session: {task?.title || roomId}</h2>
                    <div className="meeting-badges">
                        {isTeacher && <span className="meeting-badge host">Host</span>}
                        {aiJoined && <span className="meeting-badge ai">AI Moderator Active</span>}
                    </div>
                </div>

                <div className="meeting-controls">
                    {driftStatus.isDrift && <div className="drift-alert">Off-topic detected</div>}
                    <button className="btn-secondary" onClick={handleCopyInviteLink}>Copy Invite Link</button>
                    <button className="btn-primary" onClick={handleGenerateQuiz}>Generate Quiz</button>
                    {isTeacher && <button className="btn-danger" onClick={handleEndMeeting}>End Meeting</button>}
                    <button className="btn-secondary" onClick={() => navigate(isTeacher ? '/teacher' : '/student')}>Leave</button>
                </div>
            </header>

            <div className="videos-grid" ref={videosRef}>
                <div className="my-video-container">
                    <video ref={localVideoRef} muted autoPlay playsInline className="my-video" />
                    <span className="user-label">You</span>
                </div>
            </div>

            <div className="transcription-panel">
                <div className="transcript-card">
                    <h3>Live Transcript</h3>
                    <p>{transcription || 'Listening...'}</p>
                </div>

                <div className="moderator-card">
                    <h3>Moderator Panel</h3>
                    <div className={`moderator-status ${driftStatus.isDrift ? 'drift' : 'on-topic'}`}>
                        <strong>Topic Score:</strong> {Math.round((driftStatus.score || 0) * 100)}%
                    </div>
                    <p className="moderator-message">{driftStatus.message}</p>

                    {driftStatus.suggestions?.length > 0 && (
                        <ul className="moderator-suggestions">
                            {driftStatus.suggestions.map((item, index) => (
                                <li key={`${item}-${index}`}>{item}</li>
                            ))}
                        </ul>
                    )}

                    <h4>Participants ({displayedParticipants.length})</h4>
                    <ul>
                        {displayedParticipants.map((participant) => (
                            <li key={participant.userId}>{participant.name} ({participant.role})</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Meeting;
