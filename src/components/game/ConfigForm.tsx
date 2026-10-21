import { ROUND_OPTIONS, START_CASH_OPTIONS, type RoomConfig } from '@shared/types'
import { Switch } from '@/components/ui/switch'
import { money } from '@/lib/rules'
import { cn } from '@/lib/utils'

function Choice<T extends number>({ options, value, onChange, label, disabled }: { options: T[]; value: T; onChange: (v: T) => void; label: (v: T) => string; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o)}
          className={cn(
            'min-w-14 rounded-lg border px-2.5 py-1 text-sm font-medium tabular-nums transition disabled:cursor-default',
            o === value ? 'border-[#c99400] bg-gold text-ink shadow-[0_1px_0_#c99400]' : 'border-ink/15 bg-white text-ink/65 enabled:hover:border-ink/35',
          )}
        >
          {label(o)}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-ink/70">{label}</div>
      {children}
    </div>
  )
}

/** 房间设置：建房时填写，开局前房主可以修改 */
export function ConfigForm({ value, onChange, disabled }: { value: RoomConfig; onChange: (c: RoomConfig) => void; disabled?: boolean }) {
  const set = (patch: Partial<RoomConfig>) => onChange({ ...value, ...patch })
  return (
    <div className="space-y-4">
      <Field label="初始资金">
        <Choice options={START_CASH_OPTIONS} value={value.startCash} onChange={(v) => set({ startCash: v })} label={money} disabled={disabled} />
      </Field>
      <Field label="轮数上限">
        <Choice options={ROUND_OPTIONS} value={value.maxRounds} onChange={(v) => set({ maxRounds: v })} label={(v) => (v ? `${v} 轮` : '不限')} disabled={disabled} />
      </Field>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink/70">免费停车奖池</span>
        <Switch checked={value.parkingPot} onCheckedChange={(v) => set({ parkingPot: v })} disabled={disabled} />
      </label>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink/70">允许观战</span>
        <Switch checked={value.allowSpectators} onCheckedChange={(v) => set({ allowSpectators: v })} disabled={disabled} />
      </label>
    </div>
  )
}
