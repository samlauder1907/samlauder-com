import { useState, useEffect, useCallback } from 'react';

export default function LightboxGallery({ images }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const open = useCallback((index) => setActiveIndex(index), []);
  const close = useCallback(() => setActiveIndex(null), []);

  const prev = useCallback(() => {
    setActiveIndex(i => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const next = useCallback(() => {
    setActiveIndex(i => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    if (activeIndex === null) return;

    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [activeIndex, close, prev, next]);

  return (
    <>
      <div className="lb-grid">
        {images.map((img, i) => (
          <button
            key={i}
            className="lb-thumb"
            onClick={() => open(i)}
            aria-label={`Open image ${i + 1}: ${img.alt || ''}`}
          >
            <img src={img.src} alt={img.alt || ''} loading="lazy" />
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <div
          className="lb-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <button className="lb-close" onClick={close} aria-label="Close">
            &#x2715;
          </button>

          <button className="lb-nav lb-prev" onClick={prev} aria-label="Previous image">
            &#8592;
          </button>

          <div className="lb-img-wrap">
            <img
              key={activeIndex}
              src={images[activeIndex].src}
              alt={images[activeIndex].alt || ''}
              className="lb-img"
            />
          </div>

          <button className="lb-nav lb-next" onClick={next} aria-label="Next image">
            &#8594;
          </button>

          <div className="lb-counter">
            {activeIndex + 1} / {images.length}
          </div>
        </div>
      )}

      <style>{`
        .lb-grid {
          columns: 3;
          column-gap: 1rem;
          margin-bottom: 4rem;
        }

        .lb-thumb {
          display: block;
          break-inside: avoid;
          margin: 0 0 1rem;
          padding: 0;
          border: none;
          background: #e0e0e0;
          cursor: pointer;
          overflow: hidden;
          width: 100%;
        }

        .lb-thumb img {
          display: block;
          width: 100%;
          height: auto;
          transition: transform 0.4s ease;
        }

        .lb-thumb:hover img {
          transform: scale(1.03);
        }

        .lb-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.92);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lb-img-wrap {
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lb-img {
          max-width: 90vw;
          max-height: 90vh;
          object-fit: contain;
          display: block;
        }

        .lb-close {
          position: fixed;
          top: 1.25rem;
          right: 1.5rem;
          background: none;
          border: none;
          color: #fff;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          line-height: 1;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .lb-close:hover {
          opacity: 1;
        }

        .lb-nav {
          position: fixed;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #fff;
          font-size: 2rem;
          cursor: pointer;
          padding: 1rem;
          opacity: 0.5;
          transition: opacity 0.2s;
          line-height: 1;
        }

        .lb-nav:hover {
          opacity: 1;
        }

        .lb-prev { left: 1rem; }
        .lb-next { right: 1rem; }

        .lb-counter {
          position: fixed;
          bottom: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          color: rgba(255,255,255,0.6);
          font-size: 0.8rem;
          letter-spacing: 0.05em;
        }

        @media (max-width: 900px) {
          .lb-grid { columns: 2; }
        }

        @media (max-width: 480px) {
          .lb-grid { columns: 1; }
          .lb-nav { font-size: 1.5rem; padding: 0.75rem; }
        }
      `}</style>
    </>
  );
}
