import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '2rem',
                    backgroundColor: '#121212',
                    color: '#ff6b6b',
                    height: '100vh',
                    overflow: 'auto',
                    fontFamily: 'monospace'
                }}>
                    <h1>⚠️ Something went wrong</h1>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        <summary>Error Details</summary>
                        <h3>{this.state.error && this.state.error.toString()}</h3>
                        <p>{this.state.errorInfo && this.state.errorInfo.componentStack}</p>
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            background: '#333',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;