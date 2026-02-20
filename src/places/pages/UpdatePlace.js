import { useParams } from "react-router-dom";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import {
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/utils/validators";

import "./PlaceForm.css";
import useForm from "../../shared/hooks/form-hook";

const DUMMY_PLACES = [
  {
    id: "p1",
    title: "Space Needle",
    description:
      "Iconic, 605-ft-tall spire at the Seattle Center, with an observation deck & a rotating restaurant.",
    image:
      "https://insightpestnorthwest.com/wp-content/uploads/2021/04/andrea-leopardi-QfhbK2pY0Ao-unsplash-1-1024x683.jpg",
    address: "400 Broad St, Seattle, WA 98109",
    coordinates: {
      lat: 47.6205063,
      lng: -122.3518523,
    },
    creatorId: "u1",
  },
  {
    id: "p2",
    title: "Space Needle",
    description:
      "Iconic, 605-ft-tall spire at the Seattle Center, with an observation deck & a rotating restaurant.",
    image:
      "https://insightpestnorthwest.com/wp-content/uploads/2021/04/andrea-leopardi-QfhbK2pY0Ao-unsplash-1-1024x683.jpg",
    address: "400 Broad St, Seattle, WA 98109",
    coordinates: {
      lat: 47.6205063,
      lng: -122.3518523,
    },
    creatorId: "u2",
  },
];
const UpdatePlace = () => {
  const placeId = useParams().placeId;
  const identifiedPlace = DUMMY_PLACES.find((p) => p.id === placeId);
  const [formState, inputHandler] = useForm(
    {
      title: { value: identifiedPlace.title, isValid: true },
      description: { value: identifiedPlace.description, isValid: true },
    },
    true,
  );
  const placeUpdateSubmitHandler = (event) => {
    event.preventDefault();
    console.log(formState.inputs);
  };
  if (!identifiedPlace) {
    return <h2 className="center">Could not find the place!</h2>;
  }
  return (
    <form className="place-form" onSubmit={placeUpdateSubmitHandler}>
      <Input
        id="title"
        label="Title"
        element="input"
        type="text"
        validators={[VALIDATOR_REQUIRE()]}
        errorText="Please enter a valid title."
        onInput={inputHandler}
        value={formState.inputs.title.value}
        valid={formState.inputs.title.isValid}
      />
      <Input
        id="description"
        label="Description"
        validators={[VALIDATOR_MINLENGTH(5)]}
        errorText="Please enter a valid description of at least 5 characters."
        onInput={inputHandler}
        value={formState.inputs.description.value}
        valid={formState.inputs.description.isValid}
      />
      <Button type="submit" disabled={!formState.isValid}>
        UPDATE PLACE
      </Button>
    </form>
  );
};
export default UpdatePlace;
