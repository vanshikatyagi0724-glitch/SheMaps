import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Custom hook to track the user's live geographic position in browser memory.
 * Adheres to privacy rules: position is never stored or transmitted to backend.
 *
 * @returns {{
 *   position: { lat: number, lng: number, accuracy: number } | null,
 *   status: 'idle' | 'requesting' | 'tracking' | 'denied' | 'unavailable' | 'insecure',
 *   start: () => void,
 *   stop: () => void
 * }}
 */
export function useLiveLocation() {
  const [position, setPosition] = useState(null);
  const [status, setStatus] = useState("idle");
  const watchIdRef = useRef(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus("idle");
    setPosition(null);
  }, []);

  const start = useCallback(() => {
    // 1. Detect insecure context (window.isSecureContext is false on non-localhost http)
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setStatus("insecure");
      return;
    }

    // 2. Detect missing browser Geolocation API
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    // Clear any active watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setStatus("requesting");

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    };

    const handleSuccess = (pos) => {
      const coords = pos.coords;
      const lat = Number(coords.latitude.toFixed(6));
      const lng = Number(coords.longitude.toFixed(6));
      const accuracy = Number(coords.accuracy ? coords.accuracy.toFixed(1) : 20);

      setPosition({ lat, lng, accuracy });
      setStatus("tracking");
    };

    const handleError = (error) => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setPosition(null);

      // error.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      if (error && error.code === 1) {
        setStatus("denied");
      } else {
        setStatus("unavailable");
      }
    };

    try {
      const id = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
      watchIdRef.current = id;
    } catch {
      setStatus("unavailable");
    }
  }, []);

  // Clear watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return {
    position,
    status,
    start,
    stop,
  };
}

export default useLiveLocation;
