import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import {
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/utils/validators";
import useForm from "../../shared/hooks/form-hook";

import "./PlaceForm.css";
import useHttpClient from "../../shared/hooks/http-hook";
import { useContext } from "react";
import { AuthContext } from "../../shared/context/auth-context";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";

const NewPlace = () => {
  const inputs = {
    title: {
      value: "",
      isValid: false,
    },
    description: {
      value: "",
      isValid: false,
    },
    address: {
      value: "",
      isValid: false,
    },
  };
  const history = useHistory();

  const [formState, inputHandler] = useForm(inputs, false);
  const { userId } = useContext(AuthContext);
  const { isLoading, error, sendRequest, clearError } = useHttpClient();

  const placeSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      const responseData = await sendRequest(
        "http://localhost:5001/api/places",
        "POST",
        {
          "Content-Type": "application/json",
        },
        JSON.stringify({
          title: formState.inputs.title.value,
          address: formState.inputs.address.value,
          description: formState.inputs.description.value,
          creatorId: userId,
        }),
      );
      //redirect
      history.push("/");
    } catch (err) {}
  };

  return (
    <>
      <ErrorModal error={error} onClear={clearError} />
      {isLoading && <LoadingSpinner asOverlay />}
      <form className="place-form" onSubmit={placeSubmitHandler}>
        <Input
          id="title"
          type="text"
          label="Title"
          element="input"
          validators={[VALIDATOR_REQUIRE()]}
          errorText="Please enter a valid title."
          onInput={inputHandler}
        />
        <Input
          id="address"
          element="input"
          type="text"
          label="Address"
          validators={[VALIDATOR_REQUIRE()]}
          errorText="Please enter a valid address."
          onInput={inputHandler}
        />
        <Input
          id="description"
          label="Description"
          validators={[VALIDATOR_MINLENGTH(5)]}
          errorText="Please enter a description of at least 5 characters."
          onInput={inputHandler}
        />
        <Button type="submit" disabled={!formState.isValid}>
          SHARE
        </Button>
      </form>
    </>
  );
};

export default NewPlace;
