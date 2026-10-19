// 字幕辨識背景執行緒：Whisper 語音辨識模型在你的裝置上執行（不上傳聲音）
// 第一次使用會下載模型並存進瀏覽器快取，之後沒有網路也能用。
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.web.min.js';
let asr = null, loadedModel = '';

self.onmessage = async ({ data }) => {
  const { audio, model, language } = data;
  try {
    const { pipeline, env } = await import(LIB);
    env.allowLocalModels = false;
    if (!asr || loadedModel !== model) {
      const device = (self.navigator && 'gpu' in self.navigator) ? 'webgpu' : 'wasm';
      const progress = p => { if (p.status === 'progress') self.postMessage({ type: 'download', file: p.file, pct: p.progress || 0 }); };
      try {
        asr = await pipeline('automatic-speech-recognition', model, { device, dtype: device === 'webgpu' ? 'fp32' : 'q8', progress_callback: progress });
      } catch (e) {
        asr = await pipeline('automatic-speech-recognition', model, { device: 'wasm', dtype: 'q8', progress_callback: progress });
      }
      loadedModel = model;
    }
    self.postMessage({ type: 'status', status: 'transcribing' });
    const out = await asr(audio, {
      language: language === 'auto' ? undefined : language,
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    self.postMessage({ type: 'done', chunks: out.chunks || [{ timestamp: [0, audio.length / 16000], text: out.text }] });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e?.message || e) });
  }
};
