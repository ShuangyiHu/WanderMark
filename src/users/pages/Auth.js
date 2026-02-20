import { useContext, useState } from "react";

import Button from "../../shared/components/FormElements/Button";
import Input from "../../shared/components/FormElements/Input";
import Card from "../../shared/components/UIElements/Card";
import useForm from "../../shared/hooks/form-hook";
import {
  VALIDATOR_EMAIL,
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/utils/validators";

import "./Auth.css";
import { AuthContext } from "../../shared/context/auth-context";

const Auth = () => {
  const { isLoggedIn, login, logout } = useContext(AuthContext);

  const [isLoginMode, setIsLoginMode] = useState(true);

  const [formState, inputHandler, setFormData] = useForm(
    {
      email: { value: "", isValid: false },
      password: { value: "", isValid: false },
    },
    false,
  );

  const authSubmitHandler = (event) => {
    event.preventDefault();
    console.log(formState.inputs);
    login();
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
  return (
    <Card className="authentication">
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
  );
};

export default Auth;
