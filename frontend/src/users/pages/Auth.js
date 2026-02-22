import { useContext, useState } from "react";

import Button from "../../shared/components/FormElements/Button";
import Card from "../../shared/components/UIElements/Card";
import Input from "../../shared/components/FormElements/Input";
import useForm from "../../shared/hooks/form-hook";
import {
  VALIDATOR_EMAIL,
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/utils/validators";
import { AuthContext } from "../../shared/context/auth-context";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";

import "./Auth.css";

const Auth = () => {
  const { isLoggedIn, login, logout } = useContext(AuthContext);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formState, inputHandler, setFormData] = useForm(
    {
      email: { value: "", isValid: false },
      password: { value: "", isValid: false },
    },
    false,
  );

  const authSubmitHandler = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    if (isLoginMode) {
      try {
        const response = await fetch("http://localhost:5001/api/users/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formState.inputs.email?.value,
            password: formState.inputs.password?.value,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message);
        }

        setIsLoading(false);
        login();
      } catch (err) {
        console.log(err);
        setIsLoading(false);
        setError(err.message || "Something went wrong. Please try again later");
      }
    } else {
      try {
        const response = await fetch("http://localhost:5001/api/users/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: formState.inputs.username?.value,
            email: formState.inputs.email?.value,
            password: formState.inputs.password?.value,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message);
        }

        setIsLoading(false);
        login();
      } catch (err) {
        console.log(err);
        setIsLoading(false);
        setError(err.message || "Something went wrong. Please try again later");
      }
    }
  };

  const switchModeHandler = () => {
    if (!isLoginMode) {
      setFormData(
        { ...formState.inputs, username: undefined },
        formState.inputs.email.isValid && formState.inputs.password.isValid,
      );
    } else {
      setFormData(
        { ...formState.inputs, username: { value: "", isValid: false } },
        false,
      );
    }
    setIsLoginMode((prev) => !prev);
  };

  const errorHandler = () => {
    setError(null);
  };
  return (
    <>
      <ErrorModal error={error} onClear={errorHandler} />
      <Card className="authentication">
        {isLoading && <LoadingSpinner asOverlay />}
        <h2>Login required</h2>
        <hr />
        <form className="" onSubmit={authSubmitHandler}>
          {!isLoginMode && (
            <Input
              id="username"
              label="Username"
              element="input"
              type="text"
              validators={[VALIDATOR_REQUIRE()]}
              errorText="Please enter a valid username."
              onInput={inputHandler}
            />
          )}
          <Input
            id="email"
            label="Email"
            element="input"
            type="email"
            validators={[VALIDATOR_EMAIL()]}
            errorText="Please enter a valid email address."
            onInput={inputHandler}
          />
          <Input
            id="password"
            label="Password"
            element="input"
            type="password"
            validators={[VALIDATOR_MINLENGTH(6)]}
            errorText="Please enter a valid password of at least 6 characters."
            onInput={inputHandler}
          />
          <Button type="submit" disabled={!formState.isValid}>
            {isLoginMode ? "LOGIN" : "SIGNUP"}
          </Button>
        </form>
        <Button inverse onClick={switchModeHandler}>
          {isLoginMode ? "Create an account" : "Log back in"}
        </Button>
      </Card>
    </>
  );
};

export default Auth;
