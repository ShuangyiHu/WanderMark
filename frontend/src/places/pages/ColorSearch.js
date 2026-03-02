import { useState, useRef } from "react";

import Card from "../../shared/components/UIElements/Card";
import Modal from "../../shared/components/UIElements/Modal";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import Button from "../../shared/components/FormElements/Button";
import useHttpClient from "../../shared/hooks/http-hook";

import "./ColorSearch.css";

/**
 * ColorSearch page — the visual entry point for Colorwalk.
 *
 * Flow:
 *  1. User drops or picks a photo
 *  2. Frontend previews it immediately (no upload yet)
 *  3. On submit, sends multipart POST to /api/places/search/color
 *  4. Results rendered as cards with similarity score badge and palette dots
 *
 * No auth required — the search endpoint is public.
 */
const COLOR_MOODS = [
  { label: "Crimson Dusk", hex: "#E05B4B", count: 23 },
  { label: "Sahara Gold", hex: "#F2A65A", count: 18 },
  { label: "Forest Calm", hex: "#5A9E72", count: 31 },
  { label: "Arctic Blue", hex: "#4A90BF", count: 15 },
  { label: "Lavender Sky", hex: "#9B6FCC", count: 12 },
  { label: "Obsidian Night", hex: "#2C2C4A", count: 9 },
];

const ColorSearch = () => {
  const { isLoading, error, sendRequest, clearError } = useHttpClient();

  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [results, setResults] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMood, setActiveMood] = useState(null);

  const fileInputRef = useRef();

  // ── File selection helpers ────────────────────────────────────────

  const handleFileChange = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setResults(null);
    setMeta(null);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const onInputChange = (e) => {
    handleFileChange(e.target.files[0]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files[0]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  // ── Mood swatch search — creates a solid-color canvas blob ────────
  const moodSearchHandler = (mood) => {
    setActiveMood(mood.hex);
    setResults(null);
    setMeta(null);

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = mood.hex;
    ctx.fillRect(0, 0, 64, 64);

    canvas.toBlob((blob) => {
      const file = new File([blob], "mood.png", { type: "image/png" });
      setSelectedFile(file);
      setPreviewUrl(mood.hex); // use hex as flag; preview shows mood card
    }, "image/png");
  };

  // ── Search submission ─────────────────────────────────────────────
  const searchHandler = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const responseData = await sendRequest(
        process.env.REACT_APP_BACKEND_URL +
          "/places/search/color?limit=12&threshold=0.35",
        "POST",
        formData,
      );
      setResults(responseData.results);
      setMeta(responseData.meta);
    } catch (err) {
      // error is surfaced via ErrorModal through useHttpClient
    }
  };

  // ── Score badge color ─────────────────────────────────────────────

  const scoreBadgeClass = (score) => {
    if (score >= 0.75) return "color-search__badge color-search__badge--high";
    if (score >= 0.5) return "color-search__badge color-search__badge--mid";
    return "color-search__badge color-search__badge--low";
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="color-search">
      <ErrorModal error={error} onClear={clearError} />

      {/* Header */}
      <div className="color-search__header">
        <p className="color-search__eyebrow">Visual Discovery</p>
        <h1 className="color-search__title">
          Find places by <span>color</span>
        </h1>
        <p className="color-search__subtitle">
          Upload any photo — we'll match its palette to real destinations
        </p>
      </div>

      {/* Two-column: upload + mood presets */}
      <div className="color-search__main-grid">
        {/* Left: Upload zone */}
        <Card className="color-search__upload-card">
          <div
            className={`color-search__dropzone ${isDragging ? "color-search__dropzone--active" : ""}${activeMood ? " color-search__dropzone--mood" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current.click()}
          >
            {activeMood ? (
              /* Mood swatch selected */
              <div className="color-search__mood-preview">
                <div
                  className="color-search__mood-preview-swatch"
                  style={{ background: activeMood }}
                />
                <p className="color-search__mood-preview-label">
                  Searching by color mood
                </p>
                <span className="color-search__mood-preview-hex">
                  {activeMood}
                </span>
              </div>
            ) : previewUrl ? (
              /* Photo uploaded */
              <div className="color-search__preview-wrap">
                <img
                  src={previewUrl}
                  alt="Query"
                  className="color-search__preview"
                />
                {meta?.queryPalette?.length > 0 && (
                  <div className="color-search__query-palette">
                    {meta.queryPalette.map((hex, i) => (
                      <span
                        key={i}
                        className="color-search__palette-dot color-search__palette-dot--lg"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Empty state */
              <div className="color-search__dropzone-hint">
                <div className="color-search__upload-icon-wrap">
                  <span className="color-search__blob color-search__blob--1" />
                  <span className="color-search__blob color-search__blob--2" />
                  <span className="color-search__blob color-search__blob--3" />
                  <span className="color-search__blob color-search__blob--4" />
                </div>
                <p>Drop a photo here or click to browse</p>
                <span>JPG · PNG · JPEG</span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png"
            style={{ display: "none" }}
            onChange={(e) => {
              setActiveMood(null);
              onInputChange(e);
            }}
          />

          <button
            className="color-search__btn"
            onClick={searchHandler}
            disabled={!selectedFile || isLoading}
          >
            {isLoading ? "Searching…" : "Find Similar Places →"}
          </button>
        </Card>

        {/* Right: Color mood presets */}
        <div className="color-search__moods">
          <p className="color-search__moods-label">Or pick a mood</p>
          <ul className="color-search__moods-list">
            {COLOR_MOODS.map((mood) => (
              <li
                key={mood.hex}
                className={`color-search__mood-item${activeMood === mood.hex ? " color-search__mood-item--active" : ""}`}
                onClick={() => moodSearchHandler(mood)}
                style={{ "--mood-color": mood.hex }}
              >
                <span
                  className="color-search__mood-swatch"
                  style={{ background: mood.hex }}
                />
                <span className="color-search__mood-name">{mood.label}</span>
                <span className="color-search__mood-count">
                  {mood.count} places
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* end two-column grid */}

      {/* Loading overlay */}
      {isLoading && (
        <div className="center">
          <LoadingSpinner />
        </div>
      )}

      {/* Meta info strip */}
      {meta && !isLoading && (
        <div className="color-search__meta">
          <span>
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
          <span className="color-search__meta-divider">·</span>
          <span>
            Weights: color&nbsp;
            <strong>{Math.round(meta.weightsUsed.colorWeight * 100)}%</strong>
            &nbsp;/ text&nbsp;
            <strong>{Math.round(meta.weightsUsed.textWeight * 100)}%</strong>
          </span>
          {meta.queryIsColorful === false && (
            <>
              <span className="color-search__meta-divider">·</span>
              <span className="color-search__meta-note">
                Low color variance — text signal boosted
              </span>
            </>
          )}
        </div>
      )}

      {/* Results grid */}
      {results && !isLoading && (
        <>
          {results.length === 0 ? (
            <Modal
              show={true}
              onCancel={() => {
                setResults(null);
                setMeta(null);
              }}
              header="No matches found"
              footer={
                <Button
                  onClick={() => {
                    setResults(null);
                    setMeta(null);
                  }}
                >
                  Try another photo
                </Button>
              }
            >
              <p>
                No places with a similar color mood were found. Upload a
                different photo to search again.
              </p>
            </Modal>
          ) : (
            <ul className="color-search__results">
              {results.map((place) => (
                <li key={place.id} className="color-search__result-item">
                  <Card className="color-search__result-card">
                    {/* Thumbnail */}
                    <div className="color-search__result-image">
                      <img src={place.image} alt={place.title} />
                      {/* Similarity badge */}
                      <span className={scoreBadgeClass(place.similarityScore)}>
                        {Math.round(place.similarityScore * 100)}%
                      </span>
                    </div>

                    {/* Info */}
                    <div className="color-search__result-info">
                      <h3>{place.title}</h3>
                      <p className="color-search__result-address">
                        {place.address}
                      </p>
                      <p className="color-search__result-desc">
                        {place.description}
                      </p>
                    </div>

                    {/* Color palette dots */}
                    {place.colorPalette?.length > 0 && (
                      <div className="color-search__result-palette">
                        {place.colorPalette.map((swatch, i) => (
                          <span
                            key={i}
                            className="color-search__palette-dot"
                            style={{ backgroundColor: swatch.hex }}
                            title={swatch.hex}
                          />
                        ))}
                      </div>
                    )}

                    {/* Score breakdown — collapsed by default, useful for demos */}
                    <details className="color-search__breakdown">
                      <summary>Score breakdown</summary>
                      <div className="color-search__breakdown-body">
                        <span>
                          Color: {Math.round(place.scoreBreakdown.color * 100)}%
                        </span>
                        <span>
                          Text: {Math.round(place.scoreBreakdown.text * 100)}%
                        </span>
                      </div>
                    </details>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default ColorSearch;
