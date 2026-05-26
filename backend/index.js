import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Setup storage directories
const DATA_DIR = path.join(__dirname, 'data');
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
fs.mkdirSync(PROCESSED_DIR, { recursive: true });

// Multer for local uploads
const upload = multer({ dest: DOWNLOADS_DIR });

// Initialize local cache if it doesn't exist
if (!fs.existsSync(CACHE_FILE)) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ history: [], metadata: {} }, null, 2));
}

// Initialize templates database if it doesn't exist
if (!fs.existsSync(TEMPLATES_FILE)) {
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify({}, null, 2));
}

// Read cache helper
const getCache = () => {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (e) {
    return { history: [], metadata: {} };
  }
};

// Write cache helper
const saveCache = (data) => {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
};

// Read templates helper
const getTemplates = () => {
  try {
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
};

// Write templates helper
const saveTemplates = (data) => {
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2));
};

// Active task progress store (SSE connections)
const activeTasks = new Map();

// Helper to update task progress and notify clients
const updateTask = (taskId, data) => {
  const current = activeTasks.get(taskId) || { status: 'idle', progress: 0 };
  const updated = { ...current, ...data };
  activeTasks.set(taskId, updated);

  // Send SSE event if client is connected
  if (updated.client) {
    updated.client.write(`data: ${JSON.stringify({
      status: updated.status,
      progress: updated.progress,
      error: updated.error,
      file: updated.file,
      metadata: updated.metadata
    })}\n\n`);
  }
};

// Serve static assets (processed audio tracks and base downloads)
app.use('/media', express.static(PROCESSED_DIR));
app.use('/downloads', express.static(DOWNLOADS_DIR));

// SSE endpoint to listen to task progress
app.get('/api/progress/:taskId', (req, res) => {
  const { taskId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const task = activeTasks.get(taskId) || { status: 'pending', progress: 0 };
  task.client = res;
  activeTasks.set(taskId, task);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ status: task.status, progress: task.progress, error: task.error, file: task.file })}\n\n`);

  req.on('close', () => {
    const t = activeTasks.get(taskId);
    if (t) {
      t.client = null;
    }
  });
});

// GET /api/history: Retrieve previous conversions
app.get('/api/history', (req, res) => {
  const cache = getCache();
  res.json(cache.history);
});

// DELETE /api/history/:id: Remove a generated audio and update history cache
app.delete('/api/history/:id', (req, res) => {
  const { id } = req.params;
  const cache = getCache();
  const index = cache.history.findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'History item not found' });
  }

  const item = cache.history[index];
  const filePath = path.join(PROCESSED_DIR, item.fileName);

  // Attempt to delete the file
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Delete] Deleted processed audio file: ${filePath}`);
    }
  } catch (err) {
    console.error(`[Delete] Error deleting file ${filePath}:`, err);
  }

  // Remove from cache history array
  cache.history.splice(index, 1);
  saveCache(cache);

  res.json({ success: true, message: 'Audio deleted successfully' });
});

// POST /api/fetch-info: Get YouTube video metadata
app.post('/api/fetch-info', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const cache = getCache();
  if (cache.metadata[url]) {
    console.log(`[Cache Hit] Metadata for URL: ${url}`);
    return res.json(cache.metadata[url]);
  }

  console.log(`[Fetch Metadata] Running yt-dlp for URL: ${url}`);
  const ytDlp = spawn('/opt/homebrew/bin/yt-dlp', [
    '-J',
    '--no-playlist',
    url
  ]);

  let stdoutData = '';
  let stderrData = '';

  ytDlp.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  ytDlp.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  ytDlp.on('close', (code) => {
    if (code !== 0) {
      console.error(`yt-dlp failed with code ${code}. Error: ${stderrData}`);
      return res.status(500).json({ error: 'Failed to fetch video metadata. Make sure the URL is valid.' });
    }

    try {
      const meta = JSON.parse(stdoutData);
      const videoInfo = {
        id: meta.id,
        title: meta.title,
        duration: meta.duration, // in seconds
        thumbnail: meta.thumbnail || (meta.thumbnails && meta.thumbnails.length ? meta.thumbnails[meta.thumbnails.length - 1].url : null),
        url: url
      };

      // Save to cache
      cache.metadata[url] = videoInfo;
      saveCache(cache);

      res.json(videoInfo);
    } catch (e) {
      console.error('Error parsing yt-dlp stdout:', e);
      res.status(500).json({ error: 'Failed to parse video metadata.' });
    }
  });
});

// POST /api/download: Download YouTube audio as base file
app.post('/api/download', (req, res) => {
  const { url, id } = req.body;
  if (!url || !id) {
    return res.status(400).json({ error: 'URL and Video ID are required' });
  }

  const taskId = `dl_${id}_${Date.now()}`;
  const outPath = path.join(DOWNLOADS_DIR, `${id}.mp3`);

  // Check if file is already downloaded
  if (fs.existsSync(outPath)) {
    console.log(`[Download] File already exists: ${outPath}`);
    activeTasks.set(taskId, { status: 'completed', progress: 100, file: `${id}.mp3` });
    return res.json({ taskId, status: 'completed', file: `${id}.mp3` });
  }

  activeTasks.set(taskId, { status: 'downloading', progress: 0 });
  res.json({ taskId, status: 'downloading' });

  // Run download in background
  console.log(`[Download] Starting background download to ${outPath}`);
  const ytDlp = spawn('/opt/homebrew/bin/yt-dlp', [
    '-f', 'ba',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outPath,
    url
  ]);

  ytDlp.stdout.on('data', (data) => {
    const line = data.toString();
    // Parse progress percentage: e.g. [download]  12.5% of 4.50MiB at ...
    const match = line.match(/\[download\]\s+([0-9.]+)%/);
    if (match) {
      const progress = parseFloat(match[1]);
      updateTask(taskId, { progress });
    }
  });

  ytDlp.stderr.on('data', (data) => {
    console.error(`[Download Error Debug]: ${data.toString()}`);
  });

  ytDlp.on('close', (code) => {
    if (code === 0 && fs.existsSync(outPath)) {
      updateTask(taskId, { status: 'completed', progress: 100, file: `${id}.mp3` });
    } else {
      updateTask(taskId, { status: 'failed', error: 'Download failed or file was not generated.' });
    }
  });
});

// POST /api/upload: Upload local audio/video file
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const origName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const ext = path.extname(origName) || '.mp3';
  const newName = `${req.file.filename}${ext}`;
  const newPath = path.join(DOWNLOADS_DIR, newName);

  // Rename uploaded file to include extension
  fs.renameSync(req.file.path, newPath);

  // If it's a video file, we extract audio info
  // For duration, we use ffprobe
  const ffprobe = spawn('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    newPath
  ]);

  let durationStr = '';
  ffprobe.stdout.on('data', (data) => {
    durationStr += data.toString();
  });

  ffprobe.on('close', (code) => {
    const duration = code === 0 ? parseFloat(durationStr.trim()) || 0 : 0;
    res.json({
      success: true,
      file: newName,
      title: origName,
      duration: duration,
      thumbnail: null
    });
  });
});

// POST /api/process: Run the FFmpeg Lofi Slowed & Reverb Pipeline
app.post('/api/process', (req, res) => {
  const {
    sourceFile, // e.g. "dQw4w9WgXcQ.mp3"
    title,
    trimStart,  // in seconds (null or float)
    trimEnd,    // in seconds (null or float)
    speed = 0.85,
    pitchStyle = 'vinyl', // 'vinyl' (pitch changes with speed) or 'stretch' (pitch constant)
    pitchSemitones = 0,
    reverb = 'medium', // 'none', 'light', 'medium', 'deep'
    bassEQ = 0, // dB (-10 to 12)
    midEQ = 0, // dB (-10 to 10)
    trebleEQ = 0, // dB (-10 to 10)
    tapeHiss = 0.015, // volume (0 to 0.1)
    muffleCutoff = 3500, // Hz
    stereoWidth = 1.0, // expansion factor (0.0 to 2.0)
    wowFlutter = 0.0, // Tape Waver (0.0 to 1.0)
    bitDepth = 0, // Vintage resampler (0, 8, 12)
    exportFormat = 'mp3' // 'mp3' | 'wav'
  } = req.body;

  if (!sourceFile) {
    return res.status(400).json({ error: 'sourceFile is required' });
  }

  const inPath = path.join(DOWNLOADS_DIR, sourceFile);
  if (!fs.existsSync(inPath)) {
    return res.status(404).json({ error: 'Source audio file not found' });
  }

  const taskId = `proc_${Date.now()}`;
  const ext = exportFormat === 'wav' ? 'wav' : 'mp3';
  const outFileName = `${taskId}.${ext}`;
  const outPath = path.join(PROCESSED_DIR, outFileName);

  activeTasks.set(taskId, { status: 'processing', progress: 0 });
  res.json({ taskId, status: 'processing' });

  // Calculate trimmed duration for progress estimation
  const startSec = parseFloat(trimStart) || 0;
  const endSec = parseFloat(trimEnd) || 0;
  const hasTrim = endSec > startSec;
  const segmentDuration = hasTrim ? (endSec - startSec) : 0;

  // Build FFmpeg Filter Graph
  // We'll process audio stream [0:a]
  let preReverb = '';

  // 1. Slowed (speed & pitch) with support for independent controls
  let pitchFactor = 1.0;
  if (pitchStyle === 'vinyl') {
    pitchFactor = speed;
  } else {
    pitchFactor = Math.pow(2, pitchSemitones / 12);
  }

  // Shift pitch using sample rate manipulation
  preReverb += `asetrate=44100*${pitchFactor},aresample=44100`;

  // Scale tempo to correct for the pitch shift ratio
  const tempoRatio = speed / pitchFactor;
  if (tempoRatio < 0.5) {
    // atempo filter is restricted to [0.5, 2.0] in FFmpeg; chain multiple if ratio is lower
    preReverb += `,atempo=0.5,atempo=${tempoRatio / 0.5}`;
  } else if (tempoRatio > 2.0) {
    preReverb += `,atempo=2.0,atempo=${tempoRatio / 2.0}`;
  } else if (tempoRatio !== 1.0) {
    preReverb += `,atempo=${tempoRatio}`;
  }

  // 2. Multi-band EQ
  const bassVal = bassEQ !== undefined ? bassEQ : (req.body.bassBoost !== undefined ? req.body.bassBoost : 0);
  if (bassVal !== 0) {
    preReverb += `,lowshelf=f=150:g=${bassVal}`;
  }
  if (midEQ !== 0) {
    preReverb += `,equalizer=f=1000:width_type=h:width=200:g=${midEQ}`;
  }
  if (trebleEQ !== 0) {
    preReverb += `,highshelf=f=6000:g=${trebleEQ}`;
  }

  // 3. Muffle (Lowpass Cutoff)
  if (muffleCutoff < 20000) {
    preReverb += `,lowpass=f=${muffleCutoff}`;
  }

  // 4. Post-reverb effects
  let postReverb = '';
  if (stereoWidth !== 1.0) {
    postReverb += `extrastereo=m=${stereoWidth}`;
  }
  if (wowFlutter !== undefined && parseFloat(wowFlutter) > 0) {
    const wowVal = parseFloat(wowFlutter);
    if (postReverb) postReverb += ',';
    postReverb += `vibrato=f=3.0:d=${(wowVal * 0.3).toFixed(3)}`;
  }
  if (bitDepth !== undefined && parseInt(bitDepth) > 0) {
    const bits = parseInt(bitDepth);
    if (postReverb) postReverb += ',';
    postReverb += `acrusher=level_in=1:level_out=1:bits=${bits}:mode=lin`;
  }

  // 5. Build filterGraph based on Reverb Preset
  let mainAudioChain = '';
  if (reverb === 'silent_hall') {
    // Dynamic split & damping path to eliminate airy/hissy reverb tails
    const postReverbPart = postReverb ? `,${postReverb}` : '';
    mainAudioChain = `[0:a]${preReverb}[pre_rev];[pre_rev]split=2[rdry][rwet];[rwet]aecho=1.0:0.48:70|110|180|260|350:0.55|0.45|0.35|0.25|0.15,lowpass=f=1000[rwetdamp];[rdry]volume=0.85[rdryvol];[rdryvol][rwetdamp]amix=inputs=2:duration=first[rev_out];[rev_out]${postReverbPart}`;
  } else {
    let combinedChain = preReverb;
    if (reverb !== 'none') {
      let reverbFilter = '';
      if (reverb === 'light') reverbFilter = 'aecho=0.8:0.35:60|80:0.4|0.3';
      else if (reverb === 'medium') reverbFilter = 'aecho=0.8:0.4:60|80|120:0.4|0.3|0.2';
      else if (reverb === 'deep') reverbFilter = 'aecho=0.8:0.45:60|90|150|220|300:0.5|0.4|0.3|0.2|0.1';
      combinedChain += `,${reverbFilter}`;
    }
    if (postReverb) {
      combinedChain += `,${postReverb}`;
    }
    mainAudioChain = `[0:a]${combinedChain}`;
  }

  // 6. Tape Hiss & Peak Limiting (Brickwall Peak Limiter set at limit=0.95 matches WaveShaperNode)
  let filterGraph = '';
  const hasNoise = tapeHiss > 0;

  if (hasNoise) {
    filterGraph = `${mainAudioChain}[clean];anoisesrc=color=brown:amplitude=${tapeHiss}[noise];[clean][noise]amix=inputs=2:duration=first,alimiter=limit=0.95`;
  } else {
    filterGraph = `${mainAudioChain},alimiter=limit=0.95`;
  }

  // Build FFmpeg process arguments
  const ffmpegArgs = [];

  // Input seek (trim start)
  if (startSec > 0) {
    ffmpegArgs.push('-ss', startSec.toString());
  }

  // Input file
  ffmpegArgs.push('-i', inPath);

  // Input duration (trim end)
  if (endSec > startSec) {
    const duration = endSec - startSec;
    ffmpegArgs.push('-t', duration.toString());
  }

  // Apply filters
  ffmpegArgs.push('-filter_complex', filterGraph);

  // Output format/bitrate parameters
  ffmpegArgs.push('-ac', '2');
  if (exportFormat === 'wav') {
    ffmpegArgs.push('-c:a', 'pcm_s16le'); // Export lossless WAV
  } else {
    ffmpegArgs.push('-b:a', '320k'); // Export 320kbps MP3
  }
  ffmpegArgs.push('-y'); // Overwrite file
  ffmpegArgs.push(outPath);

  console.log(`[Process] Running ffmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);

  const ffmpeg = spawn('/opt/homebrew/bin/ffmpeg', ffmpegArgs);

  // Monitor processing progress
  // FFmpeg prints stats to stderr periodically, like:
  // size=     256kB time=00:00:05.12 bitrate= 409.6kbits/s speed=4.51x
  let totalDurationSec = segmentDuration;

  // If segment duration is not specified (e.g. no trim), we need to check the full duration.
  // We can query the full duration from ffprobe or just use a fallback.
  const getFullDuration = async () => {
    return new Promise((resolve) => {
      const probe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        inPath
      ]);
      let out = '';
      probe.stdout.on('data', (d) => { out += d.toString(); });
      probe.on('close', () => {
        resolve(parseFloat(out.trim()) || 180); // default fallback 3 mins
      });
    });
  };

  const runFfmpegProgress = async () => {
    if (totalDurationSec === 0) {
      totalDurationSec = await getFullDuration();
    }
    // Speed shifts duration! If we slow down the track, the output duration increases!
    // Output duration = Input duration / speed.
    const expectedOutputDuration = totalDurationSec / speed;

    ffmpeg.stderr.on('data', (data) => {
      const line = data.toString();
      const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        const ms = parseInt(timeMatch[4]);
        const processedSec = hours * 3600 + minutes * 60 + seconds + ms / 100;

        let pct = Math.round((processedSec / expectedOutputDuration) * 100);
        pct = Math.min(Math.max(pct, 0), 99); // max 99 until finished
        updateTask(taskId, { progress: pct });
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        // Save success to history cache
        const cache = getCache();
        const historyItem = {
          id: taskId,
          title: `${title || 'Audio'} (Slowed & Reverb)`,
          fileName: outFileName,
          processedAt: new Date().toISOString(),
          settings: {
            speed,
            pitchStyle,
            reverb,
            bassEQ: bassVal,
            midEQ,
            trebleEQ,
            tapeHiss,
            muffleCutoff,
            stereoWidth,
            wowFlutter,
            bitDepth
          }
        };
        cache.history.unshift(historyItem);
        saveCache(cache);

        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          file: outFileName,
          metadata: historyItem
        });
      } else {
        updateTask(taskId, { status: 'failed', error: 'Audio processing failed in FFmpeg.' });
      }
    });
  };

  runFfmpegProgress();
});

// POST /api/separate: Isolate vocals and instrumentals
app.post('/api/separate', (req, res) => {
  const { sourceFile, method = 'dsp' } = req.body;

  if (!sourceFile) {
    return res.status(400).json({ error: 'sourceFile is required' });
  }

  const inPath = path.join(DOWNLOADS_DIR, sourceFile);
  if (!fs.existsSync(inPath)) {
    return res.status(404).json({ error: 'Source audio file not found' });
  }

  const taskId = `sep_${Date.now()}`;
  const outVocName = `${taskId}_vocals.mp3`;
  const outInstName = `${taskId}_instrumental.mp3`;
  const outVocPath = path.join(PROCESSED_DIR, outVocName);
  const outInstPath = path.join(PROCESSED_DIR, outInstName);

  activeTasks.set(taskId, { status: 'processing', progress: 0 });
  res.json({ taskId, status: 'processing' });

  const runSeparation = async () => {
    const venvSepPath = path.join(__dirname, 'venv', 'bin', 'audio-separator');
    const hasAiSep = fs.existsSync(venvSepPath) && method === 'ai';

    if (hasAiSep) {
      console.log(`[Separate] Running Neural AI separation on ${sourceFile}`);
      // Copy source file to a unique temporary file inside processed dir to avoid collisions
      const tempSrcName = `${taskId}_temp${path.extname(sourceFile)}`;
      const tempSrcPath = path.join(PROCESSED_DIR, tempSrcName);
      
      try {
        fs.copyFileSync(inPath, tempSrcPath);
        updateTask(taskId, { progress: 10, status: 'processing' });
        
        const args = [
          tempSrcPath,
          '--output_dir', PROCESSED_DIR,
          '--output_format', 'mp3',
          '-m', 'UVR-MDX-NET-Voc_FT.onnx'
        ];
        
        const separatorProc = spawn(venvSepPath, args);

        separatorProc.stderr.on('data', (data) => {
          const logLine = data.toString();
          console.log(`[AI Sep Log]: ${logLine}`);
          
          // Parse progress bar percentage: e.g. " 38%|"
          const prgMatch = logLine.match(/(\d+)%\|/);
          if (prgMatch) {
            const pct = parseInt(prgMatch[1], 10);
            const scaledProgress = 10 + Math.round(pct * 0.75); // Scale 0-100% to 10-85%
            updateTask(taskId, { progress: scaledProgress });
          } else if (logLine.includes('Separating...')) {
            updateTask(taskId, { progress: 40 });
          } else if (logLine.includes('Saving')) {
            updateTask(taskId, { progress: 90 });
          }
        });

        separatorProc.on('close', (code) => {
          // Clean up temp source file
          try { fs.unlinkSync(tempSrcPath); } catch (e) {}

          if (code === 0) {
            // Scan PROCESSED_DIR for files starting with taskId_temp_
            const files = fs.readdirSync(PROCESSED_DIR);
            const separatedVocFile = files.find(f => f.startsWith(`${taskId}_temp_(Vocals)_`));
            const separatedInstFile = files.find(f => f.startsWith(`${taskId}_temp_(Instrumental)_`));

            if (separatedVocFile && separatedInstFile) {
              // Rename to standard paths
              fs.renameSync(path.join(PROCESSED_DIR, separatedVocFile), outVocPath);
              fs.renameSync(path.join(PROCESSED_DIR, separatedInstFile), outInstPath);

              updateTask(taskId, {
                status: 'completed',
                progress: 100,
                file: {
                  vocals: outVocName,
                  instrumental: outInstName
                }
              });
              console.log(`[Separate] AI Separation completed successfully.`);
              return;
            }
          }
          
          console.warn(`[Separate] AI Separation failed (code ${code}). Falling back to DSP method.`);
          runDspSeparation(true); // Fallback to DSP
        });
      } catch (err) {
        console.error(`[Separate] AI Separation exception:`, err);
        try { fs.unlinkSync(tempSrcPath); } catch (e) {}
        runDspSeparation(true);
      }

    } else {
      console.log(`[Separate] Running DSP separation on ${sourceFile}`);
      runDspSeparation(false);
    }
  };

  const runDspSeparation = (isFallback) => {
    // 1. Separate vocals: Mid channel with bandpass filter to isolate mid-range frequencies
    // 2. Separate instrumental: Left - Right cancellation
    const procVoc = spawn('ffmpeg', [
      '-i', inPath,
      '-af', 'stereotools=mode=ms,pan=stereo|c0=c0|c1=0,highpass=f=200,lowpass=f=4000',
      '-b:a', '192k',
      '-y', outVocPath
    ]);

    procVoc.on('close', (codeVoc) => {
      if (codeVoc !== 0) {
        updateTask(taskId, { status: 'failed', error: 'Vocal separation failed in FFmpeg.' });
        return;
      }

      updateTask(taskId, { progress: 50 });

      const procInst = spawn('ffmpeg', [
        '-i', inPath,
        '-af', 'pan=stereo|c0=c0-c1|c1=c1-c0',
        '-b:a', '192k',
        '-y', outInstPath
      ]);

      procInst.on('close', (codeInst) => {
        if (codeInst === 0) {
          updateTask(taskId, {
            status: 'completed',
            progress: 100,
            file: {
              vocals: outVocName,
              instrumental: outInstName,
              isFallback: isFallback
            }
          });
          console.log(`[Separate] DSP Separation completed.`);
        } else {
          updateTask(taskId, { status: 'failed', error: 'Instrumental separation failed in FFmpeg.' });
        }
      });
    });
  };

  runSeparation();
});

// GET /api/templates: Retrieve saved templates
app.get('/api/templates', (req, res) => {
  res.json(getTemplates());
});

// POST /api/templates: Save/update a custom template
app.post('/api/templates', (req, res) => {
  const { key, template } = req.body;
  if (!key || !template) {
    return res.status(400).json({ error: 'Key and template payload are required' });
  }
  const templates = getTemplates();
  templates[key] = template;
  saveTemplates(templates);
  res.json({ success: true, templates });
});

// DELETE /api/templates/:key: Remove a custom template
app.delete('/api/templates/:key', (req, res) => {
  const { key } = req.params;
  const templates = getTemplates();
  if (!templates[key]) {
    return res.status(404).json({ error: 'Template key not found' });
  }
  delete templates[key];
  saveTemplates(templates);
  res.json({ success: true, templates });
});

// GET /api/download-file/:fileName: Explicit attachment file download (forces 'Save As' browser dialog)
app.get('/api/download-file/:fileName', (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(PROCESSED_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  // Retrieve original title from cache history to give the downloaded file a clean name
  const cache = getCache();
  const item = cache.history.find(h => h.fileName === fileName);
  let cleanName = item ? item.title : fileName;
  
  // Sanitize file name for response headers
  cleanName = cleanName.replace(/[^\w\s.-]/gi, '_');
  if (!cleanName.toLowerCase().endsWith('.mp3') && !cleanName.toLowerCase().endsWith('.wav')) {
    const ext = path.extname(fileName) || '.mp3';
    cleanName += ext;
  }

  res.download(filePath, cleanName, (err) => {
    if (err) {
      console.error('[Download File] Error sending file:', err);
    }
  });
});

// Start backend server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`Lofi Wave Studio Backend running on port ${PORT}`);
  console.log(`=========================================`);
});
