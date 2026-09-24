import { Check, ChevronDown, Circle, Search } from "lucide-react";
import { useState } from "react";
import { speciesData } from "../data/migrationData";
import { speciesById } from "../lib/migration";
import { findCorridor, useMigrationStore } from "../state/useMigrationStore";
import CorridorDetails from "./CorridorDetails";

const knownCountries = new Set([
  "Denmark",
  "Egypt",
  "France",
  "Germany",
  "Greenland",
  "India",
  "Italy",
  "New Zealand",
  "Spain",
  "Sweden",
  "Turkey",
]);

const countryNames = Array.from(
  new Set(
    speciesData.flatMap((species) => [
      ...species.locations,
      ...species.corridors.flatMap((corridor) => corridor.locations),
    ]),
  ),
)
  .filter((location) => knownCountries.has(location))
  .sort((a, b) => a.localeCompare(b));

const BirdPanel = () => {
  const [query, setQuery] = useState("");
  const [openSection, setOpenSection] = useState<"birds" | "countries">("birds");
  const {
    selectedSpeciesIds,
    inspectedSpeciesId,
    selectedCountries,
    toggleSpecies,
    selectAllSpecies,
    clearSpecies,
    setInspectedSpecies,
    toggleCountry,
    clearCountries,
  } = useMigrationStore();

  const selectedCorridor = useMigrationStore((state) => findCorridor(state.selectedCorridorId));
  const inspectedSpecies = speciesById(inspectedSpeciesId);
  const filteredSpecies = speciesData.filter((species) => {
    const value = `${species.commonName} ${species.scientificName}`.toLowerCase();
    return value.includes(query.toLowerCase());
  });
  const speciesIdsForCountry = (country: string) =>
    speciesData
      .filter(
        (species) =>
          species.locations.includes(country) ||
          species.corridors.some((corridor) => corridor.locations.includes(country)),
      )
      .map((species) => species.id);

  return (
    <div className="panel-cluster">
      <CorridorDetails corridor={selectedCorridor} fallbackSpecies={inspectedSpecies} />
      <aside className="bird-panel" onMouseLeave={() => setInspectedSpecies(null)}>
        <section className={`accordion-section ${openSection === "birds" ? "open" : ""}`}>
          <button className="accordion-trigger" type="button" onClick={() => setOpenSection(openSection === "birds" ? "countries" : "birds")}>
            <span>Birds</span>
            <ChevronDown size={16} />
          </button>
          {openSection === "birds" && (
            <div className="accordion-content">
              <div className="search-field">
                <Search size={15} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search birds" />
              </div>

              <div className="panel-actions">
                <button type="button" onClick={selectAllSpecies}>
                  Select all
                </button>
                <button type="button" onClick={clearSpecies}>
                  Clear
                </button>
              </div>

              <div className="species-list">
                {filteredSpecies.map((species) => {
                  const checked = selectedSpeciesIds.includes(species.id);
                  const inspected = inspectedSpeciesId === species.id;

                  return (
                    <button
                      className={`species-row ${checked ? "checked" : ""} ${inspected ? "inspected" : ""}`}
                      type="button"
                      key={species.id}
                      onClick={() => toggleSpecies(species.id)}
                      onMouseEnter={() => setInspectedSpecies(species.id)}
                      onFocus={() => setInspectedSpecies(species.id)}
                    >
                      <span className="species-color" style={{ background: species.color, boxShadow: `0 0 18px ${species.color}` }} />
                      <span className="species-name">
                        <strong>{species.commonName}</strong>
                        <small>{species.scientificName}</small>
                      </span>
                      <span className="checkmark">{checked ? <Check size={15} /> : <Circle size={14} />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className={`accordion-section ${openSection === "countries" ? "open" : ""}`}>
          <button className="accordion-trigger" type="button" onClick={() => setOpenSection(openSection === "countries" ? "birds" : "countries")}>
            <span>Countries</span>
            <ChevronDown size={16} />
          </button>
          {openSection === "countries" && (
            <div className="accordion-content">
              <div className="panel-actions">
                <button type="button" onClick={clearCountries}>
                  Clear countries
                </button>
              </div>
              <div className="country-list">
                {countryNames.map((country) => {
                  const checked = selectedCountries.includes(country);
                  const countrySpeciesIds = speciesIdsForCountry(country);
                  const count = countrySpeciesIds.length;
                  return (
                    <button
                      className={`country-row ${checked ? "checked" : ""}`}
                      key={country}
                      type="button"
                      onClick={() => toggleCountry(country)}
                      onMouseEnter={() => setInspectedSpecies(countrySpeciesIds[0] ?? null)}
                      onFocus={() => setInspectedSpecies(countrySpeciesIds[0] ?? null)}
                    >
                      <span>{country}</span>
                      <small>{count}</small>
                      <span className="checkmark">{checked ? <Check size={15} /> : <Circle size={14} />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
};

export default BirdPanel;
