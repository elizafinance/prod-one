import { useEffect, useRef, useState } from "react";

const LazyImage = (props: any) => {
  const [inView, setInView] = useState(false);

  const placeholderRef = useRef<HTMLDivElement | null>(null);

  function onIntersection(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(entry.target);
      }
    });
  }

  useEffect(() => {
    const observer = new IntersectionObserver(onIntersection);
    if (placeholderRef.current) {
      observer.observe(placeholderRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={placeholderRef} className="relative w-full h-full">
      {inView ? (
        <img {...props} alt={props.alt || ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
};

export default LazyImage;
