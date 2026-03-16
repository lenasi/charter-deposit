import BookingForm from '../components/BookingForm.jsx'
import { useMode } from '../context/ModeContext.jsx'
import styles from './Book.module.css'

const steps = [
  {
    title: 'At deposit registration',
    description:
      'We save your card details securely through Stripe. Nothing is charged and no money is held at this point. Your card is completely unaffected.',
  },
  {
    title: 'A few days before your charter',
    description:
      'We place a €2,000 authorization hold on your card. This is not a charge — it simply reserves the funds as a security deposit. You will see it as a "pending" transaction with your bank.',
  },
  {
    title: 'On the day of your charter return',
    description:
      'We inspect the boat together at return. If everything is in order, the hold is fully released — typically within 3–5 business days depending on your bank. No money ever leaves your account.',
  },
  {
    title: 'If damage occurs',
    description:
      'Only in the case of damage or policy violation will we capture part or all of the deposit. We will always discuss this with you transparently before taking any action.',
  },
]

function WhatsAppIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

export default function Book() {
  const { mode, setMode } = useMode()

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="https://www.active.cruises" target="_blank" rel="noreferrer">
            <img src="/logo.webp" alt="Active Cruises" className={styles.logoImg} />
          </a>
          <a
            href="https://wa.me/38641277306"
            target="_blank"
            rel="noreferrer"
            className={styles.whatsapp}
            aria-label="WhatsApp"
          >
            <WhatsAppIcon />
            <span>+386 41 277 306</span>
          </a>
        </div>
      </header>

      {mode === 'test' && (
        <div className={styles.testBanner}>
          ⚠ TEST MODE — no real charges
        </div>
      )}

      <main className={styles.main}>
        {/* Section 1 — Deposit explanation */}
        <section className={styles.section}>
          <h1 className={styles.sectionHeading}>Deposit &amp; Payment — What to Expect</h1>
          <p className={styles.intro}>
            As you have a bareboat charter (without our crew), we require a €2,000 refundable
            deposit hold on your credit card. Here&apos;s exactly what happens:
          </p>

          <div className={styles.steps}>
            {steps.map((step, i) => (
              <div key={i} className={styles.step}>
                <div className={styles.stepNumber}>{i + 1}</div>
                <div className={styles.stepContent}>
                  <p className={styles.stepTitle}>{step.title}</p>
                  <p className={styles.stepDesc}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <hr className={styles.divider} />

          <p className={styles.trustNote}>
            <strong>Your card details are handled entirely by Stripe</strong> — one of the
            world&apos;s most trusted payment processors. We never see or store your full card
            number.
          </p>
          <p className={styles.trustNote} style={{ marginTop: 10 }}>
            Payment is completed online in advance, so there&apos;s no cash or on-site deposit
            required. This keeps check-in quick and straightforward.
          </p>
        </section>

        {/* Section 2 — Booking Form */}
        <section className={styles.section}>
          <BookingForm />
        </section>

      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerSecure}>
          🔒 Payments secured by Stripe. Your card details are never stored on our servers.
        </p>
        <div className={styles.footerLinks}>
          <a href="https://inoffice.box.com/v/crewedcharter" target="_blank" rel="noreferrer" className={styles.footerLink}>Charter Terms &amp; Conditions</a>
          <a
            href="https://wa.me/38641277306"
            target="_blank"
            rel="noreferrer"
            className={styles.footerLink}
          >
            Need help? WhatsApp us
          </a>
        </div>
        <p className={styles.footerCompany}>
          Active Vacations l.t.d. — Ribnjak Ulica 56, 10000 Zagreb, Croatia — VAT: HR39921718762
        </p>
        <button
          className={styles.testLink}
          onClick={() => setMode(mode === 'test' ? 'live' : 'test')}
        >
          {mode === 'test' ? 'Exit test' : 'Simulate Test Credit Card'}
        </button>
      </footer>
    </div>
  )
}
