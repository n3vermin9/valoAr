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

const navGlassSurface =
  'border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-xl backdrop-saturate-[1.8]'

export const glassRegularClass = `${glassBase} ${glassInsetHighlight} shadow-[var(--ios-glass-shadow)]`

export const navGlassClass = `nav-glass-shell liquid-glass-circle rounded-full ${navGlassSurface} backdrop-blur-lg backdrop-saturate-[1.6] ${glassInsetHighlight} shadow-[var(--ios-glass-shadow)]`

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

export const chatFloatingButtonClass = `${chatFloatingGlassClass} liquid-glass-circle h-12 w-12 shrink-0 flex items-center justify-center rounded-full transition-colors`

export const photoOverlayButtonClass =
  'liquid-glass liquid-glass-circle h-12 w-12 shrink-0 flex items-center justify-center rounded-full transition-colors border border-white/20 bg-black/55 backdrop-blur-xl text-white shadow-[0_2px_14px_rgba(0,0,0,0.42)] hover:bg-black/65 active:scale-95'

export const chatMessageTextClass =
  'text-[16px] leading-[1.35] break-words [overflow-wrap:anywhere] min-w-0'
export const chatBubblePadClass = 'px-3.5 py-2'
export const chatComposerInputClass =
  'ios-emoji-field flex-1 min-w-0 py-2.5 pr-1 bg-transparent outline-none text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)] resize-none overflow-y-auto whitespace-pre-wrap break-words text-[16px] leading-[1.25] max-h-36'

export const glassActionButtonClass = `${glassInputBarClass} h-11 w-11 shrink-0 flex items-center justify-center rounded-full transition-colors`

export const notificationGlassClass =
  'rounded-full border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-lg shadow-[var(--ios-glass-shadow)]'

export const modalGlassClass =
  'rounded-[var(--ios-radius-xl)] border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-2xl backdrop-saturate-[1.8] shadow-[var(--ios-glass-shadow-modal)]'

export const modalScrimClass = 'bg-[var(--ios-modal-scrim)] backdrop-blur-md'

export const dropdownMenuClass =
  'w-44 py-1 rounded-[var(--ios-radius-lg)] overflow-hidden liquid-glass liquid-glass-rounded'

export const dropdownMenuItemClass =
  'w-full px-3.5 py-2 text-left text-[15px] font-medium transition-colors duration-75 text-[var(--ios-label)] hover:bg-[var(--ios-hover-fill)] active:bg-[var(--ios-fill-tertiary)]'

export const dropdownMenuItemDangerClass =
  'w-full px-3.5 py-2 text-left text-[15px] font-medium transition-colors duration-75 text-[var(--ios-red)] hover:bg-red-500/10 active:bg-red-500/20'

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
export const typoTitle3Class = 'text-[20px] font-medium text-[var(--ios-label)]'
export const typoHeadlineClass = 'text-[17px] font-medium text-[var(--ios-label)]'
export const typoBodyClass = 'text-[17px] text-[var(--ios-label)] leading-relaxed'
export const typoSubheadClass = 'text-[15px] text-[var(--ios-label-secondary)]'
export const typoFootnoteClass = 'text-[13px] text-[var(--ios-label-secondary)]'
export const typoCaptionClass = 'text-[13px] font-medium text-[var(--ios-label-secondary)]'

export const sectionLabelClass = `${typoCaptionClass} mb-2 px-[var(--ios-page-x-lg)]`
export const insetCardClass =
  'rounded-[var(--ios-radius-xl)] border border-[var(--ios-hairline)] bg-[var(--ios-bg-secondary)]'
export const insetCardOuterClass = `mx-4 ${insetCardClass}`
export const subpageHeaderClass =
  'flex items-center gap-3 px-[var(--ios-page-x-lg)] pt-[max(1rem,var(--ios-safe-top))] pb-4 shrink-0'
export const subpageTitleClass = 'text-[17px] font-medium text-[var(--ios-label)] flex-1 truncate'
export const fieldLabelClass = `${typoSubheadClass} mb-2 block`

const compactInputBase =
  'w-full min-h-[var(--ios-control-min)] bg-[var(--ios-fill-tertiary)] rounded-full border border-[var(--ios-hairline)] text-[15px] leading-none text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)]'

export const compactInputClass = `${compactInputBase} px-4 outline-none focus:border-[var(--ios-blue)]`

export const compactInputAffixClass = `${compactInputBase} flex items-center outline-none focus-within:border-[var(--ios-blue)]`

export const compactInputInnerClass =
  'flex-1 min-w-0 h-[var(--ios-control-min)] pr-4 bg-transparent outline-none text-[15px] leading-none'

/** Compact search pill (iOS ~36px) — use in fullscreen Cap / no Safari chrome. */
export const searchFieldShellClass =
  'flex items-center gap-2 h-9 min-h-9 max-h-9 rounded-full border border-[var(--ios-hairline)] bg-[var(--ios-fill-tertiary)] px-3'

export const searchFieldInputClass =
  'flex-1 min-w-0 h-full bg-transparent outline-none text-[15px] leading-none text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)] appearance-none'

export const compactTextareaClass =
  'w-full min-h-[56px] px-4 py-2.5 bg-[var(--ios-fill-tertiary)] rounded-[var(--ios-radius-xl)] border border-[var(--ios-hairline)] outline-none focus:border-[var(--ios-blue)] resize-y text-[15px] leading-snug text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)]'
export const linkActionClass =
  'text-[15px] font-medium text-[var(--ios-blue)] hover:text-blue-400 transition-colors'
export const dangerLinkActionClass =
  'text-[15px] font-medium text-[var(--ios-red)] hover:opacity-75 transition-opacity disabled:opacity-50'
export const btnSecondarySmClass =
  'px-4 py-2 min-h-[36px] rounded-full text-[15px] font-medium bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] border border-[var(--ios-hairline)] text-[var(--ios-label)] transition-colors'

export const listRowClass =
  'w-full flex items-center gap-3 px-[var(--ios-page-x-lg)] py-3.5 transition-colors hover:bg-[var(--ios-hover-fill)] active:bg-[var(--ios-fill-tertiary)]'

export const settingsRowClass = `${listRowClass} w-full text-left border-b border-[var(--ios-hairline)] last:border-b-0 py-4 min-h-[60px]`

export const ICON_TONE_CLASSES = {
  blue: 'bg-blue-500/15 text-blue-400',
  green: 'bg-green-500/15 text-green-400',
  violet: 'bg-violet-500/15 text-violet-400',
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
}

export const iconTileClass = 'w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0'

export const listRowSelectedClass = 'bg-[var(--ios-hover-fill)]'

export const insetListClass =
  'mx-4 rounded-[var(--ios-radius-xl)] overflow-hidden border border-[var(--ios-separator)] bg-[var(--ios-bg-secondary)]'

export const textFieldClass =
  'w-full px-5 py-3 min-h-[var(--ios-control-min)] bg-[var(--ios-fill-tertiary)] rounded-full border border-[var(--ios-glass-border)] text-[17px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)] outline-none focus:border-[var(--ios-blue)] transition-colors'

export const btnFilledClass =
  'inline-flex items-center justify-center h-11 px-5 rounded-full text-[15px] font-medium leading-none bg-[var(--ios-blue)] text-white hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50'

export const btnFilledDangerClass =
  'inline-flex items-center justify-center h-11 px-5 rounded-full text-[15px] font-medium leading-none bg-[var(--ios-red)] text-white hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50'

export const btnBorderedClass =
  'inline-flex items-center justify-center h-11 px-5 rounded-full text-[15px] font-medium leading-none border border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg-input)] backdrop-blur-md text-[var(--ios-label)] hover:bg-[var(--ios-hover-fill)] transition-colors disabled:opacity-50'

export const btnPlainClass =
  'inline-flex items-center justify-center h-10 px-4 rounded-full text-[15px] font-medium leading-none text-[var(--ios-blue)] hover:bg-[var(--ios-hover-fill)] active:bg-[var(--ios-fill-tertiary)] transition-colors disabled:opacity-50'

export const iconButtonClass =
  'p-2 rounded-full text-[var(--ios-label)] hover:bg-[var(--ios-hover-fill)] active:bg-[var(--ios-fill-tertiary)] transition-colors'

export const profileActionBtnClass =
  'flex-1 min-w-0 h-14 flex items-center justify-center rounded-[var(--ios-radius-md)] bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] border border-[var(--ios-hairline)] text-[var(--ios-label)] disabled:opacity-50 transition-colors'

export const segmentedControlClass =
  'flex rounded-full border border-[var(--ios-glass-border)] bg-[var(--ios-fill-tertiary)] p-1'

export const segmentedItemClass =
  'flex-1 py-2 text-center text-sm font-medium rounded-full transition-colors text-[var(--ios-label-secondary)] hover:text-[var(--ios-label)]'

export const segmentedItemActiveClass =
  'flex-1 py-2 text-center text-sm font-medium rounded-full transition-colors bg-[var(--ios-blue)] text-white shadow-sm'

export const contextMenuMotion = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.08 } },
  transition: { duration: 0.15 },
}

export const pageSwitchEase = [0.32, 0.72, 0, 1]
export const pageSwitchTransition = { duration: 0.28, ease: pageSwitchEase }
export const pageSwitchExitTransition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] }

export const pageSwitchMotion = {
  initial: { scale: 1.05, opacity: 0.92 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 1, opacity: 0, transition: pageSwitchExitTransition },
  transition: pageSwitchTransition,
}

/**
 * Chat room — opacity only so fixed chrome isn't trapped in a transform containing block.
 * Enter is a full fade so opening a chat still reads as a page transition.
 */
export const chatPageSwitchMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } },
  transition: { duration: 0.28, ease: pageSwitchEase },
}

export const pageSwitchVariants = {
  enter: { scale: 1.05, opacity: 0.92 },
  center: { scale: 1, opacity: 1 },
  exit: { scale: 1, opacity: 0 },
}

/** Horizontal tab switch (bottom nav / segmented controls) — direction is +1 / -1. */
export const tabSlideTransition = { duration: 0.28, ease: pageSwitchEase }
export const tabSlideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 28 : -28,
    opacity: 0,
    zIndex: 10,
  }),
  center: { x: 0, opacity: 1, zIndex: 10 },
  exit: (direction) => ({
    x: direction > 0 ? -28 : 28,
    opacity: 0,
    zIndex: 0,
  }),
}

/** iOS push — drill-in pages enter from the trailing edge and leave the same way. */
export const pushPageMotion = {
  initial: { x: '100%' },
  animate: { x: '0%' },
  exit: { x: '100%', transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } },
  transition: { duration: 0.34, ease: pageSwitchEase },
}

/** Header gradient — geometry and gradient live in index.css. */
export const chatRoomTopScrimClass = 'chat-room-top-scrim fixed inset-x-0 pointer-events-none'

/** Always-black fade at the top of photo heroes (status-bar contrast; never theme-white). */
export const photoHeroTopScrimClass =
  'absolute inset-x-0 top-0 z-[10] pointer-events-none bg-gradient-to-b from-black/75 via-black/40 to-transparent'

/** Title overlaid on the photo hero bottom gradient — stays white in both themes. */
export const photoHeroTitleClass =
  'text-[22px] font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]'

/** Square profile/group hero — crops non-square photos to center fill */
export const photoHeroFrameClass = 'relative w-full aspect-square overflow-hidden bg-black'
export const photoHeroFullscreenFrameClass =
  'relative aspect-square w-[min(100vw,100vh)] max-w-full overflow-hidden bg-black'
export const photoHeroImageClass =
  'absolute inset-0 block h-full w-full object-cover object-center'

/** Message list — fixed to viewport so WKWebView pan does not shift the header. */
export const chatRoomMessagesClass =
  'chat-room-messages-pane fixed inset-x-0 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y px-[var(--chat-room-page-x)]'

/** Bottom-anchored message column (newest at bottom, scroll up for history). */
export const chatRoomMessagesInnerClass = 'chat-room-messages-inner min-h-full flex flex-col'
export const chatRoomMessagesStackClass = 'chat-room-messages-stack flex flex-1 flex-col justify-end pb-0'

/** Composer / typing / join bar dock. */
export const chatRoomComposerDockClass =
  'chat-room-keyboard-lift chat-room-composer-dock fixed inset-x-0 z-20 pointer-events-none'

export const chatRoomScrollFabClass =
  'chat-room-keyboard-lift chat-room-scroll-fab fixed right-4 z-10'

export const chatRoomHeaderClass =
  'chat-room-header-pinned fixed inset-x-0 z-40 !bg-transparent pointer-events-none'

/** Optional class for non-button tap targets */
export const tapScaleClass = 'tap-scale'

/** Story viewer — Liquid Glass overlays on gradient story canvas */
export const storyGlassBlur = `${glassBase} ${glassInsetHighlight}`

/**
 * Frosted chrome over a story gradient. Do not use `liquid-glass` / clip-path here —
 * isolation + clip-path break backdrop sampling, so controls stay stuck on a stale tint
 * instead of picking up the current story color.
 */
const storyChromeSurface = `border border-white/20 bg-white/12 backdrop-blur-xl backdrop-saturate-[1.8] ${glassInsetHighlight}`

export const storyGlassButtonClass = `${storyChromeSurface} rounded-full p-2.5 flex items-center justify-center text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-40`

export const storyGlassPillClass = `${storyChromeSurface} rounded-full px-4 py-2.5 flex items-center gap-2 text-white transition-all hover:brightness-110 active:scale-[0.98]`

export const storyGlassInputClass = `${storyChromeSurface} rounded-full`

export const storyGlassSheetClass = `rounded-t-[var(--ios-radius-xl)] border border-b-0 border-[var(--ios-glass-border)] bg-[var(--ios-glass-bg)] backdrop-blur-2xl backdrop-saturate-[1.8] shadow-[var(--ios-glass-shadow-modal)]`

/** Watchers list — solid sheet; scrim is parent-owned (single fade with sheet open). */
export const storyWatchersScrimClass = 'absolute inset-0 z-0 bg-black/60 cursor-default'
export const storyWatchersSheetClass =
  'absolute inset-x-0 bottom-0 z-10 max-h-[50vh] rounded-t-[var(--ios-radius-xl)] border border-b-0 border-white/10 bg-[rgb(18,18,20)] shadow-[0_-12px_40px_rgba(0,0,0,0.5)]'

export const storyAuthorBubbleClass = `${storyChromeSurface} rounded-full pl-1 pr-3 py-1 flex items-center gap-4 min-w-0 max-w-[58%] transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer`

export const storyGlassRowClass =
  'rounded-xl border border-white/5 bg-white/[0.06] backdrop-blur-lg backdrop-saturate-150 hover:bg-white/[0.1] active:bg-white/[0.14] transition-colors'

export const storyProgressTrackClass = 'bg-white/15 backdrop-blur-md backdrop-saturate-150'
export const storyProgressFillClass = 'bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.4)]'

export const storyPausedBadgeClass = `${storyChromeSurface} px-4 py-1.5 text-xs font-medium text-white/90 rounded-full`

export const storyRingInnerClass =
  'rounded-full overflow-hidden bg-white/10 backdrop-blur-lg backdrop-saturate-150 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
