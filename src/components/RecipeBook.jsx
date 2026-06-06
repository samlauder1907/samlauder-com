import { useState, useMemo } from 'react';

function stripPrefix(value) {
  return value.replace(/^(Difficulty|Duration):\s*/i, '');
}

function FilterRow({ label, options, active, onToggle }) {
  if (options.length === 0) return null;
  return (
    <div className="filter-row">
      <span className="filter-row-label">{label}</span>
      <div className="filter-row-btns">
        {options.map(opt => (
          <button
            key={opt}
            className={`filter-btn${active === opt ? ' active' : ''}`}
            onClick={() => onToggle(opt)}
          >
            {stripPrefix(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RecipeBook({ recipes }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeDifficulty, setActiveDifficulty] = useState(null);
  const [activeDuration, setActiveDuration] = useState(null);

  const allCategories = useMemo(() => {
    const set = new Set();
    recipes.forEach(r => r.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const allDifficulties = useMemo(() => {
    const set = new Set();
    recipes.forEach(r => r.difficulty?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const allDurations = useMemo(() => {
    const set = new Set();
    recipes.forEach(r => r.duration?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    return recipes.filter(r => {
      if (activeCategory && !r.tags?.includes(activeCategory)) return false;
      if (activeDifficulty && !r.difficulty?.includes(activeDifficulty)) return false;
      if (activeDuration && !r.duration?.includes(activeDuration)) return false;
      return true;
    });
  }, [recipes, activeCategory, activeDifficulty, activeDuration]);

  const hasFilters = allCategories.length > 0 || allDifficulties.length > 0 || allDurations.length > 0;

  function toggle(active, setActive, value) {
    setActive(prev => (prev === value ? null : value));
  }

  return (
    <div className="recipe-book">
      {hasFilters && (
        <div className="recipe-filters">
          <FilterRow
            label="Category"
            options={allCategories}
            active={activeCategory}
            onToggle={v => toggle(activeCategory, setActiveCategory, v)}
          />
          <FilterRow
            label="Difficulty"
            options={allDifficulties}
            active={activeDifficulty}
            onToggle={v => toggle(activeDifficulty, setActiveDifficulty, v)}
          />
          <FilterRow
            label="Duration"
            options={allDurations}
            active={activeDuration}
            onToggle={v => toggle(activeDuration, setActiveDuration, v)}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="recipe-empty">No recipes match the selected filters.</p>
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
                  {recipe.duration?.[0] && <span>{stripPrefix(recipe.duration[0])}</span>}
                  {recipe.difficulty?.[0] && <span>{stripPrefix(recipe.difficulty[0])}</span>}
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
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 2.5rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid var(--color-border, #e0e0e0);
        }

        .filter-row {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .filter-row-label {
          font-size: 0.7rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-muted, #666);
          width: 70px;
          flex-shrink: 0;
        }

        .filter-row-btns {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .filter-btn {
          font-family: inherit;
          font-size: 0.8rem;
          padding: 0.3rem 0.85rem;
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
          .filter-row-label { width: auto; }
        }
      `}</style>
    </div>
  );
}
