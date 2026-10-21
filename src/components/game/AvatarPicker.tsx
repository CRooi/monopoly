import { AVATARS } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { cn } from '@/lib/utils'

export function AvatarPicker({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {AVATARS.map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={cn('flex aspect-square items-center justify-center rounded-full transition', i === value ? 'ring-3 ring-brick' : 'opacity-75 hover:opacity-100')}
        >
          <Avatar index={i} size={null} className="size-full border-[1.5px]" />
        </button>
      ))}
    </div>
  )
}
