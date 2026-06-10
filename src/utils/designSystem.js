/**
 * iOS & iPadOS 26 design system — class compositions for ArvoliO.
 * Reference Figma kit: https://www.figma.com/community/file/1527721578857867021/ios-and-ipados-26
 *
 * Liquid Glass → navigation, toolbars, tab bars, menus, floating controls.
 * Content (lists, messages, media) → solid backgrounds, no glass.
 */

const glassBase =
  'border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-xl backdrop-saturate-[1.8]'

export const glassRegularClass = `${glassBase} shadow-[var(--ios-glass-shadow)]`

export const navGlassClass = `rounded-full ${glassBase} backdrop-blur-lg backdrop-saturate-[1.6] shadow-[var(--ios-glass-shadow)]`

export const navGlassInnerClass =
  'rounded-full border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg-inner)] backdrop-blur-sm backdrop-saturate-[1.5] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.08)]'

export const navGlassMenuClass = `${glassRegularClass}`

/** @deprecated Use navGlassMenuClass */
export const headerMenuGlassClass = navGlassMenuClass

export const glassNavBarClass =
  'relative z-20 flex items-center gap-2 px-4 py-2.5 border-b border-[var(--ios-separator)] bg-[var(--ios-glass-bg)] backdrop-blur-xl backdrop-saturate-[1.8]'

export const glassInputBarClass =
  'border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg-input)] backdrop-blur-md shadow-[var(--ios-glass-shadow)]'

export const glassActionButtonClass = `${glassInputBarClass} h-11 w-11 shrink-0 flex items-center justify-center rounded-full transition-colors`

export const notificationGlassClass =
  'rounded-full border border-[var(--ios-glass-border)] bg-black/45 backdrop-blur-lg shadow-[var(--ios-glass-shadow)]'

export const modalGlassClass =
  'rounded-[var(--ios-radius-xl)] border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-2xl backdrop-saturate-[1.8] shadow-[var(--ios-glass-shadow-modal)]'

export const modalScrimClass = 'bg-black/40 backdrop-blur-md'

export const dropdownMenuClass = 'w-44 py-1 rounded-[var(--ios-radius-lg)] overflow-hidden'

export const dropdownMenuItemClass =
  'w-full px-3.5 py-2 text-left text-[15px] font-medium transition-colors duration-75 text-[var(--ios-label)] hover:bg-white/[0.08] active:bg-white/[0.14]'

export const dropdownMenuItemDangerClass =
  'w-full px-3.5 py-2 text-left text-[15px] font-medium transition-colors duration-75 text-[var(--ios-red)] hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 active:text-red-200'

export const dropdownMenuItemWithIconClass = `${dropdownMenuItemClass} flex items-center gap-2.5`

export const dropdownMenuItemWithIconDangerClass = `${dropdownMenuItemDangerClass} flex items-center gap-2.5`

export const pageShellClass = 'h-full flex flex-col'
export const pageContentClass = 'flex-1 min-h-0'
export const pageTitleClass = 'text-[28px] font-bold tracking-tight text-[var(--ios-label)]'
export const pageHeaderClass = 'flex items-center justify-between px-[var(--ios-page-x-lg)] pt-[calc(var(--ios-safe-top)+20px)] pb-2'
export const pageBottomClearanceClass = 'pb-[var(--ios-nav-clearance)]'

export const listRowClass =
  'w-full flex items-center gap-3 px-[var(--ios-page-x-lg)] py-3.5 transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]'

export const listRowSelectedClass = 'bg-white/[0.06]'

export const insetListClass =
  'mx-4 rounded-[var(--ios-radius-xl)] overflow-hidden border border-[var(--ios-separator)] bg-[var(--ios-bg-secondary)]'

export const textFieldClass =
  'w-full px-5 py-3 min-h-[var(--ios-control-min)] bg-[var(--ios-fill-tertiary)] rounded-full border border-[var(--ios-glass-border)] text-[17px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)] outline-none focus:border-[var(--ios-blue)] transition-colors'

export const btnFilledClass =
  'inline-flex items-center justify-center min-h-[var(--ios-control-min)] px-6 py-3 rounded-full text-[17px] font-semibold bg-[var(--ios-blue)] text-white hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50'

export const btnFilledDangerClass =
  'inline-flex items-center justify-center min-h-[var(--ios-control-min)] px-6 py-3 rounded-full text-[17px] font-semibold bg-[var(--ios-red)] text-white hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50'

export const btnBorderedClass =
  'inline-flex items-center justify-center min-h-[var(--ios-control-min)] px-6 py-3 rounded-full text-[17px] font-medium border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg-input)] backdrop-blur-md hover:bg-white/[0.12] transition-colors disabled:opacity-50'

export const btnPlainClass =
  'inline-flex items-center justify-center min-h-[var(--ios-control-min)] px-4 py-2 rounded-full text-[17px] font-medium text-[var(--ios-blue)] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors disabled:opacity-50'

export const iconButtonClass =
  'p-2 rounded-full text-[var(--ios-label)] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors'

export const contextMenuMotion = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.08 } },
  transition: { duration: 0.15 },
}

/** Optional class for non-button tap targets */
export const tapScaleClass = 'tap-scale'
