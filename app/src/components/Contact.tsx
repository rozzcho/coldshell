import { useEffect, useState } from 'react'
import { REPO_URL } from '../config'
import { getMe } from '../lib/api'
import { ChatIcon, CodeIcon, MailIcon, PlaneIcon } from './icons'

const CONTACTS = [
  { label: 'suynjo', href: 'https://t.me/suynjo', icon: <PlaneIcon /> },
  { label: 'suynjo@gmail.com', href: 'mailto:suynjo@gmail.com', icon: <MailIcon /> },
  { label: 'ask-the-team', href: 'https://discord.gg/scNbdXFTxq', icon: <ChatIcon /> },
  { label: 'bug-reports', href: 'https://discord.gg/wxEaVBygGk', icon: <ChatIcon /> },
  { label: 'github', href: REPO_URL, icon: <CodeIcon /> },
]

/** The footer line: every way to reach a person, small, where footers go. */
export function Contact() {
  const [staff, setStaff] = useState(false)
  useEffect(() => {
    const check = () =>
      getMe()
        .then((me) => setStaff(Boolean(me.staff)))
        .catch(() => setStaff(false))
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  return (
    <p className="contact">
      {CONTACTS.map((contact, i) => (
        <span key={contact.label}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <a href={contact.href} target="_blank" rel="noopener noreferrer">
            {contact.icon}
            {contact.label}
          </a>
        </span>
      ))}
      {staff && (
        <span>
          <span aria-hidden="true"> · </span>
          <a href="/staff">staff</a>
        </span>
      )}
    </p>
  )
}
