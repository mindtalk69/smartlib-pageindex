'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

interface ExpandableTextProps {
  text: string
  maxLength?: number
  className?: string
}

interface ExpandableListProps {
  items: string[]
  badgeLabel?: string
  singularLabel?: string
  pluralLabel?: string
  className?: string
  displayMode?: 'badge' | 'badges'
  maxVisible?: number
}

export function ExpandableText({ text, maxLength = 50, className }: ExpandableTextProps) {
  const [open, setOpen] = useState(false)

  if (!text) return <span className={cn('text-muted-foreground', className)}>N/A</span>

  const shouldTruncate = text.length > maxLength
  const displayText = shouldTruncate ? text.slice(0, maxLength) + '...' : text

  if (!shouldTruncate) {
    return <span className={cn('text-muted-foreground', className)}>{text}</span>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className={cn(
            'text-left text-muted-foreground hover:text-foreground transition-colors',
            'truncate cursor-pointer',
            className
          )}
        >
          {displayText}{' '}
          <span className='text-primary font-medium'>Show more</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className='max-w-md' align='start'>
        <p className='text-sm text-muted-foreground whitespace-pre-wrap'>{text}</p>
      </PopoverContent>
    </Popover>
  )
}

export function ExpandableList({
  items,
  badgeLabel,
  singularLabel,
  pluralLabel,
  className,
  displayMode = 'badge',
  maxVisible = 3,
}: ExpandableListProps) {
  const [open, setOpen] = useState(false)
  const count = items?.length || 0

  if (count === 0) {
    return (
      <Badge variant='secondary' className={className}>
        0 {pluralLabel || 'Items'}
      </Badge>
    )
  }

  const label = count === 1 ? singularLabel || 'Item' : pluralLabel || 'Items'

  // Single item - just show a badge
  if (count === 1) {
    return (
      <Badge variant='secondary' className={className}>
        {items[0]}
      </Badge>
    )
  }

  // Display mode 'badges' - show individual badges with popover for overflow
  if (displayMode === 'badges') {
    const visibleItems = items.slice(0, maxVisible)
    const remainingCount = count - maxVisible

    if (remainingCount <= 0) {
      // Show all badges inline with flex-wrap
      return (
        <div className='flex flex-wrap gap-1 max-w-[300px]'>
          {items.map((item, index) => (
            <Badge key={index} variant='secondary' className='text-[10px] rounded-full px-2 py-0 h-4 shrink-0'>
              {item}
            </Badge>
          ))}
        </div>
      )
    }

    // Show visible badges + "+N more" badge with popover
    return (
      <div className='flex flex-wrap gap-1 max-w-[300px] items-center'>
        {visibleItems.map((item, index) => (
          <Badge key={index} variant='secondary' className='text-[10px] rounded-full px-2 py-0 h-4 shrink-0'>
            {item}
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type='button'
              className='focus:outline-none'
            >
              <Badge variant='outline' className='text-[10px] rounded-full px-2 py-0 h-4 cursor-pointer hover:bg-accent'>
                +{remainingCount} more
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent className='max-w-[250px]' align='start'>
            <div className='flex flex-col gap-1'>
              <p className='text-xs font-medium text-muted-foreground mb-1'>
                {badgeLabel || `All ${label.toLowerCase()}`}
              </p>
              <ul className='flex flex-col gap-1 max-h-[150px] overflow-y-auto'>
                {items.map((item, index) => (
                  <li key={index} className='text-sm truncate' title={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  // Original 'badge' mode - show count badge with popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='focus:outline-none'
        >
          <Badge variant='secondary' className={className}>
            {count} {label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className='max-w-[200px]' align='start'>
        <div className='flex flex-col gap-1'>
          <p className='text-xs font-medium text-muted-foreground mb-1'>{badgeLabel || label}</p>
          <ul className='flex flex-col gap-1'>
            {items.map((item, index) => (
              <li key={index} className='text-sm truncate' title={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  )
}
