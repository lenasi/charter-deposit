import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createClient } from '@supabase/supabase-js'
import { useMode } from '../context/ModeContext.jsx'
import styles from './BookingForm.module.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'
)

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

export default function BookingForm() {
  const stripe = useStripe()
  const elements = useElements()
  const { mode } = useMode()

  const [form, setForm] = useState({
    clientName: '',
    email: '',
    charterDate: '',
    depositAmount: '2000',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (mode === 'test') {
      const testDate = new Date()
      testDate.setDate(testDate.getDate() + 30)
      const yyyy = testDate.getFullYear()
      const mm = String(testDate.getMonth() + 1).padStart(2, '0')
      const dd = String(testDate.getDate()).padStart(2, '0')
      setForm({
        clientName: 'Test User',
        email: 'test@example.com',

        charterDate: `${yyyy}-${mm}-${dd}`,
        depositAmount: '100',
        notes: '',
      })
    }
  }, [mode])

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!stripe) return
    if (mode !== 'test' && !elements) return

    setLoading(true)

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    }

    try {
      // 1. Create SetupIntent + Stripe Customer
      const res = await fetch(`${FUNCTIONS_URL}/create-setup-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: form.email, name: form.clientName, mode }),
      })
      const { clientSecret, customerId, error: fnError } = await res.json()
      if (fnError) throw new Error(fnError)

      let paymentMethodId

      if (mode === 'test') {
        // In test mode: skip confirmCardSetup — pm_card_visa is a valid Stripe test PM
        paymentMethodId = 'pm_card_visa'
      } else {
        // 2. Confirm SetupIntent with real card element
        const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: form.clientName,
              email: form.email,
            },
          },
        })
        if (stripeError) throw new Error(stripeError.message)
        paymentMethodId = setupIntent.payment_method
      }

      // 3. Save booking
      const saveRes = await fetch(`${FUNCTIONS_URL}/save-booking`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientName: form.clientName,
          email: form.email,
          charterDate: form.charterDate,
          depositAmount: form.depositAmount,
          stripeCustomerId: customerId,
          stripePaymentMethodId: paymentMethodId,
          mode,
          notes: form.notes || null,
        }),
      })
      const { error: saveError } = await saveRes.json()
      if (saveError) throw new Error(saveError)

      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.successBox}>
        <div className={styles.successIcon}>✓</div>
        <h3 className={styles.successTitle}>Deposit Confirmed</h3>
        <p className={styles.successMsg}>
          Your deposit details are confirmed and your card has been saved. A hold of €2,000 will be placed a
          few days before your check-in date. Please make sure you have at least €2,000 available on your card at that time. Thank you and enjoy your cruise!
        </p>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Full Name</label>
          <input
            className={styles.input}
            name="clientName"
            value={form.clientName}
            onChange={handleChange}
            required
            placeholder="John Smith"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            className={styles.input}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="john@example.com"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Check-in Date</label>
          <input
            className={styles.input}
            type="date"
            name="charterDate"
            value={form.charterDate}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Deposit Amount</label>
        <div className={styles.depositDisplay}>
          <span className={styles.depositCurrency}>EUR</span>
          <span className={styles.depositAmount}>
            {Number(form.depositAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <input type="hidden" name="depositAmount" value={form.depositAmount} readOnly />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Card Details</label>
        {mode === 'test' ? (
          <div className={styles.testCardFilled}>
            <span className={styles.testCardIcon}>💳</span>
            <span>Visa <strong>4242 4242 4242 4242</strong> · 12/26 · 123 — test card autofilled</span>
          </div>
        ) : (
          <div className={styles.cardElement}>
            <CardElement
              options={{
                style: {
                  base: {
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '14px',
                    color: '#0f172a',
                    '::placeholder': { color: '#94a3b8' },
                  },
                },
              }}
            />
          </div>
        )}
      </div>

      <div className={styles.fundsNotice}>
        <span className={styles.fundsNoticeIcon}>💳</span>
        <span>Please ensure you have at least <strong>€2,000</strong> available on your credit card before proceeding.</span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.ctaGroup}>
        <motion.button
          type="submit"
          className={styles.submitBtn}
          disabled={loading || !stripe}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? 'Processing...' : 'Save card & confirm deposit'}
        </motion.button>
        <div className={styles.secureNote}>
          <LockIcon />
          <span>Payments secured by Stripe · Card details never stored</span>
        </div>
      </div>
    </form>
  )
}
