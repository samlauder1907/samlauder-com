import { useState, useMemo } from 'react';

export default function RecipeBook({ recipes }) {
  const [activeTag, setActiveTag] = useState(null);

  const allTags = useMemo(() => {
    const set = new Set();
    recipes.forEach(r => r.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    if (!activeTag) return recipes;
    return recipes.filter(r => r.tags?.includes(activeTag));
  }, [recipes, activeTag]);

  return (
    <div className="recipe-book">
      {allTags.length > 0 && (
        <div className="recipe-filters" role="group" aria-label="Filter by category">
          <button
            className={`filter-btn${!activeTag ? ' active' : ''}`}
            onClick={() => setActiveTag(null)}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`filter-btn${activeTag === tag ? ' active' : ''}`}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="recipe-empty">No recipes yet.</p>
      ) : (
        <div className="recipe-grid">
          {filtered.map(recipe => (
            <a key={recipe.id} href={`/recipes/${recipe.slug}`} className="recipe-card">
              <div className="recipe-card-image">
                {recipe.cover ? (
                  <img src={recipe.cover} alt={recipe.name} loading="lazy" />
                ) : (
                  <div className="recipe-card-placeholder" />
                )}
              </div>
              <div className="recipe-card-info">
                <h2>{recipe.name}</h2>
                <div className="recipe-meta">
                  {recipe.time && <span>{recipe.time}</span>}
                  {recipe.serves && <span>Serves {recipe.serves}</span>}
                </div>
                {recipe.tags?.length > 0 && (
                  <ul className="recipe-tags" aria-label="Categories">
                    {recipe.tags.map(tag => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      <style>{`
        .recipe-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 2.5rem;
        }

        .filter-btn {
          font-family: inherit;
          font-size: 0.8rem;
          padding: 0.4rem 1rem;
          border: 1px solid var(--color-border, #e0e0e0);
          background: transparent;
          color: var(--color-text-muted, #666);
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s, background-color 0.2s;
        }

        .filter-btn:hover,
        .filter-btn.active {
          border-color: var(--color-text, #1a1a1a);
          color: var(--color-bg, #fff);
          background: var(--color-text, #1a1a1a);
        }

        .recipe-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          margin-bottom: 4rem;
        }

        .recipe-card {
          text-decoration: none;
          color: inherit;
          display: block;
        }

        .recipe-card-image {
          aspect-ratio: 4 / 3;
          overflow: hidden;
          background: #e0e0e0;
          margin-bottom: 0.75rem;
        }

        .recipe-card-placeholder {
          width: 100%;
          height: 100%;
          background: #e8e8e6;
        }

        .recipe-card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }

        .recipe-card:hover .recipe-card-image img {
          transform: scale(1.04);
        }

        .recipe-card-info h2 {
          font-size: 0.95rem;
          font-weight: 500;
          margin-bottom: 0.3rem;
        }

        .recipe-meta {
          display: flex;
          gap: 0.75rem;
          font-size: 0.8rem;
          color: var(--color-text-muted, #666);
          margin-bottom: 0.4rem;
        }

        .recipe-tags {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .recipe-tags li {
          font-size: 0.75rem;
          color: var(--color-text-muted, #666);
          border: 1px solid var(--color-border, #e0e0e0);
          padding: 0.15rem 0.5rem;
        }

        .recipe-empty {
          color: var(--color-text-muted, #666);
          padding: 3rem 0;
        }

        @media (max-width: 900px) {
          .recipe-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 480px) {
          .recipe-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
