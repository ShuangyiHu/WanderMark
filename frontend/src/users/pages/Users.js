import UsersList from "../components/UsersList";

const Users = () => {
  const USERS = [
    {
      id: "u1",
      name: "maru",
      image: "https://cat-avatars.vercel.app/api/cat?name=may",
      places: 5,
    },
  ];
  return <UsersList items={USERS} />;
};

export default Users;
