
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LucideSettings, LucideKey, LucideServer, LucideBot, LucideCheck, 
  LucideLoader2, LucideX, LucideExternalLink, LucideSave, LucideTriangleAlert,
  LucideSparkles, LucideGlobe, LucideFolderSearch, LucideDownload,
  LucideFolder, LucidePlay, LucideTrash2, LucidePause
} from 'lucide-react';
import { AIConfig, AIProvider } from '../types';
import { validateConnection } from '../utils/aiService';
import { getAndroidBridge, isAndroidNative, getLocalModels, AndroidModel, subscribeToDownloadProgress } from '../utils/androidBridge';

interface AISettingsModalProps {
  currentConfig: AIConfig | null;
  onSave: (config: AIConfig) => void;
  onClose: () => void;
  onRemove: () => void;
}

const PROVIDER_PRESETS = [
  { id: 'gemini', name: 'Google Gemini', type: 'gemini', url: '', model: 'gemini-3-flash-preview', desc: 'Best for reasoning & Bengali support' },
  { id: 'openai', name: 'OpenAI (ChatGPT)', type: 'openai', url: 'https://api.openai.com/v1', model: 'gpt-4o', desc: 'Standard for high quality' },
  { id: 'ollama', name: 'Ollama (Local)', type: 'custom', url: 'http://localhost:11434/v1', model: 'llama3', desc: 'Run open-source models locally' },
  { id: 'android-native', name: 'Offline Native Model', type: 'android-native', url: '', model: '', desc: 'Execute models locally on Android via JNI' },
  { id: 'deepseek', name: 'DeepSeek', type: 'custom', url: 'https://api.deepseek.com', model: 'deepseek-chat', desc: 'High performance open model' },
  { id: 'groq', name: 'Groq', type: 'custom', url: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', desc: 'Extremely fast inference' },
  { id: 'openrouter', name: 'OpenRouter', type: 'custom', url: 'https://openrouter.ai/api/v1', model: 'tngtech/deepseek-r1t2-chimera:free', desc: 'Aggregator for many models' },
  { id: 'custom', name: 'Custom / Other', type: 'custom', url: '', model: '', desc: 'Any OpenAI-compatible API' },
];

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ currentConfig, onSave, onClose, onRemove }) => {
  // Determine initial selected preset based on config
  const getInitialPresetId = () => {
    if (!currentConfig) return 'gemini';
    if (currentConfig.provider === 'android-native') return 'android-native';
    if (currentConfig.provider === 'gemini') return 'gemini';
    if (currentConfig.provider === 'openai') return 'openai';
    
    // Check known URLs for custom providers
    if (currentConfig.baseUrl?.includes('localhost:11434')) return 'ollama';
    if (currentConfig.baseUrl?.includes('deepseek')) return 'deepseek';
    if (currentConfig.baseUrl?.includes('groq')) return 'groq';
    if (currentConfig.baseUrl?.includes('openrouter')) return 'openrouter';
    
    return 'custom';
  };

  const [selectedPresetId, setSelectedPresetId] = useState(getInitialPresetId());
  
  const [provider, setProvider] = useState<AIProvider>(currentConfig?.provider || 'gemini');
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(currentConfig?.baseUrl || '');
  const [model, setModel] = useState(currentConfig?.model || 'gemini-3-flash-preview');
  
  const [isValidating, setIsValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Android specific state
  const [localModels, setLocalModels] = useState<AndroidModel[]>([]);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFileName, setDownloadFileName] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloadPaused, setIsDownloadPaused] = useState(false);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);

  // Fetch models if native or mock
  useEffect(() => {
    if (selectedPresetId === 'android-native') {
       setLocalModels(getLocalModels());
    }
    
    // Subscribe to download progress
    const unsubscribe = subscribeToDownloadProgress((filename, progress) => {
        if (progress === -1) {
            setErrorMsg(`Download failed for ${filename}`);
            setDownloadProgress(null);
        } else if (progress === 100) {
            setDownloadProgress(null);
            setDownloadUrl('');
            setDownloadFileName('');
            setLocalModels(getLocalModels());
        } else {
            setDownloadProgress(progress);
            setDownloadFileName(filename);
        }
    });
    
    const handleStorageSelected = (path: string) => {
        // Force refresh local models because directory changed
        localStorage.setItem('offline_storage_path', path);
        // Trigger re-render by updating dummy state or local models
        setLocalModels(getLocalModels());
    };
    
    window.onStorageDirectorySelected = handleStorageSelected;
    return () => {
       unsubscribe();
       window.onStorageDirectorySelected = undefined;
    };
  }, [selectedPresetId]);

  const { downloadedModelsList, availableModelsList } = useMemo(() => {
    const PRESET_MODELS = [
        { id: "llama-3.2-1b-instruct-q4_k_m.gguf", name: "Llama-3.2 1B Instruct (Q4)", size: "0.8 GB", params: "1B", url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf" },
        { id: "llama-3.2-3b-instruct-q4_k_m.gguf", name: "Llama-3.2 3B Instruct (Q4)", size: "2.0 GB", params: "3B", url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf" },
        { id: "llama-3-8b-instruct.Q4_K_M.gguf", name: "Llama-3 8B Instruct (Q4)", size: "4.7 GB", params: "8B", url: "https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf" },
        { id: "phi-3-mini-4k-instruct-q4.gguf", name: "Phi-3 Mini 4k Instruct (Q4)", size: "2.4 GB", params: "3.8B", url: "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf" },
        { id: "mistral-7b-instruct-v0.2.Q4_K_M.gguf", name: "Mistral 7B Instruct v0.2 (Q4)", size: "4.1 GB", params: "7B", url: "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf" },
        { id: "gemma-2-2b-it-Q4_K_M.gguf", name: "Gemma-2 2B IT (Q4)", size: "1.6 GB", params: "2B", url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf" },
        { id: "gemma-2-9b-it-Q4_K_M.gguf", name: "Gemma-2 9B IT (Q4)", size: "5.4 GB", params: "9B", url: "https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf" },
        { id: "qwen2.5-1.5b-instruct-q4_k_m.gguf", name: "Qwen2.5 1.5B Instruct (Q4)", size: "1.1 GB", params: "1.5B", url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf" },
        { id: "qwen2.5-7b-instruct-q4_k_m.gguf", name: "Qwen2.5 7B Instruct (Q4)", size: "4.4 GB", params: "7B", url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf" },
        { id: "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf", name: "TinyLlama 1.1B Chat (Q4)", size: "0.6 GB", params: "1.1B", url: "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf" },
        { id: "hermes-2-pro-llama-3-8b-Q4_K_M.gguf", name: "Hermes 2 Pro Llama-3 8B (Q4)", size: "4.7 GB", params: "8B", url: "https://huggingface.co/NousResearch/Hermes-2-Pro-Llama-3-8B-GGUF/resolve/main/Hermes-2-Pro-Llama-3-8B-Q4_K_M.gguf" },
        { id: "deepseek-llm-7b-chat.Q4_K_M.gguf", name: "DeepSeek LLM 7B Chat (Q4)", size: "4.1 GB", params: "7B", url: "https://huggingface.co/TheBloke/deepseek-llm-7b-chat-GGUF/resolve/main/deepseek-llm-7b-chat.Q4_K_M.gguf" }
    ];
    const downloaded: any[] = [];
    const available: any[] = [];
    
    PRESET_MODELS.forEach(pm => {
        const localInfo = localModels.find(lm => lm.name === pm.id);
        if (localInfo) {
            downloaded.push({ ...pm, status: 'ready', sizeBytes: localInfo.sizeBytes });
        } else {
            available.push({ ...pm, status: 'downloadable' });
        }
    });
    
    localModels.forEach(lm => {
        if (!PRESET_MODELS.find(pm => pm.id === lm.name)) {
            downloaded.push({
                id: lm.name,
                name: lm.name,
                size: (lm.sizeBytes / 1024 / 1024).toFixed(1) + " MB",
                params: "Unknown",
                status: 'ready',
                sizeBytes: lm.sizeBytes
            });
        }
    });
    
    return { downloadedModelsList: downloaded, availableModelsList: available };
  }, [localModels]);

  const handleSelectStorage = () => {
      const bridge = getAndroidBridge();
      if (bridge) bridge.setStorageDirectory();
  };

  const handleDownloadModel = () => {
      const bridge = getAndroidBridge();
      if (!bridge) return;
      if (!downloadUrl || !downloadFileName) {
          setErrorMsg("Please provide both URL and a filename (e.g., model.gguf)");
          return;
      }
      setErrorMsg(null);
      setDownloadProgress(0);
      bridge.downloadModel(downloadUrl, downloadFileName);
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PROVIDER_PRESETS.find(p => p.id === presetId);
    if (preset) {
        setProvider(preset.type as AIProvider);
        if (preset.url) setBaseUrl(preset.url);
        
        // Don't overwrite model if we switch to android-native, as it's selected from a list usually
        if (presetId !== 'android-native') {
           if (preset.model) setModel(preset.model);
        }
        
        // Clear API key if switching types significantly, unless it's just a preset change that might share keys
        if (presetId === 'ollama' || presetId === 'android-native') setApiKey('');
    }
  };

  const handleTestAndSave = async () => {
    setErrorMsg(null);
    
    // Allow empty key for local/custom providers (like Ollama)
    if (!apiKey && provider === 'gemini') {
        setErrorMsg("Google Gemini-এর জন্য API Key প্রয়োজন।");
        return;
    }
    if (!apiKey && provider === 'openai') {
        setErrorMsg("OpenAI-এর জন্য API Key প্রয়োজন।");
        return;
    }
    
    const config: AIConfig = { provider, apiKey, baseUrl, model };
    setIsValidating(true);
    
    const success = await validateConnection(config);
    setIsValidating(false);

    if (success) {
        onSave(config);
        onClose();
    } else {
        setErrorMsg("সংযোগ ব্যর্থ হয়েছে। সেটিংস বা মডেল নেম চেক করুন।");
    }
  };

  if (isModelManagerOpen) {
      return (
        <div className="fixed inset-0 z-[110] bg-white dark:bg-gray-900 flex flex-col h-full overflow-hidden">
            <div className="w-full h-full flex flex-col relative">
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm z-10 shrink-0">
                    <h3 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <LucideBot className="text-emerald-500" size={20}/>
                        Model Manager
                    </h3>
                    <button 
                        onClick={() => setIsModelManagerOpen(false)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <LucideX size={18} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {errorMsg && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold">
                            <LucideTriangleAlert size={16} />
                            {errorMsg}
                        </div>
                    )}
                    
                    {/* Storage Location Picker */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Storage Location
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg shrink-0">
                                <LucideFolder size={20} className="text-gray-600 dark:text-gray-300" />
                            </div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1 truncate">
                                {localStorage.getItem('offline_storage_path') || 'Internal Storage / ai_models'}
                            </span>
                            <button 
                                onClick={() => {
                                    const bridge = getAndroidBridge();
                                    if (bridge) bridge.setStorageDirectory();
                                }}
                                className="text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
                            >
                                Change
                            </button>
                        </div>
                    </div>

                    {/* Downloaded Models List */}
                    {downloadedModelsList.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                                <LucideCheck size={14} className="text-emerald-500" />
                                Downloaded Models
                            </h4>
                            <div className="space-y-2">
                                {downloadedModelsList.map(m => (
                                    <div 
                                        key={m.id} 
                                        className={`p-3 rounded-xl border transition-all ${
                                            model === m.id 
                                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md' 
                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="overflow-hidden pr-2">
                                                <span className="text-sm font-bold text-gray-800 dark:text-white block truncate">
                                                    {m.name}
                                                </span>
                                                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1 truncate">
                                                    Size: {m.size} &bull; Params: {m.params}
                                                </div>
                                            </div>
                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0">
                                                Ready
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                            <button 
                                                onClick={() => setModel(m.id)}
                                                className={`flex-1 flex items-center justify-center gap-2 text-xs py-2 rounded-lg font-bold transition-colors ${
                                                    model === m.id 
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' 
                                                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                                                }`}
                                            >
                                                {model === m.id ? (
                                                    <><LucideCheck size={14} /> Selected & Ready</>
                                                ) : (
                                                    <><LucidePlay size={14} /> Select Model</>
                                                )}
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    const bridge = getAndroidBridge();
                                                    if (bridge) {
                                                        const success = bridge.deleteModel(m.id);
                                                        if (success) {
                                                            setLocalModels(getLocalModels());
                                                            if (model === m.id) setModel('');
                                                        } else {
                                                            setErrorMsg("Failed to delete model file.");
                                                        }
                                                    } else {
                                                        setErrorMsg("Native bridge not found.");
                                                    }
                                                }}
                                                className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-bold text-xs flex items-center gap-2"
                                                title="Delete Model"
                                            >
                                                <LucideTrash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Available Models List */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                            <LucideDownload size={14} className="text-blue-500" />
                            Available to Download
                        </h4>
                        <div className="space-y-2">
                            {availableModelsList.map(m => (
                                <div 
                                    key={m.id} 
                                    className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="overflow-hidden">
                                            <span className="text-sm font-bold text-gray-800 dark:text-white block truncate">
                                                {m.name}
                                            </span>
                                            <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1 truncate">
                                                Size: {m.size} &bull; Params: {m.params}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        {!(downloadProgress !== null && downloadFileName === m.id) ? (
                                            <button 
                                                onClick={() => {
                                                    setDownloadUrl(m.url!);
                                                    setDownloadFileName(m.id);
                                                    const bridge = getAndroidBridge();
                                                    if (bridge) {
                                                        setDownloadProgress(0);
                                                        setErrorMsg(null);
                                                        bridge.downloadModel(m.url!, m.id);
                                                    } else {
                                                        setErrorMsg("Native bridge not found.");
                                                    }
                                                }}
                                                className="w-full flex items-center justify-center gap-2 text-xs bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 py-2 px-3 rounded-lg font-bold transition-colors"
                                            >
                                                <LucideDownload size={14} /> Download to Device
                                            </button>
                                        ) : (
                                            <div className="w-full">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="flex justify-between text-[10px] font-bold text-gray-600 dark:text-gray-300 w-full pr-2">
                                                        <span className="truncate max-w-[150px]">
                                                            Downloading {m.name}...
                                                        </span>
                                                        <span>{Math.round(downloadProgress)}%</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                const bridge = getAndroidBridge();
                                                                if (bridge) {
                                                                    if (isDownloadPaused) {
                                                                        bridge.resumeDownload(m.id);
                                                                        setIsDownloadPaused(false);
                                                                    } else {
                                                                        bridge.pauseDownload(m.id);
                                                                        setIsDownloadPaused(true);
                                                                    }
                                                                }
                                                            }} 
                                                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                                            title={isDownloadPaused ? "Resume Download" : "Pause Download"}
                                                        >
                                                            {isDownloadPaused ? <LucidePlay size={14} /> : <LucidePause size={14} />}
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                const bridge = getAndroidBridge();
                                                                if (bridge) bridge.cancelDownload(m.id);
                                                                setDownloadProgress(null);
                                                                setDownloadFileName('');
                                                                setIsDownloadPaused(false);
                                                            }} 
                                                            className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                                            title="Cancel Download"
                                                        >
                                                            <LucideX size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                    <div 
                                                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                                                        style={{ width: `${downloadProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Custom Download URL Section */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                            <LucideGlobe size={14} className="text-purple-500" />
                            Custom Model URL
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Direct URL</label>
                                <input 
                                    type="text" 
                                    value={downloadUrl}
                                    onChange={(e) => setDownloadUrl(e.target.value)}
                                    placeholder="https://.../model.gguf"
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Filename</label>
                                <input 
                                    type="text" 
                                    value={downloadFileName}
                                    onChange={(e) => setDownloadFileName(e.target.value)}
                                    placeholder="custom-model.gguf"
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900"
                                />
                            </div>
                            <button 
                                onClick={handleDownloadModel}
                                disabled={downloadProgress !== null}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                            >
                                <LucideDownload size={14} />
                                Download Custom Model
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Sticky Bottom Actions */}
                <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex gap-2 shadow-sm z-20 shrink-0">
                    <button 
                        onClick={() => {
                            handleTestAndSave();
                        }}
                        disabled={isValidating || !model}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white py-2 rounded-lg font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                    >
                        {isValidating ? <LucideLoader2 size={16} className="animate-spin" /> : <LucideSave size={16} />}
                        {isValidating ? 'যাচাই করা হচ্ছে...' : 'সেভ করুন'}
                    </button>
                    {currentConfig && (
                        <button 
                            onClick={() => {
                                onRemove();
                                setIsModelManagerOpen(false);
                            }}
                            className="px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-900/30 rounded-lg font-bold text-sm transition-colors"
                        >
                            মুছে ফেলুন
                        </button>
                    )}
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-extrabold text-gray-800 dark:text-white flex items-center gap-2">
                <LucideSettings className="text-indigo-600 dark:text-indigo-400" size={24}/>
                AI সেটআপ
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                <LucideX size={24} />
            </button>
        </div>

        {/* Provider Preset Selection */}
        <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Service Provider</label>
            <div className="relative">
                <select 
                    value={selectedPresetId}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none"
                >
                    {PROVIDER_PRESETS.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                    <LucideGlobe size={16} />
                </div>
            </div>
            {/* Description */}
            <p className="text-[0.625rem] text-gray-500 dark:text-gray-400 mt-2 px-1">
                {PROVIDER_PRESETS.find(p => p.id === selectedPresetId)?.desc}
            </p>
        </div>

        {/* Config Fields */}
        <div className="space-y-4 mb-2">
            {selectedPresetId === 'android-native' ? (
              <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
                  
                  {/* Section Header */}
                  <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                          <LucideBot size={18} className="text-emerald-500" />
                          Model Manager
                      </h4>
                  </div>
                  
                  <button
                      onClick={() => setIsModelManagerOpen(true)}
                      className="w-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 py-3 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                      <LucideBot size={16} />
                      Open Model Manager
                  </button>

                  {model && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Selected Model</div>
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{model}</div>
                      </div>
                  )}
              </div>
            ) : (
                <>
                    {/* Base URL (Shown for Custom/OpenAI types except standard OpenAI which has fixed url usually, but we allow editing for custom) */}
                    {provider !== 'gemini' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Base URL / API Endpoint</label>
                            <div className="relative">
                                <LucideServer className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input 
                                    type="text" 
                                    value={baseUrl}
                                    onChange={(e) => setBaseUrl(e.target.value)}
                                    placeholder="https://api.openai.com/v1"
                                    disabled={selectedPresetId === 'openai'} // Standard OpenAI URL usually doesn't change
                                    className={`w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${selectedPresetId === 'openai' ? 'bg-gray-100 dark:bg-gray-800/50 text-gray-500' : ''}`}
                                />
                            </div>
                        </div>
                    )}

                    {/* API Key */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                            API Key 
                            {selectedPresetId === 'ollama' && <span className="text-gray-400 font-normal ml-1">(Optional for Local)</span>}
                        </label>
                        <div className="relative">
                            <LucideKey className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input 
                                type="password" 
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={provider === 'gemini' ? "AIza..." : "sk-..."}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                        {provider === 'gemini' && (
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[0.625rem] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1 hover:underline">
                                Get Gemini Key <LucideExternalLink size={8} />
                            </a>
                        )}
                        {selectedPresetId === 'groq' && (
                            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[0.625rem] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1 hover:underline">
                                Get Groq Key <LucideExternalLink size={8} />
                            </a>
                        )}
                    </div>

                    {/* Model Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Model Name</label>
                        <div className="relative">
                            <LucideBot className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="gpt-4o, llama3, etc."
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                        <p className="text-[0.625rem] text-gray-400 dark:text-gray-500 mt-1">
                            Examples: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">gpt-4o</span>, <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">llama3</span>, <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">deepseek-chat</span>
                        </p>
                    </div>
                </>
            )}
        </div>

        {/* Error Message */}
        {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold">
                <LucideTriangleAlert size={16} />
                {errorMsg}
            </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
             <button 
                onClick={handleTestAndSave}
                disabled={isValidating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white py-2 rounded-lg font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
            >
                {isValidating ? <LucideLoader2 size={16} className="animate-spin" /> : <LucideSave size={16} />}
                {isValidating ? 'যাচাই করা হচ্ছে...' : 'সেভ করুন'}
            </button>
            {currentConfig && (
                <button 
                    onClick={onRemove}
                    className="px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-900/30 rounded-lg font-bold text-sm"
                >
                    মুছে ফেলুন
                </button>
            )}
        </div>
      </div>
    </div>
  );
};