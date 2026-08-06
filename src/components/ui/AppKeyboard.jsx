import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { IconArrowBackUp, IconSpace, IconKeyboardShow } from '@tabler/icons-react'
import { shouldUseAppKeyboard } from '../../utils/iosInput'
import { scrollFieldAboveKeyboard } from '../../utils/keyboardFocus'
import { typoHeadlineClass } from '../../utils/designSystem'

const AppKeyboardContext = createContext(null)

const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

const NUMBER_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
  ['.', ',', '?', '!', "'", '#', '%', '*', '+', '='],
]

const URL_EXTRA = ['.', '/', ':', '-', '_', '?', '=', '&']

export function AppKeyboardProvider({ children }) {
  const enabled = shouldUseAppKeyboard()
  const [session, setSession] = useState(null)
  const [mode, setMode] = useState('letters') // letters | numbers
  const [shifted, setShifted] = useState(false)

  const close = useCallback(() => {
    setSession(null)
    setMode('letters')
    setShifted(false)
  }, [])

  const open = useCallback((next) => {
    setSession(next)
    setMode('letters')
    setShifted(false)
  }, [])

  const patch = useCallback((id, partial) => {
    setSession((current) =>
      current && current.id === id ? { ...current, ...partial } : current
    )
  }, [])

  const insert = useCallback(
    (chunk) => {
      if (!session) return
      const max = session.maxLength ?? Infinity
      const next = `${session.value || ''}${chunk}`.slice(0, max)
      session.onChange(next)
      setSession((current) => (current ? { ...current, value: next } : current))
      if (shifted) setShifted(false)
    },
    [session, shifted]
  )

  const backspace = useCallback(() => {
    if (!session) return
    const next = (session.value || '').slice(0, -1)
    session.onChange(next)
    setSession((current) => (current ? { ...current, value: next } : current))
  }, [session])

  useEffect(() => {
    if (!session) return undefined
    // In-app keyboard path (disabled by default). System inset is owned by setupKeyboardInset.
    document.documentElement.style.setProperty('--app-keyboard-inset', '280px')
    const el = session.element
    const t1 = window.setTimeout(() => scrollFieldAboveKeyboard(el, { extraPad: 300 }), 40)
    const t2 = window.setTimeout(() => scrollFieldAboveKeyboard(el, { extraPad: 300 }), 220)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      document.documentElement.style.removeProperty('--app-keyboard-inset')
    }
  }, [session])

  const value = useMemo(
    () => ({
      enabled,
      activeId: session?.id ?? null,
      open,
      close,
      patch,
      isOpen: Boolean(session),
    }),
    [enabled, session?.id, open, close, patch, session]
  )

  const rows = mode === 'numbers' ? NUMBER_ROWS : LETTER_ROWS

  return (
    <AppKeyboardContext.Provider value={value}>
      {children}
      {enabled && session
        ? createPortal(
            <div
              className="fixed inset-x-0 bottom-0 z-[200] border-t border-[var(--ios-hairline)] bg-[var(--app-kb-bg)] pt-2 pb-[max(0.5rem,var(--ios-safe-bottom))] select-none"
              role="group"
              aria-label="Keyboard"
            >
              <div className="flex items-center justify-between px-3 pb-2 gap-2">
                <p className={`${typoHeadlineClass} truncate text-[15px] text-[var(--ios-label-secondary)]`}>
                  {session.label || 'Type'}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 px-3 py-1.5 rounded-full text-[15px] font-medium text-[var(--ios-blue)]"
                >
                  Done
                </button>
              </div>

              <div className="px-1.5 space-y-1.5">
                {rows.map((row) => (
                  <div key={row.join('')} className="flex justify-center gap-1">
                    {mode === 'letters' && row[0] === 'z' ? (
                      <Key wide onClick={() => setShifted((s) => !s)} label={shifted ? '⇪' : '⇧'} />
                    ) : null}
                    {row.map((key) => {
                      const char =
                        mode === 'letters' ? (shifted ? key.toUpperCase() : key) : key
                      return (
                        <Key
                          key={key}
                          label={char}
                          onClick={() => insert(char)}
                        />
                      )
                    })}
                    {mode === 'letters' && row[0] === 'z' ? (
                      <Key wide onClick={backspace} icon={<IconArrowBackUp size={18} />} />
                    ) : null}
                  </div>
                ))}

                {session.layout === 'url' ? (
                  <div className="flex justify-center gap-1 px-1">
                    {URL_EXTRA.map((key) => (
                      <Key key={key} label={key} onClick={() => insert(key)} />
                    ))}
                  </div>
                ) : null}

                <div className="flex justify-center gap-1">
                  <Key
                    wide
                    label={mode === 'numbers' ? 'ABC' : '123'}
                    onClick={() => setMode((m) => (m === 'numbers' ? 'letters' : 'numbers'))}
                  />
                  <Key
                    flex
                    icon={<IconSpace size={18} />}
                    onClick={() => insert(' ')}
                  />
                  {session.layout === 'multiline' ? (
                    <Key wide label="↵" onClick={() => insert('\n')} />
                  ) : null}
                  {mode === 'numbers' ? (
                    <Key wide onClick={backspace} icon={<IconArrowBackUp size={18} />} />
                  ) : (
                    <Key
                      wide
                      icon={<IconKeyboardShow size={18} />}
                      onClick={close}
                    />
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </AppKeyboardContext.Provider>
  )
}

function Key({ label, icon, onClick, wide = false, flex = false }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
      }}
      className={`h-11 rounded-[8px] bg-[var(--app-kb-key)] text-[var(--ios-label)] text-[17px] font-medium active:bg-[var(--app-kb-key-active)] shadow-[0_1px_0_rgba(0,0,0,0.18)] transition-colors flex items-center justify-center ${
        flex ? 'flex-[3] min-w-0' : wide ? 'w-11 min-w-[2.75rem] px-1' : 'w-8 min-w-[1.9rem] flex-1 max-w-[2.4rem]'
      }`}
    >
      {icon || label}
    </button>
  )
}

export function useAppKeyboard() {
  const ctx = useContext(AppKeyboardContext)
  if (!ctx) {
    return {
      enabled: false,
      activeId: null,
      open: () => {},
      close: () => {},
      patch: () => {},
      isOpen: false,
    }
  }
  return ctx
}
