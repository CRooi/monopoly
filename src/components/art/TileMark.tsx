import { Droplets, Plane, TrainFront, Zap } from 'lucide-react'
import { GROUP_COLOR, type Tile } from '@shared/types'
import { CityBadge } from './CityBadge'
import { Flag } from './Flag'

/** 地产的标记：国家用国旗，城市用简称印章，交通线路用飞机或高铁，公用事业用电和水 */
export function TileMark({ tile, size }: { tile: Tile; size: number }) {
  switch (tile.kind) {
    case 'country':
      if (tile.iso) return <Flag iso={tile.iso} className="shrink-0" style={{ width: size }} />
      return <CityBadge badge={tile.badge ?? tile.name[0]!} color={GROUP_COLOR[tile.group]} className="shrink-0" style={{ width: size * 0.82, fontSize: size * 0.46 }} />
    case 'airline':
      return tile.name.includes('高铁') ? (
        <TrainFront className="shrink-0 text-[#d63c2f]" style={{ width: size * 0.75, height: size * 0.75 }} />
      ) : (
        <Plane className="shrink-0 text-[#1c63c9]" style={{ width: size * 0.75, height: size * 0.75 }} />
      )
    case 'utility':
      return tile.name.includes('电') ? (
        <Zap className="shrink-0 fill-gold text-ink" style={{ width: size * 0.75, height: size * 0.75 }} />
      ) : (
        <Droplets className="shrink-0 fill-[#7cc8f0] text-[#1c63c9]" style={{ width: size * 0.75, height: size * 0.75 }} />
      )
    default:
      return null
  }
}
