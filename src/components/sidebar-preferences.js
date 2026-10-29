'use client'

import { useEffect, useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowLeftIcon, CheckIcon, ChevronRightIcon, LanguagesIcon, Icon, SunMoonIcon } from 'lucide-react'
import { LOCALES, THEMES } from '@/lib/i18n.mjs'
import { usePreferences } from '@/components/preferences'

const MENU_CLASS =
  'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-gray-200/80 bg-white p-1.5 text-sm text-gray-900 shadow-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
const ROW_CLASS =
  'flex cursor-default select-none items-center gap-2 rounded-md px-2 outline-none data-[highlighted]:bg-gray-100 data-[state=open]:bg-gray-100 dark:data-[highlighted]:bg-zinc-800 dark:data-[state=open]:bg-zinc-800'
const CASCADE_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

export function SidebarPreferences() {
  const { locale, theme, changeLocale, changeTheme, t } = usePreferences()
  const triggerRef = useRef(null)
  const contentRef = useRef(null)
  const categoryRefs = useRef({})
  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(true)
  const [portalContainer, setPortalContainer] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [inlineGroup, setInlineGroup] = useState(null)

  function onOpenChange(nextOpen) {
    if (nextOpen) {
      setCompact(!window.matchMedia(CASCADE_QUERY).matches)
      // Keep portals inside the mobile drawer's focus scope, outside its scrolling region.
      setPortalContainer(triggerRef.current?.closest('[role="dialog"]') ?? document.body)
    }
    setActiveGroup(null)
    setInlineGroup(null)
    setOpen(nextOpen)
  }

  useEffect(() => {
    if (!open) return
    const media = window.matchMedia(CASCADE_QUERY)
    const updateMode = () => {
      setCompact(!media.matches)
      setOpen(false)
      setActiveGroup(null)
      setInlineGroup(null)
    }
    media.addEventListener('change', updateMode)
    return () => media.removeEventListener('change', updateMode)
  }, [open])

  useEffect(() => {
    if (inlineGroup) contentRef.current?.querySelector('[role="menuitemradio"][data-state="checked"]')?.focus()
  }, [inlineGroup])

  function returnToCategories() {
    const previousGroup = inlineGroup
    setInlineGroup(null)
    requestAnimationFrame(() => categoryRefs.current[previousGroup]?.focus())
  }

  function selectOption(group, value) {
    onOpenChange(false)
    if (group === 'language') {
      if (value !== locale) changeLocale(value)
    } else {
      changeTheme(value)
    }
  }

  function options(group) {
    const items = group === 'language' ? Object.entries(LOCALES) : THEMES.map((value) => [value, t(value)])
    return (
      <DropdownMenu.RadioGroup value={group === 'language' ? locale : theme} aria-label={t(group)}>
        {items.map(([value, label]) => (
          <DropdownMenu.RadioItem
            key={value}
            value={value}
            textValue={label}
            onSelect={() => selectOption(group, value)}
            className={`${ROW_CLASS} h-10 justify-between`}
          >
            <span lang={group === 'language' ? value : undefined}>{label}</span>
            <DropdownMenu.ItemIndicator>
              <CheckIcon size={16} aria-hidden="true" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    )
  }

  function categoryContent(group) {
    const CategoryIcon = group === 'language' ? LanguagesIcon : SunMoonIcon
    return (
      <>
        <CategoryIcon size={16} aria-hidden="true" className="shrink-0 text-gray-500 dark:text-zinc-400" />
        <span>{t(group)}</span>
        <span className="ml-auto text-xs text-gray-500 dark:text-zinc-400">
          {group === 'language' ? LOCALES[locale] : t(theme)}
        </span>
        <ChevronRightIcon size={14} aria-hidden="true" className="shrink-0 text-gray-500 dark:text-zinc-400" />
      </>
    )
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={t('preferences')}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        >
          <Icon
            size={18}
            aria-hidden="true"
            iconNode={[
              ['path', { d: 'M3 7h9m6 0h3M3 17h3m6 0h9', key: 'lines' }],
              ['circle', { cx: 15, cy: 7, r: 3, key: 'top' }],
              ['circle', { cx: 9, cy: 17, r: 3, key: 'bottom' }]
            ]}
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalContainer}>
        <DropdownMenu.Content
          ref={contentRef}
          aria-label={t('preferences')}
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          sticky="always"
          loop
          className={`${MENU_CLASS} w-60`}
          onEscapeKeyDown={(event) => {
            // Escape unwinds one level at a time, including inside the mobile drawer.
            event.stopPropagation()
            if (inlineGroup) {
              event.preventDefault()
              returnToCategories()
            } else if (activeGroup) {
              event.preventDefault()
              categoryRefs.current[activeGroup]?.focus()
              setActiveGroup(null)
            }
          }}
          onKeyDown={(event) => {
            if (inlineGroup && event.key === 'ArrowLeft') {
              event.preventDefault()
              returnToCategories()
            }
          }}
        >
          {compact && inlineGroup ? (
            <>
              <DropdownMenu.Item
                className={`${ROW_CLASS} h-10`}
                textValue={t('back')}
                onSelect={(event) => {
                  event.preventDefault()
                  returnToCategories()
                }}
              >
                <ArrowLeftIcon size={16} aria-hidden="true" />
                <span>{t('back')}</span>
              </DropdownMenu.Item>
              {options(inlineGroup)}
            </>
          ) : (
            ['language', 'appearance'].map((group) =>
              compact ? (
                <DropdownMenu.Item
                  key={group}
                  ref={(element) => {
                    categoryRefs.current[group] = element
                  }}
                  aria-haspopup="menu"
                  aria-expanded={false}
                  textValue={t(group)}
                  className={`${ROW_CLASS} h-11`}
                  onSelect={(event) => {
                    event.preventDefault()
                    setInlineGroup(group)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      setInlineGroup(group)
                    }
                  }}
                >
                  {categoryContent(group)}
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Sub
                  key={group}
                  open={activeGroup === group}
                  onOpenChange={(nextOpen) =>
                    setActiveGroup((current) => (nextOpen ? group : current === group ? null : current))
                  }
                >
                  <DropdownMenu.SubTrigger
                    ref={(element) => {
                      categoryRefs.current[group] = element
                    }}
                    textValue={t(group)}
                    className={`${ROW_CLASS} h-11`}
                  >
                    {categoryContent(group)}
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal container={portalContainer}>
                    <DropdownMenu.SubContent
                      aria-label={t(group)}
                      sideOffset={14}
                      collisionPadding={12}
                      sticky="always"
                      loop
                      className={`${MENU_CLASS} w-44`}
                      onEscapeKeyDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setActiveGroup(null)
                        categoryRefs.current[group]?.focus()
                      }}
                    >
                      {options(group)}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              )
            )
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
