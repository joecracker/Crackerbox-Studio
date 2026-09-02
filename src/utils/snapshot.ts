/**
 * Captures the current tab as a PNG dataURL using the Screen Capture API.
 * This is the same pixels you'd get from a Snipping Tool capture, and it is
 * the only cross-origin-safe way to capture a rendered iframe (the preview
 * sandbox prevents direct DOM access). Works in Chrome/Edge.
 *
 * Returns null when the browser doesn't support it or the user cancels.
 */
export async function captureCurrentTab(): Promise<string | null> {
  const media = navigator.mediaDevices?.getDisplayMedia;
  if (!media) return null;

  let stream: MediaStream | null = null;
  try {
    stream = await media({
      // @ts-expect-error preferCurrentTab is Chromium-only but falls back gracefully
      preferCurrentTab: true,
      video: true,
      audio: false,
    });
    const track = stream.getVideoTracks()[0];
    if (!track) return null;

    const settings = track.getSettings();
    const width = settings.width ?? 1280;
    const height = settings.height ?? 720;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });
    await video.play();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);

    track.stop();
    return canvas.toDataURL("image/png");
  } catch {
    return null; // user cancelled or unsupported
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}