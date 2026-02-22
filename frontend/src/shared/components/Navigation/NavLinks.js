import { NavLink } from "react-router-dom";

import "./NavLinks.css";
import { useContext } from "react";
import { AuthContext } from "../../context/auth-context";
import Button from "../FormElements/Button";

const NavLinks = (props) => {
  const { isLoggedIn, userId, logout } = useContext(AuthContext);
  return (
    <ul className="nav-links">
      <li>
        <NavLink to="/" exact>
          ALL USERS
        </NavLink>
      </li>
      {isLoggedIn && (
        <li>
          <NavLink to={`/${userId}/places`}>MY PLACES</NavLink>
        </li>
      )}
      {isLoggedIn && (
        <li>
          <NavLink to="/places/new">SHARE PLACE</NavLink>
        </li>
      )}
      {!isLoggedIn && (
        <li>
          <NavLink to="/auth">AUTHENTICATE</NavLink>
        </li>
      )}
      {isLoggedIn && (
        <li>
          <Button onClick={logout}>LOGOUT</Button>
        </li>
      )}
    </ul>
  );
};

export default NavLinks;
