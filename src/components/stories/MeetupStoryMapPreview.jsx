import { useEffect, useMemo, useState } from 'react'
import { getMeetupMapTiles, preloadMeetupMapTiles } from '../../utils/storyHelpers'

export default function MeetupStoryMapPreview({
  lat,
  lng,
  placeName = '',
  emoji = '📍',
  className = '',
}) {
  const mapView = useMemo(() => getMeetupMapTiles(lat, lng), [lat, lng])
  const [ready, setReady] = useState(false)
  const safeName = placeName.trim().slice(0, 28)

  useEffect(() => {
    setReady(false)
    const centerTile = mapView.tiles[4]
    preloadMeetupMapTiles(lat, lng)

    const probe = new Image()
    const markReady = () => setReady(true)
    probe.onload = markReady
    probe.src = centerTile.url
    if (probe.complete) markReady()
  }, [lat, lng, mapView.tiles])

  return (
    <div
      className={`relative h-[9.5rem] w-full overflow-hidden rounded-[var(--ios-radius-lg)] border border-white/15 bg-[#d9d2c6] ${className}`}
      aria-hidden
    >
      {!ready ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/10 via-white/5 to-white/10" />
      ) : null}

      <div
        className={`absolute grid grid-cols-3 grid-rows-3 transition-opacity duration-200 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          width: mapView.gridSize,
          height: mapView.gridSize,
          left: `calc(50% - ${mapView.pinGridX}px)`,
          top: `calc(50% - ${mapView.pinGridY}px)`,
        }}
      >
        {mapView.tiles.map((tile, index) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            width={256}
            height={256}
            loading="eager"
            decoding="async"
            draggable={false}
            className="block h-full w-full"
            onLoad={index === 4 ? () => setReady(true) : undefined}
          />
        ))}
      </div>

      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity duration-200 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="inline-flex max-w-[11.5rem] items-center gap-2 rounded-full border-2 border-[var(--ios-blue)] bg-[var(--ios-bg-secondary)] px-2.5 py-1.5 shadow-[0_0_0_3px_color-mix(in_srgb,var(--ios-blue)_35%,transparent),0_2px_12px_rgba(0,0,0,0.4)]">
          <span className="shrink-0 text-lg leading-none" aria-hidden>
            {emoji}
          </span>
          {safeName ? (
            <span className="truncate text-[13px] font-semibold text-white">{safeName}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
