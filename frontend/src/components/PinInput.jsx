import { useRef } from 'react'
import './PinInput.css'

/**
 * 6-digit boxed PIN input.
 * Props: value (string up to 6 digits), onChange(string), disabled, autoFocus
 */
export default function PinInput({ value = '', onChange, disabled = false, autoFocus = false }) {
  const refs = useRef([])
  const digits = value.split('')

  function setAt(idx, char) {
    const arr = value.padEnd(6, ' ').split('')
    arr[idx] = char
    const next = arr.join('').replace(/\s/g, '').slice(0, 6)
    onChange(next)
  }

  function handleChange(idx, e) {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) return
    if (raw.length > 1) {
      // pasted multiple digits
      const merged = (value.slice(0, idx) + raw).replace(/\D/g, '').slice(0, 6)
      onChange(merged)
      const focusIdx = Math.min(merged.length, 5)
      refs.current[focusIdx]?.focus()
      return
    }
    setAt(idx, raw)
    if (idx < 5) refs.current[idx + 1]?.focus()
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[idx]) {
        setAt(idx, '')
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus()
        setAt(idx - 1, '')
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < 5) {
      refs.current[idx + 1]?.focus()
    }
  }

  return (
    <div className="pin-input">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="pin-input-box"
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  )
}
