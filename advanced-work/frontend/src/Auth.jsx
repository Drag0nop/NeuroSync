
import { useState } from 'react'

function Auth({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isSignup
        ? '/api/auth/signup'
        : '/api/auth/login'

      const body = isSignup
        ? { name, email, password }
        : { email, password }

      const response = await fetch(
        `http://localhost:5000${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed')
      }

      localStorage.setItem('neurosyncToken', data.token)
      localStorage.setItem(
        'neurosyncUser',
        JSON.stringify(data.user)
      )

      onLogin(data.user)
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Backend server is not running. Please start the backend.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>
          Neuro<span style={{ color: '#6c63ff' }}>Sync</span>
        </h1>

        <h2 style={styles.heading}>
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h2>

        <p style={styles.subtitle}>
          {isSignup
            ? 'Join NeuroSync and build better focus habits.'
            : 'Login to continue to your productivity dashboard.'}
        </p>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <input
              style={styles.input}
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Password (minimum 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />

          {error && (
            <p style={styles.error}>{error}</p>
          )}

          <button
            style={styles.button}
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : isSignup
                ? 'Create Account'
                : 'Login'}
          </button>
        </form>

        <p style={styles.switchText}>
          {isSignup
            ? 'Already have an account? '
            : "Don't have an account? "}

          <button
            type="button"
            style={styles.link}
            onClick={() => {
              setIsSignup(!isSignup)
              setError('')
            }}
          >
            {isSignup ? 'Login' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#f4f5fb',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#ffffff',
    padding: '36px',
    borderRadius: '16px',
    boxShadow: '0 10px 35px rgba(0,0,0,0.08)',
  },
  logo: {
    textAlign: 'center',
    fontSize: '30px',
    marginBottom: '28px',
  },
  heading: {
    textAlign: 'center',
    color: '#20243a',
  },
  subtitle: {
    textAlign: 'center',
    color: '#777',
    fontSize: '14px',
    marginBottom: '25px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px',
    marginBottom: '15px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
  },
  button: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: '8px',
    background: '#6c63ff',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  error: {
    color: '#d93025',
    fontSize: '13px',
    marginBottom: '14px',
  },
  switchText: {
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
    marginTop: '22px',
  },
  link: {
    border: 'none',
    background: 'none',
    color: '#6c63ff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
}

export default Auth
