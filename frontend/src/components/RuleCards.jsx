import { useState } from 'react'
import styles from './RuleCards.module.css'

const rules = [
  {
    icon: '🔒',
    title: 'Safety First',
    description: 'Please follow our safety briefing before departure. Life jackets are provided for all passengers.',
  },
  {
    icon: '⛽',
    title: 'Fuel Policy',
    description: 'Return the vessel with the same fuel level. A refueling fee applies otherwise.',
  },
  {
    icon: '✨',
    title: 'Cleanliness',
    description: 'Leave the boat in a clean condition. Excessive cleaning will incur additional charges.',
  },
  {
    icon: '🚭',
    title: 'No Smoking',
    description: 'Smoking is not permitted on board. This applies to all areas of the vessel.',
  },
  {
    icon: '🐕',
    title: 'Pets Welcome',
    description: 'Pets are welcome but must be supervised at all times. Any damage will be assessed.',
  },
  {
    icon: '⏱',
    title: 'Punctual Return',
    description: 'Please return the boat on time. Late returns may incur hourly overtime charges.',
  },
]

export default function RuleCards() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={styles.section}>
      <button
        className={styles.sectionHeader}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <h2 className={styles.sectionTitle}>A few things to keep in mind on board</h2>
        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
          &#8964;
        </span>
      </button>

      {expanded && (
        <div className={styles.grid}>
          {rules.map((rule) => (
            <div key={rule.title} className={styles.card}>
              <span className={styles.icon}>{rule.icon}</span>
              <div>
                <p className={styles.cardTitle}>{rule.title}</p>
                <p className={styles.cardDesc}>{rule.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
