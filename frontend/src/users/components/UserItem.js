import { Link } from "react-router-dom";
import "./UserItem.css";

import Avatar from "../../shared/components/UIElements/Avatar";
import Card from "../../shared/components/UIElements/Card";

const UserItem = (props) => {
  // Cycles through 5 accent colors via data-accent attribute (0–4)
  const accent = (props.colorIndex ?? 0) % 5;

  return (
    <li className="user-item" data-accent={accent}>
      <Card className="user-item__content" style={{ padding: "0rem" }}>
        <Link to={`/${props.id}/places`}>
          <div className="user-item__image">
            <Avatar
              image={props.image}
              alt={props.username}
              colorIndex={accent}
            />
          </div>
          <div className="user-item__info">
            <h2>{props.username}</h2>
            <h3>
              has been to {props.placeCount}{" "}
              {props.placeCount === 1 ? "place" : "places"}
            </h3>
          </div>
        </Link>
      </Card>
    </li>
  );
};

export default UserItem;
