# ClipKaro — trim videos in your browser

A small tool for cutting a piece out of a video. No uploads, no sign-up, no server — the file stays on your device the whole time.

**Live demo:** https://motivationp81-star.github.io/clipkaro-video-trimmer/

## What it does

- Load a video from your device (MP4, WebM, MOV — whatever your browser can play)
- Pick the start and end with two sliders, or park the playhead and use the "set start / set end" buttons
- Preview just the selected part, with an optional loop
- Export the selection as a `.webm` file
- Save the current frame as a PNG — handy when you need a thumbnail from a video

## How the export works

It uses the browser's MediaRecorder API. On export, the selected part is played once and recorded off a canvas (video) together with an audio stream pulled from the same element. That means export happens in real time: a 20-second clip takes about 20 seconds. Chrome and Edge handle this best.

## Run it locally

No build step. Just open `index.html` in a browser, or serve the folder any way you like:

```bash
npx serve .
```

## Limits

- Output is WebM only (that's what MediaRecorder produces).
- Quality depends on the source video; the recorder runs at 6 Mbps by default — change `videoBitsPerSecond` in `app.js` if you want more.
- Very long exports can use a lot of memory, since the whole clip is kept in RAM before saving.

## License

MIT
