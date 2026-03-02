// apps/web-frontend/src/components/Loading.jsx
import './Loading.css';

export const LoadingSpinner = () => (
    <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading...</p>
    </div>
);

export const SkeletonCard = () => (
    <div className="skeleton-card">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text short"></div>
        <div className="skeleton-buttons">
            <div className="skeleton skeleton-button"></div>
            <div className="skeleton skeleton-button"></div>
        </div>
    </div>
);