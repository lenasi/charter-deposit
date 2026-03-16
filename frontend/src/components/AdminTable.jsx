import { useState } from 'react'
import styles from './AdminTable.module.css'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const STATUS_LABELS = {
  card_saved: 'Card Saved',
  hold_active: 'Hold Active',
  captured: 'Captured',
  voided: 'Voided',
}

function scheduledHoldDate(charterDate) {
  const d = new Date(charterDate)
  d.setDate(d.getDate() - 2)
  return d
}

function holdScheduleLabel(charterDate) {
  const holdDate = scheduledHoldDate(charterDate)
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const holdStr = holdDate.toISOString().split('T')[0]
  const diffDays = Math.round((holdDate - now) / (1000 * 60 * 60 * 24))

  if (holdStr < todayStr) return { date: holdDate.toLocaleDateString(), note: 'overdue', warn: true }
  if (holdStr === todayStr) return { date: holdDate.toLocaleDateString(), note: 'today at 08:00 UTC', warn: true }
  if (diffDays === 1) return { date: holdDate.toLocaleDateString(), note: 'tomorrow', warn: true }
  return { date: holdDate.toLocaleDateString(), note: `in ${diffDays} days`, warn: false }
}

function holdExpiry(holdPlacedAt) {
  if (!holdPlacedAt) return null
  const d = new Date(holdPlacedAt)
  d.setDate(d.getDate() + 7)
  return d
}

function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false
  const now = new Date()
  const diff = (expiryDate - now) / (1000 * 60 * 60 * 24)
  return diff <= 2 && diff >= 0
}

export default function AdminTable({ bookings, onRefresh, mode = 'live' }) {
  const [loadingId, setLoadingId] = useState(null)
  const [error, setError] = useState('')

  const callFunction = async (fnName, body) => {
    const res = await fetch(`${FUNCTIONS_URL}/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Request failed')
    return data
  }

  const handleAction = async (action, booking) => {
    setError('')
    setLoadingId(booking.id)
    try {
      if (action === 'place') {
        await callFunction('place-hold', {
          bookingId: booking.id,
          paymentMethodId: booking.stripe_payment_method_id,
          customerId: booking.stripe_customer_id,
          amount: booking.deposit_amount,
          mode,
        })
      } else if (action === 'capture') {
        await callFunction('capture-hold', {
          bookingId: booking.id,
          paymentIntentId: booking.stripe_payment_intent_id,
          mode,
        })
      } else if (action === 'void') {
        await callFunction('void-hold', {
          bookingId: booking.id,
          paymentIntentId: booking.stripe_payment_intent_id,
          mode,
        })
      } else if (action === 'delete') {
        if (!window.confirm(`Delete booking for ${booking.client_name}? The Stripe customer will be kept.`)) return
        await callFunction('delete-booking', { bookingId: booking.id })
      }
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Client</th>
              <th>Email</th>
              <th>Check-in Date</th>
              <th>Deposit</th>
              <th>Status</th>
              <th>Hold Scheduled</th>
              <th>Hold Expiry</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.empty}>No bookings found.</td>
              </tr>
            )}
            {bookings.map((b) => {
              const expiry = holdExpiry(b.hold_placed_at)
              const expiringSoon = isExpiringSoon(expiry)
              const isLoading = loadingId === b.id
              const holdSched = b.status === 'card_saved' ? holdScheduleLabel(b.charter_date) : null

              return (
                <tr
                  key={b.id}
                  className={expiringSoon ? styles.rowDanger : ''}
                >
                  <td className={styles.nameCell}>{b.client_name}</td>
                  <td>{b.email}</td>
                  <td>{b.charter_date}</td>
                  <td>€{Number(b.deposit_amount).toLocaleString()}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[`badge_${b.status}`]}`}>
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                  </td>
                  <td>
                    {holdSched ? (
                      <span className={holdSched.warn ? styles.holdSchedWarn : styles.holdSched}>
                        {holdSched.date}
                        <span className={styles.holdSchedNote}> {holdSched.note}</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {expiry ? (
                      <span className={expiringSoon ? styles.expiryWarn : ''}>
                        {expiry.toLocaleDateString()}
                        {expiringSoon && ' ⚠'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className={styles.actions}>
                    {b.status === 'card_saved' && (
                      <button
                        className={`${styles.btn} ${styles.btnPlace}`}
                        onClick={() => handleAction('place', b)}
                        disabled={isLoading}
                      >
                        {isLoading ? '...' : 'Place Hold'}
                      </button>
                    )}
                    {b.status === 'hold_active' && (
                      <>
                        <button
                          className={`${styles.btn} ${styles.btnCapture}`}
                          onClick={() => handleAction('capture', b)}
                          disabled={isLoading}
                        >
                          {isLoading ? '...' : 'Capture'}
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnVoid}`}
                          onClick={() => handleAction('void', b)}
                          disabled={isLoading}
                        >
                          {isLoading ? '...' : 'Void'}
                        </button>
                      </>
                    )}
                    <button
                      className={`${styles.btn} ${styles.btnDelete}`}
                      onClick={() => handleAction('delete', b)}
                      disabled={isLoading}
                    >
                      {isLoading ? '...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
