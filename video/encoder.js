// Injecté par render.mjs dans la page de la vidéo (un seul onglet : Chrome ne dessine pas les onglets en arrière-plan).
// Encode en H.264 (WebCodecs) les images envoyées par render.mjs, puis les assemble en MP4 (mp4-muxer, chargé avant).
(() => {
  const CODECS = ["avc1.640028", "avc1.4d0028", "avc1.42e028"]; // High, Main, Baseline (niveau 4.0 : 1080p30)
  let muxer, encoder, fps, failure = null;

  async function supported(width, height, bitrate) {
    const ok = [];
    for (const codec of CODECS) {
      const res = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: 30, avc: { format: "avc" } });
      if (res.supported) ok.push(codec);
    }
    return ok;
  }

  window.__start = async ({ width, height, frameRate, bitrate }) => {
    if (typeof VideoEncoder === "undefined") throw new Error("WebCodecs indisponible (la page doit être servie en http://127.0.0.1)");
    const [codec] = await supported(width, height, bitrate);
    if (!codec) throw new Error("Aucun encodeur H.264 disponible dans ce navigateur");
    fps = frameRate;
    muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width, height, frameRate },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { failure = e; },
    });
    encoder.configure({ codec, width, height, bitrate, framerate: frameRate, latencyMode: "realtime", avc: { format: "avc" } });
    return codec;
  };

  window.__addFrame = async (b64, index) => {
    if (failure) throw failure;
    const blob = await (await fetch("data:image/png;base64," + b64)).blob();
    const bitmap = await createImageBitmap(blob);
    const frame = new VideoFrame(bitmap, { timestamp: Math.round((index * 1e6) / fps), duration: Math.round(1e6 / fps) });
    encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 });
    frame.close();
    bitmap.close();
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
  };

  // Renvoie le MP4 par morceaux à render.mjs (fonction exposée __saveChunk).
  window.__finish = async () => {
    await encoder.flush();
    if (failure) throw failure;
    muxer.finalize();
    const bytes = new Uint8Array(muxer.target.buffer);
    const size = 1 << 20;
    for (let i = 0; i < bytes.length; i += size) {
      let s = "";
      const part = bytes.subarray(i, i + size);
      for (let j = 0; j < part.length; j += 0x8000) s += String.fromCharCode.apply(null, part.subarray(j, j + 0x8000));
      await window.__saveChunk(btoa(s));
    }
    return bytes.length;
  };
})();
