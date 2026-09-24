import { corridorSpecies } from "../lib/migration";
import { windowLabel } from "../lib/calendar";
import type { MigrationCorridor, Species } from "../types/migration";

type CorridorDetailsProps = {
  corridor: MigrationCorridor | null;
  fallbackSpecies: Species | null;
};

const shareLabel = (corridor: MigrationCorridor) => {
  const rounded = Math.round(corridor.share * 100);
  return corridor.shareType === "measured" ? `${rounded}%` : `~${rounded}%`;
};

const CorridorDetails = ({ corridor, fallbackSpecies }: CorridorDetailsProps) => {
  const species = corridorSpecies(corridor) ?? fallbackSpecies;

  if (!species) {
    return null;
  }

  return (
    <section className="detail-panel">
      <div className="detail-title">
        <span className="species-color" style={{ background: species.color, boxShadow: `0 0 18px ${species.color}` }} />
        <h2>{species.commonName}</h2>
      </div>
      <p className="latin">{species.scientificName}</p>

      {corridor ? (
        <>
          <div className="detail-grid">
            <span>Route</span>
            <strong>
              {corridor.originRegion} to {corridor.destinationRegion}
            </strong>
            <span>Share</span>
            <strong>{shareLabel(corridor)}</strong>
            <span>Period</span>
            <strong>{windowLabel(corridor.seasonalWindow.startDay, corridor.seasonalWindow.endDay)}</strong>
            <span>Type</span>
            <strong>{corridor.routeType}</strong>
          </div>
          <p className="detail-note">{corridor.notes}</p>
          <div className="source-line">
            <span>{corridor.shareType}</span>
            {corridor.sampleSize ? <span>{corridor.sampleSize} tracked</span> : null}
            <span>{corridor.source}</span>
          </div>
        </>
      ) : (
        <>
          <p className="detail-note">{species.summary}</p>
          <div className="detail-grid">
            <span>Annual distance</span>
            <strong>{species.annualDistanceKm}</strong>
            <span>Corridors</span>
            <strong>{species.corridors.length}</strong>
          </div>
        </>
      )}
    </section>
  );
};

export default CorridorDetails;
