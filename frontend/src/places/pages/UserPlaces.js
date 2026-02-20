import { useParams } from "react-router-dom";

import PlaceList from "../components/PlaceList";

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

const UserPlaces = () => {
  const userId = useParams().userId;
  const loadedPlaces = DUMMY_PLACES.filter((p) => p.creatorId === userId);
  return <PlaceList items={loadedPlaces} />;
};

export default UserPlaces;
