import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo } from "react";
import { speciesData } from "../data/migrationData";
import { dayToMonthLabel, monthLabels } from "../lib/calendar";
import { isDayInSeasonWindow } from "../lib/migration";
import type { PlaybackSpeed } from "../state/useMigrationStore";
import { useMigrationStore } from "../state/useMigrationStore";
import type { SeasonalWindow } from "../types/migration";

const speeds: PlaybackSpeed[] = ["auto", 0.5, 1, 2, 4];

const hexToRgba = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const splitWindow = ({ startDay, endDay }: SeasonalWindow) =>
  startDay <= endDay
    ? [{ start: startDay, end: endDay }]
    : [
        { start: startDay, end: 365 },
        { start: 1, end: endDay },
      ];

const hasActiveMigration = (selectedSpeciesIds: string[], dayOfYear: number) =>
  speciesData
    .filter((species) => selectedSpeciesIds.includes(species.id))
    .some((species) => species.corridors.some((corridor) => isDayInSeasonWindow(corridor.seasonalWindow, dayOfYear)));

const effectiveSpeed = (speed: PlaybackSpeed, selectedSpeciesIds: string[], dayOfYear: number) => {
  if (speed !== "auto") return speed;
  return hasActiveMigration(selectedSpeciesIds, dayOfYear) ? 0.5 : 4;
};

const Timeline = () => {
  const { dayOfYear, isPlaying, selectedSpeciesIds, speed, setDayOfYear, setIsPlaying, setSpeed } = useMigrationStore();

  const migrationBands = useMemo(
    () =>
      speciesData
        .filter((species) => selectedSpeciesIds.includes(species.id))
        .map((species) => ({
          id: species.id,
          color: species.color,
          label: species.commonName,
          segments: species.corridors.flatMap((corridor) =>
            splitWindow(corridor.seasonalWindow).map((segment, segmentIndex) => ({
              id: `${corridor.id}-${segmentIndex}`,
              start: segment.start,
              end: segment.end,
              active: isDayInSeasonWindow(corridor.seasonalWindow, dayOfYear),
              label: `${species.commonName}: ${corridor.originRegion} to ${corridor.destinationRegion}`,
            })),
          ),
        })),
    [dayOfYear, selectedSpeciesIds],
  );

  useEffect(() => {
    if (!isPlaying) return;

    let frame = 0;
    let previous = performance.now();

    const tick = (time: number) => {
      const delta = time - previous;
      previous = time;
      useMigrationStore.setState((state) => {
        const multiplier = effectiveSpeed(state.speed, state.selectedSpeciesIds, state.dayOfYear);
        const next = state.dayOfYear + (delta / 1000) * 8 * multiplier;
        return { dayOfYear: next > 365 ? 1 + (next % 365) : next };
      });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  return (
    <footer className="timeline-panel">
      <div className="transport">
        <button className="round-button" type="button" onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="round-button secondary" type="button" onClick={() => setDayOfYear(1)} title="Restart year">
          <RotateCcw size={16} />
        </button>
        <div className="date-readout">
          <span>{dayToMonthLabel(dayOfYear)}</span>
          <small>Day {Math.round(dayOfYear)}</small>
        </div>
      </div>

      <div className="timeline-track">
        <div className="month-row">
          {monthLabels.map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>
        <input
          aria-label="Migration day of year"
          min="1"
          max="365"
          step="0.1"
          type="range"
          value={dayOfYear}
          onInput={(event) => setDayOfYear(Number(event.currentTarget.value))}
          onChange={(event) => setDayOfYear(Number(event.target.value))}
        />
        <div className="migration-bands" aria-label="Migration periods">
          {migrationBands.map((lane) => (
            <div className="migration-band-lane" key={lane.id} title={lane.label}>
              {lane.segments.map((band) => {
                const left = ((band.start - 1) / 364) * 100;
                const width = ((band.end - band.start + 1) / 365) * 100;

                return (
                  <span
                    className={`migration-band${band.active ? " active" : ""}`}
                    key={band.id}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: hexToRgba(lane.color, band.active ? 0.84 : 0.3),
                      boxShadow: band.active ? `0 0 16px ${hexToRgba(lane.color, 0.55)}` : "none",
                    }}
                    title={band.label}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="speed-control" aria-label="Playback speed">
        {speeds.map((item) => (
          <button className={speed === item ? "active" : ""} key={item} type="button" onClick={() => setSpeed(item)}>
            {item === "auto" ? "Auto" : `${item}x`}
          </button>
        ))}
      </div>
    </footer>
  );
};

export default Timeline;
