import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { error: Error | null }
> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
        return { error };
    }
    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 40, color: '#b91c1c', fontFamily: 'monospace', background: '#f8fafc', minHeight: '100vh' }}>
                    <h1 style={{ fontSize: 24, marginBottom: 16 }}>Runtime Error</h1>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {this.state.error.message}
                    </pre>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#475569', marginTop: 12, fontSize: 12 }}>
                        {this.state.error.stack}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
)
