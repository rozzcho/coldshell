import { useState } from 'react'
import { HOW_TO_START, RULES } from '../../content'
import { RULES_URL } from '../../config'
import { useCommands, useScrollOutput } from './chips'

/** How to start: the steps, numbered, because they really are a sequence. */
export function StartPane({ active }: { active: boolean }) {
  useCommands({ chips: [] }, [], active)
  return (
    <>
      <p className="term-prompt">how-to-start</p>
      <ol className="term-steps">
        {HOW_TO_START.map((step) => (
          <li key={step.title}>
            <p className="term-step-title">{step.title}</p>
            <p className="term-step-body">{step.body}</p>
          </li>
        ))}
      </ol>
    </>
  )
}

/** The rules in full, with the canonical longer version one confirmation away. */
export function RulesPane({ active }: { active: boolean }) {
  const [asking, setAsking] = useState(false)
  useScrollOutput([asking])

  useCommands(
    {
      chips: asking
        ? [
            { key: 'yes', label: 'y', tone: 'yes' as const, href: RULES_URL },
            { key: 'no', label: 'n', tone: 'no' as const, onClick: () => setAsking(false) },
          ]
        : [{ key: 'full', label: 'full rules', onClick: () => setAsking(true) }],
      back: asking ? () => setAsking(false) : undefined,
    },
    [asking],
    active,
  )

  return (
    <>
      <p className="term-prompt">rules</p>
      <ol className="term-rules">
        {RULES.map((rule) => (
          <li key={rule.topic}>
            <span className="term-topic">{rule.topic}:</span> {rule.text}
          </li>
        ))}
      </ol>
      {asking && (
        <p className="term-line term-ask">
          the canonical, longer version lives on github. open it?
        </p>
      )}
    </>
  )
}
