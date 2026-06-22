import type { ReactNode } from "react";

interface GameResultProps {
  isWinner: boolean;
  message?: ReactNode;
}

export default function GameResult({ isWinner, message }: GameResultProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        fontSize: "1.8rem",
        fontWeight: "bold",
        textAlign: "center",
        padding: "1rem",
        borderRadius: "8px",
        backgroundColor: isWinner ? "#d4edda" : "#f8d7da",
        color: isWinner ? "#155724" : "#721c24",
        marginTop: "1rem",
      }}
    >
      {isWinner ? "🎉 You won!" : "😔 You lost."}
      {message && (
        <div style={{ fontSize: "1rem", fontWeight: "normal", marginTop: "0.5rem" }}>{message}</div>
      )}
    </div>
  );
}
