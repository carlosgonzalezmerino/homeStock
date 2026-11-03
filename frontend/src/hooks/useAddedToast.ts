import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** How long the "added" confirmation stays on screen. */
export const ADDED_TOAST_DURATION_MS = 1000;

/**
 * Shows a short confirmation after an add, when the screen is reached with `state.added`.
 *
 * The flag is cleared straight away, so a back navigation does not show the confirmation again.
 * Nothing else happens on the screen: the camera, for example, stays off.
 *
 * @returns `true` while the confirmation should be visible.
 */
export function useAddedToast(): boolean {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const wasJustAdded = Boolean(location.state?.added);

  useEffect(() => {
    if (!wasJustAdded) return;
    setIsVisible(true);
    navigate(".", { state: {}, replace: true });
  }, [wasJustAdded, navigate]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const timer = setTimeout(() => setIsVisible(false), ADDED_TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isVisible]);

  return isVisible;
}
