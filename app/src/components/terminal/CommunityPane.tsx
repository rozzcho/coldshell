import { useCommands } from './chips'

/** Where people will leave a line of their own. Empty until that is built. */
export function CommunityPane({ active }: { active: boolean }) {
  useCommands({ chips: [] }, [], active)
  return (
    <>
      <p className="term-prompt">community</p>
      <p className="term-line term-dim">nothing here yet.</p>
    </>
  )
}
