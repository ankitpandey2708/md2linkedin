// Open a URL in the user's default browser. Cross-platform, best-effort:
// article mode's deliverable is rich HTML on the clipboard, so opening the
// LinkedIn article editor lets the user paste straight into a fresh article.
// Fire-and-forget — a failure here must never sink an otherwise-good run.

import { spawn } from "node:child_process";

export function openUrl(url) {
  const platform = process.platform;
  let cmd, args;
  if (platform === "win32") {
    // `start` is a cmd builtin; the "" is the (empty) window title it expects.
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {}); // no browser / command missing — ignore
    child.unref();
    return true;
  } catch {
    return false;
  }
}
