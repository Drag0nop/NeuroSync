import { useEffect, useMemo, useState } from 'react'
import Auth from './Auth'
import './App.css'

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [authenticatedUser, setAuthenticatedUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('neurosyncUser'))
    } catch {
      return null
    }
  })
  const [authChecking, setAuthChecking] = useState(true);

useEffect(() => {
  const verifyToken = async () => {
    const token = localStorage.getItem('neurosyncToken');

    if (!token) {
      setAuthenticatedUser(null);
      setAuthChecking(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.user) {
        setAuthenticatedUser(data.user);
        localStorage.setItem('neurosyncUser', JSON.stringify(data.user));
      } else {
        localStorage.removeItem('neurosyncToken');
        localStorage.removeItem('neurosyncUser');
        setAuthenticatedUser(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      setAuthenticatedUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  verifyToken();
}, []);

  const [seconds, setSeconds] = useState(25 * 60)
  const [customMinutes, setCustomMinutes] = useState(25)
  const [timeUnit, setTimeUnit] = useState('minutes')
  const [isRunning, setIsRunning] = useState(false)
  const [pauseStartedAt, setPauseStartedAt] = useState(null)
  const [pauseDurationSeconds, setPauseDurationSeconds] = useState(0)
  const [pauseCount, setPauseCount] = useState(0)
  const [isEditingGoal, setIsEditingGoal] = useState(false)

  const [completedSessions, setCompletedSessions] = useState(0)

  const [sessionHistory, setSessionHistory] = useState([])

  useEffect(() => {
    const loadSessions = async () => {
      // Purane user ka data turant clear karo
      setSessionHistory([])
  
      if (!authenticatedUser?.id) {
        return
      }
  
      try {
        const token = localStorage.getItem('neurosyncToken')
  
        if (!token) {
          throw new Error('JWT token missing. Please login again.')
        }
  
        const response = await fetch(
          'http://localhost:5000/api/sessions',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
  
        if (!response.ok) {
          throw new Error('Backend request failed')
        }
  
        const data = await response.json()
  
        console.log('Backend sessions:', data)
  
        if (data.success && Array.isArray(data.sessions)) {
          setSessionHistory(data.sessions)
  
          localStorage.setItem(
            'sessionHistory',
            JSON.stringify(data.sessions)
          )
        }
      } catch (error) {
        console.error('Backend connection error:', error)
  
        setSessionHistory([])
        localStorage.removeItem('sessionHistory')
      }
    }
  
    loadSessions()
  }, [authenticatedUser?.id])

  /* ================= TIMER ================= */

  useEffect(() => {
    if (!isRunning) return

    const timer = setInterval(() => {
      setSeconds((prev) => Math.max(prev - 1, 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [isRunning])

  useEffect(() => {
    if (seconds !== 0 || !isRunning) return

    const completedPauseCount = pauseCount
    const completedPauseDuration = pauseDurationSeconds

    setIsRunning(false)
    setPauseStartedAt(null)

    setCompletedSessions((count) => count + 1)
    
    if (authenticatedUser?.id) {
      localStorage.setItem(
        `completedSessions_${authenticatedUser.id}`,
        String(completedSessions + 1)
      )
    }

    const sessionCognitiveLoad = Math.min(
      100,
      20 + (customMinutes * 2) + (completedPauseCount * 10)
    );
    const sessionLoadLevel =
  sessionCognitiveLoad < 40
    ? 'LOW'
    : sessionCognitiveLoad < 70
      ? 'MODERATE'
      : 'HIGH';

    const completedSession = {
      id: Date.now(),
      completedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      durationMinutes: customMinutes,
      completedDate: new Date().toLocaleDateString(),
      pauseCount: completedPauseCount,
      pauseDuration: completedPauseDuration,
      cognitiveLoad: sessionCognitiveLoad,
      cognitiveLoadLevel: sessionLoadLevel,
    }
    console.log('Sending completed session to backend:', completedSession)
    saveSessionToBackend(completedSession)

    setSessionHistory((prev) => {
      const alreadyExists = prev.some(
        (existingSession) =>
          existingSession.id === completedSession.id
      )
    
      if (alreadyExists) {
        return prev
      }
    
      const updatedHistory = [
        ...prev,
        completedSession,
      ]
    
      localStorage.setItem(
        'sessionHistory',
        JSON.stringify(updatedHistory)
      )
    
      return updatedHistory
    })

    setPauseCount(0)
    setPauseDurationSeconds(0)
  }, [
    seconds,
    isRunning,
    customMinutes,
    pauseCount,
    pauseDurationSeconds,
  ])

  useEffect(() => {
    localStorage.setItem(
      'sessionHistory',
      JSON.stringify(sessionHistory)
    )
  }, [sessionHistory])

  useEffect(() => {
    if (!authenticatedUser?.id) {
      setCompletedSessions(0)
      return
    }
  
    const savedCount = Number(
      localStorage.getItem(
        `completedSessions_${authenticatedUser.id}`
      )
    ) || 0
  
    setCompletedSessions(savedCount)
  }, [authenticatedUser?.id])

  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const remainingSeconds = String(seconds % 60).padStart(2, '0')
  const isComplete = seconds === 0

  const timerDisplay =
    timeUnit === 'hours'
      ? `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(
          Math.floor((seconds % 3600) / 60)
        ).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
      : `${minutes}:${remainingSeconds}`

  /* ================= DATE / SESSION DATA ================= */

  const today = new Date().toLocaleDateString()

  const todaySessions = useMemo(
    () =>
      sessionHistory.filter(
        (session) =>
          session &&
          session.completedDate === today &&
          Number(session.durationMinutes) > 0
      ),
    [sessionHistory, today]
  )

  const focusTimeToday = useMemo(
    () =>
      todaySessions.reduce(
        (total, session) =>
          total + Number(session.durationMinutes || 0),
        0
      ),
    [todaySessions]
  )

  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (6 - index))

      const dateString = date.toLocaleDateString()

      const daySessions = sessionHistory.filter(
        (session) =>
          session &&
          session.completedDate === dateString &&
          Number(session.durationMinutes) > 0
      )

      const focusMinutes = daySessions.reduce(
        (total, session) =>
          total + Number(session.durationMinutes || 0),
        0
      )

      return {
        date: dateString,
        label: date.toLocaleDateString(undefined, {
          weekday: 'short',
        }),
        sessions: daySessions.length,
        focusMinutes,
      }
    })
  }, [sessionHistory])
  

  const weeklyFocusTime = weeklyData.reduce(
    (total, day) => total + day.focusMinutes,
    0
  )

  const weeklySessions = weeklyData.reduce(
    (total, day) => total + day.sessions,
    0
  )

  const activeDays = weeklyData.filter(
    (day) => day.sessions > 0
  ).length

  const averageDailyFocus =
    weeklyFocusTime > 0
      ? Math.round(weeklyFocusTime / 7)
      : 0

      const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(() => {
        return Number(localStorage.getItem('weeklyGoalMinutes')) || 600
      })
      const [isEditingWeeklyGoal, setIsEditingWeeklyGoal] = useState(false)

  const weeklyGoalProgress = Math.min(
    100,
    Math.round(
      (weeklyFocusTime / weeklyGoalMinutes) * 100
    )
  )

  const weeklyReport = useMemo(() => {
    if (weeklySessions === 0) {
      return {
        status: 'No activity',
        message:
          'Complete a few focus sessions this week to generate your weekly productivity report.',
      }
    }

    if (weeklyGoalProgress >= 100) {
      return {
        status: 'Goal completed',
        message:
          `Excellent work! You completed ${weeklyFocusTime} minutes of focus this week.`,
      }
    }

    if (weeklyGoalProgress >= 50) {
      return {
        status: 'Good progress',
        message:
          `You have completed ${weeklyFocusTime} minutes across ${weeklySessions} sessions this week.`,
      }
    }

    return {
      status: 'Getting started',
      message:
        `You have recorded ${weeklyFocusTime} minutes of focus this week. Keep building your routine.`,
    }
  }, [
    weeklySessions,
    weeklyGoalProgress,
    weeklyFocusTime,
  ])

  const bestFocusDay = weeklyData.reduce(
    (best, day) =>
      day.focusMinutes > best.focusMinutes ? day : best,
    weeklyData[0]
  )

  /* ================= STREAK ================= */

  const completedDates = [
    ...new Set(
      sessionHistory
        .map((session) => session.completedDate)
        .filter(Boolean)
    ),
  ]

  let focusStreak = 0
  const currentDate = new Date()

  while (true) {
    const dateString = currentDate.toLocaleDateString()

    if (!completedDates.includes(dateString)) {
      break
    }

    focusStreak += 1
    currentDate.setDate(currentDate.getDate() - 1)
  }

  const streakMessage =
    focusStreak === 0
      ? 'Complete a focus session today to start your streak.'
      : focusStreak === 1
        ? 'Great start! Come back tomorrow to build your streak.'
        : focusStreak < 5
          ? `You have maintained focus for ${focusStreak} consecutive days. Keep going!`
          : `Excellent consistency! You have maintained a ${focusStreak}-day focus streak.`

  /* ================= PERFORMANCE ================= */

  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(() => {
    return Number(localStorage.getItem('dailyGoalMinutes')) || 120
  })

  const dailyGoalProgress = Math.min(
    100,
    Math.round(
      (focusTimeToday / dailyGoalMinutes) * 100
    )
  )

  const averageSessionDuration =
    todaySessions.length > 0
      ? Math.round(
          focusTimeToday / todaySessions.length
        )
      : 0

  const longestSessionDuration =
    todaySessions.length > 0
      ? Math.max(
          ...todaySessions.map(
            (session) =>
              Number(session.durationMinutes || 0)
          )
        )
      : 0

  const recentSessions = [...sessionHistory].slice(-7)

  const recentAverage =
    recentSessions.length > 0
      ? Math.round(
          recentSessions.reduce(
            (total, session) =>
              total +
              Number(session.durationMinutes || 0),
            0
          ) / recentSessions.length
        )
      : 0

  const totalFocusMinutes = sessionHistory.reduce(
    (total, session) =>
      total + Number(session.durationMinutes || 0),
    0
  )

  /* ================= BREAK / PAUSE ANALYTICS ================= */

  const totalPauseCount = sessionHistory.reduce(
    (total, session) =>
      total + Number(session.pauseCount || 0),
    0
  )

  const totalPauseSeconds = sessionHistory.reduce(
    (total, session) =>
      total + Number(session.pauseDuration || 0),
    0
  )

  const totalPauseMinutes = Math.round(
    totalPauseSeconds / 60
  )

  const averagePauseMinutes =
    sessionHistory.length > 0
      ? Math.round(
          totalPauseMinutes / sessionHistory.length
        )
      : 0

  const sessionsWithPauses = sessionHistory.filter(
    (session) =>
      Number(session.pauseCount || 0) > 0
  ).length

  const breakHeavySessions = sessionHistory.filter(
    (session) =>
      Number(session.pauseCount || 0) >= 2 ||
      Number(session.pauseDuration || 0) >= 5 * 60
  ).length

  const todayPauseCount = todaySessions.reduce(
    (total, session) =>
      total + Number(session.pauseCount || 0),
    0
  )

  const todayPauseSeconds = todaySessions.reduce(
    (total, session) =>
      total + Number(session.pauseDuration || 0),
    0
  )

  const todayPauseMinutes = Math.round(
    todayPauseSeconds / 60
  )

  const currentPauseMinutes = Math.floor(
    pauseDurationSeconds / 60
  )

  const cognitiveLoadPercentage =
    dailyGoalMinutes > 0
      ? (focusTimeToday / dailyGoalMinutes) * 100
      : 0

  const cognitiveLoadScore =
    focusTimeToday === 0
      ? 30
      : cognitiveLoadPercentage >= 100
        ? 80
        : cognitiveLoadPercentage >= 75
          ? 70
          : cognitiveLoadPercentage >= 50
            ? 60
            : 45

  const cognitiveLoadLevel =
    cognitiveLoadScore >= 75
      ? 'HIGH'
      : cognitiveLoadScore >= 50
        ? 'MODERATE'
        : 'LOW'

  const productivityScore =
    focusTimeToday === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (focusTimeToday / dailyGoalMinutes) * 100
          )
        )

  const consistencyScore = Math.round(
    (activeDays / 7) * 100
  )

  const averageWeeklySession =
    weeklySessions > 0
      ? Math.round(
          weeklyFocusTime / weeklySessions
        )
      : 0

  const longestRecentSession =
    recentSessions.length > 0
      ? Math.max(
          ...recentSessions.map(
            (session) =>
              Number(session.durationMinutes || 0)
          )
        )
      : 0

  const focusPerformanceRating =
    recentAverage === 0
      ? 'No Rating'
      : recentAverage >= 60
        ? 'Excellent'
        : recentAverage >= 45
          ? 'Strong'
          : recentAverage >= 25
            ? 'Good'
            : 'Building'

  const focusPerformanceScore =
    recentAverage === 0
      ? 0
      : recentAverage >= 60
        ? 100
        : recentAverage >= 45
          ? 85
          : recentAverage >= 25
            ? 70
            : 50

  const productivityInsight =
    focusTimeToday === 0
      ? 'No focus activity recorded today. Start a session to build your productivity data.'
      : productivityScore >= 75
        ? `Excellent productivity today with ${focusTimeToday} minutes of focused work.`
        : productivityScore >= 50
          ? `Good productivity today. You have completed ${focusTimeToday} minutes of focused work.`
          : `You have recorded ${focusTimeToday} minutes today. A few more focused sessions can improve your productivity score.`

  const recentTrend =
    recentSessions.length >= 2
      ? Number(
          recentSessions[
            recentSessions.length - 1
          ].durationMinutes || 0
        ) -
        Number(
          recentSessions[
            recentSessions.length - 2
          ].durationMinutes || 0
        )
      : 0

  const trendInsight =
    recentTrend > 0
      ? `Your latest session was ${recentTrend} minutes longer than the previous one.`
      : recentTrend < 0
        ? `Your latest session was ${Math.abs(recentTrend)} minutes shorter than the previous one.`
        : 'Your recent session duration is stable.'

  /* ================= RECOMMENDATION ENGINE ================= */

  const recommendationContext =
    recentAverage === 0
      ? 'No recent session data'
      : breakHeavySessions > 0
        ? 'Recent sessions show frequent or extended breaks'
        : todayPauseCount > 0
          ? 'You have used recovery pauses during today\'s focus'
          : cognitiveLoadPercentage >= 100
  ? 'Daily focus goal has been reached'
  : cognitiveLoadPercentage >= 75
    ? 'Daily focus goal is nearly reached'
    : dailyGoalProgress < 25
      ? 'Daily focus goal progress is still low'
      : focusPerformanceRating === 'Excellent'
              ? 'Daily focus goal is nearly reached'
              : focusPerformanceRating === 'Excellent'
                ? 'Recent focus performance is excellent'
                : focusPerformanceRating === 'Strong'
                  ? 'Recent focus performance is strong'
                  : recentTrend > 0
                    ? 'Focus duration is improving'
                    : recentTrend < 0
                      ? 'Focus duration is decreasing'
                      : 'Focus duration is stable'

  const recommendation =
    breakHeavySessions > 0
      ? {
          type: 'RECOVER',
          icon: '☕',
          title: 'Balance focus and recovery',
          message:
            'Your recent sessions include frequent or extended pauses. Use shorter focus blocks with intentional recovery breaks.',
          reason:
            `You have ${breakHeavySessions} session(s) with frequent or extended breaks. ${recommendationContext}.`,
          action: 'Plan a shorter focus block',
        }
      : cognitiveLoadLevel === 'HIGH'
        ? {
            type: 'RECOVER',
            icon: '☕',
            title: 'Your cognitive load is high',
            message:
              'You have reached a high focus load. Take a short recovery break before starting another session.',
            reason:
              `Your current cognitive load is ${cognitiveLoadScore}/100 based on today's completed focus activity.`,
            action: 'Take a short break',
          }
        : todaySessions.length === 0
          ? {
              type: 'START',
              icon: '🎯',
              title: 'Start with one focused session',
              message:
                'Begin with a comfortable session and build your focus rhythm gradually.',
              reason:
                `No completed focus session has been recorded today. ${recommendationContext}.`,
              action: 'Start a Focus Session',
            }
          : cognitiveLoadPercentage >= 75 ||
              recentAverage >= 60
            ? {
                type: 'RECOVER',
                icon: '☕',
                title: 'Your focus load is high today',
                message:
                  'You have already invested significant focused time. A short recovery break can help protect your next session.',
                reason:
                  `You have completed ${focusTimeToday} minutes across ${todaySessions.length} session(s) today. Cognitive load is currently ${cognitiveLoadLevel.toLowerCase()}.`,
                action: 'Take a short break',
              }
            : focusTimeToday >= 50 ||
                recentAverage >= 45
              ? {
                  type: 'RESET',
                  icon: '🌿',
                  title: 'Time for a short reset',
                  message:
                    'Your focus rhythm is building nicely. Step away briefly before your next session.',
                  reason:
                    `You have completed ${focusTimeToday} minutes of focus time today.`,
                  action: 'Take a short break',
                }

                : dailyGoalProgress < 25 &&
    focusTimeToday > 0
  ? {
      type: 'BUILD',
      icon: '⚡',
      title: 'Build toward your daily goal',
      message:
        'You have started your focus work, but there is still plenty of room to build toward today’s goal.',
      reason:
        `You have completed ${focusTimeToday} minutes out of your ${dailyGoalMinutes}-minute daily goal.`,
      action: 'Continue focusing',
    }

              : focusTimeToday >= 25
                ? {
                    type: 'BUILD',
                    icon: '⚡',
                    title: 'Keep building momentum',
                    message:
                      'You have established a useful focus block. Try another session while your momentum is active.',
                    reason:
                      `You have completed ${focusTimeToday} minutes across ${todaySessions.length} session(s).`,
                    action: 'Continue focusing',
                  }
                : {
                    type: 'FOCUS',
                    icon: '🎯',
                    title: 'Keep your focus steady',
                    message:
                      'Your first focus block is underway. Keep the next session comfortable and distraction-free.',
                    reason:
                      'Your current completed focus time is still below 25 minutes.',
                    action: 'Build focus time',
                  }

  /* ================= TIMER HELPERS ================= */

  const handleTimeUnitChange = (event) => {
    const nextUnit = event.target.value

    if (
      customMinutes !== '' &&
      nextUnit === 'hours'
    ) {
      const hours = Math.max(
        1,
        Math.round(customMinutes / 60)
      )

      setCustomMinutes(hours * 60)
      setSeconds(hours * 60 * 60)
    }

    setTimeUnit(nextUnit)
  }

  const handleDurationChange = (event) => {
    const rawValue = event.target.value

    if (rawValue === '') {
      setCustomMinutes('')
      return
    }

    const value = Number(rawValue)

    const totalMinutes =
      timeUnit === 'hours'
        ? value * 60
        : value

    setCustomMinutes(totalMinutes)

    if (
      totalMinutes >= 1 &&
      totalMinutes <= 600
    ) {
      setSeconds(totalMinutes * 60)
    }
  }

  const startOrPauseTimer = () => {
    if (isRunning) {
      setIsRunning(false)
      setPauseCount((count) => count + 1)
      setPauseStartedAt(Date.now())
      return
    }

    if (!customMinutes || customMinutes < 1) {
      return
    }

    if (seconds === 0) {
      setSeconds(customMinutes * 60)
      setPauseCount(0)
      setPauseDurationSeconds(0)
      setPauseStartedAt(null)
    }

    if (pauseStartedAt) {
      const breakDuration = Math.max(
        0,
        Math.round(
          (Date.now() - pauseStartedAt) / 1000
        )
      )

      setPauseDurationSeconds(
        (total) => total + breakDuration
      )

      setPauseStartedAt(null)
    }

    setIsRunning(true)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setPauseStartedAt(null)
    setPauseDurationSeconds(0)
    setPauseCount(0)

    if (customMinutes && customMinutes >= 1) {
      setSeconds(customMinutes * 60)
    }
  }


  const saveSessionToBackend = async (session) => {
    try {
      const token = localStorage.getItem('neurosyncToken');
  
      if (!token) {
        console.error('JWT token missing. Please login again.');
        return;
      }
  
      const response = await fetch('http://localhost:5000/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(session),
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        console.error('Backend rejected session:', data);
        return;
      }
  
      console.log('Session saved to backend:', data);
    } catch (error) {
      console.error('Backend session save error:', error);
    }
  };


  const clearHistory = async () => {
    try {
      const response = await fetch(
        'http://localhost:5000/api/sessions',
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('neurosyncToken')}`,
          },
        }
      )
  
      const data = await response.json()
  
      if (data.success) {
        setSessionHistory([])
        localStorage.removeItem('sessionHistory')
      }
    } catch (error) {
      console.error(
        'Failed to clear sessions from backend:',
        error
      )
    }
  }

  const formatMinutes = (value) => {
    const total = Number(value || 0)

    if (total < 60) {
      return `${total}m`
    }

    return `${Math.floor(total / 60)}h ${
      total % 60
    }m`
  }

  const isDashboard = activePage === 'Dashboard'

  /* ================= APP ================= */
  if (authChecking) {
    return <div>Checking login...</div>;
  }
  if (!authenticatedUser) {
    return <Auth onLogin={setAuthenticatedUser} />
  }
  return (
    <div className="app">

      {/* ================= SIDEBAR ================= */}

      <aside className="sidebar">

        <div className="sidebar-brand-area">
          <h2 className="brand">
            Neuro<span>Sync</span>
          </h2>

          <div className="brand-status">
            <span />
            PRODUCTIVITY OS
          </div>
        </div>

        <p className="side-label">
          WORKSPACE
        </p>

        <nav className="navigation">

          {[
            ['Dashboard', '▦'],
            ['Focus Sessions', '◷'],
            ['Cognitive Analytics', '⌁'],
            ['Recommendations', '✧'],
          ].map(([page, icon]) => (
            <button
              key={page}
              className={`nav-item ${
                activePage === page ? 'active' : ''
              }`}
              onClick={() => setActivePage(page)}
            >
              <span className="nav-icon">
                {icon}
              </span>

              <span>{page}</span>

              {activePage === page && (
                <span className="nav-active-dot" />
              )}
            </button>
          ))}

        </nav>

        <div className="sidebar-bottom">

          <div className="avatar">
            N
          </div>

          <div className="workspace-user">
            <strong>
              My Workspace
            </strong>

            <p>
              Productivity Mode
            </p>
          </div>

          <span className="workspace-menu">
            •••
          </span>

          <button
  type="button"
  onClick={() => {
    localStorage.removeItem('neurosyncToken')
    localStorage.removeItem('neurosyncUser')
    setAuthenticatedUser(null)
  }}
  style={{
    marginLeft: '12px',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '13px',
  }}
>
  Logout
</button>

        </div>

      </aside>

      {/* ================= MAIN ================= */}

      <main className="main">

        {/* ================= TOP BAR ================= */}

        <header className="topbar">

          <div>

            <p className="eyebrow">
              COGNITIVE PRODUCTIVITY
            </p>

            <h1>
              {activePage}
            </h1>

          </div>

          <div className="topbar-meta">

            <div className="date-chip">

              <span>Today</span>

              <strong>
                {new Date().toLocaleDateString(
                  undefined,
                  {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }
                )}
              </strong>

            </div>

            <div className="status">
              <span />
              Prototype Mode
            </div>

          </div>

        </header>

        {/* ================= DASHBOARD ================= */}

        {isDashboard && (
          <>

            {/* HERO */}

            <section className="welcome">

              <div className="welcome-content">

                <div className="hero-badge">
                  <span>✦</span>
                  PERSONAL FOCUS INTELLIGENCE
                </div>

                <h2>
                  Work smarter,
                  <span> not harder.</span>
                </h2>

                <p>
                  Build better focus habits by
                  understanding your sessions,
                  consistency and cognitive energy.
                </p>

                <div className="hero-actions">

                  <button
                    className="hero-primary"
                    onClick={() =>
                      document
                        .querySelector(
                          '.focus-widget'
                        )
                        ?.scrollIntoView({
                          behavior: 'smooth',
                        })
                    }
                  >
                    Start a focus session
                    <span>→</span>
                  </button>

                  <button
                    className="hero-secondary"
                    onClick={() =>
                      setActivePage(
                        'Cognitive Analytics'
                      )
                    }
                  >
                    View analytics
                  </button>

                </div>

              </div>

              <div className="hero-visual">

                <div className="hero-orbit orbit-one" />
                <div className="hero-orbit orbit-two" />

                <div className="hero-core">
                  ✳
                </div>

                <div className="hero-floating-card">

                  <span>
                    FOCUS SCORE
                  </span>

                  <strong>
                    {productivityScore}
                  </strong>

                  <small>
                    / 100
                  </small>

                </div>

              </div>

            </section>

            {/* KPI GRID */}

            <section className="dashboard-kpis">

              <div className="kpi-card kpi-primary">

                <div className="kpi-top">

                  <span className="kpi-label">
                    FOCUS TIME TODAY
                  </span>

                  <span className="kpi-icon">
                    ◷
                  </span>

                </div>

                <div className="kpi-value">
                  {formatMinutes(
                    focusTimeToday
                  )}
                </div>

                <div className="kpi-bottom">

                  <span>
                    {todaySessions.length}{' '}
                    completed session
                    {todaySessions.length !== 1
                      ? 's'
                      : ''}
                  </span>

                  <span>
                    Goal: {formatMinutes(dailyGoalMinutes)}

                    {isEditingGoal ? (
                      <div className="goal-edit-area">

                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={dailyGoalMinutes}
                          onChange={(event) => {
                            const newGoal = Number(event.target.value)
                          
                            setDailyGoalMinutes(newGoal)
                          
                            localStorage.setItem(
                              'dailyGoalMinutes',
                              String(newGoal)
                            )
                          }
                          }
                        />

                        <button
                          onClick={() => {
                            if (
                              dailyGoalMinutes >= 1 &&
                              dailyGoalMinutes <= 600
                            ) {
                              localStorage.setItem(
                                'dailyGoalMinutes',
                                String(
                                  dailyGoalMinutes
                                )
                              )

                              setIsEditingGoal(false)
                            }
                          }}
                        >
                          Save Goal
                        </button>

                      </div>
                    ) : (
                      <button
  className="goal-edit-button"
  onClick={() => {
    setIsEditingGoal(true)
  }}
>
  ✎ Change Goal
</button>
                    )}

                  </span>

                  <span className="kpi-accent">
                    {dailyGoalProgress}% goal
                  </span>

                </div>

                <div className="kpi-progress">

                  <div
                    className="kpi-progress-fill"
                    style={{
                      width: `${dailyGoalProgress}%`,
                    }}
                  />

                </div>

              </div>

              <div className="kpi-card">

                <div className="kpi-top">

                  <span className="kpi-label">
                    PRODUCTIVITY SCORE
                  </span>

                  <span className="kpi-icon">
                    ✦
                  </span>

                </div>

                <div className="kpi-value">

                  {productivityScore}

                  <span className="kpi-unit">
                    /100
                  </span>

                </div>

                <div className="kpi-bottom">

                  <span>
                    Today's performance
                  </span>

                  <span className="kpi-status">
  {productivityScore < 25
    ? 'Starting'
    : productivityScore < 50
      ? 'Building'
      : productivityScore < 75
        ? 'Focused'
        : 'Excellent'}
</span>

<p className="kpi-insight">
  {productivityScore < 25
    ? 'Start a focus session to build your productivity.'
    : productivityScore < 50
      ? 'You are building consistency. Keep going.'
      : productivityScore < 75
        ? 'Good focus pattern. Try maintaining this pace.'
        : 'Excellent productivity. Keep up the consistency.'}
</p>

                </div>

              </div>

              <div className="kpi-card">

                <div className="kpi-top">

                  <span className="kpi-label">
                    FOCUS STREAK
                  </span>

                  <span className="kpi-icon">
                    🔥
                  </span>

                </div>

                <div className="kpi-value">

                  {focusStreak}

                  <span className="kpi-unit">

                    {focusStreak === 1
                      ? ' day'
                      : ' days'}

                  </span>

                </div>

                <div className="kpi-bottom">

                  <span>
                    Consecutive productive days
                  </span>

                  <span className="kpi-status">

                    {focusStreak === 0
                      ? 'Start today'
                      : 'Keep going'}

                  </span>

                </div>

              </div>

              <div className="kpi-card">

                <div className="kpi-top">

                  <span className="kpi-label">
                    WEEKLY FOCUS
                  </span>

                  <span className="kpi-icon">
                    ↗
                  </span>

                </div>

                <div className="kpi-value">
                  {formatMinutes(
                    weeklyFocusTime
                  )}
                </div>

                <div className="kpi-bottom">

                  <span>
                    {weeklySessions} session
                    {weeklySessions !== 1
                      ? 's'
                      : ''} · 7 days
                  </span>

                  <span className="kpi-status">
                    {activeDays}/7 active
                  </span>

                </div>

              </div>

            </section>

            {/* TIMER + INSIGHTS */}

            <section className="dashboard-main-grid">

              <div className="card focus-widget">

                <div className="dashboard-card-header">

                  <div>

                    <p className="eyebrow">
                      FOCUS SESSION
                    </p>

                    <h3>
                      {isRunning
                        ? 'Stay in the zone'
                        : pauseStartedAt
                          ? 'Session paused'
                          : 'Ready to focus?'}
                    </h3>

                    <p>
                      Set your duration and enter
                      a distraction-free focus block.
                    </p>

                  </div>

                  <span
                    className={`live-indicator ${
                      isRunning ? 'running' : ''
                    }`}
                  >
                    <span />

                    {isRunning
                      ? 'Session active'
                      : pauseStartedAt
                        ? 'Session paused'
                        : 'Ready'}

                  </span>

                </div>

                <div className="timer-area">

                  <div className="timer-ring">

                    <div className="timer-ring-inner">

                      <span className="timer-caption">

                        {isRunning
                          ? 'FOCUSING'
                          : isComplete
                            ? 'COMPLETED'
                            : pauseStartedAt
                              ? 'PAUSED'
                              : 'FOCUS TIME'}

                      </span>

                      <strong>
                        {timerDisplay}
                      </strong>

                      <span className="timer-state">

                        {isComplete
                          ? 'Great work — session complete'
                          : isRunning
                            ? 'Stay focused on one task'
                            : pauseStartedAt
                              ? 'Resume when you are ready'
                              : 'Start when you are ready'}

                      </span>

                    </div>

                  </div>

                  <div className="timer-control-panel">

                    <div className="timer-settings">

                      <label>

                        <span>
                          TIME UNIT
                        </span>

                        <select
                          value={timeUnit}
                          onChange={
                            handleTimeUnitChange
                          }
                          disabled={isRunning}
                        >

                          <option value="minutes">
                            Minutes
                          </option>

                          <option value="hours">
                            Hours
                          </option>

                        </select>

                      </label>

                      <label>

                        <span>
                          FOCUS DURATION
                        </span>

                        <div className="duration-input">

                          <input
                            type="number"
                            min="1"
                            max={
                              timeUnit === 'hours'
                                ? 10
                                : 600
                            }
                            step="1"
                            value={
                              customMinutes === ''
                                ? ''
                                : timeUnit ===
                                    'hours'
                                  ? Math.max(
                                      1,
                                      Math.round(
                                        customMinutes /
                                          60
                                      )
                                    )
                                  : customMinutes
                            }
                            onChange={
                              handleDurationChange
                            }
                            disabled={isRunning}
                          />

                          <span>
                            {timeUnit}
                          </span>

                        </div>

                      </label>

                    </div>

                    <div className="timer-controls">

                      <button
                        className="primary-action"
                        disabled={
                          !isRunning &&
                          (!customMinutes ||
                            customMinutes < 1)
                        }
                        onClick={
                          startOrPauseTimer
                        }
                      >

                        {isRunning
                          ? 'Pause Session'
                          : pauseStartedAt
                            ? 'Resume Focus'
                            : 'Start Focus'}

                      </button>

                      <button
                        className="secondary-action"
                        onClick={resetTimer}
                      >
                        Reset
                      </button>

                    </div>

                    {isComplete && (
                      <div className="completion-message">
                        <span>✓</span>
                        Focus session completed.
                        Great work!
                      </div>
                    )}

                  </div>

                </div>

                <div className="timer-footer">

                  <span>
                    <b>Tip</b> — Choose a duration
                    you can comfortably sustain.
                  </span>

                  <span>
                    {completedSessions}{' '}
                    total sessions
                  </span>

                  <span>
                    {pauseCount} pause
                    {pauseCount !== 1 ? 's' : ''}

                    {pauseDurationSeconds > 0
                      ? ` · ${formatMinutes(currentPauseMinutes)} break`
                      : ''}

                  </span>

                </div>

              </div>

              <div className="dashboard-side-column">

                <div className="card insight-card">

                  <div className="dashboard-card-header compact">

                    <div>

                      <p className="eyebrow">
                        COGNITIVE INSIGHT
                      </p>

                      <h3>
                        Current Load
                      </h3>

                    </div>

                    <span className="insight-badge">
                      {cognitiveLoadLevel}
                    </span>

                  </div>

                  <div className="load-score">

                    <strong>
                      {cognitiveLoadScore}
                    </strong>

                    <span>/100</span>

                  </div>

                  <div className="load-meter">

                    <div
                      className="load-meter-fill"
                      style={{
                        width: `${cognitiveLoadScore}%`,
                      }}
                    />

                  </div>

                  <div className="load-scale">
                    <span>LOW</span>
                    <span>MODERATE</span>
                    <span>HIGH</span>
                  </div>

                  <div className="load-footer">

                    <span>
                      {cognitiveLoadLevel === 'HIGH'
                        ? 'High cognitive demand'
                        : cognitiveLoadLevel === 'MODERATE'
                          ? 'Moderate cognitive demand'
                          : 'Low cognitive demand'}
                    </span>

                    <span>
                      Rule-based signal
                    </span>

                  </div>

                  <p className="insight-note">
                    Cognitive-load visualization is
                    currently illustrative. Camera-based
                    measurement belongs to a later phase.
                  </p>

                </div>

                <div className="card streak-card">

                  <div className="streak-icon">
                    🔥
                  </div>

                  <div>

                    <p className="eyebrow">
                      CONSISTENCY
                    </p>

                    <h3>
                      {focusStreak} day
                      {focusStreak !== 1
                        ? 's'
                        : ''} streak
                    </h3>

                    <p>
                      {streakMessage}
                    </p>

                  </div>

                </div>

              </div>

            </section>

            {/* WEEKLY + RECOMMENDATION */}

            <section className="dashboard-bottom-grid">

              <div className="card weekly-card">

                <div className="dashboard-card-header">

                  <div>

                    <p className="eyebrow">
                      PERFORMANCE
                    </p>

                    <h3>
                      Weekly Productivity
                    </h3>

                    <p>
                      Your focus activity across the
                      last 7 days.
                    </p>

                  </div>

                  <div className="weekly-summary">

                    <strong>
                      {formatMinutes(
                        weeklyFocusTime
                      )}
                    </strong>

                    <span>
                      {weeklySessions} sessions
                    </span>

                  </div>

                </div>

                <div className="weekly-meta">

                  <div>

                    <span>
                      Goal progress
                    </span>

                    <strong>
                      {weeklyGoalProgress}%
                    </strong>

                  </div>

                  <div>

                    <span>
                      Consistency
                    </span>

                    <strong>
                      {activeDays}/7 days
                    </strong>

                  </div>

                  <div>

                    <span>
                      Best day
                    </span>

                    <strong>
                      {bestFocusDay &&
                      bestFocusDay.focusMinutes > 0
                        ? bestFocusDay.label
                        : '—'}
                    </strong>

                  </div>

                  <div>

                    <span>
                      Avg. daily focus
                    </span>

                    <strong>
                      {averageDailyFocus} min
                    </strong>

                  </div>

                </div>

                <div className="weekly-report-summary">

                  <strong>
                    Weekly Report
                  </strong>

                  <p>
                    {weeklySessions === 0
                      ? 'No focus activity recorded this week.'
                      : `You completed ${weeklySessions} focus session${weeklySessions !== 1 ? 's' : ''} and ${formatMinutes(weeklyFocusTime)} of focused work this week, averaging ${averageDailyFocus} minutes per day.`}
                  </p>

                  <div className="weekly-goal-section">
  <div className="weekly-goal-header">
    <div>
      <span>Weekly Goal</span>
      <strong>{weeklyGoalMinutes} minutes</strong>
    </div>

    {!isEditingWeeklyGoal && (
      <button
        className="goal-edit-button"
        onClick={() => setIsEditingWeeklyGoal(true)}
      >
        Change Goal
      </button>
    )}
  </div>

  {isEditingWeeklyGoal ? (
    <div className="goal-edit-form">
      <input
        type="number"
        min="60"
        max="4200"
        value={weeklyGoalMinutes}
        onChange={(event) =>
          setWeeklyGoalMinutes(
            Number(event.target.value)
          )
        }
      />

      <button
        onClick={() => {
          if (
            weeklyGoalMinutes >= 60 &&
            weeklyGoalMinutes <= 4200
          ) {
            localStorage.setItem(
              'weeklyGoalMinutes',
              String(weeklyGoalMinutes)
            )

            setIsEditingWeeklyGoal(false)
          }
        }}
      >
        Save Goal
      </button>
    </div>
  ) : null}
</div>

                </div>

                <div className="weekly-chart">

                  {weeklyData.map((day) => (

                    <div
                      className="weekly-day"
                      key={day.date}
                    >

                      <span>
                        {day.focusMinutes}m
                      </span>

                      <div
                        className="weekly-bar"
                        style={{
                          height: `${Math.max(
                            8,
                            Math.min(
                              day.focusMinutes * 2,
                              100
                            )
                          )}%`,
                        }}
                      />

                      <small>
                        {day.label}
                      </small>

                    </div>

                  ))}

                </div>

                <div className="weekly-report-insight">

                  <span>
                    {weeklyReport.status}
                  </span>

                  <p>
                    {weeklyReport.message}
                  </p>

                  <div className="weekly-report-progress">
  <div className="weekly-report-progress-header">
    <span>Weekly Goal Progress</span>
    <strong>{weeklyGoalProgress}%</strong>
  </div>

  <div className="weekly-report-progress-bar">
    <div
      className="weekly-report-progress-fill"
      style={{
        width: `${weeklyGoalProgress}%`,
      }}
    ></div>
  </div>

  <span>
    {weeklyGoalProgress >= 100
      ? 'Weekly goal completed 🎉'
      : `${Math.max(
          0,
          weeklyGoalMinutes - weeklyFocusTime
        )} minutes remaining to reach your weekly goal.`}
  </span>
</div>

                </div>

                <div className="weekly-footer">

                  <span>
                    {weeklySessions === 0
                      ? 'No activity yet'
                      : weeklySessions <= 2
                        ? 'Getting started'
                        : weeklySessions <= 5
                          ? 'Consistent'
                          : 'Highly consistent'}
                  </span>

                  <span>
                    {weeklyGoalProgress === 0
                      ? 'Not Started'
                      : weeklyGoalProgress < 50
                        ? 'Getting Started'
                        : weeklyGoalProgress < 100
                          ? 'Good Progress'
                          : 'Goal Completed 🎉'}
                  </span>

                </div>

              </div>

              <div className="card recommendation-card">

                <div className="dashboard-card-header compact">

                  <div>

                    <p className="eyebrow">
                      SMART INTERVENTION
                    </p>

                    <h3>
                      Recommendation
                    </h3>

                  </div>

                  <span className="recommendation-sparkle">
                    ✦
                  </span>

                </div>

                <div className="recommendation-icon">
                  {recommendation.icon}
                </div>

                <span className="recommendation-label">

                  {recommendation.type}
                  {' · '}
                  PERSONALIZED

                </span>

                <h2>
                  {recommendation.title}
                </h2>

                <p className="recommendation-message">
                  {recommendation.message}
                </p>

                <div className="recommendation-reason">

                  <span>
                    Why this suggestion?
                  </span>

                  <p>
                    {recommendation.reason}
                  </p>

                </div>

                <button
                  className="recommendation-action"
                  onClick={() => {

                    if (
                      recommendation.type ===
                        'START' ||
                      recommendation.type ===
                        'FOCUS' ||
                      recommendation.type ===
                        'BUILD'
                    ) {

                      document
                        .querySelector(
                          '.focus-widget'
                        )
                        ?.scrollIntoView({
                          behavior: 'smooth',
                        })

                    }

                  }}
                >

                  {recommendation.action}

                  <span>→</span>

                </button>

              </div>

            </section>

          </>
        )}

        {/* ================= FOCUS SESSIONS ================= */}

        {!isDashboard &&
          activePage === 'Focus Sessions' && (

            <section className="content-grid focus-sessions-grid">

              <div className="card focus-sessions-main-card">

                <div className="page-intro">

                  <div>

                    <p className="eyebrow">
                      FOCUS TRACKER
                    </p>

                    <h2>
                      Your Focus Sessions
                    </h2>

                    <p>
                      Review your completed work
                      blocks and build a consistent
                      focus routine.
                    </p>

                  </div>

                  <div className="page-intro-icon">
                    ◷
                  </div>

                </div>

                <div className="focus-summary-grid">

                  <div className="focus-summary-card">

                    <p className="eyebrow">
                      TOTAL SESSIONS
                    </p>

                    <h2>
                      {completedSessions}
                    </h2>

                    <p>
                      Sessions completed so far
                    </p>

                  </div>

                  <div className="focus-summary-card">

                    <p className="eyebrow">
                      TOTAL FOCUS TIME
                    </p>

                    <h2>
                      {formatMinutes(
                        totalFocusMinutes
                      )}
                    </h2>

                    <p>
                      Across all completed sessions
                    </p>

                  </div>

                  <div className="focus-summary-card">

                    <p className="eyebrow">
                      TODAY
                    </p>

                    <h2>
                      {todaySessions.length}
                    </h2>

                    <p>
                      {formatMinutes(
                        focusTimeToday
                      )}{' '}
                      focused today
                    </p>

                  </div>

                  <div className="focus-summary-card">

                    <p className="eyebrow">
                      AVERAGE SESSION
                    </p>

                    <h2>
                      {recentAverage}m
                    </h2>

                    <p>
                      Based on recent sessions
                    </p>

                  </div>

                </div>

                <div className="session-history-section">

                  <div className="session-history-header">

                    <div>

                      <p className="eyebrow">
                        YOUR ACTIVITY
                      </p>

                      <h3>
                        Session History
                      </h3>

                      <p>
                        Your latest completed focus
                        sessions.
                      </p>

                    </div>

                    {sessionHistory.length > 0 && (

                      <button
                        className="clear-history-button"
                        onClick={clearHistory}
                      >
                        Clear History
                      </button>

                    )}

                  </div>

                  {sessionHistory.length === 0 ? (

                    <div className="session-empty-state">

                      <p className="session-empty-icon">
                        🎯
                      </p>

                      <h3>
                        No sessions yet
                      </h3>

                      <p>
                        Complete your first focus
                        session from the Dashboard
                        to start building your history.
                      </p>

                    </div>

                  ) : (

                    <ul className="session-history-list">

                      {[...sessionHistory]
                        .sort((a, b) => Number(b.id) - Number(a.id))
                        .map((session, index) => (

                          <li
                            className="session-history-item"
                            key={session.id}
                          >

                            <div className="session-history-icon">
                              ✓
                            </div>

                            <div className="session-history-details">

                              <strong>
                                {session.completedDate ===
                                today
                                  ? 'Today'
                                  : session.completedDate ||
                                    'Date unavailable'}
                              </strong>

                              <p>
                                Session{' '}
                                {sessionHistory.length -
                                  index}
                              </p>

                              <p>
                                Completed at{' '}
                                {session.completedAt}
                              </p>

                              <p>
                                {session.pauseCount || 0}{' '}
                                pause
                                {(session.pauseCount || 0) !== 1
                                  ? 's'
                                  : ''}
                              </p>

                              <p>
                                Break time:{' '}
                                {formatMinutes(
                                  Math.round(
                                    Number(
                                      session.pauseDuration ||
                                        0
                                    ) / 60
                                  )
                                )}
                              </p>

                            </div>

                            <div className="session-duration">

                              <strong>
                                {session.durationMinutes ||
                                  0}
                              </strong>

                              <span>
                                min
                              </span>

                            </div>

                          </li>

                        ))}

                    </ul>

                  )}

                </div>

              </div>

              <div className="card focus-sessions-status-card">

                <p className="eyebrow">
                  SESSION STATUS
                </p>

                <div className="status-large-icon">

                  {isRunning ? '◉' : '◷'}

                </div>

                <h2>

                  {isRunning
                    ? 'Focus in Progress'
                    : isComplete
                      ? 'Session Completed'
                      : pauseStartedAt
                        ? 'Session Paused'
                        : 'Ready to Focus'}

                </h2>

                <p>
                  Time remaining
                </p>

                <strong className="status-timer">
                  {timerDisplay}
                </strong>

                <div className="status-divider" />

                <p>

                  {isRunning
                    ? 'Keep focusing on your current task.'
                    : pauseStartedAt
                      ? `Paused with ${pauseCount} pause${pauseCount !== 1 ? 's' : ''}. Resume when you are ready.`
                      : 'Start a focus session from the Dashboard whenever you are ready.'}

                </p>

                <p>
                  Pauses: {pauseCount} · Break time:{' '}
                  {formatMinutes(currentPauseMinutes)}
                </p>

                <button
                  className="secondary-action full-width"
                  onClick={() =>
                    setActivePage('Dashboard')
                  }
                >
                  Go to Dashboard
                </button>

              </div>

            </section>

          )}

        {/* ================= COGNITIVE ANALYTICS ================= */}

        {activePage === 'Cognitive Analytics' && (

          <section className="analytics-page">

            <div className="analytics-layout">

              <div className="card analytics-main">

                <div className="analytics-page-header">

                  <div>

                    <p className="eyebrow">
                      PERFORMANCE INTELLIGENCE
                    </p>

                    <h2>
                      Focus Session Analytics
                    </h2>

                    <p>
                      Understand your focus patterns
                      using completed session data.
                    </p>

                  </div>

                  <span className="tag">
                    Last 7 Sessions
                  </span>

                </div>

                <div className="analytics-overview-grid">

                  <div className="analytics-stat featured">

                    <span>
                      BEST FOCUS DAY
                    </span>

                    <strong>
                      {bestFocusDay &&
                      bestFocusDay.focusMinutes > 0
                        ? bestFocusDay.label
                        : 'No data'}
                    </strong>

                    <small>
                      {bestFocusDay &&
                      bestFocusDay.focusMinutes > 0
                        ? `${bestFocusDay.focusMinutes} minutes of focus`
                        : 'Complete sessions to identify your strongest day.'}
                    </small>

                  </div>

                  <div className="analytics-stat">

                    <span>
                      RECENT AVERAGE
                    </span>

                    <strong>
                      {recentAverage} min
                    </strong>

                    <small>
                      Average duration across
                      your latest sessions.
                    </small>

                  </div>

                  <div className="analytics-stat">

                    <span>
                      TODAY
                    </span>

                    <strong>
                      {focusTimeToday} min
                    </strong>

                    <small>
                      {todaySessions.length}{' '}
                      completed session
                      {todaySessions.length !== 1
                        ? 's'
                        : ''}
                    </small>

                  </div>

                </div>

                <div className="analytics-trend-card">

                  <div className="analytics-section-title">

                    <div>

                      <p className="eyebrow">
                        SESSION PERFORMANCE
                      </p>

                      <h3>
                        Recent Focus Pattern
                      </h3>

                    </div>

                    <span className="trend-pill">

                      {recentTrend > 0
                        ? `↑ ${recentTrend}m`
                        : recentTrend < 0
                          ? `↓ ${Math.abs(
                              recentTrend
                            )}m`
                          : '→ Stable'}

                    </span>

                  </div>

                  <p className="trend-description">

                    {recentAverage === 0
                      ? 'Complete a session to start generating performance insights.'
                      : recentAverage >= 45
                        ? 'Your recent sessions show strong sustained focus. Remember to balance longer sessions with recovery breaks.'
                        : recentAverage >= 25
                          ? 'Your recent sessions show a balanced focus pattern. Consistency is the next opportunity.'
                          : 'Your recent sessions are relatively short. Gradually increasing duration can help build focus endurance.'}

                  </p>

                  <div className="analytics-bar-chart">

                    {recentSessions.length === 0 ? (

                      <div className="analytics-no-data">
                        Complete a focus session
                        to generate your chart.
                      </div>

                    ) : (

                      recentSessions.map(
                        (session, index) => {

                          const maxDuration =
                            Math.max(
                              ...recentSessions.map(
                                (item) =>
                                  Number(
                                    item.durationMinutes ||
                                      0
                                  )
                              ),
                              1
                            )

                          const height = Math.max(
                            12,
                            (Number(
                              session.durationMinutes ||
                                0
                            ) /
                              maxDuration) *
                              100
                          )

                          return (
                            <div
                              className="analytics-bar-column"
                              key={session.id}
                            >

                              <div className="analytics-bar-value">
                                {
                                  session.durationMinutes
                                }
                                m
                              </div>

                              <div className="analytics-bar-track">

                                <div
                                  className="analytics-bar"
                                  style={{
                                    height: `${height}%`,
                                  }}
                                />

                              </div>

                              <span>
                                S{index + 1}
                              </span>

                            </div>
                          )
                        }
                      )

                    )}

                  </div>

                </div>

                <div className="analytics-detail-grid">

                  <div className="analytics-detail">

                    <span>
                      TODAY'S AVERAGE
                    </span>

                    <strong>
                      {averageSessionDuration} min
                    </strong>

                    <small>
                      Per completed session
                    </small>

                  </div>

                  <div className="analytics-detail">

                    <span>
                      LONGEST SESSION
                    </span>

                    <strong>
                      {longestSessionDuration} min
                    </strong>

                    <small>
                      Best sustained block today
                    </small>

                  </div>

                  <div className="analytics-detail">

                    <span>
                      WEEKLY AVERAGE
                    </span>

                    <strong>
                      {averageWeeklySession} min
                    </strong>

                    <small>
                      Per completed session
                    </small>

                  </div>

                  <div className="analytics-detail">

                    <span>
                      CONSISTENCY
                    </span>

                    <strong>
                      {consistencyScore}%
                    </strong>

                    <small>
                      {activeDays} of 7 days active
                    </small>

                  </div>

                  <div className="analytics-detail">

                    <span>
                      TOTAL PAUSES
                    </span>

                    <strong>
                      {totalPauseCount}
                    </strong>

                    <small>
                      Across completed sessions
                    </small>

                  </div>

                  <div className="analytics-detail">

                    <span>
                      BREAK TIME
                    </span>

                    <strong>
                      {formatMinutes(totalPauseMinutes)}
                    </strong>

                    <small>
                      Total recorded recovery time
                    </small>

                  </div>

                  <div className="analytics-detail">

                    <span>
                      AVG. BREAK
                    </span>

                    <strong>
                      {averagePauseMinutes} min
                    </strong>

                    <small>
                      Average per completed session
                    </small>

                  </div>

                  <div className="analytics-detail">

                    <span>
                      PAUSED SESSIONS
                    </span>

                    <strong>
                      {sessionsWithPauses}
                    </strong>

                    <small>
                      Sessions with at least one pause
                    </small>

                  </div>

                </div>

                <div className="analytics-performance-rating">

                  <span>
                    FOCUS PERFORMANCE
                  </span>

                  <strong>
                    {focusPerformanceRating} ·{' '}
                    {focusPerformanceScore}/100
                  </strong>

                  <p>
                    Recent average: {recentAverage} min
                  </p>

                  <small>
                    {recentAverage === 0
                      ? 'Complete a focus session to generate your performance rating.'
                      : `Your recent sessions average ${recentAverage} minutes each.`}
                  </small>

                </div>

                <div className="analytics-breakdown">

                  <div className="analytics-section-title">

                    <div>

                      <p className="eyebrow">
                        TODAY'S ACTIVITY
                      </p>

                      <h3>
                        Session Breakdown
                      </h3>

                    </div>

                    <span className="breakdown-count">
                      {todaySessions.length} sessions
                    </span>

                  </div>

                  {todaySessions.length === 0 ? (

                    <div className="analytics-empty">

                      <span>◷</span>

                      <div>

                        <strong>
                          No completed sessions today
                        </strong>

                        <p>
                          Your completed focus
                          sessions will appear here.
                        </p>

                      </div>

                    </div>

                  ) : (

                    <div className="breakdown-list">

                      {todaySessions.map(
                        (session, index) => (

                          <div
                            className="breakdown-item"
                            key={session.id}
                          >

                            <div className="breakdown-number">
                              {String(
                                index + 1
                              ).padStart(2, '0')}
                            </div>

                            <div className="breakdown-info">

                              <strong>
                                Focus Session{' '}
                                {index + 1}
                              </strong>

                              <span>
                                Completed at{' '}
                                {
                                  session.completedAt
                                }
                              </span>

                              <span>
                                {session.pauseCount || 0}{' '}
                                pause
                                {(session.pauseCount || 0) !== 1
                                  ? 's'
                                  : ''}
                                {' · '}
                                Break{' '}
                                {formatMinutes(
                                  Math.round(
                                    Number(
                                      session.pauseDuration ||
                                        0
                                    ) / 60
                                  )
                                )}
                              </span>

                            </div>

                            <strong className="breakdown-duration">
                              {
                                session.durationMinutes
                              }
                              m
                            </strong>

                          </div>

                        )
                      )}

                    </div>

                  )}

                </div>

                <div className="analytics-breakdown">

                  <div className="analytics-section-title">

                    <div>

                      <p className="eyebrow">
                        RECOVERY BEHAVIOUR
                      </p>

                      <h3>
                        Focus vs Break Pattern
                      </h3>

                    </div>

                    <span className="breakdown-count">
                      {todayPauseCount} pauses today
                    </span>

                  </div>

                  {todaySessions.length === 0 ? (

                    <div className="analytics-empty">

                      <span>☕</span>

                      <div>

                        <strong>
                          No recovery data today
                        </strong>

                        <p>
                          Pause behaviour will appear
                          after completed sessions.
                        </p>

                      </div>

                    </div>

                  ) : (

                    <div className="breakdown-list">

                      <div className="breakdown-item">

                        <div className="breakdown-number">
                          01
                        </div>

                        <div className="breakdown-info">

                          <strong>
                            Today's focus time
                          </strong>

                          <span>
                            Completed focused work
                          </span>

                        </div>

                        <strong className="breakdown-duration">
                          {formatMinutes(
                            focusTimeToday
                          )}
                        </strong>

                      </div>

                      <div className="breakdown-item">

                        <div className="breakdown-number">
                          02
                        </div>

                        <div className="breakdown-info">

                          <strong>
                            Today's break time
                          </strong>

                          <span>
                            Recorded pause and
                            recovery time
                          </span>

                        </div>

                        <strong className="breakdown-duration">
                          {formatMinutes(
                            todayPauseMinutes
                          )}
                        </strong>

                      </div>

                      <div className="breakdown-item">

                        <div className="breakdown-number">
                          03
                        </div>

                        <div className="breakdown-info">

                          <strong>
                            Focus-to-break balance
                          </strong>

                          <span>
                            Focus minutes compared
                            with break minutes
                          </span>

                        </div>

                        <strong className="breakdown-duration">

                          {todayPauseMinutes === 0
                            ? 'Focus only'
                            : `${Math.round(
                                focusTimeToday /
                                  todayPauseMinutes
                              )}:1`}

                        </strong>

                      </div>

                    </div>

                  )}

                </div>

              </div>

              {/* ANALYTICS SIDE */}

              <aside className="analytics-sidebar">

                <div className="card cognitive-load-card">

                  <div className="cognitive-card-heading">

                    <div>

                      <p className="eyebrow">
                        COGNITIVE LOAD
                      </p>

                      <h3>
                        Current Load
                      </h3>

                    </div>

                    <span className="load-status">
                      {cognitiveLoadLevel}
                    </span>

                  </div>

                  <div className="cognitive-score">

                    <strong>
                      {cognitiveLoadScore}
                    </strong>

                    <span>
                      /100
                    </span>

                  </div>

                  <div className="cognitive-progress">

                    <div
                      style={{
                        width: `${cognitiveLoadScore}%`,
                      }}
                    />

                  </div>

                  <div className="cognitive-scale">

                    <span>
                      Low
                    </span>

                    <span>
                      Balanced
                    </span>

                    <span>
                      High
                    </span>

                  </div>

                  <div className="cognitive-description">

                    <strong>

                      {cognitiveLoadLevel === 'HIGH'
                        ? 'High cognitive demand'
                        : cognitiveLoadLevel === 'MODERATE'
                          ? 'Moderate cognitive demand'
                          : 'Low cognitive demand'}

                    </strong>

                    <p>

                      {cognitiveLoadLevel === 'HIGH'
                        ? 'Your recent focus activity indicates a higher cognitive demand. Consider taking a recovery break.'
                        : cognitiveLoadLevel === 'MODERATE'
                          ? 'Your recent focus activity indicates a moderate cognitive demand. Maintain a balanced focus and recovery routine.'
                          : 'Your recent focus activity indicates a lower cognitive demand. You can continue building your focus routine.'}

                    </p>

                  </div>

                  <div className="prototype-note">

                    <span>
                      ⓘ
                    </span>

                    Camera-based cognitive detection
                    is planned for a later project phase.

                  </div>

                </div>

                <div className="card analytics-insight-card">

                  <p className="eyebrow">
                    BEHAVIOURAL INSIGHT
                  </p>

                  <h3>
                    Your focus profile
                  </h3>

                  <div className="productivity-insight-text">

                    <strong>
                      Productivity Insight
                    </strong>

                    <p>
                      {productivityInsight}
                    </p>

                    <small>
                      {trendInsight}
                    </small>

                  </div>

                  <div className="profile-score">

                    <div className="profile-score-ring">

                      <strong>
                        {consistencyScore}
                      </strong>

                      <span>
                        %
                      </span>

                    </div>

                    <div>

                      <strong>
                        Consistency
                      </strong>

                      <p>

                        {activeDays === 0
                          ? 'Start recording sessions to build your profile.'
                          : activeDays <= 2
                            ? 'You are starting to establish a routine.'
                            : activeDays <= 4
                              ? 'Your focus routine is becoming consistent.'
                              : 'Excellent weekly consistency.'}

                      </p>

                    </div>

                  </div>

                </div>

                <div className="card analytics-mini-card">

                  <span>
                    TOTAL FOCUS
                  </span>

                  <strong>
                    {formatMinutes(
                      totalFocusMinutes
                    )}
                  </strong>

                  <small>
                    All-time recorded focus
                  </small>

                </div>

                <div className="card analytics-mini-card">

                  <span>
                    TOTAL BREAK
                  </span>

                  <strong>
                    {formatMinutes(
                      totalPauseMinutes
                    )}
                  </strong>

                  <small>
                    All-time recorded recovery
                  </small>

                </div>

              </aside>

            </div>

          </section>

        )}

        {/* ================= RECOMMENDATIONS ================= */}

        {activePage === 'Recommendations' && (

          <section className="recommendations-page">

            <div className="recommendations-header">

              <div>

                <p className="eyebrow">
                  SMART INTERVENTION
                </p>

                <h2>
                  Recommendations
                </h2>

                <p>
                  Practical suggestions generated
                  from your current focus behaviour.
                </p>

              </div>

              <div className="recommendation-header-icon">
                ✧
              </div>

            </div>

            <div className="recommendation-layout">

              <div className="card recommendation recommendation-main">

                <div className="recommendation-top">

                  <span className="recommendation-type">
                    {recommendation.type}
                  </span>

                  <span className="recommendation-sparkle">
                    ✦
                  </span>

                </div>

                <div className="rec-icon">
                  {recommendation.icon}
                </div>

                <span className="demo-label">
                  PERSONALIZED INSIGHT
                </span>

                <h2>
                  {recommendation.title}
                </h2>

                <p className="rec-description">
                  {recommendation.message}
                </p>

                <div className="reason">

                  <strong>
                    Why this recommendation?
                  </strong>

                  <p>
                    {recommendation.reason}
                  </p>

                </div>

                <div className="recommendation-action-large">

                  <span>
                    Recommended next step
                  </span>

                  <strong>
                    {recommendation.action}
                  </strong>

                </div>

              </div>

              <div className="recommendation-context">

                <div className="card context-card">

                  <p className="eyebrow">
                    TODAY'S SIGNALS
                  </p>

                  

                  <h3>
                    What NeuroSync sees
                  </h3>

                  <div className="signal-list">

                    <div>

                      <span>
                        Focus time
                      </span>

                      <strong>
                        {formatMinutes(
                          focusTimeToday
                        )}
                      </strong>

                    </div>

                    <div>

                      <span>
                        Sessions
                      </span>

                      <strong>
                        {todaySessions.length}
                      </strong>

                    </div>

                    <div>

                      <span>
                        Recent average
                      </span>

                      <strong>
                        {recentAverage}m
                      </strong>

                    </div>

                    <div>

                      <span>
                        Weekly consistency
                      </span>

                      <strong>
                        {activeDays}/7
                      </strong>

                    </div>

                    <div>

                      <span>
                        Pauses today
                      </span>

                      <strong>
                        {todayPauseCount}
                      </strong>

                    </div>

                    <div>

                      <span>
                        Break time today
                      </span>

                      <strong>
                        {formatMinutes(
                          todayPauseMinutes
                        )}
                      </strong>

                    </div>

                    <div>

                      <span>
                        Performance rating
                      </span>

                      <strong>
                        {focusPerformanceRating}
                      </strong>

                    </div>

                    <div>

                      <span>
                        Cognitive load
                      </span>

                      <strong>
                        {cognitiveLoadScore}/100 ·{' '}
                        {cognitiveLoadLevel}
                      </strong>

                    </div>

                  </div>

                  <div className="recommendation-progress">

                    <div>

                      <span>
                        Weekly goal progress
                      </span>

                      <strong>
                        {weeklyGoalProgress}%
                      </strong>

                    </div>

                    <div className="recommendation-progress-bar">

                      <div
                        style={{
                          width: `${weeklyGoalProgress}%`,
                        }}
                      />

                    </div>

                  </div>

                </div>

                <div className="card context-card">

                  <p className="eyebrow">
                    SYSTEM LOGIC
                  </p>

                  <h3>
                    Rule-based intelligence
                  </h3>

                  <p className="context-description">
                    Recommendations currently use
                    completed-session behaviour,
                    focus duration, pause frequency,
                    break duration and consistency.
                  </p>

                  <div className="logic-badge">
                    ✓ Prototype intelligence active
                  </div>

                </div>

              </div>

            </div>

          </section>

        )}

        {/* ================= FOOTER ================= */}

        <footer>

          <span>
            NeuroSync · Cognitive Load Aware
            Productivity Intelligence
          </span>

          <span>
            Frontend prototype · Rule-based insights
          </span>

        </footer>

      </main>

    </div>
  )
}

export default App