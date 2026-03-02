import React from "react";
import "./Avatar.css";

// 5 conic gradients cycling by colorIndex
const AVATAR_GRADIENTS = [
  "conic-gradient(from 0deg, #00d4aa, #ffd600, #00d4aa)",
  "conic-gradient(from 60deg, #ff6b2f, #ffd600, #ff6b2f)",
  "conic-gradient(from 120deg, #7b2fff, #ff1f6b, #7b2fff)",
  "conic-gradient(from 200deg, #ff1f6b, #ff6b2f, #ff1f6b)",
  "conic-gradient(from 280deg, #ffd600, #00d4aa, #ffd600)",
];

const Avatar = (props) => {
  const { image, alt, colorIndex, className, style, width } = props;

  // Compute initials from alt (username)
  const initials = alt
    ? alt
        .replace("_", " ")
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const gradientIndex = (colorIndex ?? 0) % AVATAR_GRADIENTS.length;
  const gradient = AVATAR_GRADIENTS[gradientIndex];

  return (
    <div className={`avatar ${className || ""}`} style={style}>
      {image ? (
        <img src={image} alt={alt} style={{ width: width, height: width }} />
      ) : (
        <div
          className="avatar__initials"
          style={{ background: gradient }}
          aria-label={alt}
        >
          {initials}
        </div>
      )}
    </div>
  );
};

export default Avatar;
