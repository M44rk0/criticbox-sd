import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function ReviewComment({ comment, containsSpoilers, allowExpand = false }) {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!comment) return null;

  const isLong = comment.length > 220;
  const displayText = allowExpand && isLong && !expanded ? `${comment.slice(0, 200)}...` : comment;

  if (!containsSpoilers) {
    return (
      <div className="review-comment-wrap">
        <p className="review-card-text">
          {displayText}
          {allowExpand && isLong && (
            <button
              type="button"
              className="review-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? ' Recolher' : ' Ler mais'}
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="spoiler-wrap">
      <p
        className={`review-card-text ${!revealed ? 'spoiler-blurred' : ''}`}
        onClick={() => !revealed && setRevealed(true)}
        style={!revealed ? { cursor: 'pointer' } : undefined}
      >
        {!revealed ? comment : displayText}
        {revealed && allowExpand && isLong && (
          <button
            type="button"
            className="review-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? ' Recolher' : ' Ler mais'}
          </button>
        )}
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
