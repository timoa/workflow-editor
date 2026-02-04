import { HiOutlineUpload, HiOutlineRefresh, HiOutlineClock, HiOutlinePlay } from 'react-icons/hi'
import { formatTrigger } from '@/lib/triggerUtils'
import type { ParsedTrigger } from '@/lib/triggerUtils'

const iconClass = 'shrink-0 text-purple-700 dark:text-purple-300'

function getEventIcon(event: string): React.ReactNode {
  const e = event.toLowerCase()
  if (e === 'push') return <HiOutlineUpload className={iconClass} size={14} />
  if (e === 'pull_request' || e === 'pull_request_target') return <HiOutlineRefresh className={iconClass} size={14} />
  if (e === 'schedule') return <HiOutlineClock className={iconClass} size={14} />
  return <HiOutlinePlay className={iconClass} size={14} />
}

/**
 * Returns one badge entry per filter (branches, tags, cron, types) so the diagram shows e.g. "master" and "v*" separately.
 */
function getTriggerBadges(trigger: ParsedTrigger): { icon: React.ReactNode; label: string }[] {
  const { event, config } = trigger
  const icon = getEventIcon(event)
  const badges: { icon: React.ReactNode; label: string }[] = []

  if (config.branches && config.branches.length > 0) {
    badges.push({
      icon,
      label: config.branches.length === 1 ? config.branches[0]! : config.branches.join(', '),
    })
  }
  if (config.tags && config.tags.length > 0) {
    badges.push({
      icon,
      label: config.tags.length === 1 ? config.tags[0]! : config.tags.join(', '),
    })
  }
  if (config.cron) {
    badges.push({ icon, label: config.cron })
  }
  if (config.types && config.types.length > 0) {
    badges.push({
      icon,
      label: config.types.length === 1 ? config.types[0]! : config.types.join(', '),
    })
  }
  if (badges.length === 0) {
    badges.push({ icon, label: event })
  }

  return badges
}

interface TriggerBadgeProps {
  trigger: ParsedTrigger
  className?: string
}

/** Renders all badges for one trigger (event + branches, event + tags, cron, etc.). */
export function TriggerBadge({ trigger, className = '' }: TriggerBadgeProps) {
  const badges = getTriggerBadges(trigger)
  const fullTitle = formatTrigger(trigger)
  return (
    <>
      {badges.map(({ icon, label }, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-xs font-medium text-purple-800 dark:text-purple-200 ${className}`}
          title={fullTitle}
        >
          {icon}
          <span>{label}</span>
        </span>
      ))}
    </>
  )
}
