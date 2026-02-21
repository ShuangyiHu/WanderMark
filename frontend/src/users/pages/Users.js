import UsersList from "../components/UsersList";

const Users = () => {
  const USERS = [
    {
      id: "u1",
      name: "maru",
      image: "https://cat-avatars.vercel.app/api/cat?name=may",
      places: 5,
    },

    {
      id: "u2",
      name: "may",
      image: "https://cat-avatars.vercel.app/api/cat?name=may",
      places: 5,
    },

    {
      id: "u3",
      name: "cookie",
      image: "https://cat-avatars.vercel.app/api/cat?name=cookie",
      places: 5,
    },
  ];
  return <UsersList items={USERS} />;
};

export default Users;
