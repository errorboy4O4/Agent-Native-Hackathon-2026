import { appPathFromLocalRoute } from "@agent-native/core/client/api-path";
import { useEffect } from "react";

/** DataPilot is the home screen: `/` goes straight to it. */
export default function ChatHomeRedirect() {
  useEffect(() => {
    window.location.replace(appPathFromLocalRoute("/datapilot"));
  }, []);
  return null;
}
