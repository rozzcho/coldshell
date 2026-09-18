import { useCommands } from './chips'
import { today } from '../../lib/shell'

/** Where a stake is placed and a run of shells begins. Not built yet. */
export function RegisterPane({ active }: { active: boolean }) {
  const now = today()
  useCommands({ chips: [] }, [], active)
  return (
    <>
      <p className="term-prompt">register --shell {now.shell}</p>
      <p className="term-line term-dim">nothing to register with yet. the program comes next.</p>
    </>
  )
}
