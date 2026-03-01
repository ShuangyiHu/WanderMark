import { useContext, useState, useEffect } from "react";

import Card from "../../shared/components/UIElements/Card";
import Button from "../../shared/components/FormElements/Button";
import Modal from "../../shared/components/UIElements/Modal";
import Map from "../../shared/components/UIElements/Map";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import { AuthContext } from "../../shared/context/auth-context";
import useHttpClient from "../../shared/hooks/http-hook";

import "./PlaceItem.css";

const PROCESSING_SENTINEL = "processing";

const PlaceItem = (props) => {
  const { isLoggedIn, userId } = useContext(AuthContext);
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [showMap, setShowMap] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ── Optimistic image state ─────────────────────────────────────────────────
  // Start with whatever image the server sent (may be "processing")
  const [currentImage, setCurrentImage] = useState(props.image);
  const isProcessing = currentImage === PROCESSING_SENTINEL;

  // If the image is still processing, poll once after 3 seconds.
  // By then the async Cloudinary upload is almost certainly done (~1-2s).
  useEffect(() => {
    if (!isProcessing) return;

    const timer = setTimeout(async () => {
      try {
        const responseData = await sendRequest(
          process.env.REACT_APP_BACKEND_URL + `/places/${props.id}`,
        );
        const freshImage = responseData.place?.image;
        if (freshImage && freshImage !== PROCESSING_SENTINEL) {
          setCurrentImage(freshImage);
        }
      } catch (err) {
        // silently ignore — user can manually refresh if needed
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isProcessing, props.id, sendRequest]);

  const openMapHandler = () => setShowMap(true);
  const closeMapHandler = () => setShowMap(false);
  const openConfirmHandler = () => setShowConfirmModal(true);
  const cancelConfirmHandler = () => setShowConfirmModal(false);

  const confirmDeleteHandler = async () => {
    setShowConfirmModal(false);
    try {
      await sendRequest(
        process.env.REACT_APP_BACKEND_URL + `/places/${props.id}`,
        "DELETE",
        null,
        { Authorization: "Bearer " + useContext.token },
      );
      props.onDelete(props.id);
    } catch (err) {}
  };

  return (
    <>
      <ErrorModal error={error} onClear={clearError} />

      <Modal
        show={showMap}
        onCancel={closeMapHandler}
        header={props.address}
        contentClass="place-item__modal-content"
        footerClass="place-item__modal-actions"
        footer={<Button onClick={closeMapHandler}>CLOSE</Button>}
      >
        <div className="map-container">
          <Map center={props.coordinates} zoom={16} />
        </div>
      </Modal>

      <Modal
        show={showConfirmModal}
        onCancel={cancelConfirmHandler}
        header="Are you sure?"
        footerClass="place-item__modal-actions"
        footer={
          <>
            <Button inverse onClick={cancelConfirmHandler}>
              CANCEL
            </Button>
            <Button danger onClick={confirmDeleteHandler}>
              DELETE
            </Button>
          </>
        }
      >
        <p>
          Do you want to proceed and delete this place? Please note it cannot be
          undone thereafter.
        </p>
      </Modal>

      <li className="place-item">
        <Card className="place-item__content">
          {isLoading && <LoadingSpinner asOverlay />}

          {/* ── Image area: shimmer skeleton while processing ── */}
          <div className="place-item__image">
            {isProcessing ? (
              <div className="place-item__image-processing">
                <div className="place-item__image-shimmer" />
                <span className="place-item__image-label">
                  📸 Image uploading…
                </span>
              </div>
            ) : (
              <img src={currentImage} alt={props.title} />
            )}
          </div>

          <div className="place-item__info">
            <h2>{props.title}</h2>
            <h3>{props.address}</h3>
            <p>{props.description}</p>
          </div>

          {props.colorPalette?.length > 0 && (
            <div className="place-item__palette">
              {props.colorPalette.map((swatch, i) => (
                <span
                  key={i}
                  className="place-item__palette-dot"
                  style={{ backgroundColor: swatch.hex }}
                  title={swatch.hex}
                />
              ))}
            </div>
          )}

          <div className="place-item__actions">
            <Button inverse onClick={openMapHandler}>
              VIEW ON MAP
            </Button>
            {isLoggedIn && userId === props.creatorId && (
              <Button to={`/places/${props.id}`}>EDIT</Button>
            )}
            {isLoggedIn && userId === props.creatorId && (
              <Button danger onClick={openConfirmHandler}>
                DELETE
              </Button>
            )}
          </div>
        </Card>
      </li>
    </>
  );
};

export default PlaceItem;
