import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useMode } from '../context/ModeContext.jsx'
import AdminTable from '../components/AdminTable.jsx'
import styles from './Admin.module.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'
)

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PASSWORDS = {
  test: import.meta.env.VITE_ADMIN_PASSWORD_TEST,
  live: import.meta.env.VITE_ADMIN_PASSWORD_LIVE,
}

function getNextRun() {
  const now = new Date()
  const next = new Date()
  next.setUTCHours(8, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatDateTime(d) {
  return new Date(d).toLocaleString()
}

export default function Admin() {
  const { mode, setMode } = useMode()
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState('bookings')

  const [bookings, setBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(false)

  const [pendingCount, setPendingCount] = useState(null)
  const [cronRunning, setCronRunning] = useState(false)
  const [cronResult, setCronResult] = useState(null)

  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [expandedLog, setExpandedLog] = useState(null)

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true)
    const { data } = await supabase
      .schema('charter')
      .from('bookings')
      .select('*')
      .eq('mode', mode)
      .order('charter_date', { ascending: true })
    setBookings(data || [])
    setBookingsLoading(false)
  }, [mode])

  const fetchPendingCount = useCallback(async () => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 2)
    const dateStr = targetDate.toISOString().split('T')[0]
    const { count } = await supabase
      .schema('charter')
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'card_saved')
      .eq('mode', mode)
      .eq('charter_date', dateStr)
    setPendingCount(count ?? 0)
  }, [mode])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    const { data } = await supabase
      .schema('charter')
      .from('cron_logs')
      .select('*')
      .order('ran_at', { ascending: false })
    setLogs(data || [])
    setLogsLoading(false)
  }, [])

  // Re-fetch when mode changes (after login)
  useEffect(() => {
    if (!authed) return
    if (tab === 'bookings') fetchBookings()
    if (tab === 'cron') fetchPendingCount()
    if (tab === 'logs') fetchLogs()
  }, [authed, tab, mode, fetchBookings, fetchPendingCount, fetchLogs])

  // Log out when mode switches so password is re-checked
  const handleModeSwitch = (m) => {
    setMode(m)
    setAuthed(false)
    setPassword('')
    setAuthError('')
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === PASSWORDS[mode]) {
      setAuthed(true)
    } else {
      setAuthError('Incorrect password.')
    }
  }

  const handleRunNow = async () => {
    setCronRunning(true)
    setCronResult(null)
    try {
      const res = await fetch(`${FUNCTIONS_URL}/auto-place-holds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()
      setCronResult(data)
      fetchPendingCount()
      fetchLogs()
    } catch (err) {
      setCronResult({ error: err.message })
    } finally {
      setCronRunning(false)
    }
  }

  if (!authed) {
    return (
      <div className={styles.loginWrap}>
        <form className={styles.loginBox} onSubmit={handleLogin}>
          <h1 className={styles.loginTitle}>Admin Login</h1>

          {/* Mode selector on login screen */}
          <div className={styles.loginModeRow}>
            <button
              type="button"
              className={mode === 'test' ? styles.loginModeBtnActive : styles.loginModeBtn}
              onClick={() => handleModeSwitch('test')}
            >
              Test
            </button>
            <button
              type="button"
              className={mode === 'live' ? styles.loginModeBtnActiveLive : styles.loginModeBtn}
              onClick={() => handleModeSwitch('live')}
            >
              Live
            </button>
          </div>
          {mode === 'test' && (
            <p className={styles.loginModeHint}>Signing in to test environment</p>
          )}
          {mode === 'live' && (
            <p className={`${styles.loginModeHint} ${styles.loginModeHintLive}`}>Signing in to live environment</p>
          )}

          <input
            className={styles.loginInput}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          {authError && <p className={styles.loginError}>{authError}</p>}
          <button type="submit" className={styles.loginBtn}>Sign In</button>
        </form>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>Active Cruises — Admin</span>
          <div className={styles.headerRight}>
            {/* Mode toggle in header */}
            <div className={styles.modeToggle}>
              <button
                className={mode === 'test' ? styles.modeTestActive : styles.modeTestInactive}
                onClick={() => handleModeSwitch('test')}
              >
                Test
              </button>
              <button
                className={mode === 'live' ? styles.modeLiveActive : styles.modeLiveInactive}
                onClick={() => handleModeSwitch('live')}
              >
                Live
              </button>
            </div>
            <button className={styles.logoutBtn} onClick={() => setAuthed(false)}>Log out</button>
          </div>
        </div>
      </header>

      {/* Mode indicator bar */}
      <div className={mode === 'test' ? styles.modeBarTest : styles.modeBarLive}>
        {mode === 'test'
          ? '⚠ TEST MODE — showing test bookings only, no real charges'
          : '● LIVE MODE — showing real bookings'}
      </div>

      <main className={styles.main}>
        <div className={styles.tabs}>
          {['bookings', 'cron', 'logs'].map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'bookings' && (
          <div>
            <div className={styles.tabHeader}>
              <h2 className={styles.tabTitle}>Bookings</h2>
              <button className={styles.refreshBtn} onClick={fetchBookings}>Refresh</button>
            </div>
            {bookingsLoading ? (
              <p className={styles.loading}>Loading...</p>
            ) : (
              <AdminTable bookings={bookings} onRefresh={fetchBookings} mode={mode} />
            )}
          </div>
        )}

        {tab === 'cron' && (
          <div className={styles.cronSection}>
            <h2 className={styles.tabTitle}>Cron Job Status</h2>

            <div className={styles.cronCard}>
              <div className={styles.cronRow}>
                <span className={styles.cronLabel}>Job name</span>
                <span className={styles.cronValue}>auto-hold-charter-deposits</span>
              </div>
              <div className={styles.cronRow}>
                <span className={styles.cronLabel}>Schedule</span>
                <span className={styles.cronValue}>Daily at 08:00 UTC</span>
              </div>
              <div className={styles.cronRow}>
                <span className={styles.cronLabel}>Next run</span>
                <span className={styles.cronValue}>{getNextRun().toLocaleString()} (local)</span>
              </div>
              <div className={styles.cronRow}>
                <span className={styles.cronLabel}>Eligible for next run</span>
                <span className={styles.cronValue}>
                  {pendingCount === null ? '...' : pendingCount}
                  {' '}
                  <span className={styles.cronHint}>(card_saved · {mode} · charter date = today + 2 days)</span>
                </span>
              </div>
            </div>

            <button className={styles.runNowBtn} onClick={handleRunNow} disabled={cronRunning}>
              {cronRunning ? 'Running...' : `Run now (${mode})`}
            </button>

            {cronResult && (
              <div className={cronResult.error ? styles.cronResultError : styles.cronResultOk}>
                {cronResult.error ? (
                  <p>Error: {cronResult.error}</p>
                ) : (
                  <p>
                    Done — found: <strong>{cronResult.bookingsFound}</strong>, triggered:{' '}
                    <strong>{cronResult.bookingsTriggered}</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'logs' && (
          <div>
            <div className={styles.tabHeader}>
              <h2 className={styles.tabTitle}>Cron Logs</h2>
              <button className={styles.refreshBtn} onClick={fetchLogs}>Refresh</button>
            </div>
            {logsLoading ? (
              <p className={styles.loading}>Loading...</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>Found</th>
                      <th>Triggered</th>
                      <th>Status</th>
                      <th>Error</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={6} className={styles.empty}>No logs yet.</td>
                      </tr>
                    )}
                    {logs.map((log) => {
                      const ids = log.details?.processed_ids || []
                      return (
                        <>
                          <tr key={log.id}>
                            <td>{formatDateTime(log.ran_at)}</td>
                            <td>{log.bookings_found}</td>
                            <td>{log.bookings_triggered}</td>
                            <td>
                              <span className={`${styles.badge} ${log.status === 'ok' ? styles.badgeOk : styles.badgeError}`}>
                                {log.status}
                              </span>
                            </td>
                            <td>{log.error_message || '—'}</td>
                            <td>
                              {ids.length > 0 && (
                                <button
                                  className={styles.detailsBtn}
                                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                >
                                  {expandedLog === log.id ? 'Hide' : `Show ${ids.length} IDs`}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expandedLog === log.id && (
                            <tr key={`${log.id}-detail`}>
                              <td colSpan={6} className={styles.detailsRow}>
                                <ul className={styles.idList}>
                                  {ids.map((id) => (
                                    <li key={id}>{id}</li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
