import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function ReviewComment({ comment, containsSpoilers }) {
  const [revealed, setRevealed] = useState(false);
  if (!comment) return null;
  if (!containsSpoilers) {
    return <p className="review-card-text">{comment}</p>;
  }
  return (
    <div className="spoiler-wrap">
      <p
        className={`review-card-text ${!revealed ? 'spoiler-blurred' : ''}`}
        onClick={() => !revealed && setRevealed(true)}
        style={!revealed ? { cursor: 'pointer' } : undefined}
      >
        {comment}
      </p>
      {!revealed ? (
        <button
          type="button"
          className="spoiler-toggle"
          onClick={() => setRevealed(true)}
          title="Revelar crítica com spoiler"
        >
          <Eye size={12} />
          <span>Contém spoiler — clique para ver</span>
        </button>
      ) : (
        <button
          type="button"
          className="spoiler-toggle spoiler-toggle--hide"
          onClick={() => setRevealed(false)}
          title="Ocultar spoiler"
        >
          <EyeOff size={12} />
          <span>Ocultar spoiler</span>
        </button>
      )}
    </div>
  );
}
