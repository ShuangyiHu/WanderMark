import { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import {
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/utils/validators";
import useForm from "../../shared/hooks/form-hook";

import "./PlaceForm.css";
import Card from "../../shared/components/UIElements/Card";
import useHttpClient from "../../shared/hooks/http-hook";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import { AuthContext } from "../../shared/context/auth-context";

// const DUMMY_PLACES = [
//   {
//     id: "p1",
//     title: "Space Needle",
//     description:
//       "Iconic, 605-ft-tall spire at the Seattle Center, with an observation deck & a rotating restaurant.",
//     image:
//       "https://insightpestnorthwest.com/wp-content/uploads/2021/04/andrea-leopardi-QfhbK2pY0Ao-unsplash-1-1024x683.jpg",
//     address: "400 Broad St, Seattle, WA 98109",
//     coordinates: {
//       lat: 47.6205063,
//       lng: -122.3518523,
//     },
//     creatorId: "u1",
//   },
//   {
//     id: "p2",
//     title: "Space Needle",
//     description:
//       "Iconic, 605-ft-tall spire at the Seattle Center, with an observation deck & a rotating restaurant.",
//     image:
//       "https://insightpestnorthwest.com/wp-content/uploads/2021/04/andrea-leopardi-QfhbK2pY0Ao-unsplash-1-1024x683.jpg",
//     address: "400 Broad St, Seattle, WA 98109",
//     coordinates: {
//       lat: 47.6205063,
//       lng: -122.3518523,
//     },
//     creatorId: "u2",
//   },
// ];

const UpdatePlace = () => {
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const placeId = useParams().placeId;
  const { userId } = useContext(AuthContext);
  const [identifiedPlace, setIdentifiedPlace] = useState(null);
  const [formState, inputHandler, setFormData] = useForm(
    {
      title: { value: "", isValid: false },
      description: { value: "", isValid: false },
    },
    false,
  );
  const history = useHistory();

  useEffect(() => {
    const fetchPlace = async () => {
      try {
        const responseData = await sendRequest(
          `http://localhost:5001/api/places/${placeId}`,
        );
        setIdentifiedPlace(responseData.place);
        setFormData(
          {
            title: { value: identifiedPlace.title, isValid: true },
            description: { value: identifiedPlace.description, isValid: true },
          },
          true,
        );
      } catch (err) {}
    };
    fetchPlace();
  }, [sendRequest, placeId, setFormData]);

  const placeUpdateSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      const responseData = await sendRequest(
        `http://localhost:5001/api/places/${placeId}`,
        "PATCH",
        { "Content-Type": "application/json" },
        JSON.stringify({
          title: formState.inputs.title.value,
          description: formState.inputs.description.value,
        }),
      );
      history.push(`/${userId}/places`);
    } catch (err) {}
  };

  if (isLoading) {
    return (
      <div className="center">
        <LoadingSpinner />
      </div>
    );
  }
  if (!identifiedPlace && !error) {
    return (
      <Card>
        <h2 className="center">Could not find the place!</h2>
      </Card>
    );
  }
  return (
    <>
      <ErrorModal error={error} onClear={clearError} />
      {!isLoading && identifiedPlace && (
        <form className="place-form" onSubmit={placeUpdateSubmitHandler}>
          <Input
            id="title"
            label="Title"
            element="input"
            type="text"
            validators={[VALIDATOR_REQUIRE()]}
            errorText="Please enter a valid title."
            onInput={inputHandler}
            value={identifiedPlace.title}
            valid={true}
          />
          <Input
            id="description"
            label="Description"
            validators={[VALIDATOR_MINLENGTH(5)]}
            errorText="Please enter a valid description of at least 5 characters."
            onInput={inputHandler}
            value={identifiedPlace.description}
            valid={true}
          />
          <Button type="submit" disabled={!formState.isValid}>
            UPDATE PLACE
          </Button>
        </form>
      )}
    </>
  );
};
export default UpdatePlace;
