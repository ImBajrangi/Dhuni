import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  Music, 
  RotateCcw, 
  Sliders, 
  Youtube, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Volume2, 
  Loader2, 
  Sparkles, 
  History,
  Trash2,
  Save,
  Plus,
  X
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:3001';

const PRESETS = {
  lofi: {
    name: '💤 Lofi Dream',
    speed: 0.82,
    pitchStyle: 'vinyl',
    pitchSemitones: 0,
    reverb: 'medium',
    bassEQ: 8,
    midEQ: -2,
    trebleEQ: -4,
    tapeHiss: 4,
    muffleCutoff: 3000
  },
  vaporwave: {
    name: '🌌 Vaporwave',
    speed: 0.72,
    pitchStyle: 'vinyl',
    pitchSemitones: 0,
    reverb: 'deep',
    bassEQ: 6,
    midEQ: -1,
    trebleEQ: -3,
    tapeHiss: 6,
    muffleCutoff: 2500
  },
  tiktok: {
    name: '🎵 TikTok',
    speed: 0.85,
    pitchStyle: 'vinyl',
    pitchSemitones: 0,
    reverb: 'medium',
    bassEQ: 5,
    midEQ: 0,
    trebleEQ: -1,
    tapeHiss: 2,
    muffleCutoff: 4000
  },
  cozy: {
    name: '🌧️ Cozy Rain',
    speed: 0.80,
    pitchStyle: 'vinyl',
    pitchSemitones: 0,
    reverb: 'deep',
    bassEQ: 7,
    midEQ: -3,
    trebleEQ: -5,
    tapeHiss: 8,
    muffleCutoff: 2000
  },
  nightcore: {
    name: '⚡ Nightcore',
    speed: 1.25,
    pitchStyle: 'vinyl',
    pitchSemitones: 0,
    reverb: 'light',
    bassEQ: 2,
    midEQ: 2,
    trebleEQ: 4,
    tapeHiss: 0,
    muffleCutoff: 20000
  }
};

function App() {
  // Source states
  const [sourceType, setSourceType] = useState('youtube'); // 'youtube' | 'upload'
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null); // { id, title, duration, thumbnail, url, isLocal }
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Audio effect settings
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [speed, setSpeed] = useState(0.85);
  const [pitchStyle, setPitchStyle] = useState('vinyl'); // 'vinyl' | 'stretch'
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [reverb, setReverb] = useState('medium'); // 'none' | 'light' | 'medium' | 'deep'
  const [bassEQ, setBassEQ] = useState(0); // dB (-10 to 12)
  const [midEQ, setMidEQ] = useState(0); // dB (-10 to 10)
  const [trebleEQ, setTrebleEQ] = useState(0); // dB (-10 to 10)
  const [tapeHiss, setTapeHiss] = useState(2); // percent (0-10) -> converts to volume
  const [muffleCutoff, setMuffleCutoff] = useState(3500); // Hz (1000-20000)
  const [exportFormat, setExportFormat] = useState('mp3'); // 'mp3' | 'wav'
  const [stereoWidth, setStereoWidth] = useState(1.0); // 0.0 to 2.0
  const [wowFlutter, setWowFlutter] = useState(0.0); // Tape Waver (0.0 to 1.0)
  const [bitDepth, setBitDepth] = useState(0); // Vintage resampler (0, 8, 12)
  const [visualizerMode, setVisualizerMode] = useState('wave'); // 'wave' | 'bars' | 'circular'
  const [showRetroGrid, setShowRetroGrid] = useState(true);
  const [gridColor, setGridColor] = useState('pink'); // 'pink' | 'cyan' | 'purple'
  const [activePreset, setActivePreset] = useState(null);

  // Vocal & Instrumental stem separation states
  const [isSeparating, setIsSeparating] = useState(false);
  const [separateProgress, setSeparateProgress] = useState(0);
  const [separateMethod, setSeparateMethod] = useState('dsp'); // 'ai' | 'dsp'
  const [separatedStems, setSeparatedStems] = useState(null); // { vocals, instrumental, vocalsUrl, instrumentalUrl, isFallback }

  // Keep a ref of tapeHiss to read inside ScriptProcessorNode without clicking
  const tapeHissRef = useRef(tapeHiss);
  tapeHissRef.current = tapeHiss;

  // Status & Progress States
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskProgress, setTaskProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Real-Time Preview States (Web Audio API)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState('');
  const [useFallbackAudio, setUseFallbackAudio] = useState(false); // Fallback on Web Audio failures

  // Audio Player States (Final processed files)
  const [currentAudioUrl, setCurrentAudioUrl] = useState('');
  const [currentAudioTitle, setCurrentAudioTitle] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // History States
  const [history, setHistory] = useState([]);

  // Custom Templates & Bulk Mode States
  const [customTemplates, setCustomTemplates] = useState({});
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkQueue, setBulkQueue] = useState([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkYtText, setBulkYtText] = useState('');
  const [bulkSourceType, setBulkSourceType] = useState('youtube'); // 'youtube' | 'upload'

  // DOM and Audio Web API Refs
  const audioRef = useRef(null);
  const previewAudioRef = useRef(null);
  const canvasRef = useRef(null);
  const gridOffsetRef = useRef(0);
  const fileInputRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Web Audio Graph Refs
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const bassFilterRef = useRef(null);
  const midFilterRef = useRef(null);
  const trebleFilterRef = useRef(null);
  const muffleFilterRef = useRef(null);
  const delayNodesRef = useRef([]);
  const fbGainsRef = useRef([]);
  const reverbDryGainRef = useRef(null);
  const reverbWetGainRef = useRef(null);
  const reverbWetFilterRef = useRef(null);
  const mainGainRef = useRef(null);
  const amixMusicGainRef = useRef(null);
  const makeupGainRef = useRef(null);
  const noiseSourceRef = useRef(null);
  const noiseGainRef = useRef(null);
  const previewAnalyserRef = useRef(null);

  // Stereo Width Expander Matrix Nodes
  const splitterNodeRef = useRef(null);
  const mergerNodeRef = useRef(null);
  const g1Ref = useRef(null);
  const g2Ref = useRef(null);
  const g3Ref = useRef(null);
  const g4Ref = useRef(null);

  // Tape Wow/Flutter & Bitcrusher Refs
  const wowDelayRef = useRef(null);
  const wowLfoRef = useRef(null);
  const wowLfoGainRef = useRef(null);
  const crusherNodeRef = useRef(null);
  const previewFinalGainRef = useRef(null);
  const pitchShifterNodeRef = useRef(null);

  // Persistent refs for final audio visualizer to prevent context closed stuttering
  const finalAudioContextRef = useRef(null);
  const finalAnalyserRef = useRef(null);
  const finalSourceNodeRef = useRef(null);

  // Load history and templates on mount
  useEffect(() => {
    fetchHistory();
    fetchTemplates();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/templates`);
      if (res.ok) {
        const data = await res.json();
        setCustomTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  // Reset settings helper
  const handleResetSettings = () => {
    setSpeed(0.85);
    setPitchStyle('vinyl');
    setPitchSemitones(0);
    setReverb('medium');
    setBassEQ(0);
    setMidEQ(0);
    setTrebleEQ(0);
    setTapeHiss(2);
    setMuffleCutoff(3500);
    setExportFormat('mp3');
    setActivePreset(null);
    setSeparatedStems(null);
    if (videoInfo) {
      setTrimStart(0);
      setTrimEnd(Math.round(videoInfo.duration));
    }
  };

  const handleLoadDemoTrack = () => {
    setSourceType('youtube');
    setErrorMessage('');
    disconnectAudioGraph();
    setVideoInfo({
      id: '37f091eae67e3ef6d72410d8a6aa2e07.mp3',
      title: '✨ Retro Lofi Beats (Demo Track)',
      duration: 65,
      thumbnail: null,
      isLocal: true
    });
    setTrimStart(0);
    setTrimEnd(65);
  };

  // Custom Template Management
  const handleSaveTemplate = async () => {
    const name = prompt("Enter a name for your custom template:");
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}`;
    const newTemplate = {
      name: name.trim(),
      speed,
      pitchStyle,
      pitchSemitones,
      reverb,
      bassEQ,
      midEQ,
      trebleEQ,
      tapeHiss,
      muffleCutoff,
      stereoWidth,
      wowFlutter,
      bitDepth
    };
    try {
      const res = await fetch(`${BACKEND_URL}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, template: newTemplate })
      });
      if (res.ok) {
        const data = await res.json();
        setCustomTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to save template to backend:', err);
    }
  };

  const applyCustomTemplate = (key) => {
    const t = customTemplates[key];
    if (!t) return;
    setSpeed(t.speed);
    setPitchStyle(t.pitchStyle);
    setPitchSemitones(t.pitchSemitones);
    setReverb(t.reverb);
    setBassEQ(t.bassEQ);
    setMidEQ(t.midEQ);
    setTrebleEQ(t.trebleEQ);
    setTapeHiss(t.tapeHiss);
    setMuffleCutoff(t.muffleCutoff);
    if (t.stereoWidth !== undefined) setStereoWidth(t.stereoWidth);
    if (t.wowFlutter !== undefined) setWowFlutter(t.wowFlutter);
    if (t.bitDepth !== undefined) setBitDepth(t.bitDepth);
    setActivePreset(null);
  };

  const deleteCustomTemplate = async (key, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${BACKEND_URL}/api/templates/${key}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setCustomTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to delete template from backend:', err);
    }
  };

  // Bulk Mode Helpers & Workers
  const addYtLinksToQueue = async (linksText) => {
    const lines = linksText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    
    setErrorMessage('');
    
    // Add temp items first with loading state
    const tempItems = lines.map((link, idx) => {
      const tempId = `yt_temp_${Date.now()}_${idx}`;
      return {
        id: tempId,
        title: `Fetching metadata for ${link.substring(0, 30)}${link.length > 30 ? '...' : ''}`,
        url: link,
        isLocal: false,
        status: 'fetching',
        progress: 0,
        error: null,
        outputFile: null
      };
    });
    
    setBulkQueue(prev => [...prev, ...tempItems]);
    setBulkYtText('');

    // Now fetch metadata for each link in background
    for (const item of tempItems) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/fetch-info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url })
        });
        const data = await res.json();
        
        if (res.ok) {
          setBulkQueue(prev => prev.map(q => q.id === item.id ? {
            ...q,
            id: data.id,
            title: data.title,
            duration: data.duration,
            thumbnail: data.thumbnail,
            status: 'queued'
          } : q));
        } else {
          setBulkQueue(prev => prev.map(q => q.id === item.id ? {
            ...q,
            title: `Error: ${item.url}`,
            status: 'failed',
            error: data.error || 'Failed to fetch video info.'
          } : q));
        }
      } catch (err) {
        setBulkQueue(prev => prev.map(q => q.id === item.id ? {
          ...q,
          title: `Error: ${item.url}`,
          status: 'failed',
          error: 'Connection error fetching info.'
        } : q));
      }
    }
  };

  const handleBulkFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setErrorMessage('');

    // Pre-queue them as uploading
    const tempItems = files.map((file, idx) => {
      const tempId = `upload_temp_${Date.now()}_${idx}`;
      return {
        id: tempId,
        title: `Uploading ${file.name}...`,
        isLocal: true,
        status: 'uploading',
        progress: 0,
        error: null,
        outputFile: null
      };
    });

    setBulkQueue(prev => [...prev, ...tempItems]);

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempItem = tempItems[i];
      
      const formData = new FormData();
      formData.append('file', file);

      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BACKEND_URL}/api/upload`, true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setBulkQueue(prev => prev.map(q => q.id === tempItem.id ? { ...q, progress: pct } : q));
          }
        };

        const uploadPromise = new Promise((resolve) => {
          xhr.onload = () => {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText);
              setBulkQueue(prev => prev.map(q => q.id === tempItem.id ? {
                ...q,
                id: data.file,
                title: data.title,
                duration: data.duration,
                status: 'queued',
                progress: 0
              } : q));
              resolve(true);
            } else {
              setBulkQueue(prev => prev.map(q => q.id === tempItem.id ? {
                ...q,
                status: 'failed',
                error: 'Upload failed.'
              } : q));
              resolve(false);
            }
          };

          xhr.onerror = () => {
            setBulkQueue(prev => prev.map(q => q.id === tempItem.id ? {
              ...q,
              status: 'failed',
              error: 'Upload connection error.'
            } : q));
            resolve(false);
          };

          xhr.send(formData);
        });

        await uploadPromise;
      } catch (err) {
        setBulkQueue(prev => prev.map(q => q.id === tempItem.id ? {
          ...q,
          status: 'failed',
          error: 'Process upload error.'
        } : q));
      }
    }
  };

  const handleStartBulkProcess = async () => {
    const queuedItems = bulkQueue.filter(item => item.status === 'queued' || item.status === 'failed');
    if (queuedItems.length === 0) return;

    setIsProcessingBulk(true);
    setErrorMessage('');

    // Iterate through items
    for (const item of queuedItems) {
      setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'downloading', progress: 0 } : q));

      try {
        let sourceFile = item.id;

        const listenToBulkProgress = (taskId, type) => {
          return new Promise((resolve, reject) => {
            const es = new EventSource(`${BACKEND_URL}/api/progress/${taskId}`);
            es.onmessage = (event) => {
              const data = JSON.parse(event.data);
              if (data.status === 'downloading' && type === 'downloading') {
                setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: Math.round(data.progress) } : q));
              } else if (data.status === 'processing' && type === 'processing') {
                setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: Math.round(data.progress) } : q));
              } else if (data.status === 'completed') {
                es.close();
                if (type === 'processing') {
                  setBulkQueue(prev => prev.map(q => q.id === item.id ? {
                    ...q,
                    status: 'completed',
                    progress: 100,
                    outputFile: data.file
                  } : q));
                } else {
                  setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: 100 } : q));
                }
                resolve(data.file);
              } else if (data.status === 'failed') {
                es.close();
                reject(new Error(data.error || 'Server task failed.'));
              }
            };
            es.onerror = () => {
              es.close();
              reject(new Error('Progress event link lost.'));
            };
          });
        };

        if (!item.isLocal) {
          // 1. Download
          const dlRes = await fetch(`${BACKEND_URL}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url, id: item.id })
          });
          const dlData = await dlRes.json();
          if (!dlRes.ok) throw new Error(dlData.error || 'Failed to download.');

          await listenToBulkProgress(dlData.taskId, 'downloading');
          sourceFile = `${item.id}.mp3`;
        }

        // 2. Process
        setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing', progress: 0 } : q));

        const procRes = await fetch(`${BACKEND_URL}/api/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceFile,
            title: item.title,
            speed,
            pitchStyle,
            pitchSemitones: pitchStyle === 'vinyl' ? Math.round(12 * Math.log2(speed)) : pitchSemitones,
            reverb,
            bassEQ,
            midEQ,
            trebleEQ,
            tapeHiss: tapeHiss / 200,
            muffleCutoff,
            stereoWidth,
            wowFlutter,
            bitDepth,
            exportFormat
          })
        });
        const procData = await procRes.json();
        if (!procRes.ok) throw new Error(procData.error || 'Process failed.');

        await listenToBulkProgress(procData.taskId, 'processing');

      } catch (err) {
        setBulkQueue(prev => prev.map(q => q.id === item.id ? {
          ...q,
          status: 'failed',
          progress: 0,
          error: err.message || 'Processing failed.'
        } : q));
      }
    }

    setIsProcessingBulk(false);
    fetchHistory();
  };

  const handleDeleteHistoryItem = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/history/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setHistory(prev => prev.filter(item => item.id !== id));
        
        // If deleted audio is playing in the main player, stop it
        const cacheItem = history.find(item => item.id === id);
        if (cacheItem) {
          const targetMediaUrl = `${BACKEND_URL}/media/${cacheItem.fileName}`;
          if (currentAudioUrl === targetMediaUrl) {
            if (audioRef.current) {
              audioRef.current.pause();
            }
            setCurrentAudioUrl('');
            setCurrentAudioTitle('');
            setIsPlaying(false);
          }
        }
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Failed to delete history item.');
      }
    } catch (err) {
      console.error('Error deleting history item:', err);
      setErrorMessage('Failed to connect to backend to delete item.');
    }
  };

  const applyPreset = (key) => {
    const p = PRESETS[key];
    if (!p) return;
    setSpeed(p.speed);
    setPitchStyle(p.pitchStyle);
    setPitchSemitones(p.pitchSemitones);
    setReverb(p.reverb);
    setBassEQ(p.bassEQ);
    setMidEQ(p.midEQ);
    setTrebleEQ(p.trebleEQ);
    setTapeHiss(p.tapeHiss);
    setMuffleCutoff(p.muffleCutoff);
    setActivePreset(key);
  };

  // 1. YouTube Info Fetcher
  const handleFetchInfo = async () => {
    if (!url) return;
    setIsFetchingInfo(true);
    setErrorMessage('');
    setVideoInfo(null);
    disconnectAudioGraph();

    try {
      const res = await fetch(`${BACKEND_URL}/api/fetch-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (res.ok) {
        setVideoInfo(data);
        setTrimStart(0);
        setTrimEnd(Math.round(data.duration));
      } else {
        setErrorMessage(data.error || 'Failed to retrieve video metadata.');
      }
    } catch (err) {
      setErrorMessage('Network error connecting to backend. Is the server running?');
    } finally {
      setIsFetchingInfo(false);
    }
  };

  // 2. Local File Uploader
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage('');
    setVideoInfo(null);
    setUploadProgress(0);
    disconnectAudioGraph();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BACKEND_URL}/api/upload`, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(pct);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setVideoInfo({
            id: data.file,
            title: data.title,
            duration: data.duration,
            thumbnail: null,
            isLocal: true
          });
          setTrimStart(0);
          setTrimEnd(Math.round(data.duration));
        } else {
          setErrorMessage('Failed to upload audio/video file.');
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setErrorMessage('Upload connection failed.');
      };

      xhr.send(formData);
    } catch (err) {
      setIsUploading(false);
      setErrorMessage('Failed to initiate upload.');
    }
  };

  const getReverbConfig = (r) => {
    switch (r) {
      case 'light':
        return {
          dry: 0.8,
          wet: 0.35,
          delays: [0.06, 0.08, 0.1, 0.1, 0.1],
          decays: [0.4, 0.3, 0.0, 0.0, 0.0],
          hfDamping: false
        };
      case 'medium':
        return {
          dry: 0.8,
          wet: 0.40,
          delays: [0.06, 0.08, 0.12, 0.1, 0.1],
          decays: [0.4, 0.3, 0.2, 0.0, 0.0],
          hfDamping: false
        };
      case 'deep':
        return {
          dry: 0.8,
          wet: 0.45,
          delays: [0.06, 0.09, 0.15, 0.22, 0.30],
          decays: [0.5, 0.4, 0.3, 0.2, 0.1],
          hfDamping: false
        };
      case 'silent_hall':
        return {
          dry: 0.85,
          wet: 0.48,
          delays: [0.07, 0.11, 0.18, 0.26, 0.35],
          decays: [0.55, 0.45, 0.35, 0.25, 0.15],
          hfDamping: true
        };
      default: // 'none'
        return {
          dry: 1.0,
          wet: 0.0,
          delays: [0.1, 0.1, 0.1, 0.1, 0.1],
          decays: [0.0, 0.0, 0.0, 0.0, 0.0],
          hfDamping: false
        };
    }
  };

  // Web Audio API Graph Builder
  const initAudioGraph = () => {
    if (audioContextRef.current) return;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;

      // 1. Create Source Node from preview audio element
      const source = ctx.createMediaElementSource(previewAudioRef.current);

      // 2. Multi-band Equalizer Nodes
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 150;
      bassFilter.gain.value = bassEQ;

      const midFilter = ctx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 5.0; // Q = 5.0 matches width=200 at f=1000 in FFmpeg
      midFilter.gain.value = midEQ;

      const trebleFilter = ctx.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 6000;
      trebleFilter.gain.value = trebleEQ;

      // 3. Muffle Filter (Lowpass)
      const muffleFilter = ctx.createBiquadFilter();
      muffleFilter.type = 'lowpass';
      muffleFilter.frequency.value = muffleCutoff;

      // 4. Reverb Effect (Multi-tap feedback delay matching FFmpeg's aecho filter)
      const reverbDryGain = ctx.createGain();
      const reverbWetGain = ctx.createGain();

      // High-Frequency Damping filter to eliminate airy ringing/hiss
      const reverbWetFilter = ctx.createBiquadFilter();
      reverbWetFilter.type = 'lowpass';

      const delayNodes = [];
      const fbGains = [];

      for (let i = 0; i < 5; i++) {
        const delayNode = ctx.createDelay(1.0);
        const fbGain = ctx.createGain();

        // Connect feedback loop: delayNode -> fbGain -> delayNode
        delayNode.connect(fbGain);
        fbGain.connect(delayNode);

        // Connect fbGain to wet filter instead of wet output directly
        fbGain.connect(reverbWetFilter);

        delayNodes.push(delayNode);
        fbGains.push(fbGain);
      }

      reverbWetFilter.connect(reverbWetGain);

      // 5. Tape Hiss (High-fidelity Pink Noise Loop with seamless loop crossfader)
      const fadeSamples = 4000;
      const loopSize = ctx.sampleRate * 2; // 2 seconds loop
      const totalSize = loopSize + fadeSamples;
      const noiseBuffer = ctx.createBuffer(1, loopSize, ctx.sampleRate);
      const tempOutput = new Float32Array(totalSize);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      
      for (let i = 0; i < totalSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        tempOutput[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        tempOutput[i] *= 0.11; // Level normalization
        b6 = white * 0.115926;
      }
      
      // Copy to buffer and crossfade the extra end samples over the beginning to completely eliminate periodic clicks
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < loopSize; i++) {
        if (i < fadeSamples) {
          const alpha = i / fadeSamples;
          output[i] = tempOutput[i] * alpha + tempOutput[loopSize + i] * (1 - alpha);
        } else {
          output[i] = tempOutput[i];
        }
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = isPreviewPlaying ? (tapeHiss / 200) : 0;

      // 6. Peak Limiter (WaveShaperNode hard clipper — matches FFmpeg alimiter=limit=0.95 exactly)
      // Unlike DynamicsCompressor (RMS-based, squashes sustained energy), this only clips
      // individual peaks exceeding ±0.95 — preserving full dynamics and tonal body.
      const limiterNode = ctx.createWaveShaper();
      const limCurveLen = 8192;
      const limCurve = new Float32Array(limCurveLen);
      for (let i = 0; i < limCurveLen; i++) {
        const x = (i * 2) / limCurveLen - 1;
        limCurve[i] = Math.max(-0.95, Math.min(0.95, x));
      }
      limiterNode.curve = limCurve;
      limiterNode.oversample = '4x'; // Anti-aliasing for clipped transients

      // Pass-through gains (no amix scaling needed — clipper handles peak limiting transparently)
      const amixMusicGain = ctx.createGain();
      amixMusicGain.gain.value = 1.0;

      const makeupGain = ctx.createGain();
      makeupGain.gain.value = 1.0;

      const finalGain = ctx.createGain();
      finalGain.gain.value = 1.0;

      noiseSource.connect(noiseGain);
      noiseGain.connect(limiterNode);
      noiseSource.start(0);

      // 7. Preview Analyser (for canvas visualizer)
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      // Connect standard paths
      // Source -> Bass -> Mid -> Treble -> Muffle Lowpass
      source.connect(bassFilter);
      bassFilter.connect(midFilter);
      midFilter.connect(trebleFilter);
      trebleFilter.connect(muffleFilter);

      // Reverb routing matching FFmpeg aecho exactly:
      // Dry path: muffleFilter -> reverbDryGain -> mainGain (scaled by 0.8 when reverb active)
      // Wet path: muffleFilter -> 5 parallel delay lines -> reverbWetGain -> mainGain (scaled by out_gain)
      const mainGain = ctx.createGain();
      mainGain.gain.value = 1.0;

      const reverbConfig = getReverbConfig(reverb);
      reverbDryGain.gain.value = reverbConfig.dry;
      reverbWetGain.gain.value = reverbConfig.wet;
      reverbWetFilter.frequency.value = reverbConfig.hfDamping ? 1000 : 20000;

      for (let i = 0; i < 5; i++) {
        delayNodes[i].delayTime.value = reverbConfig.delays[i];
        fbGains[i].gain.value = reverbConfig.decays[i];
      }

      muffleFilter.connect(reverbDryGain);
      reverbDryGain.connect(mainGain);

      for (let i = 0; i < 5; i++) {
        muffleFilter.connect(delayNodes[i]);
      }
      reverbWetGain.connect(mainGain);

      // Connect to splitter/merger matrix for stereo width adjustment, then to analyser, then to compressor, then to hardware output
      const splitter = ctx.createChannelSplitter(2);
      const merger = ctx.createChannelMerger(2);
      const g1 = ctx.createGain(); // L_in to L_out
      const g2 = ctx.createGain(); // R_in to L_out
      const g3 = ctx.createGain(); // L_in to R_out
      const g4 = ctx.createGain(); // R_in to R_out

      const w1 = (1 + stereoWidth) * 0.5;
      const w2 = (1 - stereoWidth) * 0.5;
      g1.gain.value = w1;
      g2.gain.value = w2;
      g3.gain.value = w2;
      g4.gain.value = w1;

      // 5.8 Wow & Flutter Delay Modulation
      const wowDelay = ctx.createDelay(0.1);
      wowDelay.delayTime.value = 0.005; // 5ms default delay offset
      
      const wowLfo = ctx.createOscillator();
      wowLfo.type = 'sine';
      wowLfo.frequency.value = 3.0; // 3Hz speed
      
      const wowLfoGain = ctx.createGain();
      wowLfoGain.gain.value = wowFlutter * 0.003; // scale up to 3ms modulation depth
      
      wowLfo.connect(wowLfoGain);
      wowLfoGain.connect(wowDelay.delayTime);
      wowLfo.start(0);

      // 5.9 Bitcrusher / Resampler Waveshaper
      const crusherNode = ctx.createWaveShaper();
      const generateCrushCurve = (bits) => {
        if (!bits || bits === 0) {
          // Stable linear pass-through curve to prevent browser audio glitches
          const passThrough = new Float32Array(2);
          passThrough[0] = -1;
          passThrough[1] = 1;
          return passThrough;
        }
        const steps = Math.pow(2, bits);
        const bufferSize = 44100;
        const curve = new Float32Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          const x = (i * 2) / bufferSize - 1;
          curve[i] = Math.round(x * (steps / 2)) / (steps / 2);
        }
        return curve;
      };
      crusherNode.curve = generateCrushCurve(bitDepth);

      // 5.10 Pitch Shifter Node
      const pitchShifterNode = ctx.createScriptProcessor(2048, 2, 2);
      pitchShifterNode.pitch = pitchStyle === 'vinyl' ? 1.0 : Math.pow(2, pitchSemitones / 12);
      
      const delayBufferL = new Float32Array(16384);
      const delayBufferR = new Float32Array(16384);
      let pitchWriteIndex = 0;
      const delaySize = 16384;
      const grainSize = 1024;
      
      pitchShifterNode.onaudioprocess = (e) => {
        const inputL = e.inputBuffer.getChannelData(0);
        const inputR = e.inputBuffer.getChannelData(1);
        const outputL = e.outputBuffer.getChannelData(0);
        const outputR = e.outputBuffer.getChannelData(1);
        
        const pitch = pitchShifterNode.pitch;
        if (Math.abs(pitch - 1.0) < 0.005) {
          outputL.set(inputL);
          outputR.set(inputR);
          return;
        }
        
        const len = e.inputBuffer.length;
        for (let i = 0; i < len; i++) {
          delayBufferL[pitchWriteIndex] = inputL[i];
          delayBufferR[pitchWriteIndex] = inputR[i];
          
          let delayTime1 = (pitchWriteIndex * (1 - pitch)) % grainSize;
          if (delayTime1 < 0) delayTime1 += grainSize;
          
          let delayTime2 = ((pitchWriteIndex + grainSize / 2) * (1 - pitch)) % grainSize;
          if (delayTime2 < 0) delayTime2 += grainSize;
          
          const x = (delayTime1 / grainSize);
          const fade1 = Math.sin(x * Math.PI);
          const fade2 = Math.sin(((x + 0.5) % 1.0) * Math.PI);
          
          let readIndex1 = Math.round(pitchWriteIndex - delayTime1);
          if (readIndex1 < 0) readIndex1 += delaySize;
          readIndex1 = readIndex1 % delaySize;
          
          let readIndex2 = Math.round(pitchWriteIndex - delayTime2);
          if (readIndex2 < 0) readIndex2 += delaySize;
          readIndex2 = readIndex2 % delaySize;
          
          outputL[i] = (delayBufferL[readIndex1] * fade1 + delayBufferL[readIndex2] * fade2) / (fade1 + fade2 || 1);
          outputR[i] = (delayBufferR[readIndex1] * fade1 + delayBufferR[readIndex2] * fade2) / (fade1 + fade2 || 1);
          
          pitchWriteIndex = (pitchWriteIndex + 1) % delaySize;
        }
      };

      // Route clean music path: mainGain -> wowDelay -> crusherNode -> pitchShifterNode -> splitter
      mainGain.connect(wowDelay);
      wowDelay.connect(crusherNode);
      crusherNode.connect(pitchShifterNode);
      pitchShifterNode.connect(splitter);

      splitter.connect(g1, 0, 0);
      splitter.connect(g3, 0, 0);
      splitter.connect(g2, 1, 0);
      splitter.connect(g4, 1, 0);

      g1.connect(merger, 0, 0);
      g2.connect(merger, 0, 0);
      g3.connect(merger, 0, 1);
      g4.connect(merger, 0, 1);

      // Route through peak limiter (hard clipper at ±0.95 — matches FFmpeg alimiter)
      merger.connect(amixMusicGain);
      amixMusicGain.connect(limiterNode);

      limiterNode.connect(makeupGain);
      makeupGain.connect(analyser);

      // Analyser goes to finalGain, then to destination
      analyser.connect(finalGain);
      finalGain.connect(ctx.destination);

      // Save references
      sourceNodeRef.current = source;
      bassFilterRef.current = bassFilter;
      midFilterRef.current = midFilter;
      trebleFilterRef.current = trebleFilter;
      muffleFilterRef.current = muffleFilter;
      delayNodesRef.current = delayNodes;
      fbGainsRef.current = fbGains;
      reverbDryGainRef.current = reverbDryGain;
      reverbWetGainRef.current = reverbWetGain;
      reverbWetFilterRef.current = reverbWetFilter;
      noiseSourceRef.current = noiseSource;
      noiseGainRef.current = noiseGain;
      mainGainRef.current = mainGain;
      amixMusicGainRef.current = amixMusicGain;
      makeupGainRef.current = makeupGain;
      splitterNodeRef.current = splitter;
      mergerNodeRef.current = merger;
      g1Ref.current = g1;
      g2Ref.current = g2;
      g3Ref.current = g3;
      g4Ref.current = g4;
      wowDelayRef.current = wowDelay;
      wowLfoRef.current = wowLfo;
      wowLfoGainRef.current = wowLfoGain;
      crusherNodeRef.current = crusherNode;
      pitchShifterNodeRef.current = pitchShifterNode;
      previewFinalGainRef.current = finalGain;
      previewAnalyserRef.current = analyser;
      setUseFallbackAudio(false);

    } catch (err) {
      console.warn('Web Audio API is not supported or blocked in this browser. Falling back to native controls.', err);
      setUseFallbackAudio(true);
    }
  };

  const disconnectAudioGraph = () => {
    try {
      if (noiseSourceRef.current) {
        try {
          noiseSourceRef.current.disconnect();
          noiseSourceRef.current.onaudioprocess = null;
        } catch (e) {}
      }
      if (wowLfoRef.current) {
        try { wowLfoRef.current.stop(); } catch (e) {}
        try { wowLfoRef.current.disconnect(); } catch (e) {}
      }
      if (wowLfoGainRef.current) {
        try { wowLfoGainRef.current.disconnect(); } catch (e) {}
      }
      if (wowDelayRef.current) {
        try { wowDelayRef.current.disconnect(); } catch (e) {}
      }
      if (crusherNodeRef.current) {
        try { crusherNodeRef.current.disconnect(); } catch (e) {}
      }
      if (pitchShifterNodeRef.current) {
        try {
          pitchShifterNodeRef.current.disconnect();
          pitchShifterNodeRef.current.onaudioprocess = null;
        } catch (e) {}
      }
      if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
      if (bassFilterRef.current) bassFilterRef.current.disconnect();
      if (midFilterRef.current) midFilterRef.current.disconnect();
      if (trebleFilterRef.current) trebleFilterRef.current.disconnect();
      if (muffleFilterRef.current) muffleFilterRef.current.disconnect();
      if (delayNodesRef.current && delayNodesRef.current.length > 0) {
        delayNodesRef.current.forEach(node => {
          try { node.disconnect(); } catch (e) {}
        });
      }
      if (fbGainsRef.current && fbGainsRef.current.length > 0) {
        fbGainsRef.current.forEach(node => {
          try { node.disconnect(); } catch (e) {}
        });
      }
      if (reverbDryGainRef.current) {
        try { reverbDryGainRef.current.disconnect(); } catch (e) {}
      }
      if (reverbWetGainRef.current) {
        try { reverbWetGainRef.current.disconnect(); } catch (e) {}
      }
      if (reverbWetFilterRef.current) {
        try { reverbWetFilterRef.current.disconnect(); } catch (e) {}
      }
      if (mainGainRef.current) mainGainRef.current.disconnect();
      if (amixMusicGainRef.current) {
        try { amixMusicGainRef.current.disconnect(); } catch (e) {}
      }
      if (makeupGainRef.current) {
        try { makeupGainRef.current.disconnect(); } catch (e) {}
      }
      if (splitterNodeRef.current) splitterNodeRef.current.disconnect();
      if (mergerNodeRef.current) mergerNodeRef.current.disconnect();
      if (g1Ref.current) g1Ref.current.disconnect();
      if (g2Ref.current) g2Ref.current.disconnect();
      if (g3Ref.current) g3Ref.current.disconnect();
      if (g4Ref.current) g4Ref.current.disconnect();
      if (previewFinalGainRef.current) {
        try { previewFinalGainRef.current.disconnect(); } catch (e) {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    } catch (e) {
      console.warn('Audio graph disconnect cleanups skipped:', e);
    }

    audioContextRef.current = null;
    sourceNodeRef.current = null;
    bassFilterRef.current = null;
    midFilterRef.current = null;
    trebleFilterRef.current = null;
    muffleFilterRef.current = null;
    delayNodesRef.current = [];
    fbGainsRef.current = [];
    reverbDryGainRef.current = null;
    reverbWetGainRef.current = null;
    reverbWetFilterRef.current = null;
    noiseSourceRef.current = null;
    noiseGainRef.current = null;
    tapeHissRef.current = null;
    mainGainRef.current = null;
    amixMusicGainRef.current = null;
    makeupGainRef.current = null;
    previewAnalyserRef.current = null;
    splitterNodeRef.current = null;
    mergerNodeRef.current = null;
    g1Ref.current = null;
    g2Ref.current = null;
    g3Ref.current = null;
    g4Ref.current = null;
    wowDelayRef.current = null;
    wowLfoRef.current = null;
    wowLfoGainRef.current = null;
    crusherNodeRef.current = null;
    pitchShifterNodeRef.current = null;
    previewFinalGainRef.current = null;
  };

  // Real-Time parameter listener adjustments (Smooth ramp transitions)
  useEffect(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.playbackRate = speed;
      previewAudioRef.current.preservesPitch = pitchStyle === 'stretch';
    }
  }, [speed, pitchStyle, previewAudioUrl]);

  useEffect(() => {
    if (bassFilterRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      bassFilterRef.current.gain.setTargetAtTime(bassEQ, ctx.currentTime, 0.05);
    }
  }, [bassEQ]);

  useEffect(() => {
    if (midFilterRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      midFilterRef.current.gain.setTargetAtTime(midEQ, ctx.currentTime, 0.05);
    }
  }, [midEQ]);

  useEffect(() => {
    if (trebleFilterRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      trebleFilterRef.current.gain.setTargetAtTime(trebleEQ, ctx.currentTime, 0.05);
    }
  }, [trebleEQ]);

  useEffect(() => {
    if (muffleFilterRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      muffleFilterRef.current.frequency.setTargetAtTime(muffleCutoff, ctx.currentTime, 0.05);
    }
  }, [muffleCutoff]);

  useEffect(() => {
    if (reverbDryGainRef.current && reverbWetGainRef.current && delayNodesRef.current.length > 0 && fbGainsRef.current.length > 0 && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const config = getReverbConfig(reverb);
      reverbDryGainRef.current.gain.setTargetAtTime(config.dry, ctx.currentTime, 0.05);
      reverbWetGainRef.current.gain.setTargetAtTime(config.wet, ctx.currentTime, 0.05);
      if (reverbWetFilterRef.current) {
        const targetFreq = config.hfDamping ? 1000 : 20000;
        reverbWetFilterRef.current.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
      }
      for (let i = 0; i < 5; i++) {
        if (delayNodesRef.current[i]) {
          delayNodesRef.current[i].delayTime.setTargetAtTime(config.delays[i], ctx.currentTime, 0.05);
        }
        if (fbGainsRef.current[i]) {
          fbGainsRef.current[i].gain.setTargetAtTime(config.decays[i], ctx.currentTime, 0.05);
        }
      }
    }
  }, [reverb]);

  useEffect(() => {
    if (noiseGainRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const targetGain = isPreviewPlaying ? (tapeHiss / 200) : 0;
      noiseGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
    }
  }, [tapeHiss, isPreviewPlaying]);

  useEffect(() => {
    if (g1Ref.current && g2Ref.current && g3Ref.current && g4Ref.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const w1 = (1 + stereoWidth) * 0.5;
      const w2 = (1 - stereoWidth) * 0.5;
      g1Ref.current.gain.setTargetAtTime(w1, ctx.currentTime, 0.05);
      g2Ref.current.gain.setTargetAtTime(w2, ctx.currentTime, 0.05);
      g3Ref.current.gain.setTargetAtTime(w2, ctx.currentTime, 0.05);
      g4Ref.current.gain.setTargetAtTime(w1, ctx.currentTime, 0.05);
    }
  }, [stereoWidth]);

  useEffect(() => {
    if (wowLfoGainRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      if (wowFlutter === 0) {
        // Force exact 0.0 gain to completely shut off delay modulation
        wowLfoGainRef.current.gain.setValueAtTime(0, ctx.currentTime);
      } else {
        wowLfoGainRef.current.gain.setTargetAtTime(wowFlutter * 0.003, ctx.currentTime, 0.05);
      }
    }
  }, [wowFlutter]);

  useEffect(() => {
    if (crusherNodeRef.current && audioContextRef.current) {
      const generateCrushCurve = (bits) => {
        if (!bits || bits === 0) {
          // Stable linear pass-through curve to prevent browser audio glitches
          const passThrough = new Float32Array(2);
          passThrough[0] = -1;
          passThrough[1] = 1;
          return passThrough;
        }
        const steps = Math.pow(2, bits);
        const bufferSize = 44100;
        const curve = new Float32Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          const x = (i * 2) / bufferSize - 1;
          curve[i] = Math.round(x * (steps / 2)) / (steps / 2);
        }
        return curve;
      };
      crusherNodeRef.current.curve = generateCrushCurve(bitDepth);
    }
  }, [bitDepth]);

  useEffect(() => {
    if (pitchShifterNodeRef.current && audioContextRef.current) {
      const targetPitch = pitchStyle === 'vinyl' ? 1.0 : Math.pow(2, pitchSemitones / 12);
      pitchShifterNodeRef.current.pitch = targetPitch;
    }
  }, [pitchSemitones, pitchStyle]);

  // Reset preview player states on base info change
  useEffect(() => {
    setIsPreviewPlaying(false);
    setPreviewAudioUrl('');
    disconnectAudioGraph();
  }, [videoInfo]);

  // Preview Playback Toggle Handler
  const handleTogglePreview = async () => {
    if (!videoInfo) return;
    setErrorMessage('');

    // If final player is currently active, pause it
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    if (isPreviewPlaying) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setIsPreviewPlaying(false);
      return;
    }

    setIsPreviewLoading(true);

    try {
      let targetFile = videoInfo.id;

      // If YouTube link, ensure file is downloaded to downloads folder first
      if (!videoInfo.isLocal) {
        const dlPath = `${videoInfo.id}.mp3`;
        const testRes = await fetch(`${BACKEND_URL}/downloads/${dlPath}`, { method: 'HEAD' });
        
        if (!testRes.ok) {
          // Trigger background download
          const dlRes = await fetch(`${BACKEND_URL}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoInfo.url, id: videoInfo.id })
          });
          const dlData = await dlRes.json();
          if (!dlRes.ok) throw new Error(dlData.error || 'Failed to download preview.');

          await listenToProgress(dlData.taskId, 'downloading');
        }
        targetFile = dlPath;
      }

      const previewUrl = `${BACKEND_URL}/downloads/${targetFile}`;
      setPreviewAudioUrl(previewUrl);
      setIsPreviewLoading(false);

      // Play audio on next tick after source update
      setTimeout(() => {
        if (previewAudioRef.current) {
          if (!audioContextRef.current && !useFallbackAudio) {
            initAudioGraph();
          }

          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
          }

          previewAudioRef.current.play()
            .then(() => setIsPreviewPlaying(true))
            .catch(e => {
              console.error('Playback failed:', e);
              setErrorMessage('Failed to trigger audio playback. Try clicking again.');
            });
        }
      }, 100);

    } catch (err) {
      setErrorMessage(err.message || 'Failed to initialize preview buffer.');
      setIsPreviewLoading(false);
    }
  };

  const handlePreviewEnded = () => {
    setIsPreviewPlaying(false);
  };

  // Final Output Playback Toggle
  const togglePlay = () => {
    if (!audioRef.current) return;

    // If preview player is active, pause it
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Play failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  // Load track from history
  const loadHistoryTrack = (track) => {
    // Stop preview if active
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    setCurrentAudioUrl(`${BACKEND_URL}/media/${track.fileName}`);
    setCurrentAudioTitle(track.title);
    setIsPlaying(false);

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(e => console.error(e));
      }
    }, 100);
  };

  // Combined Visualizer Canvas Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;
    let analyserNode = null;
    let audioContext = null;
    let source = null;

    const bufferLength = 64; // Visual complexity reduction for performance
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      // 1. Calculate Real-time Beat Detection (Bass Energy)
      let bassNormalized = 0;
      if (analyserNode) {
        analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 8; i++) {
          sum += dataArray[i];
        }
        bassNormalized = (sum / 8) / 255;
      } else {
        // Render flat baseline idle state
        ctx.fillStyle = '#080914';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const bassBoundary = canvas.width * 0.20;
        const midsBoundary = canvas.width * 0.75;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(bassBoundary, 0);
        ctx.lineTo(bassBoundary, canvas.height);
        ctx.moveTo(midsBoundary, 0);
        ctx.lineTo(midsBoundary, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '10px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.textAlign = 'center';
        ctx.fillText('BASS (20-250Hz)', bassBoundary / 2, canvas.height - 8);
        ctx.fillText('MIDS (250-4kHz)', bassBoundary + (midsBoundary - bassBoundary) / 2, canvas.height - 8);
        ctx.fillText('TREBLE (4k-20kHz)', midsBoundary + (canvas.width - midsBoundary) / 2, canvas.height - 8);

        ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        return;
      }

      ctx.fillStyle = '#080914';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Retro 3D perspective grid background if enabled
      if (showRetroGrid) {
        // Scroll speed increases dynamically when bass beat pumps
        gridOffsetRef.current = (gridOffsetRef.current || 0) + (0.012 + bassNormalized * 0.088);
        if (gridOffsetRef.current > 1) {
          gridOffsetRef.current -= 1;
        }

        let gridStroke = 'rgba(236, 72, 153, 0.12)'; // Default Neon Pink
        let horizonStroke = 'rgba(236, 72, 153, 0.03)';
        if (gridColor === 'cyan') {
          gridStroke = 'rgba(6, 182, 212, 0.12)';
          horizonStroke = 'rgba(6, 182, 212, 0.03)';
        } else if (gridColor === 'purple') {
          gridStroke = 'rgba(139, 92, 246, 0.12)';
          horizonStroke = 'rgba(139, 92, 246, 0.03)';
        }

        const vX = canvas.width / 2;
        const vY = canvas.height * 0.12; // Vanishing point near top horizon

        // Horizon line
        ctx.strokeStyle = horizonStroke;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, vY);
        ctx.lineTo(canvas.width, vY);
        ctx.stroke();

        ctx.strokeStyle = gridStroke;
        ctx.lineWidth = 1;

        // Radiating perspective lines
        const numPerspectiveLines = 14;
        for (let i = 0; i <= numPerspectiveLines; i++) {
          const ratio = i / numPerspectiveLines;
          const targetX = ratio * canvas.width;
          ctx.beginPath();
          ctx.moveTo(vX, vY);
          ctx.lineTo(targetX, canvas.height);
          ctx.stroke();
        }

        // Horizontal lines scrolling down
        const numHorizontalLines = 7;
        for (let i = 0; i < numHorizontalLines; i++) {
          const ratio = (i + gridOffsetRef.current) / numHorizontalLines;
          const y = vY + Math.pow(ratio, 2.5) * (canvas.height - vY);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }

      // 3. Draw Grid Partition Zones (Frequency dividers)
      const bassBoundary = canvas.width * 0.20;
      const midsBoundary = canvas.width * 0.75;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bassBoundary, 0);
      ctx.lineTo(bassBoundary, canvas.height);
      ctx.moveTo(midsBoundary, 0);
      ctx.lineTo(midsBoundary, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Text Labels
      ctx.font = '10px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.textAlign = 'center';
      ctx.fillText('BASS (20-250Hz)', bassBoundary / 2, canvas.height - 8);
      ctx.fillText('MIDS (250-4kHz)', bassBoundary + (midsBoundary - bassBoundary) / 2, canvas.height - 8);
      ctx.fillText('TREBLE (4k-20kHz)', midsBoundary + (canvas.width - midsBoundary) / 2, canvas.height - 8);

      // 4. Draw the EQ Curve Overlay as a dotted line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();

      const getEqY = (xPos) => {
        const midX = canvas.width / 2;
        let eqGain = 0;
        
        if (xPos < bassBoundary) {
          eqGain = bassEQ;
        } else if (xPos > midsBoundary) {
          eqGain = trebleEQ;
        } else {
          if (xPos < midX) {
            const ratio = (xPos - bassBoundary) / (midX - bassBoundary);
            eqGain = bassEQ * (1 - ratio) + midEQ * ratio;
          } else {
            const ratio = (xPos - midX) / (midsBoundary - midX);
            eqGain = midEQ * (1 - ratio) + trebleEQ * ratio;
          }
        }
        const center = canvas.height * 0.45;
        return center - (eqGain / 12) * (canvas.height * 0.35);
      };

      ctx.moveTo(0, getEqY(0));
      for (let xp = 1; xp < canvas.width; xp++) {
        ctx.lineTo(xp, getEqY(xp));
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // 5. Render active visualizer mode spectrum
      if (visualizerMode === 'wave') {
        // Mode 1: Neon Wave (Smooth glowing Bezier curve)
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        const step = canvas.width / (bufferLength - 1);
        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const y = canvas.height - (percent * canvas.height * 0.78);
          const x = i * step;

          if (i === 0) {
            ctx.lineTo(x, y);
          } else {
            const prevX = (i - 1) * step;
            const prevValue = dataArray[i - 1];
            const prevPercent = prevValue / 255;
            const prevY = canvas.height - (prevPercent * canvas.height * 0.78);
            const cpX1 = prevX + step / 2;
            const cpY1 = prevY;
            const cpX2 = prevX + step / 2;
            const cpY2 = y;
            ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x, y);
          }
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        if (isPreviewPlaying) {
          grad.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
          grad.addColorStop(0.5, 'rgba(139, 92, 246, 0.2)');
          grad.addColorStop(1, 'rgba(8, 9, 20, 0)');
          ctx.strokeStyle = '#06b6d4';
        } else {
          grad.addColorStop(0, 'rgba(236, 72, 153, 0.45)');
          grad.addColorStop(0.5, 'rgba(139, 92, 246, 0.2)');
          grad.addColorStop(1, 'rgba(8, 9, 20, 0)');
          ctx.strokeStyle = '#ec4899';
        }
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = isPreviewPlaying ? '#06b6d4' : '#ec4899';

        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const y = canvas.height - (percent * canvas.height * 0.78);
          const x = i * step;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevX = (i - 1) * step;
            const prevValue = dataArray[i - 1];
            const prevPercent = prevValue / 255;
            const prevY = canvas.height - (prevPercent * canvas.height * 0.78);
            const cpX1 = prevX + step / 2;
            const cpY1 = prevY;
            const cpX2 = prevX + step / 2;
            const cpY2 = y;
            ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

      } else if (visualizerMode === 'bars') {
        // Mode 2: Cyber Bars (Vertical glowing gradient columns)
        const step = canvas.width / bufferLength;
        const barWidth = Math.max(step * 0.75, 2.5);
        const strokeColor = isPreviewPlaying ? '#06b6d4' : '#ec4899';
        
        ctx.shadowBlur = 8;
        ctx.shadowColor = strokeColor;

        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const barHeight = percent * canvas.height * 0.76;
          const x = i * step;
          const y = canvas.height - barHeight;

          const barGrad = ctx.createLinearGradient(x, y, x, canvas.height);
          if (isPreviewPlaying) {
            barGrad.addColorStop(0, '#06b6d4');
            barGrad.addColorStop(0.5, '#8b5cf6');
            barGrad.addColorStop(1, 'rgba(8, 9, 20, 0.2)');
          } else {
            barGrad.addColorStop(0, '#ec4899');
            barGrad.addColorStop(0.5, '#8b5cf6');
            barGrad.addColorStop(1, 'rgba(8, 9, 20, 0.2)');
          }
          ctx.fillStyle = barGrad;
          ctx.fillRect(x, y, barWidth, barHeight);
        }
        ctx.shadowBlur = 0;

      } else if (visualizerMode === 'circular') {
        // Mode 3: Retro Circular (Pulse visualizer centered in canvas card)
        const cX = canvas.width / 2;
        const cY = canvas.height * 0.45;
        const baseRadius = 26 + bassNormalized * 6; // pulse base circle to the beat!
        const strokeColor = isPreviewPlaying ? '#06b6d4' : '#ec4899';

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = strokeColor;

        ctx.beginPath();
        for (let i = 0; i <= bufferLength; i++) {
          const index = i % bufferLength;
          const value = dataArray[index];
          const percent = value / 255;
          const angle = (i / bufferLength) * Math.PI * 2;
          const r = baseRadius + percent * 24;
          const x = cX + Math.cos(angle) * r;
          const y = cY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();

        const circGrad = ctx.createRadialGradient(cX, cY, baseRadius * 0.5, cX, cY, baseRadius + 24);
        if (isPreviewPlaying) {
          circGrad.addColorStop(0, 'rgba(8, 9, 20, 0.1)');
          circGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.06)');
          circGrad.addColorStop(1, 'rgba(6, 182, 212, 0.18)');
        } else {
          circGrad.addColorStop(0, 'rgba(8, 9, 20, 0.1)');
          circGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.06)');
          circGrad.addColorStop(1, 'rgba(236, 72, 153, 0.18)');
        }
        ctx.fillStyle = circGrad;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    // Determine visual audio source
    if (isPreviewPlaying && previewAnalyserRef.current) {
      analyserNode = previewAnalyserRef.current;
      draw();
    } else if (isPlaying && audioRef.current) {
      if (!finalAudioContextRef.current) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          finalAudioContextRef.current = ctx;

          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          finalAnalyserRef.current = analyser;

          const source = ctx.createMediaElementSource(audioRef.current);
          finalSourceNodeRef.current = source;

          source.connect(analyser);
          analyser.connect(ctx.destination);
        } catch (err) {
          console.warn('Spectrum analyzer binding failed:', err);
        }
      }

      if (finalAudioContextRef.current) {
        if (finalAudioContextRef.current.state === 'suspended') {
          finalAudioContextRef.current.resume();
        }
        analyserNode = finalAnalyserRef.current;
      }
      
      draw();
    } else {
      draw();
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, isPreviewPlaying, currentAudioUrl, bassEQ, midEQ, trebleEQ, visualizerMode, showRetroGrid, gridColor]);

  // Clean EventSource connections on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      disconnectAudioGraph();
      
      // Cleanup final player persistent context
      if (finalAudioContextRef.current) {
        finalAudioContextRef.current.close();
      }
    };
  }, []);

  // 3. Process Execution Trigger (Offline Server Render)
  const handleGenerate = async () => {
    if (!videoInfo) return;
    setIsProcessing(true);
    setTaskProgress(0);
    setStatusText('Preparing download context...');
    setErrorMessage('');

    // Stop real-time preview playback
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    try {
      let sourceFile = videoInfo.id;

      if (!videoInfo.isLocal) {
        // Queue YT download first if not available
        setStatusText('Fetching audio stream from YouTube...');
        const dlRes = await fetch(`${BACKEND_URL}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoInfo.url, id: videoInfo.id })
        });
        const dlData = await dlRes.json();
        
        if (!dlRes.ok) throw new Error(dlData.error || 'Failed to download source track.');

        await listenToProgress(dlData.taskId, 'downloading');
        sourceFile = `${videoInfo.id}.mp3`;
      }

      // Process effect rendering
      setStatusText('Baking HQ slowed & reverb files...');
      const procRes = await fetch(`${BACKEND_URL}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFile,
          title: videoInfo.title,
          trimStart,
          trimEnd,
          speed,
          pitchStyle,
          pitchSemitones: pitchStyle === 'vinyl' ? Math.round(12 * Math.log2(speed)) : pitchSemitones,
          reverb,
          bassEQ,
          midEQ,
          trebleEQ,
          tapeHiss: tapeHiss / 200, // Converts 0-10 back to volume multiplier
          muffleCutoff,
          stereoWidth,
          wowFlutter,
          bitDepth,
          exportFormat
        })
      });
      const procData = await procRes.json();
      if (!procRes.ok) throw new Error(procData.error || 'FFmpeg encoding failed.');

      await listenToProgress(procData.taskId, 'processing');

    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during final file compile.');
      setIsProcessing(false);
    }
  };

  const handleSeparate = async () => {
    if (!videoInfo) return;
    setIsSeparating(true);
    setSeparateProgress(0);
    setErrorMessage('');
    setSeparatedStems(null);

    // Stop preview
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }

    try {
      let sourceFile = videoInfo.id;

      // If YT link, download first
      if (!videoInfo.isLocal) {
        const dlPath = `${videoInfo.id}.mp3`;
        const testRes = await fetch(`${BACKEND_URL}/downloads/${dlPath}`, { method: 'HEAD' });
        if (!testRes.ok) {
          const dlRes = await fetch(`${BACKEND_URL}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoInfo.url, id: videoInfo.id })
          });
          const dlData = await dlRes.json();
          if (!dlRes.ok) throw new Error(dlData.error || 'Failed to download source track.');
          await listenToProgress(dlData.taskId, 'downloading');
        }
        sourceFile = dlPath;
      }

      const res = await fetch(`${BACKEND_URL}/api/separate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFile,
          title: videoInfo.title,
          method: separateMethod
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Separation request failed.');

      await listenToSeparateProgress(data.taskId);

    } catch (err) {
      setErrorMessage(err.message || 'Stem separation failed.');
      setIsSeparating(false);
    }
  };

  const listenToSeparateProgress = (taskId) => {
    return new Promise((resolve, reject) => {
      const es = new EventSource(`${BACKEND_URL}/api/progress/${taskId}`);
      
      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.status === 'processing') {
          setSeparateProgress(Math.round(data.progress || 0));
        } else if (data.status === 'completed') {
          es.close();
          setSeparateProgress(100);
          setIsSeparating(false);
          setSeparatedStems({
            vocals: data.file.vocals,
            instrumental: data.file.instrumental,
            vocalsUrl: `${BACKEND_URL}/media/${data.file.vocals}`,
            instrumentalUrl: `${BACKEND_URL}/media/${data.file.instrumental}`,
            isFallback: data.file.isFallback
          });
          resolve();
        } else if (data.status === 'failed') {
          es.close();
          setIsSeparating(false);
          reject(new Error(data.error || 'Vocal isolation failed on backend.'));
        }
      };

      es.onerror = () => {
        es.close();
        setIsSeparating(false);
        reject(new Error('SSE connection failed for separation.'));
      };
    });
  };

  const listenToProgress = (taskId, type) => {
    return new Promise((resolve, reject) => {
      if (eventSourceRef.current) eventSourceRef.current.close();

      const es = new EventSource(`${BACKEND_URL}/api/progress/${taskId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.status === 'downloading' && type === 'downloading') {
          setTaskProgress(Math.round(data.progress));
        } else if (data.status === 'processing' && type === 'processing') {
          setTaskProgress(Math.round(data.progress));
        } else if (data.status === 'completed') {
          es.close();
          setTaskProgress(100);
          if (type === 'processing') {
            setIsProcessing(false);
            setCurrentAudioUrl(`${BACKEND_URL}/media/${data.file}`);
            setCurrentAudioTitle(data.metadata?.title || 'Lofi Remix');
            fetchHistory();
          }
          resolve();
        } else if (data.status === 'failed') {
          es.close();
          setIsProcessing(false);
          reject(new Error(data.error || 'Server processing failed.'));
        }
      };

      es.onerror = () => {
        es.close();
        setIsProcessing(false);
        reject(new Error('Progress event link lost.'));
      };
    });
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === null) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
      
      {/* Hidden Base Preview Audio Player */}
      <audio 
        ref={previewAudioRef} 
        src={previewAudioUrl || null} 
        crossOrigin="anonymous" 
        onEnded={handlePreviewEnded} 
        style={{ display: 'none' }}
      />

      {/* Header Banner */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              background: 'linear-gradient(to right, #06b6d4, #8b5cf6, #ec4899)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              LOFI WAVE
            </span>
            <span style={{ color: '#ffffff', fontWeight: 300 }}>STUDIO</span>
            <Sparkles className="glow-text-pink" style={{ color: '#ec4899', width: '24px', height: '24px' }} />
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '5px', fontSize: '0.95rem' }}>
            Automate slowed & reverb lofi aesthetics from YouTube links or local uploads.
          </p>
        </div>
        <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }}></div>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>System Ready</span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        
        {/* Left Side: Sources & Audio Controller Deck */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Deck 1: Source Loader */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 className="panel-title" style={{ margin: 0 }}>
                  <Youtube style={{ color: 'var(--accent-cyan)' }} />
                  Lofi Engine Mode
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choose single track editing or bulk rendering queue</p>
              </div>
              
              {/* Mode Selector */}
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setBulkMode(false)}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '0.8rem', 
                    border: 'none', 
                    borderRadius: '6px',
                    background: !bulkMode ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
                    color: !bulkMode ? 'var(--accent-purple)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🎵 Single Track
                </button>
                <button 
                  onClick={() => { setBulkMode(true); setVideoInfo(null); }}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '0.8rem', 
                    border: 'none', 
                    borderRadius: '6px',
                    background: bulkMode ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
                    color: bulkMode ? 'var(--accent-purple)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📦 Bulk Queue
                </button>
              </div>
            </div>

            {bulkMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Bulk Source Switcher */}
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                  <button 
                    onClick={() => setBulkSourceType('youtube')}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.8rem', 
                      border: 'none', 
                      borderRadius: '6px',
                      background: bulkSourceType === 'youtube' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                      color: bulkSourceType === 'youtube' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    YouTube Links
                  </button>
                  <button 
                    onClick={() => setBulkSourceType('upload')}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.8rem', 
                      border: 'none', 
                      borderRadius: '6px',
                      background: bulkSourceType === 'upload' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                      color: bulkSourceType === 'upload' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Local Files
                  </button>
                </div>

                {bulkSourceType === 'youtube' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <textarea
                      placeholder="Paste YouTube links here (One link per line)..."
                      value={bulkYtText}
                      onChange={(e) => setBulkYtText(e.target.value)}
                      style={{
                        width: '100%',
                        height: '90px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace',
                        resize: 'vertical'
                      }}
                    />
                    <button
                      onClick={() => addYtLinksToQueue(bulkYtText)}
                      disabled={!bulkYtText.trim()}
                      className="btn-primary"
                      style={{
                        alignSelf: 'flex-start',
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Plus style={{ width: '14px', height: '14px' }} />
                      Add to Bulk Queue
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div 
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      style={{
                        border: '2px dashed var(--border-color)',
                        borderRadius: '12px',
                        padding: '24px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(0,0,0,0.15)',
                        transition: 'all 0.25s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      <UploadCloud style={{ width: '36px', height: '36px', color: 'var(--text-secondary)', margin: '0 auto 8px' }} />
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        Click to select multiple local audio/video files
                      </p>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="audio/*,video/*" 
                        multiple={true}
                        onChange={handleBulkFileUpload} 
                        style={{ display: 'none' }} 
                      />
                    </div>
                  </div>
                )}

                {/* Bulk Queue List */}
                {bulkQueue.length > 0 && (
                  <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Queue ({bulkQueue.length} Tracks)
                      </span>
                      <button
                        onClick={() => setBulkQueue([])}
                        disabled={isProcessingBulk}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Clear All
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                      {bulkQueue.map((item, index) => (
                        <div 
                          key={item.id + '_' + index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(255,255,255,0.02)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.05)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                background: 
                                  item.status === 'completed' ? 'rgba(34,197,94,0.15)' :
                                  item.status === 'failed' ? 'rgba(239,68,68,0.15)' :
                                  item.status === 'queued' ? 'rgba(255,255,255,0.05)' :
                                  item.status === 'fetching' ? 'rgba(236,72,153,0.15)' :
                                  'rgba(6,182,212,0.15)',
                                color:
                                  item.status === 'completed' ? '#22c55e' :
                                  item.status === 'failed' ? '#ef4444' :
                                  item.status === 'queued' ? 'var(--text-muted)' :
                                  item.status === 'fetching' ? 'var(--accent-pink)' :
                                  'var(--accent-cyan)'
                              }}>
                                {item.status}
                              </span>
                              {item.error && (
                                <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>
                                  ({item.error})
                                </span>
                              )}
                            </div>
                            
                            {/* Individual Item Progress */}
                            {(item.status === 'downloading' || item.status === 'processing' || item.status === 'uploading' || item.status === 'fetching') && (
                              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                                <div style={{ width: `${item.progress || 0}%`, height: '100%', background: 'var(--accent-cyan)', transition: 'width 0.1s ease' }}></div>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                            {item.status === 'completed' && item.outputFile && (
                              <a
                                href={`${BACKEND_URL}/api/download-file/${item.outputFile}`}
                                download
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  background: 'rgba(34,197,94,0.2)',
                                  color: '#22c55e',
                                  border: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <Download style={{ width: '14px', height: '14px' }} />
                              </a>
                            )}
                            <button
                              onClick={() => setBulkQueue(prev => prev.filter((_, idx) => idx !== index))}
                              disabled={isProcessingBulk}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: 'rgba(239,68,68,0.1)',
                                color: '#ef4444',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ⚠️ Notice: Active effects & presets on the right will be baked into each queued audio.
                      </p>
                      <button
                        onClick={handleStartBulkProcess}
                        disabled={isProcessingBulk || bulkQueue.filter(q => q.status === 'queued' || q.status === 'failed').length === 0}
                        className="btn-primary"
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          background: 'linear-gradient(135deg, var(--accent-pink) 0%, var(--accent-purple) 100%)',
                          boxShadow: '0 4px 15px rgba(236,72,153,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        {isProcessingBulk ? (
                          <>
                            <Loader2 className="spinning" style={{ width: '18px', height: '18px' }} />
                            Baking Batch slowed & reverb...
                          </>
                        ) : (
                          <>
                            <Sparkles style={{ width: '18px', height: '18px' }} />
                            Process {bulkQueue.filter(q => q.status === 'queued' || q.status === 'failed').length} Tracks in Bulk
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                  <button 
                    onClick={() => { setSourceType('youtube'); setVideoInfo(null); }}
                    className="btn-secondary"
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.85rem', 
                      border: 'none', 
                      borderRadius: '6px',
                      background: sourceType === 'youtube' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                      color: sourceType === 'youtube' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontWeight: 600
                    }}
                  >
                    YouTube Link
                  </button>
                  <button 
                    onClick={() => { setSourceType('upload'); setVideoInfo(null); }}
                    className="btn-secondary"
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.85rem', 
                      border: 'none', 
                      borderRadius: '6px',
                      background: sourceType === 'upload' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                      color: sourceType === 'upload' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                      fontWeight: 600
                    }}
                  >
                    Local Upload
                  </button>
                </div>

                {/* Quick Demo Track Loader Option */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', marginBottom: '4px' }}>
                  <button
                    onClick={handleLoadDemoTrack}
                    className="btn-secondary"
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.8rem', 
                      borderRadius: '8px',
                      borderColor: 'var(--accent-pink)',
                      color: 'var(--accent-pink)',
                      background: 'rgba(236, 72, 153, 0.05)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Sparkles style={{ width: '12px', height: '12px' }} />
                    Try a Demo Track
                  </button>
                </div>

                {sourceType === 'youtube' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                        <input 
                          type="text" 
                          placeholder="Paste YouTube video or audio link..."
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                      </div>
                      <button 
                        className="btn-primary" 
                        onClick={handleFetchInfo}
                        disabled={isFetchingInfo || !url}
                        style={{ minWidth: '130px' }}
                      >
                        {isFetchingInfo ? (
                          <>
                            <Loader2 className="animate-spin-custom" style={{ width: '18px', height: '18px' }} />
                            Analyzing...
                          </>
                        ) : 'Fetch Video'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: '2px dashed var(--border-color)',
                        borderRadius: '12px',
                        padding: '30px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(0,0,0,0.15)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      <UploadCloud style={{ width: '40px', height: '40px', color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                      <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {isUploading ? `Uploading file (${uploadProgress}%)` : 'Drag and drop or click to upload file'}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                        Supports MP3, WAV, FLAC, MP4, MKV (Audio extracted automatically)
                      </p>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="audio/*,video/*" 
                        onChange={handleFileUpload} 
                        style={{ display: 'none' }} 
                      />
                    </div>
                    {isUploading && (
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent-purple)', transition: 'width 0.1s ease' }}></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div style={{ 
                marginTop: '16px', 
                padding: '12px 16px', 
                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                borderRadius: '8px',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.9rem'
              }}>
                <AlertTriangle style={{ flexShrink: 0, width: '18px', height: '18px' }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Video Metadata Panel */}
            {videoInfo && (
              <div style={{ 
                marginTop: '20px', 
                display: 'flex', 
                gap: '16px', 
                padding: '16px', 
                background: 'rgba(255,255,255,0.02)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '12px',
                alignItems: 'center'
              }}>
                {videoInfo.thumbnail ? (
                  <img 
                    src={videoInfo.thumbnail} 
                    alt="thumbnail" 
                    style={{ width: '120px', height: '68px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} 
                  />
                ) : (
                  <div style={{ width: '120px', height: '68px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Music style={{ color: 'var(--accent-purple)' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ 
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'normal',
                    fontWeight: 600, 
                    fontSize: '0.95rem', 
                    margin: 0, 
                    color: 'var(--text-primary)',
                    lineHeight: '1.4'
                  }}>
                    {videoInfo.title}
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                    Original Duration: <strong style={{ color: 'var(--text-primary)' }}>{formatTime(videoInfo.duration)}</strong>
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-green)', fontSize: '0.8rem', marginTop: '6px', fontWeight: 500 }}>
                    <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                    Source loaded successfully
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Deck 1.5: Vocal & Instrumental Stem Separator */}
          {videoInfo && (
            <section className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                🎙️ Stem Separator (Vocal & Instrumentals)
              </h3>
              
              {!separatedStems ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Extract the vocal acapella and backing track stems individually. Perfect for remixing and making lofi beats.
                  </p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    {/* Method selection */}
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)', flex: 1 }}>
                      <button
                        onClick={() => setSeparateMethod('ai')}
                        disabled={isSeparating}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          fontSize: '0.75rem',
                          border: 'none',
                          borderRadius: '4px',
                          background: separateMethod === 'ai' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                          color: separateMethod === 'ai' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🧠 Neural AI (HQ)
                      </button>
                      <button
                        onClick={() => setSeparateMethod('dsp')}
                        disabled={isSeparating}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          fontSize: '0.75rem',
                          border: 'none',
                          borderRadius: '4px',
                          background: separateMethod === 'dsp' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                          color: separateMethod === 'dsp' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ DSP Filter (Fast)
                      </button>
                    </div>

                    <button
                      onClick={handleSeparate}
                      disabled={isSeparating}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px', minWidth: '120px' }}
                    >
                      {isSeparating ? (
                        <>
                          <Loader2 className="animate-spin-custom" style={{ width: '12px', height: '12px' }} />
                          Splitting...
                        </>
                      ) : 'Split Tracks'}
                    </button>
                  </div>
                  
                  {isSeparating && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Extracting vocals & instruments...</span>
                        <span>{separateProgress}%</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${separateProgress}%`, height: '100%', background: 'var(--accent-purple)', transition: 'width 0.2s ease' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {separatedStems.isFallback && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', margin: '0 0 4px 0' }}>
                      * System used DSP phase filters (AI environment initialization pending).
                    </p>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Vocals Stem Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>🎙️ Vocals Stem</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Acapella extract</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setPreviewAudioUrl(separatedStems.vocalsUrl);
                            setErrorMessage('Loaded vocals stem. Click "Live Preview" or play below.');
                          }}
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => {
                            setVideoInfo({
                              id: separatedStems.vocals,
                              title: `${videoInfo.title} (Vocals Stem)`,
                              duration: videoInfo.duration,
                              thumbnail: videoInfo.thumbnail,
                              isLocal: true
                            });
                            setSeparatedStems(null);
                          }}
                          className="btn-primary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))' }}
                        >
                          Load Stem
                        </button>
                      </div>
                    </div>

                    {/* Instrumental Stem Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>🎹 Instrumental Stem</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Backing track extract</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setPreviewAudioUrl(separatedStems.instrumentalUrl);
                            setErrorMessage('Loaded instrumental stem. Click "Live Preview" or play below.');
                          }}
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => {
                            setVideoInfo({
                              id: separatedStems.instrumental,
                              title: `${videoInfo.title} (Instrumental Stem)`,
                              duration: videoInfo.duration,
                              thumbnail: videoInfo.thumbnail,
                              isLocal: true
                            });
                            setSeparatedStems(null);
                          }}
                          className="btn-primary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))' }}
                        >
                          Load Stem
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSeparatedStems(null)}
                    className="btn-secondary"
                    style={{ padding: '6px', fontSize: '0.75rem', width: '100%', borderRadius: '6px' }}
                  >
                    Reset Stems
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Deck 2: Effects Deck */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div className="panel-header">
              <h2 className="panel-title">
                <Sliders style={{ color: 'var(--accent-purple)' }} />
                Lofi & Reverb Control Board
              </h2>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {videoInfo && (
                  <button
                    onClick={handleTogglePreview}
                    className="btn-primary"
                    disabled={isPreviewLoading}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.8rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      background: isPreviewPlaying ? 'var(--accent-pink)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                      boxShadow: isPreviewPlaying ? '0 0 10px var(--accent-pink)' : '0 4px 15px rgba(139, 92, 246, 0.3)'
                    }}
                  >
                    {isPreviewLoading ? (
                      <>
                        <Loader2 className="animate-spin-custom" style={{ width: '12px', height: '12px' }} />
                        Buffering...
                      </>
                    ) : isPreviewPlaying ? (
                      <>
                        <Pause style={{ width: '12px', height: '12px' }} />
                        Mute Preview
                      </>
                    ) : (
                      <>
                        <Play style={{ width: '12px', height: '12px' }} />
                        Live Preview
                      </>
                    )}
                  </button>
                )}

                <button 
                  onClick={handleResetSettings} 
                  className="btn-secondary"
                  disabled={(!videoInfo && !bulkMode) || isPreviewLoading}
                  style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCcw style={{ width: '12px', height: '12px' }} />
                  Reset
                </button>
              </div>
            </div>

            {(videoInfo || bulkMode) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Aesthetic Presets Selection */}
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <span>Aesthetic Presets</span>
                    {activePreset && (
                      <span style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem', fontWeight: 600 }}>
                        Active: {PRESETS[activePreset].name}
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                    {Object.keys(PRESETS).map((key) => {
                      const isActive = activePreset === key;
                      return (
                        <button
                          key={key}
                          onClick={() => applyPreset(key)}
                          style={{
                            padding: '8px 4px',
                            border: '1px solid',
                            borderColor: isActive ? 'var(--accent-cyan)' : 'var(--border-color)',
                            backgroundColor: isActive ? 'rgba(6, 182, 212, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                            color: isActive ? '#ffffff' : 'var(--text-secondary)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textAlign: 'center',
                            transition: 'all 0.2s ease',
                            boxShadow: isActive ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none'
                          }}
                        >
                          {PRESETS[key].name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* My Custom Templates */}
                <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Save style={{ width: '14px', height: '14px', color: 'var(--accent-pink)' }} />
                      My Custom Templates
                    </span>
                    <button
                      onClick={handleSaveTemplate}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(236, 72, 153, 0.1)',
                        border: '1px solid var(--accent-pink)',
                        color: 'var(--accent-pink)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-pink)'; e.currentTarget.style.color = '#ffffff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)'; e.currentTarget.style.color = 'var(--accent-pink)'; }}
                    >
                      <Plus style={{ width: '12px', height: '12px' }} />
                      Save Current
                    </button>
                  </div>

                  {Object.keys(customTemplates).length === 0 ? (
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0' }}>
                      No custom templates saved yet. Set sliders and click "Save Current" to create one!
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.keys(customTemplates).map((key) => {
                        const t = customTemplates[key];
                        return (
                          <div
                            key={key}
                            onClick={() => applyCustomTemplate(key)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              color: 'var(--text-primary)',
                              fontWeight: 500,
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-pink)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                          >
                            <span>{t.name}</span>
                            <button
                              onClick={(e) => deleteCustomTemplate(key, e)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'var(--text-muted)'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                            >
                              <X style={{ width: '12px', height: '12px', pointerEvents: 'none' }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {videoInfo && (
                  <>
                    <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

                    {/* Visual Audio Trimmer Slider */}
                    <div>
                      <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <span>Audio Trimmer Range</span>
                        <span style={{ color: 'var(--accent-cyan)' }}>
                          {formatTime(trimStart)} - {formatTime(trimEnd)} ({formatTime(trimEnd - trimStart)})
                        </span>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start Time</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{formatTime(trimStart)}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max={Math.round(videoInfo.duration)} 
                            value={trimStart} 
                            disabled={isPreviewPlaying}
                            onChange={(e) => {
                              const val = Math.min(parseInt(e.target.value), trimEnd - 1);
                              setTrimStart(val || 0);
                            }} 
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>End Time</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{formatTime(trimEnd)}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max={Math.round(videoInfo.duration)} 
                            value={trimEnd} 
                            disabled={isPreviewPlaying}
                            onChange={(e) => {
                              const val = Math.max(parseInt(e.target.value), trimStart + 1);
                              setTrimEnd(val || 1);
                            }} 
                          />
                        </div>
                      </div>
                      {isPreviewPlaying && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', marginTop: '4px' }}>
                          * Mute Live Preview to adjust the trim window.
                        </p>
                      )}
                    </div>
                  </>
                )}

                <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

                {/* Speed and Pitch Deck */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                  
                  {/* Speed (Tempo) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span>Speed (Tempo Factor)</span>
                      <span style={{ color: 'var(--accent-cyan)' }}>{speed.toFixed(2)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.50" 
                      max="1.50" 
                      step="0.01"
                      value={speed}
                      onChange={(e) => {
                        setSpeed(parseFloat(e.target.value));
                        setActivePreset(null);
                      }}
                    />
                    {/* Quick Presets */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button 
                        onClick={() => { setSpeed(0.80); setActivePreset(null); }} 
                        style={{ fontSize: '0.75rem', background: speed === 0.80 ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', color: speed === 0.80 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
                      >
                        Midnight (0.80x)
                      </button>
                      <button 
                        onClick={() => { setSpeed(0.85); setActivePreset(null); }} 
                        style={{ fontSize: '0.75rem', background: speed === 0.85 ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', color: speed === 0.85 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
                      >
                        Classic (0.85x)
                      </button>
                      <button 
                        onClick={() => { setSpeed(0.90); setActivePreset(null); }} 
                        style={{ fontSize: '0.75rem', background: speed === 0.90 ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', color: speed === 0.90 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
                      >
                        Chilled (0.90x)
                      </button>
                    </div>
                  </div>

                  {/* Pitch Modification Style */}
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                      Pitch Modification Mode
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div 
                        onClick={() => { setPitchStyle('vinyl'); setActivePreset(null); }}
                        className={`glass-panel ${pitchStyle === 'vinyl' ? 'pulse-glow' : ''}`}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          backgroundColor: pitchStyle === 'vinyl' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(0,0,0,0.2)',
                          borderColor: pitchStyle === 'vinyl' ? 'var(--accent-purple)' : 'var(--border-color)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', color: pitchStyle === 'vinyl' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          Vinyl Slowdown
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                          Pitch lowers with speed (Cozy & Deep)
                        </span>
                      </div>

                      <div 
                        onClick={() => { setPitchStyle('stretch'); setActivePreset(null); }}
                        className={`glass-panel ${pitchStyle === 'stretch' ? 'pulse-glow' : ''}`}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          backgroundColor: pitchStyle === 'stretch' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(0,0,0,0.2)',
                          borderColor: pitchStyle === 'stretch' ? 'var(--accent-cyan)' : 'var(--border-color)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', color: pitchStyle === 'stretch' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          Time Stretch
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                          Maintain original pitch (Vocal Safe)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pitch Tuning (Semitones) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span>Pitch Tuning (Semitones)</span>
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>
                        {pitchStyle === 'vinyl' 
                          ? `${(12 * Math.log2(speed)).toFixed(1)} semitones (locked)` 
                          : `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} semitones`
                        }
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="-12" 
                      max="12" 
                      step="1"
                      value={pitchStyle === 'vinyl' ? Math.round(12 * Math.log2(speed)) : pitchSemitones}
                      disabled={pitchStyle === 'vinyl'}
                      onChange={(e) => {
                        setPitchSemitones(parseInt(e.target.value));
                        setActivePreset(null);
                      }}
                      style={{
                        opacity: pitchStyle === 'vinyl' ? 0.5 : 1,
                        cursor: pitchStyle === 'vinyl' ? 'not-allowed' : 'pointer'
                      }}
                    />
                    {pitchStyle === 'vinyl' ? (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-4px' }}>
                        * Pitch is tied to speed in Vinyl mode. Switch to Time Stretch to modify pitch independently.
                      </p>
                    ) : (
                      <p style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '-4px' }}>
                        * Preview will play time-stretched; full semitone tuning is processed in the final export!
                      </p>
                    )}
                  </div>
                </div>

                <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

                {/* EQ & Ambient Effects */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Reverb Presets */}
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                      Reverb Density
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))', gap: '8px' }}>
                      {['none', 'light', 'medium', 'deep', 'silent_hall'].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => { setReverb(preset); setActivePreset(null); }}
                          style={{
                            padding: '10px 4px',
                            border: '1px solid',
                            borderColor: reverb === preset ? 'var(--accent-pink)' : 'var(--border-color)',
                            backgroundColor: reverb === preset ? 'rgba(236,72,153,0.1)' : 'rgba(0,0,0,0.2)',
                            color: reverb === preset ? '#ffffff' : 'var(--text-secondary)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {preset === 'silent_hall' ? 'Silent Hall' : preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3-Band Equalizer */}
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>
                      🎛️ Interactive 3-Band Equalizer (EQ)
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Low (Bass) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span>Low (Bass Shelf @150Hz)</span>
                          <span style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>
                            {bassEQ > 0 ? `+${bassEQ}` : bassEQ} dB
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="-10" 
                          max="12" 
                          value={bassEQ}
                          onChange={(e) => {
                            setBassEQ(parseInt(e.target.value));
                            setActivePreset(null);
                          }}
                        />
                      </div>

                      {/* Mid (Vocals/Melody) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span>Mid (Vocal Presence @1kHz)</span>
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                            {midEQ > 0 ? `+${midEQ}` : midEQ} dB
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="-10" 
                          max="10" 
                          value={midEQ}
                          onChange={(e) => {
                            setMidEQ(parseInt(e.target.value));
                            setActivePreset(null);
                          }}
                        />
                      </div>

                      {/* High (Treble/Sparkle) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span>High (Air/Sparkle @6kHz)</span>
                          <span style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>
                            {trebleEQ > 0 ? `+${trebleEQ}` : trebleEQ} dB
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="-10" 
                          max="10" 
                          value={trebleEQ}
                          onChange={(e) => {
                            setTrebleEQ(parseInt(e.target.value));
                            setActivePreset(null);
                          }}
                        />
                      </div>
                    </div>

                    {/* Vocals & Tone EQ Guide Presets */}
                    <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
                        🎙️ Vocals & Tone EQ Guide (Quick Presets)
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        
                        <div 
                          onClick={() => {
                            setBassEQ(4);
                            setMidEQ(8);
                            setTrebleEQ(-3);
                            setMuffleCutoff(12000);
                            setActivePreset(null);
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-purple)';
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>🎙️ Heavy/Warm Vocals</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                            Boosts mid-presence (+8dB Mid) and adds low-end warmth. Reduces harsh sibilance.
                          </span>
                        </div>

                        <div 
                          onClick={() => {
                            setBassEQ(-5);
                            setMidEQ(-4);
                            setTrebleEQ(8);
                            setMuffleCutoff(20000);
                            setActivePreset(null);
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>✨ Light/Ethereal Vocals</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                            Reduces muddy bass (-5dB) and boosts airy, crystal highs (+8dB) for breathing space.
                          </span>
                        </div>

                        <div 
                          onClick={() => {
                            setBassEQ(10);
                            setMidEQ(-3);
                            setTrebleEQ(-6);
                            setMuffleCutoff(4500);
                            setActivePreset(null);
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-pink)';
                            e.currentTarget.style.background = 'rgba(236, 72, 153, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>🔊 Deep Club Bass</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                            Maxes sub-bass (+10dB Low), scoops mid frequencies, and cuts highs with 4.5kHz lowpass.
                          </span>
                        </div>

                        <div 
                          onClick={() => {
                            setBassEQ(-8);
                            setMidEQ(6);
                            setTrebleEQ(-8);
                            setMuffleCutoff(3000);
                            setActivePreset(null);
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-purple)';
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>📻 Retro Lo-Fi Radio</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                            Emulates thin speaker characteristics by cutting lows/highs (-8dB) and boosting mids (+6dB).
                          </span>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Tape Hiss Noise overlay */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span>Ambient Tape Hiss (Warmth)</span>
                      <span style={{ color: 'var(--accent-pink)' }}>{tapeHiss > 0 ? `${tapeHiss * 10}%` : 'Bypass'}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      value={tapeHiss}
                      onChange={(e) => {
                        setTapeHiss(parseInt(e.target.value));
                        setActivePreset(null);
                      }}
                    />
                  </div>

                  {/* Lowpass Muffle */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span>Muffle Cutoff (Low-pass)</span>
                      <span style={{ color: 'var(--accent-cyan)' }}>
                        {muffleCutoff < 20000 ? `${muffleCutoff} Hz` : 'Bypass'}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="1000" 
                      max="20000" 
                      step="500"
                      value={muffleCutoff}
                      onChange={(e) => {
                        setMuffleCutoff(parseInt(e.target.value));
                        setActivePreset(null);
                      }}
                    />
                  </div>

                  {/* Stereo Width Expansion */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span>Stereo Width (Haas/Mid-Side)</span>
                      <span style={{ color: 'var(--accent-purple)' }}>
                        {stereoWidth === 0.0 ? 'Mono (0.0x)' : stereoWidth === 1.0 ? 'Normal (1.0x)' : `${stereoWidth.toFixed(1)}x`}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.0" 
                      max="2.0" 
                      step="0.1"
                      value={stereoWidth}
                      onChange={(e) => {
                        setStereoWidth(parseFloat(e.target.value));
                        setActivePreset(null);
                      }}
                    />
                  </div>

                  {/* Tape Waver (Wow & Flutter) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span>Tape Waver (Wow & Flutter)</span>
                      <span style={{ color: 'var(--accent-pink)' }}>
                        {wowFlutter === 0 ? 'None' : wowFlutter <= 0.3 ? 'Subtle' : wowFlutter <= 0.7 ? 'Warm' : 'Degraded'} ({Math.round(wowFlutter * 100)}%)
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.0" 
                      max="1.0" 
                      step="0.05"
                      value={wowFlutter}
                      onChange={(e) => {
                        setWowFlutter(parseFloat(e.target.value));
                        setActivePreset(null);
                      }}
                    />
                  </div>

                  {/* Vintage Resampler */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      <span>Vintage Resampler (Bitcrusher)</span>
                      <span style={{ color: 'var(--accent-cyan)' }}>
                        {bitDepth === 0 ? 'Bypass' : bitDepth === 12 ? '12-bit (Sampler)' : '8-bit (Chiptune)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      {[
                        { label: 'Bypass', value: 0 },
                        { label: '12-Bit', value: 12 },
                        { label: '8-Bit', value: 8 }
                      ].map((item) => (
                        <button
                          key={item.value}
                          onClick={() => {
                            setBitDepth(item.value);
                            setActivePreset(null);
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '0.75rem',
                            border: 'none',
                            borderRadius: '6px',
                            background: bitDepth === item.value ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                            color: bitDepth === item.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Sliders style={{ width: '32px', height: '32px', margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontSize: '0.9rem' }}>Please enter YouTube links or choose files in Bulk Queue, or load a Single Track first to configure effects.</p>
              </div>
            )}
          </section>

        </div>

        {/* Right Side: Process Execution, Player Deck & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Action Trigger Card */}
          <section className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>
              Export Remix Deck
            </h3>

            {/* Export Format Select */}
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Export Quality & Format
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={() => setExportFormat('mp3')}
                  disabled={isProcessing}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: exportFormat === 'mp3' ? 'var(--accent-cyan)' : 'var(--border-color)',
                    backgroundColor: exportFormat === 'mp3' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(0, 0, 0, 0.2)',
                    color: exportFormat === 'mp3' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🎧 Standard MP3 (320kbps)
                </button>
                <button
                  onClick={() => setExportFormat('wav')}
                  disabled={isProcessing}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: exportFormat === 'wav' ? 'var(--accent-purple)' : 'var(--border-color)',
                    backgroundColor: exportFormat === 'wav' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(0, 0, 0, 0.2)',
                    color: exportFormat === 'wav' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📀 Lossless WAV (16-bit)
                </button>
              </div>
            </div>

            {(() => {
              const completed = bulkQueue.filter(q => q.status === 'completed').length;
              const failed = bulkQueue.filter(q => q.status === 'failed').length;
              const activeItem = bulkQueue.find(q => q.status === 'downloading' || q.status === 'processing');
              const activeProgress = activeItem ? (activeItem.progress || 0) : 0;
              const overallProgress = bulkQueue.length > 0 ? Math.min(100, Math.round(((completed + failed) / bulkQueue.length) * 100 + (activeProgress / bulkQueue.length))) : 0;
              const queuedCount = bulkQueue.filter(q => q.status === 'queued' || q.status === 'failed').length;

              if (bulkMode) {
                return isProcessingBulk ? (
                  <div style={{ padding: '10px 0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>
                        {activeItem 
                          ? `Baking: ${activeItem.title}`
                          : 'Preparing bulk tasks...'
                        }
                      </span>
                      <span style={{ color: 'var(--accent-pink)', fontWeight: 600 }}>{overallProgress}%</span>
                    </div>
                    {/* Master Overall Progress Bar */}
                    <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ width: `${overallProgress}%`, height: '100%', background: 'linear-gradient(to right, var(--accent-pink), var(--accent-purple))', transition: 'width 0.2s ease' }}></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Loader2 className="spinning" style={{ width: '14px', height: '14px', color: 'var(--accent-pink)' }} />
                        Batch Conversion Active
                      </span>
                      <span>
                        {completed + failed} / {bulkQueue.length} Completed
                      </span>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="btn-primary"
                    disabled={queuedCount === 0}
                    onClick={handleStartBulkProcess}
                    style={{ 
                      width: '100%', 
                      padding: '16px', 
                      fontSize: '1.05rem', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em',
                      background: 'linear-gradient(135deg, var(--accent-pink) 0%, var(--accent-purple) 100%)',
                      cursor: 'pointer'
                    }}
                  >
                    <Sparkles style={{ width: '18px', height: '18px' }} />
                    Bake {queuedCount} Queue Tracks
                  </button>
                );
              }

              // Original Single Track Render
              return isProcessing ? (
                <div style={{ padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    <span>{statusText}</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{taskProgress}%</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div style={{ width: `${taskProgress}%`, height: '100%', background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))', transition: 'width 0.2s ease' }}></div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <Loader2 className="animate-spin-custom" style={{ width: '14px', height: '14px', color: 'var(--accent-cyan)' }} />
                    Running automated FFmpeg render task...
                  </div>
                </div>
              ) : (
                <button 
                  className="btn-primary"
                  disabled={!videoInfo}
                  onClick={handleGenerate}
                  style={{ width: '100%', padding: '16px', fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                >
                  <Sparkles style={{ width: '18px', height: '18px' }} />
                  Generate Slowed & Reverb Remix
                </button>
              );
            })()}
          </section>

          {/* Audio Wave Player Deck */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <h2 className="panel-title" style={{ marginBottom: '16px' }}>
              <Volume2 style={{ color: 'var(--accent-cyan)' }} />
              Live Spectrum Analyser
            </h2>

            <div>
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                background: 'rgba(0, 0, 0, 0.2)', 
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Active Audio Source
                </p>
                <p style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)', 
                  marginTop: '2px', 
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  whiteSpace: 'normal',
                  lineHeight: '1.4'
                }}>
                  {isPreviewPlaying ? `[Live Preview] ${videoInfo?.title}` : (currentAudioTitle || 'No active track')}
                </p>
              </div>

              {/* Retro Cassette Deck Widget */}
              <div className={`cassette-deck ${isPlaying || isPreviewPlaying ? 'active' : ''}`}>
                <div className="cassette-label">
                  <div className="cassette-label-text">
                    {isPreviewPlaying ? videoInfo?.title : (currentAudioTitle || 'Lofi Wave Studio')}
                  </div>
                  <div className="cassette-label-sub">
                    {isPlaying || isPreviewPlaying ? '★ PLAYING ★' : '📼 DECK READY'}
                  </div>
                </div>
                <div className="cassette-window">
                  <div className="tape-ribbon"></div>
                  <div 
                    className={`cassette-spindle ${isPlaying || isPreviewPlaying ? 'spinning' : ''}`} 
                    style={{ '--reel-speed': `${2.0 / speed}s` }}
                  >
                    <div className="cassette-spindle-inner"></div>
                  </div>
                  <div 
                    className={`cassette-spindle ${isPlaying || isPreviewPlaying ? 'spinning' : ''}`} 
                    style={{ '--reel-speed': `${2.0 / speed}s` }}
                  >
                    <div className="cassette-spindle-inner"></div>
                  </div>
                </div>
                <div className="cassette-bottom-trapezoid"></div>
              </div>

              {/* Shared Canvas Visualizer */}
              <canvas 
                ref={canvasRef} 
                width="400" 
                height="110" 
                style={{ 
                  width: '100%', 
                  height: '110px', 
                  borderRadius: '12px', 
                  backgroundColor: '#080914',
                  border: '1px solid var(--border-color)',
                  marginBottom: '16px'
                }}
              />

              {/* Visualizer Settings Controls */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px', 
                padding: '12px', 
                background: 'rgba(255,255,255,0.01)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '10px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Visualizer Mode</span>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    {['wave', 'bars', 'circular'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setVisualizerMode(mode)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          border: 'none',
                          borderRadius: '4px',
                          textTransform: 'capitalize',
                          background: visualizerMode === mode ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                          color: visualizerMode === mode ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                  <div 
                    onClick={() => setShowRetroGrid(!showRetroGrid)}
                    className={`switch-container ${showRetroGrid ? 'active' : ''}`}
                    style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}
                  >
                    <div className="switch-track">
                      <div className="switch-thumb"></div>
                    </div>
                    <span>Retro 3D Beat Grid</span>
                  </div>

                  {showRetroGrid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grid Theme:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[
                          { key: 'pink', color: '#ec4899' },
                          { key: 'cyan', color: '#06b6d4' },
                          { key: 'purple', color: '#8b5cf6' }
                        ].map((item) => (
                          <button
                            key={item.key}
                            onClick={() => setGridColor(item.key)}
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: item.color,
                              border: gridColor === item.key ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                              cursor: 'pointer',
                              padding: 0,
                              boxShadow: gridColor === item.key ? `0 0 8px ${item.color}` : 'none',
                              transition: 'all 0.2s'
                            }}
                            title={`Set ${item.key} grid theme`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Audio Element & Controls for Rendered Output */}
              <audio 
                ref={audioRef}
                src={currentAudioUrl || null}
                crossOrigin="anonymous"
                onEnded={() => setIsPlaying(false)}
                style={{ display: 'none' }}
              />

              {currentAudioUrl && (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button 
                    onClick={togglePlay}
                    className="btn-primary"
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      padding: 0,
                      boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)'
                    }}
                  >
                    {isPlaying ? <Pause style={{ width: '22px', height: '22px' }} /> : <Play style={{ width: '22px', height: '22px', marginLeft: '3px' }} />}
                  </button>

                  <a 
                    href={`${BACKEND_URL}/api/download-file/${currentAudioUrl.substring(currentAudioUrl.lastIndexOf('/') + 1)}`}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{ 
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Download style={{ width: '20px', height: '20px' }} />
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* History Deck */}
          <section className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 className="panel-title" style={{ marginBottom: '16px' }}>
              <History style={{ color: 'var(--accent-pink)' }} />
              Generation History
            </h2>

            <div style={{ 
              overflowY: 'auto', 
              maxHeight: '320px', 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {history.length > 0 ? (
                history.map((track) => (
                  <div 
                    key={track.id} 
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(236,72,153,0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ 
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        whiteSpace: 'normal',
                        fontSize: '0.9rem', 
                        margin: 0, 
                        fontWeight: 600,
                        lineHeight: '1.4'
                      }}>
                        {track.title}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                        <span>Speed: {track.settings?.speed.toFixed(2)}x</span>
                        <span>•</span>
                        <span>EQ: [L: {track.settings?.bassEQ !== undefined ? (track.settings.bassEQ > 0 ? `+${track.settings.bassEQ}` : track.settings.bassEQ) : `+${track.settings?.bassBoost || 0}`}dB, M: {track.settings?.midEQ > 0 ? `+${track.settings.midEQ}` : (track.settings?.midEQ || 0)}dB, H: {track.settings?.trebleEQ > 0 ? `+${track.settings.trebleEQ}` : (track.settings?.trebleEQ || 0)}dB]</span>
                        <span>•</span>
                        <span>Reverb: {track.settings?.reverb}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => loadHistoryTrack(track)}
                        className="btn-secondary"
                        style={{ padding: '8px', borderRadius: '8px' }}
                        title="Play remix"
                      >
                        <Play style={{ width: '14px', height: '14px' }} />
                      </button>
                      <a 
                        href={`${BACKEND_URL}/api/download-file/${track.fileName}`} 
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                        style={{ padding: '8px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Download file"
                      >
                        <Download style={{ width: '14px', height: '14px' }} />
                      </a>
                      <button 
                        onClick={() => handleDeleteHistoryItem(track.id)}
                        className="btn-secondary"
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                        title="Delete track"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                      >
                        <Trash2 style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No previous generations found in the local cache.
                </div>
              )}
            </div>
          </section>

        </div>

      </div>

    </div>
  );
}

export default App;
