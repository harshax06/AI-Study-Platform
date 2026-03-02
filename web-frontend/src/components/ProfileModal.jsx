import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';

import './ProfileModal.css';

const YEAR_OPTIONS = [
    'B-Tech 1st Year',
    'B-Tech 2nd Year',
    'B-Tech 3rd Year',
    'B-Tech 4th Year'
];

const ProfileModal = ({ onClose }) => {
    const { user, setUser, logout } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [teachingYearToAdd, setTeachingYearToAdd] = useState(YEAR_OPTIONS[0]);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        studentYear: user?.studentYear || YEAR_OPTIONS[0],
        teachingYears: user?.teachingYears || [],
        password: ''
    });

    const availableTeachingYears = useMemo(
        () => YEAR_OPTIONS.filter((year) => !formData.teachingYears.includes(year)),
        [formData.teachingYears]
    );

    const addTeachingYear = () => {
        if (!teachingYearToAdd || formData.teachingYears.includes(teachingYearToAdd)) {
            return;
        }

        setFormData((prev) => ({
            ...prev,
            teachingYears: [...prev.teachingYears, teachingYearToAdd]
        }));
    };

    const removeTeachingYear = (year) => {
        setFormData((prev) => ({
            ...prev,
            teachingYears: prev.teachingYears.filter((value) => value !== year)
        }));
    };

    const handleUpdate = async (event) => {
        event.preventDefault();

        if (user.role === 'teacher' && formData.teachingYears.length === 0) {
            toast.error('Select at least one teaching year');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                name: formData.name,
                email: formData.email
            };

            if (formData.password) {
                payload.password = formData.password;
            }

            if (user.role === 'student') {
                payload.studentYear = formData.studentYear;
            }

            if (user.role === 'teacher') {
                payload.teachingYears = formData.teachingYears;
            }

            const response = await authAPI.updateProfile(payload);
            setUser(response.data.user);

            toast.success('Profile updated');
            setIsEditing(false);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            setLoading(true);
            await authAPI.deleteAccount();
            toast.success('Account deleted');
            logout();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete account');
            setLoading(false);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal glass-modal profile-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <h2>User Profile</h2>
                    <button className="close-btn" onClick={onClose}>X</button>
                </div>

                {!showDeleteConfirm ? (
                    <div className="profile-content">
                        {isEditing ? (
                            <form onSubmit={handleUpdate} className="profile-form">
                                <div className="form-group">
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                                        required
                                    />
                                </div>

                                {user.role === 'student' && (
                                    <div className="form-group">
                                        <label>Year</label>
                                        <select
                                            value={formData.studentYear}
                                            onChange={(event) => setFormData({ ...formData, studentYear: event.target.value })}
                                            required
                                        >
                                            {YEAR_OPTIONS.map((year) => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {user.role === 'teacher' && (
                                    <div className="form-group">
                                        <label>Teaching Years</label>

                                        <div className="teaching-year-controls">
                                            <select
                                                value={teachingYearToAdd}
                                                onChange={(event) => setTeachingYearToAdd(event.target.value)}
                                                disabled={availableTeachingYears.length === 0}
                                            >
                                                {availableTeachingYears.map((year) => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={addTeachingYear}
                                                disabled={availableTeachingYears.length === 0}
                                            >
                                                Add Year
                                            </button>
                                        </div>

                                        <div className="teaching-year-tags">
                                            {formData.teachingYears.map((year) => (
                                                <span key={year} className="teaching-year-tag">
                                                    {year}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTeachingYear(year)}
                                                        className="remove-year-btn"
                                                    >
                                                        X
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>New Password (optional)</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                                        placeholder="Leave blank to keep current password"
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={loading}>
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="profile-details">
                                <div className="profile-avatar-large">{user.name?.charAt(0)?.toUpperCase()}</div>
                                <div className="detail-row"><strong>Name:</strong> <span>{user.name}</span></div>
                                <div className="detail-row"><strong>Email:</strong> <span>{user.email}</span></div>
                                <div className="detail-row"><strong>Role:</strong> <span className="capitalize">{user.role}</span></div>

                                {user.role === 'student' && (
                                    <div className="detail-row"><strong>Year:</strong> <span>{user.studentYear}</span></div>
                                )}

                                {user.role === 'teacher' && (
                                    <div className="detail-row">
                                        <strong>Teaching:</strong>
                                        <span>{(user.teachingYears || []).join(', ') || 'Not set'}</span>
                                    </div>
                                )}

                                <div className="profile-actions">
                                    <button className="btn-primary" onClick={() => setIsEditing(true)}>Edit Profile</button>
                                    <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete Account</button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="delete-confirm">
                        <h3>Delete account?</h3>
                        <p>This action is permanent.</p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDeleteAccount} disabled={loading}>
                                {loading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileModal;
