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
const ColorSearch = () => {
  const { isLoading, error, sendRequest, clearError } = useHttpClient();

  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [results, setResults] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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
        <h1 className="color-search__title">Color&nbsp;Search</h1>
        <p className="color-search__subtitle">
          Upload a photo — find places with a similar visual mood
        </p>
      </div>

      {/* Upload zone */}
      <Card className="color-search__upload-card">
        <div
          className={`color-search__dropzone ${isDragging ? "color-search__dropzone--active" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current.click()}
        >
          {previewUrl ? (
            <div className="color-search__preview-wrap">
              <img
                src={previewUrl}
                alt="Query"
                className="color-search__preview"
              />
              {/* Overlay palette from meta if available */}
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
            <div className="color-search__dropzone-hint">
              <svg
                className="color-search__upload-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p>Drop a photo here or click to browse</p>
              <span>JPG, PNG, JPEG</span>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          style={{ display: "none" }}
          onChange={onInputChange}
        />

        <button
          className="color-search__btn"
          onClick={searchHandler}
          disabled={!selectedFile || isLoading}
        >
          {isLoading ? "Searching…" : "Find Similar Places"}
        </button>
      </Card>

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
