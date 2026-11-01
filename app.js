// ClipKaro - trim a video in the browser and save the piece as a .webm file.
// Everything runs locally. Export uses MediaRecorder: the selected part is
// played once and recorded off a canvas, video + audio together.

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const editor = document.getElementById("editor");
const video = document.getElementById("player");
const startRange = document.getElementById("startRange");
const endRange = document.getElementById("endRange");
const startLabel = document.getElementById("startLabel");
const endLabel = document.getElementById("endLabel");
const lenLabel = document.getElementById("lenLabel");
const statusEl = document.getElementById("status");
const downloadWrap = document.getElementById("downloadWrap");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const loopChk = document.getElementById("loopChk");
const exportBtn = document.getElementById("exportBtn");

let objectUrl = null;
let exporting = false;

function fmt(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function setStatus(msg) { statusEl.textContent = msg; }

function refreshLabels() {
  const s = parseFloat(startRange.value);
  const e = parseFloat(endRange.value);
  startLabel.textContent = fmt(s);
  endLabel.textContent = fmt(e);
  lenLabel.textContent = fmt(e - s);
}

// ---- loading a file ----

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("over");
  if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) loadFile(fileInput.files[0]);
});

function loadFile(file) {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;
  downloadWrap.innerHTML = "";
  setStatus("Loaded: " + file.name);
}

video.addEventListener("loadedmetadata", () => {
  const d = video.duration;
  startRange.max = d; endRange.max = d;
  startRange.value = 0; endRange.value = d;
  editor.hidden = false;
  refreshLabels();
});

// ---- start / end sliders ----
// keep at least half a second between start and end

startRange.addEventListener("input", () => {
  let s = parseFloat(startRange.value);
  const e = parseFloat(endRange.value);
  if (s > e - 0.5) { s = e - 0.5; startRange.value = s; }
  video.currentTime = s;
  refreshLabels();
});
endRange.addEventListener("input", () => {
  let e = parseFloat(endRange.value);
  const s = parseFloat(startRange.value);
  if (e < s + 0.5) { e = s + 0.5; endRange.value = e; }
  video.currentTime = Math.max(0, e - 0.6); // show a frame near the end point
  refreshLabels();
});

document.getElementById("setStartBtn").addEventListener("click", () => {
  startRange.value = video.currentTime;
  startRange.dispatchEvent(new Event("input"));
});
document.getElementById("setEndBtn").addEventListener("click", () => {
  endRange.value = video.currentTime;
  endRange.dispatchEvent(new Event("input"));
});
document.getElementById("playSelBtn").addEventListener("click", () => {
  video.currentTime = parseFloat(startRange.value);
  video.play();
});

// stop (or loop) at the end of the selection while previewing
video.addEventListener("timeupdate", () => {
  if (exporting) return;
  const e = parseFloat(endRange.value);
  if (!video.paused && video.currentTime >= e) {
    if (loopChk.checked) video.currentTime = parseFloat(startRange.value);
    else video.pause();
  }
});

// ---- save current frame as PNG ----

document.getElementById("frameBtn").addEventListener("click", () => {
  if (!video.videoWidth) return;
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext("2d").drawImage(video, 0, 0);
  c.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frame-" + Math.round(video.currentTime) + "s.png";
    a.click();
    const img = document.getElementById("framePreview");
    img.src = url;
    img.hidden = false;
    setStatus("Frame saved as PNG.");
  }, "image/png");
});

// ---- export ----
// the audio side needs an AudioContext graph; build it once, on first export

let audioCtx = null, audioDest = null;
function setupAudio() {
  if (audioCtx) { audioCtx.resume(); return; }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = audioCtx.createMediaElementSource(video);
  audioDest = audioCtx.createMediaStreamDestination();
  src.connect(audioCtx.destination); // keep normal playback audible
  src.connect(audioDest);
}

exportBtn.addEventListener("click", () => {
  if (exporting) return;
  if (!window.MediaRecorder) {
    setStatus("Sorry, this browser does not support MediaRecorder. Please try Chrome or Edge.");
    return;
  }
  const start = parseFloat(startRange.value);
  const end = parseFloat(endRange.value);

  setupAudio();

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx2d = canvas.getContext("2d");

  const tracks = [...canvas.captureStream(30).getVideoTracks(), ...audioDest.stream.getAudioTracks()];
  const recorder = new MediaRecorder(new MediaStream(tracks), {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm",
    videoBitsPerSecond: 6_000_000,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    exporting = false;
    exportBtn.disabled = false;
    progressWrap.hidden = true;
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    downloadWrap.innerHTML = "";
    const a = document.createElement("a");
    a.href = url;
    a.download = "clip-" + fmt(start).replace(":", "m") + "s.webm";
    a.textContent = "Download your clip (" + mb + " MB)";
    downloadWrap.appendChild(a);
    setStatus("Done. Your clip is ready below.");
  };

  exporting = true;
  exportBtn.disabled = true;
  progressWrap.hidden = false;
  progressBar.style.width = "0%";
  setStatus("Exporting... the clip plays once while it records.");

  // draw the video onto the canvas for as long as we record
  function draw() {
    if (!exporting) return;
    ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(draw);
  }

  function onTime() {
    const t = video.currentTime;
    progressBar.style.width = Math.min(100, ((t - start) / (end - start)) * 100) + "%";
    if (t >= end || video.ended) {
      video.removeEventListener("timeupdate", onTime);
      video.pause();
      if (recorder.state !== "inactive") recorder.stop();
    }
  }

  video.currentTime = start;
  video.addEventListener("seeked", function begin() {
    video.removeEventListener("seeked", begin);
    recorder.start(200);
    draw();
    video.addEventListener("timeupdate", onTime);
    video.play();
  });
});
