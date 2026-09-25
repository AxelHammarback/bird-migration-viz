import { Check, ChevronDown, Circle, Search, X } from "lucide-react";
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
  "Kenya",
  "Mozambique",
  "Morocco",
  "New Zealand",
  "Poland",
  "Spain",
  "Sudan",
  "Sweden",
  "Turkey",
  "United Kingdom",
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
  const [openSection, setOpenSection] = useState<"birds" | "countries">("countries");
  const {
    selectedSpeciesIds,
    inspectedSpeciesId,
    selectedCountries,
    toggleSpecies,
    clearSpecies,
    setSelectedSpeciesIds,
    setInspectedSpecies,
    toggleCountry,
    clearCountries,
  } = useMigrationStore();

  const selectedCorridor = useMigrationStore((state) => findCorridor(state.selectedCorridorId));
  const inspectedSpecies = speciesById(inspectedSpeciesId);
  const speciesIdsForCountry = (country: string) =>
    speciesData
      .filter(
        (species) =>
          species.locations.includes(country) ||
          species.corridors.some((corridor) => corridor.locations.includes(country)),
      )
      .map((species) => species.id);
  const countryFilteredSpecies = speciesData.filter((species) => {
    if (selectedCountries.length === 0) return true;

    return selectedCountries.some(
      (country) =>
        species.locations.includes(country) ||
        species.corridors.some((corridor) => corridor.locations.includes(country)),
    );
  });
  const filteredSpecies = countryFilteredSpecies.filter((species) => {
    const value = `${species.commonName} ${species.scientificName}`.toLowerCase();
    return value.includes(query.toLowerCase());
  });
  const selectVisibleSpecies = () => setSelectedSpeciesIds(filteredSpecies.map((species) => species.id));

  return (
    <div className="panel-cluster">
      <CorridorDetails corridor={selectedCorridor} fallbackSpecies={inspectedSpecies} />
      <aside className="bird-panel" onMouseLeave={() => setInspectedSpecies(null)}>
        <section className={`accordion-section ${openSection === "countries" ? "open" : ""}`}>
          <button className="accordion-trigger" type="button" onClick={() => setOpenSection(openSection === "countries" ? "birds" : "countries")}>
            <span>Countries</span>
            <ChevronDown size={16} />
          </button>
          <div className="accordion-content">
            <div className="accordion-inner">
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
                    >
                      <span>{country}</span>
                      <small>{count}</small>
                      <span className="checkmark">{checked ? <Check size={15} /> : <Circle size={14} />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className={`accordion-section ${openSection === "birds" ? "open" : ""}`}>
          <button className="accordion-trigger" type="button" onClick={() => setOpenSection(openSection === "birds" ? "countries" : "birds")}>
            <span>Birds</span>
            <ChevronDown size={16} />
          </button>
          <div className="accordion-content">
            <div className="accordion-inner">
              <div className="search-field">
                <Search size={15} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search birds" />
              </div>

              <div className="panel-actions">
                <button type="button" onClick={selectVisibleSpecies}>
                  Select all
                </button>
                <button type="button" onClick={clearSpecies}>
                  Clear
                </button>
                {selectedCountries.map((country) => (
                  <button className="filter-chip" type="button" key={country} onClick={() => toggleCountry(country)}>
                    <span>{country}</span>
                    <X size={12} />
                  </button>
                ))}
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
          </div>
        </section>
      </aside>
    </div>
  );
};

export default BirdPanel;
