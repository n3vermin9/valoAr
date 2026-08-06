export default function SystemMessage({ text }) {
  if (!text) return null

  return (
    <div className="flex justify-center mb-2.5 px-2">
      <p className="max-w-[90%] text-center text-[12px] leading-snug text-[var(--ios-label-secondary)]">{text}</p>
    </div>
  )
}
