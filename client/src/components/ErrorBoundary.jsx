import React from 'react';

/**
 * Error Boundary — 捕获子组件树中的渲染错误，防止整个 UI 崩溃
 * React 文档: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (fallback) {
        return fallback({ error: this.state.error, reset: this.handleReset });
      }

      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-content">
            <h2>⚠️ 出错了</h2>
            <p>应用遇到了未预期的错误，请尝试刷新页面。</p>
            <pre className="error-boundary-detail">
              {this.state.error?.message || '未知错误'}
            </pre>
            <div className="error-boundary-actions">
              <button className="stage-btn-sm" onClick={this.handleReset}>
                🔄 重试
              </button>
              <button
                className="stage-btn-sm"
                onClick={() => window.location.reload()}
              >
                🔃 刷新页面
              </button>
            </div>
            {this.state.errorInfo && (
              <details className="error-boundary-stack">
                <summary>组件堆栈</summary>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
