import { REPO_URL } from '../config'
import { CodeIcon, MailIcon, PlaneIcon } from './icons'

const CONTACTS = [
  { label: 'suynjo', href: 'https://t.me/suynjo', icon: <PlaneIcon /> },
  { label: 'suynjo@gmail.com', href: 'mailto:suynjo@gmail.com', icon: <MailIcon /> },
  { label: 'github', href: REPO_URL, icon: <CodeIcon /> },
]

/** The footer line: every way to reach a person, small, where footers go. */
export function Contact() {
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
    </p>
  )
}
