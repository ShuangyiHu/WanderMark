import UserItem from "./UserItem";
import Card from "../../shared/components/UIElements/Card";
import "./UsersList.css";

const UsersList = (props) => {
  if (props.items.length === 0) {
    return (
      <div className="center">
        <Card>
          <h2>No users found.</h2>
        </Card>
      </div>
    );
  }
  return (
    <>
      <div className="users-list__header">
        <p className="users-list__eyebrow">Community</p>
        <h1 className="users-list__title">
          Every journey,{" "}
          <span className="gradient-text">a new color.</span>
        </h1>
        <p className="users-list__subtitle">Explore places through the eyes of wanderers around the world.</p>
        <div className="spectrum-bar" />
      </div>
      <ul className="users-list">
        {props.items.map((user, index) => (
        <UserItem
          key={user.id}
          id={user.id}
          username={user.username}
          image={user.image}
          placeCount={user.places.length}
          colorIndex={index}
        />
      ))}
      </ul>
    </>
  );
};

export default UsersList;
