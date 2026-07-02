export type ModelProviderId = "voxcpm2" | "cosyvoice" | "indextts2" | "gpt-sovits" | "spark-tts";

export type CommercialUse = "safe" | "check" | "nonCommercial";
export type InstallMode = "managed" | "manual" | "api";
export type InstallStatus = "available" | "experimental" | "planned";
export type ModelGoal = "general" | "video" | "voice" | "lightweight" | "all";

export type ModelCapabilities = {
  voiceClone: boolean;
  durationControl: boolean;
  emotionControl: boolean;
  stylePrompt: boolean;
  referenceTranscriptRequired: boolean;
  streaming: boolean;
  dialects: boolean;
  commercialUse: CommercialUse;
  installMode: InstallMode;
  macMpsOk: boolean;
  cpuOk: boolean;
};

export type ModelProvider = {
  id: ModelProviderId;
  name: string;
  sourceUrl: string;
  goals: ModelGoal[];
  summary: {
    zh: string;
    en: string;
  };
  bestFor: {
    zh: string;
    en: string;
  };
  installDifficulty: {
    zh: string;
    en: string;
  };
  hardwareHint: {
    zh: string;
    en: string;
  };
  licenseNote: {
    zh: string;
    en: string;
  };
  status: InstallStatus;
  capabilities: ModelCapabilities;
};

export const MODEL_GOALS: Array<{ id: ModelGoal; label: { zh: string; en: string }; description: { zh: string; en: string } }> = [
  { id: "general", label: { zh: "通用中文配音", en: "General Chinese dubbing" }, description: { zh: "优先稳定、多语种、方言和参考音频能力。", en: "Prioritizes stability, multilingual support, dialects, and reference audio." } },
  { id: "video", label: { zh: "视频时长同步", en: "Video duration sync" }, description: { zh: "优先时长控制、情绪控制和音画同步。", en: "Prioritizes duration control, emotion, and screen sync." } },
  { id: "voice", label: { zh: "高级音色克隆", en: "Advanced voice cloning" }, description: { zh: "优先自定义声音包、少样本训练和高级用户工作流。", en: "Prioritizes custom voice packs, few-shot training, and advanced workflows." } },
  { id: "lightweight", label: { zh: "轻量双语", en: "Lightweight bilingual" }, description: { zh: "优先安装简单、资源占用低和商用友好。", en: "Prioritizes easier install, lower resource use, and commercial friendliness." } },
  { id: "all", label: { zh: "查看全部模型", en: "View all models" }, description: { zh: "显示全部推荐与实验候选。", en: "Shows every recommended and experimental candidate." } },
];

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: "voxcpm2",
    name: "VoxCPM2",
    sourceUrl: "https://github.com/OpenBMB/VoxCPM",
    goals: ["general", "all"],
    summary: { zh: "当前 DubCue 主力后端，适合中文旁白与参考声音工作流。", en: "Current primary DubCue backend for Chinese narration and reference-voice workflows." },
    bestFor: { zh: "当前稳定工作流", en: "Current stable workflow" },
    installDifficulty: { zh: "已接入", en: "Integrated" },
    hardwareHint: { zh: "Apple Silicon / 本地 Python 环境", en: "Apple Silicon / local Python runtime" },
    licenseNote: { zh: "遵循 OpenBMB/VoxCPM 原项目授权", en: "Subject to OpenBMB/VoxCPM licensing" },
    status: "available",
    capabilities: {
      voiceClone: true,
      durationControl: false,
      emotionControl: false,
      stylePrompt: true,
      referenceTranscriptRequired: true,
      streaming: false,
      dialects: false,
      commercialUse: "check",
      installMode: "managed",
      macMpsOk: true,
      cpuOk: false,
    },
  },
  {
    id: "cosyvoice",
    name: "CosyVoice / CosyVoice2",
    sourceUrl: "https://github.com/FunAudioLLM/CosyVoice",
    goals: ["general", "all"],
    summary: { zh: "多语种、中文方言、零样本克隆和流式能力完整，适合作为第二主力后端。", en: "Strong multilingual, Chinese dialect, zero-shot cloning, and streaming support; a good second primary backend." },
    bestFor: { zh: "多语种与中文方言", en: "Multilingual and Chinese dialects" },
    installDifficulty: { zh: "中等", en: "Medium" },
    hardwareHint: { zh: "建议独立环境；资源需求需实测", en: "Separate environment recommended; hardware needs require testing" },
    licenseNote: { zh: "接入前需确认模型与权重授权", en: "Confirm code and weight licensing before production use" },
    status: "planned",
    capabilities: {
      voiceClone: true,
      durationControl: false,
      emotionControl: true,
      stylePrompt: true,
      referenceTranscriptRequired: false,
      streaming: true,
      dialects: true,
      commercialUse: "check",
      installMode: "manual",
      macMpsOk: true,
      cpuOk: false,
    },
  },
  {
    id: "indextts2",
    name: "IndexTTS2",
    sourceUrl: "https://github.com/index-tts/index-tts",
    goals: ["video", "all"],
    summary: { zh: "时长控制和情绪控制突出，适合视频配音与音画同步。", en: "Duration and emotion controls make it promising for video dubbing and sync." },
    bestFor: { zh: "视频配音 / 时长控制", en: "Video dubbing / duration control" },
    installDifficulty: { zh: "中等偏高", en: "Medium-high" },
    hardwareHint: { zh: "建议 GPU / MPS 环境；需要接入实测", en: "GPU / MPS recommended; integration testing needed" },
    licenseNote: { zh: "商业使用需联系作者确认", en: "Commercial use requires author confirmation" },
    status: "planned",
    capabilities: {
      voiceClone: true,
      durationControl: true,
      emotionControl: true,
      stylePrompt: false,
      referenceTranscriptRequired: false,
      streaming: false,
      dialects: false,
      commercialUse: "check",
      installMode: "manual",
      macMpsOk: true,
      cpuOk: false,
    },
  },
  {
    id: "gpt-sovits",
    name: "GPT-SoVITS",
    sourceUrl: "https://github.com/RVC-Boss/GPT-SoVITS",
    goals: ["voice", "all"],
    summary: { zh: "生态成熟，适合高级用户做自定义声音包、zero-shot 和 few-shot 微调。", en: "Mature ecosystem for custom voice packs, zero-shot, and few-shot fine-tuning." },
    bestFor: { zh: "高级音色克隆 / 声音包", en: "Advanced cloning / voice packs" },
    installDifficulty: { zh: "较高", en: "High" },
    hardwareHint: { zh: "建议独立环境；训练链路资源要求更高", en: "Separate environment recommended; training requires more resources" },
    licenseNote: { zh: "商用前需逐项确认代码、模型与训练素材授权", en: "Confirm code, model, and training-data licensing before commercial use" },
    status: "planned",
    capabilities: {
      voiceClone: true,
      durationControl: false,
      emotionControl: false,
      stylePrompt: true,
      referenceTranscriptRequired: true,
      streaming: false,
      dialects: true,
      commercialUse: "check",
      installMode: "manual",
      macMpsOk: true,
      cpuOk: false,
    },
  },
  {
    id: "spark-tts",
    name: "Spark-TTS",
    sourceUrl: "https://github.com/SparkAudio/Spark-TTS",
    goals: ["lightweight", "all"],
    summary: { zh: "轻量双语、零样本克隆和 Apache-2.0 方向更友好；0.6 起提供实验性自动安装。", en: "Lightweight bilingual zero-shot cloning with a friendlier Apache-2.0 direction; experimental managed install starts in 0.6." },
    bestFor: { zh: "轻量 / 双语 / 商用友好", en: "Lightweight / bilingual / commercial-friendly" },
    installDifficulty: { zh: "实验性自动安装", en: "Experimental managed install" },
    hardwareHint: { zh: "0.5B 级别；建议预留 16GB 以上空间，首次安装依赖网络与 Python 环境", en: "0.5B-class; keep 16GB+ free. First install depends on network and Python." },
    licenseNote: { zh: "Apache-2.0；音色克隆需遵守官方免责声明与素材授权", en: "Apache-2.0; voice cloning must follow upstream disclaimers and source-audio rights" },
    status: "experimental",
    capabilities: {
      voiceClone: true,
      durationControl: true,
      emotionControl: true,
      stylePrompt: true,
      referenceTranscriptRequired: false,
      streaming: false,
      dialects: false,
      commercialUse: "safe",
      installMode: "managed",
      macMpsOk: true,
      cpuOk: true,
    },
  },
];

export const CURRENT_PROVIDER_ID: ModelProviderId = "voxcpm2";
