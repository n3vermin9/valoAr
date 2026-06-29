/**
 * iOS & iPadOS 26 design system — class compositions for ArvoliO.
 * Reference Figma kit: https://www.figma.com/community/file/1527721578857867021/ios-and-ipados-26
 *
 * Liquid Glass → navigation, toolbars, tab bars, menus, floating controls.
 * Content (lists, messages, media) → solid backgrounds, no glass.
 */

const glassInsetHighlight = 'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'

const glassBase =
  'liquid-glass border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-xl backdrop-saturate-[1.8]'

export const glassRegularClass = `${glassBase} ${glassInsetHighlight} shadow-[var(--ios-glass-shadow)]`

export const navGlassClass = `liquid-glass liquid-glass-circle rounded-full ${glassBase} backdrop-blur-lg backdrop-saturate-[1.6] ${glassInsetHighlight} shadow-[var(--ios-glass-shadow)]`

export const navGlassInnerClass =
  'rounded-full border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg-inner)] backdrop-blur-sm backdrop-saturate-[1.5] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.08)]'

export const navGlassMenuClass = `${glassRegularClass} liquid-glass-rounded`

/** @deprecated Use navGlassMenuClass */
export const headerMenuGlassClass = navGlassMenuClass

export const glassNavBarClass =
  'relative z-20 flex items-center gap-2 px-4 py-2.5 border-b border-[var(--ios-separator)] bg-[var(--ios-glass-bg)] backdrop-blur-xl backdrop-saturate-[1.8]'

/** Transparent bar — glass lives on child bubbles/buttons (stories, chat) */
export const liquidGlassNavBarClass =
  'relative z-20 flex items-center gap-2 px-4 py-2.5 w-full bg-transparent'

export const glassInputBarClass =
  'border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg-input)] backdrop-blur-md shadow-[var(--ios-glass-shadow)]'

export const chatFloatingGlassClass = `liquid-glass border border-[var(--ios-glass-border)] bg-transparent backdrop-blur-xl backdrop-saturate-[1.8] ${glassInsetHighlight}`

export const chatFloatingInputBarClass = `${chatFloatingGlassClass} liquid-glass-capsule backdrop-blur-md`

export const chatFloatingPanelClass = `${chatFloatingGlassClass} liquid-glass-rounded backdrop-blur-md`

export const chatFloatingButtonClass = `${chatFloatingGlassClass} liquid-glass-circle h-11 w-11 shrink-0 flex items-center justify-center rounded-full transition-colors`

export const glassActionButtonClass = `${glassInputBarClass} h-11 w-11 shrink-0 flex items-center justify-center rounded-full transition-colors`

export const notificationGlassClass =
  'rounded-full border border-[var(--ios-glass-border)] bg-black/45 backdrop-blur-lg shadow-[var(--ios-glass-shadow)]'

export const modalGlassClass =
  'rounded-[var(--ios-radius-xl)] border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-2xl backdrop-saturate-[1.8] shadow-[var(--ios-glass-shadow-modal)]'

export const modalScrimClass = 'bg-black/40 backdrop-blur-md'

export const dropdownMenuClass =
  'w-44 py-1 rounded-[var(--ios-radius-lg)] overflow-hidden liquid-glass liquid-glass-rounded'

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

/** iOS typography scale — use these instead of ad-hoc text-* / font-* on screens */
export const typoLargeTitleClass = pageTitleClass
export const typoTitle2Class = 'text-[22px] font-bold leading-tight text-[var(--ios-label)]'
export const typoTitle3Class = 'text-[20px] font-semibold text-[var(--ios-label)]'
export const typoHeadlineClass = 'text-[17px] font-semibold text-[var(--ios-label)]'
export const typoBodyClass = 'text-[17px] text-[var(--ios-label)] leading-relaxed'
export const typoSubheadClass = 'text-[15px] text-[var(--ios-label-secondary)]'
export const typoFootnoteClass = 'text-[13px] text-[var(--ios-label-secondary)]'
export const typoCaptionClass = 'text-[13px] font-medium text-[var(--ios-label-secondary)]'

export const sectionLabelClass = `${typoCaptionClass} mb-2 px-[var(--ios-page-x-lg)]`
export const insetCardClass =
  'rounded-[var(--ios-radius-xl)] border border-white/10 bg-white/[0.03]'
export const insetCardOuterClass = `mx-4 ${insetCardClass}`
export const subpageHeaderClass =
  'flex items-center gap-3 px-[var(--ios-page-x-lg)] pt-[max(1rem,var(--ios-safe-top))] pb-4 shrink-0'
export const subpageTitleClass = 'text-[17px] font-medium text-[var(--ios-label)] flex-1 truncate'
export const fieldLabelClass = `${typoSubheadClass} mb-2 block`
export const linkActionClass =
  'text-[15px] font-medium text-[var(--ios-blue)] hover:text-blue-400 transition-colors'
export const btnSecondarySmClass =
  'px-4 py-2 min-h-[36px] rounded-full text-[15px] font-medium bg-white/10 hover:bg-white/15 border border-white/10 transition-colors'

export const listRowClass =
  'w-full flex items-center gap-3 px-[var(--ios-page-x-lg)] py-3.5 transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]'

export const settingsRowClass = `${listRowClass} w-full text-left border-b border-white/10 last:border-b-0 py-4 min-h-[60px]`

export const ICON_TONE_CLASSES = {
  blue: 'bg-blue-500/15 text-blue-400',
  green: 'bg-green-500/15 text-green-400',
  violet: 'bg-violet-500/15 text-violet-400',
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
}

export const iconTileClass = 'w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0'

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

export const profileActionBtnClass =
  'flex-1 min-w-0 h-14 flex items-center justify-center rounded-[var(--ios-radius-md)] bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition-colors'

export const contextMenuMotion = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.08 } },
  transition: { duration: 0.15 },
}

/** Optional class for non-button tap targets */
export const tapScaleClass = 'tap-scale'

/** Story viewer — Liquid Glass overlays on gradient story canvas */
export const storyGlassBlur = `${glassBase} ${glassInsetHighlight}`

export const storyGlassButtonClass = `${storyGlassBlur} liquid-glass-circle p-2.5 rounded-full flex items-center justify-center text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-40`

export const storyGlassPillClass = `${storyGlassBlur} liquid-glass-pill rounded-full px-4 py-2.5 flex items-center gap-2 text-white transition-all hover:brightness-110 active:scale-[0.98]`

export const storyGlassInputClass = `${storyGlassBlur} rounded-full`

export const storyGlassSheetClass = `rounded-t-[var(--ios-radius-xl)] border border-b-0 border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-2xl backdrop-saturate-[1.8] shadow-[var(--ios-glass-shadow-modal)]`

/** Watchers list — solid sheet, no extra backdrop blur (story already has glass UI behind) */
export const storyWatchersScrimClass = 'absolute inset-0 z-[35] bg-black/55 cursor-default'
export const storyWatchersSheetClass =
  'absolute inset-x-0 bottom-0 z-40 max-h-[50vh] rounded-t-[var(--ios-radius-xl)] border border-b-0 border-white/10 bg-[rgb(18,18,20)] shadow-[0_-12px_40px_rgba(0,0,0,0.5)]'

export const storyAuthorBubbleClass = `${storyGlassBlur} liquid-glass-pill rounded-full pl-1 pr-3 py-1 flex items-center gap-4 min-w-0 max-w-[58%] transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer`

export const storyGlassRowClass =
  'rounded-xl border border-white/5 bg-white/[0.06] backdrop-blur-lg backdrop-saturate-150 hover:bg-white/[0.1] active:bg-white/[0.14] transition-colors'

export const storyProgressTrackClass = 'bg-white/15 backdrop-blur-md backdrop-saturate-150'
export const storyProgressFillClass = 'bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.4)]'

export const storyPausedBadgeClass = `${storyGlassBlur} px-4 py-1.5 text-xs font-medium text-white/90 rounded-full`

export const storyRingInnerClass =
  'rounded-full overflow-hidden bg-white/10 backdrop-blur-lg backdrop-saturate-150 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
