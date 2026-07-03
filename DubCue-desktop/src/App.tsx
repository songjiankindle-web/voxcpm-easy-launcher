import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  AudioLines,
  AudioWaveform,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Download,
  FilePlus2,
  Gauge,
  GripVertical,
  Languages,
  Moon,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import {
  absoluteAudioUrl,
  backendUrl,
  configureDesktopBackend,
  generateSegment as requestSegmentGeneration,
  getBackendHealth,
  mergeSegments as requestMergeSegments,
  transcribeReference as requestReferenceTranscription,
  type BackendHealth,
  type MergedAudio,
} from "./api";
import { CURRENT_PROVIDER_ID, MODEL_PROVIDERS, type ModelProvider } from "./modelProviders";
import {
  autosaveWorkspace,
  isDesktopApp,
  loadAutosave,
  openExternalUrl,
  openLogs,
  runtimeStatus,
  saveAudioFile,
  saveProjectFile,
  startBackend,
  watchRuntime,
  type NativeWorkspace,
  type RuntimeStatus,
} from "./desktop";
import "./App.css";

type Language = "zh" | "en";
type SegmentStatus = "pending" | "generating" | "done" | "error";
type ColumnId = "text" | "speed" | "prompt" | "pause" | "audio";
const NATURAL_SPEED_CPM = 215;
const MAX_REFERENCE_AUDIO_BYTES = 25 * 1024 * 1024;

type Segment = {
  id: number;
  text: string;
  speedCpm: number;
  prompt: string;
  pauseSeconds: number;
  status: SegmentStatus;
  progress: number;
  duration?: string;
  audioUrl?: string;
  audioFile?: string;
  audioVersions?: AudioVersion[];
  activeAudioVersionId?: string;
  actualCpm?: number;
  referenceAudio?: ReferenceAudio;
  referenceName?: string;
  referenceTranscript?: string;
  error?: string;
};

type AudioVersion = {
  id: string;
  createdAt: number;
  duration?: string;
  audioUrl: string;
  audioFile: string;
  actualCpm?: number;
};

type ReferenceAudio = {
  name: string;
  base64: string;
};

type DirectorState = {
  referenceAudio?: ReferenceAudio;
  referenceName: string;
  referenceSyncAll: boolean;
  promptSyncAll: boolean;
  ultimateClone: boolean;
  referenceTranscript: string;
};

type SavedProject = {
  id: string;
  parentId: string;
  parentNodeId: string | null;
  name: string;
  episodeName: string;
  rawScript: string;
  segments: Segment[];
  directorState: DirectorState;
  updatedAt: number;
};

const COPY = {
  zh: {
    workspace: "导演台本",
    script: "长文本稿件",
    director: "导演表",
    render: "合成与导出",
    library: "项目",
    recent: "最近项目",
    chapters: "内容结构",
    addChapter: "添加章节",
    importScript: "导入内容",
    generateTable: "生成导演台本",
    segmentCount: "4 个分段",
    tableHint: "拖动行号调整分段 · 拖动表头调整列序",
    generateAll: "生成全部",
    stop: "停止任务",
    mergeExport: "合并导出",
    inspector: "分段设置",
    selected: "当前分段",
    text: "文本",
    speed: "语速",
    prompt: "表演提示词",
    pause: "合并间隔",
    voice: "参考声音",
    voiceName: "纪录片男声 01",
    regenerate: "重新生成",
    modelReady: "VoxCPM2 已就绪",
    saved: "已保存到本机",
    overall: "生成进度",
    complete: "2 / 4 已完成",
    addSegment: "添加分段",
    deleteSegment: "删除分段",
    play: "试听",
    download: "下载",
    more: "更多操作",
    settings: "设置",
    help: "操作技巧",
    theme: "切换主题",
    language: "切换为英文",
    save: "保存项目",
    undo: "撤销",
    redo: "重做",
    reference: "声音参考",
    natural: "标准",
    slow: "舒缓",
    fast: "明快",
    ms: "秒",
    idle: "等待生成",
    processing: "正在生成",
    ready: "可试听",
    failed: "需要重试",
    newProject: "新建项目",
    totalDuration: "预计成片 00:47",
  },
  en: {
    workspace: "Director Script",
    script: "Long Script",
    director: "Director Table",
    render: "Render & Export",
    library: "Projects",
    recent: "Recent Projects",
    chapters: "Content Structure",
    addChapter: "Add chapter",
    importScript: "Import content",
    generateTable: "Create Director Script",
    segmentCount: "4 segments",
    tableHint: "Drag row numbers to reorder · Drag headers to reorder",
    generateAll: "Generate all",
    stop: "Stop task",
    mergeExport: "Merge & export",
    inspector: "Segment Inspector",
    selected: "Selected segment",
    text: "Text",
    speed: "Pacing",
    prompt: "Performance direction",
    pause: "Merge gap",
    voice: "Reference voice",
    voiceName: "Documentary Voice 01",
    regenerate: "Regenerate",
    modelReady: "VoxCPM2 ready",
    saved: "Saved locally",
    overall: "Generation progress",
    complete: "2 / 4 complete",
    addSegment: "Add segment",
    deleteSegment: "Delete segment",
    play: "Preview",
    download: "Download",
    more: "More actions",
    settings: "Settings",
    help: "Tips",
    theme: "Toggle theme",
    language: "Switch to Chinese",
    save: "Save project",
    undo: "Undo",
    redo: "Redo",
    reference: "Voice reference",
    natural: "Standard",
    slow: "Calm",
    fast: "Brisk",
    ms: "sec",
    idle: "Waiting",
    processing: "Generating",
    ready: "Ready",
    failed: "Retry needed",
    newProject: "New project",
    totalDuration: "Est. duration 00:47",
  },
} as const;

const WAVE_BARS = [8, 15, 11, 22, 31, 18, 26, 38, 28, 17, 24, 34, 42, 30, 19, 13, 28, 37, 25, 16, 32, 44, 35, 23, 14, 28, 39, 30, 18, 11, 22, 33];
const DEFAULT_COLUMN_ORDER: ColumnId[] = ["text", "prompt", "pause", "audio"];
const COLUMN_ORDER_STORAGE_KEY = "dubcue.director-column-order";
const PROJECT_STORAGE_KEY = "dubcue.project.v1";
const PROJECTS_STORAGE_KEY = "dubcue.projects.v1";
const CURRENT_PROJECT_STORAGE_KEY = "dubcue.current-project-id";
const CFG_STORAGE_KEY = "dubcue.generation-cfg-v2";
const INFERENCE_STEPS_STORAGE_KEY = "dubcue.generation-steps-v2";
const DEFAULT_INFERENCE_TIMESTEPS = 50;
const COLUMN_TRACKS: Record<ColumnId, string> = {
  text: "minmax(180px, 1.25fr)",
  speed: "112px",
  prompt: "minmax(150px, 0.9fr)",
  pause: "94px",
  audio: "minmax(220px, 1.2fr)",
};

function normalizeSavedSegments(items: Segment[]): Segment[] {
  return items.map((segment, index) => {
    const savedVersions = Array.isArray(segment.audioVersions)
      ? segment.audioVersions.filter((version) => version.audioUrl && version.audioFile)
      : [];
    const legacyVersion = segment.audioUrl && segment.audioFile && !savedVersions.some((version) => version.audioFile === segment.audioFile)
      ? [{
          id: segment.activeAudioVersionId || `legacy-${index + 1}`,
          createdAt: Date.now(),
          duration: segment.duration,
          audioUrl: segment.audioUrl,
          audioFile: segment.audioFile,
          actualCpm: segment.actualCpm,
        }]
      : [];
    const audioVersions = [...savedVersions, ...legacyVersion];
    const lastVersion = audioVersions[audioVersions.length - 1];
    const activeAudioVersionId = segment.activeAudioVersionId || lastVersion?.id;
    const activeVersion = audioVersions.find((version) => version.id === activeAudioVersionId) || lastVersion;
    return {
      ...segment,
      id: index + 1,
      speedCpm: Number(segment.speedCpm || NATURAL_SPEED_CPM),
      status: activeVersion ? "done" : (segment.status === "generating" ? "pending" : segment.status || "pending"),
      progress: activeVersion ? 100 : 0,
      duration: activeVersion?.duration,
      audioUrl: activeVersion?.audioUrl,
      audioFile: activeVersion?.audioFile,
      actualCpm: activeVersion?.actualCpm,
      audioVersions,
      activeAudioVersionId: activeVersion?.id,
    };
  });
}

function normalizeProjectIdentity(nameValue: string, episodeValue?: string) {
  const source = String(nameValue || "").trim();
  if (episodeValue?.trim()) return { name: source || "未命名项目", episodeName: episodeValue.trim() };
  const separated = source.split(/\s*·\s*/).filter(Boolean);
  if (separated.length >= 2) {
    return { name: separated.slice(0, -1).join(" · "), episodeName: separated[separated.length - 1] };
  }
  const matched = source.match(/^(.*?)(第[一二三四五六七八九十百\d]+集)$/);
  if (matched?.[1]) return { name: matched[1].trim(), episodeName: matched[2] };
  return { name: source || "未命名项目", episodeName: "主内容" };
}

function normalizeSavedProject(project: Partial<SavedProject>): SavedProject {
  const identity = normalizeProjectIdentity(String(project.name || ""), project.episodeName);
  const id = String(project.id || crypto.randomUUID());
  const segments = Array.isArray(project.segments) ? normalizeSavedSegments(project.segments) : [];
  const savedDirectorState = project.directorState;
  const referenceAudio = savedDirectorState?.referenceAudio?.base64
    ? {
        name: String(savedDirectorState.referenceAudio.name || savedDirectorState.referenceName || "reference.wav"),
        base64: String(savedDirectorState.referenceAudio.base64),
      }
    : undefined;
  return {
    id,
    parentId: String(project.parentId || id),
    parentNodeId: typeof project.parentNodeId === "string" ? project.parentNodeId : null,
    name: identity.name,
    episodeName: identity.episodeName,
    rawScript: String(project.rawScript ?? segments.map((segment) => segment.text).join("\n")),
    segments,
    directorState: {
      referenceAudio,
      referenceName: String(savedDirectorState?.referenceName || referenceAudio?.name || ""),
      referenceSyncAll: Boolean(savedDirectorState?.referenceSyncAll ?? referenceAudio),
      promptSyncAll: Boolean(savedDirectorState?.promptSyncAll),
      ultimateClone: Boolean(savedDirectorState?.ultimateClone),
      referenceTranscript: String(savedDirectorState?.referenceTranscript || ""),
    },
    updatedAt: Number(project.updatedAt || Date.now()),
  };
}

function normalizeSavedProjects(saved: Partial<SavedProject>[]): SavedProject[] {
  const hasExplicitTree = saved.some((project) => Object.prototype.hasOwnProperty.call(project, "parentNodeId"));
  if (hasExplicitTree) return saved.map(normalizeSavedProject);

  const legacy = saved.map(normalizeSavedProject);
  const groups = new Map<string, SavedProject[]>();
  legacy.forEach((project) => {
    const group = groups.get(project.parentId);
    if (group) group.push(project);
    else groups.set(project.parentId, [project]);
  });

  const migrated: SavedProject[] = [];
  groups.forEach((items, legacyParentId) => {
    const rootId = `root:${legacyParentId}`;
    const rootName = items[0]?.name || "未命名项目";
    migrated.push({
      id: rootId,
      parentId: rootId,
      parentNodeId: null,
      name: rootName,
      episodeName: rootName,
      rawScript: items[0]?.rawScript || "",
      segments: [],
      directorState: {
        referenceName: "",
        referenceSyncAll: false,
        promptSyncAll: false,
        ultimateClone: false,
        referenceTranscript: "",
      },
      updatedAt: Math.max(...items.map((item) => item.updatedAt), Date.now()),
    });
    items.forEach((item) => migrated.push({ ...item, parentId: rootId, parentNodeId: rootId }));
  });
  return migrated;
}

function nodePath(projects: SavedProject[], id: string): SavedProject[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const path: SavedProject[] = [];
  const visited = new Set<string>();
  let current = byId.get(id);
  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentNodeId ? byId.get(current.parentNodeId) : undefined;
  }
  return path;
}

function descendantIds(projects: SavedProject[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    projects.forEach((project) => {
      if (project.parentNodeId && result.has(project.parentNodeId) && !result.has(project.id)) {
        result.add(project.id);
        changed = true;
      }
    });
  }
  return result;
}

function loadWorkspace() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROJECTS_STORAGE_KEY) ?? "null");
    if (Array.isArray(saved)) {
      const projects = normalizeSavedProjects(saved);
      if (!projects.length) return { projects, current: null };
      const preferredId = window.localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
      const current = projects.find((project: SavedProject) => project.id === preferredId) ?? projects[0];
      return { projects, current };
    }
  } catch {
    // A malformed project list should still open as an empty workspace.
  }
  return { projects: [], current: null };
}

const STARTUP_WORKSPACE = loadWorkspace();
const STARTUP_CURRENT = STARTUP_WORKSPACE.current ?? {
  id: "",
  parentId: "",
  parentNodeId: null,
  name: "",
  episodeName: "",
  rawScript: "",
  segments: [] as Segment[],
  directorState: {
    referenceName: "",
    referenceSyncAll: false,
    promptSyncAll: false,
    ultimateClone: false,
    referenceTranscript: "",
  },
  updatedAt: Date.now(),
};

function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={`icon-button${active ? " active" : ""}`}
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6}>
          {label}
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function WaveformBars({ active = false }: { active?: boolean }) {
  return (
    <div className={`waveform-bars${active ? " playing" : ""}`} aria-hidden="true">
      {WAVE_BARS.map((height, index) => (
        <span key={index} style={{ height: `${height}px`, animationDelay: `${index * 24}ms` }} />
      ))}
    </div>
  );
}

function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [dark, setDark] = useState(false);
  const [projects, setProjects] = useState<SavedProject[]>(STARTUP_WORKSPACE.projects);
  const [projectId, setProjectId] = useState(STARTUP_CURRENT.id);
  const [projectName, setProjectName] = useState(STARTUP_CURRENT.name);
  const [episodeName, setEpisodeName] = useState(STARTUP_CURRENT.episodeName);
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<string[]>([]);
  const [editingTreeNode, setEditingTreeNode] = useState<string | null>(null);
  const [treeNameDraft, setTreeNameDraft] = useState("");
  const [segments, setSegments] = useState<Segment[]>(STARTUP_CURRENT.segments);
  const [selectedId, setSelectedId] = useState(1);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [activeNav, setActiveNav] = useState("director");
  const [undoStack, setUndoStack] = useState<Segment[][]>([]);
  const [redoStack, setRedoStack] = useState<Segment[][]>([]);
  const [isSaved, setIsSaved] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [backendError, setBackendError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelWizardOpen, setModelWizardOpen] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [nativeProjectPath, setNativeProjectPath] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newChildOpen, setNewChildOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newChildParentId, setNewChildParentId] = useState<string | null>(null);
  const [scriptImportMessage, setScriptImportMessage] = useState("");
  const [scriptImportFailed, setScriptImportFailed] = useState(false);
  const [backendAddress, setBackendAddress] = useState(backendUrl());
  const [referenceAudio, setReferenceAudio] = useState<ReferenceAudio | undefined>(STARTUP_CURRENT.directorState.referenceAudio);
  const [referenceName, setReferenceName] = useState(STARTUP_CURRENT.directorState.referenceName);
  const [referenceSyncAll, setReferenceSyncAll] = useState(STARTUP_CURRENT.directorState.referenceSyncAll);
  const [promptSyncAll, setPromptSyncAll] = useState(STARTUP_CURRENT.directorState.promptSyncAll);
  const [ultimateClone, setUltimateClone] = useState(STARTUP_CURRENT.directorState.ultimateClone);
  const [referenceTranscript, setReferenceTranscript] = useState(STARTUP_CURRENT.directorState.referenceTranscript);
  const [referenceTranscriptStatus, setReferenceTranscriptStatus] = useState("");
  const [isTranscribingReference, setIsTranscribingReference] = useState(false);
  const [cfgValue, setCfgValue] = useState(() => Number(window.localStorage.getItem(CFG_STORAGE_KEY) || 3));
  const [inferenceTimesteps, setInferenceTimesteps] = useState(() => Number(window.localStorage.getItem(INFERENCE_STEPS_STORAGE_KEY) || DEFAULT_INFERENCE_TIMESTEPS));
  const [mergedAudio, setMergedAudio] = useState<MergedAudio | null>(null);
  const [rawScript, setRawScript] = useState(() => STARTUP_CURRENT.rawScript);
  const [segmentMaxChars, setSegmentMaxChars] = useState("70");
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY) ?? "null");
      if (
        Array.isArray(saved)
        && saved.length === DEFAULT_COLUMN_ORDER.length
        && DEFAULT_COLUMN_ORDER.every((column) => saved.includes(column))
      ) {
        return saved as ColumnId[];
      }
    } catch {
      // Fall back to the product default if a previous preference is malformed.
    }
    return DEFAULT_COLUMN_ORDER;
  });
  const [draggedColumn, setDraggedColumn] = useState<ColumnId | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);
  const [draggedSegmentId, setDraggedSegmentId] = useState<number | null>(null);
  const [dragOverSegmentId, setDragOverSegmentId] = useState<number | null>(null);
  const [isTableEntering, setIsTableEntering] = useState(false);
  const [enteringSegmentId, setEnteringSegmentId] = useState<number | null>(null);
  const [deletingSegmentId, setDeletingSegmentId] = useState<number | null>(null);
  const [projectDeleteTargetId, setProjectDeleteTargetId] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const projectsRef = useRef<SavedProject[]>(STARTUP_WORKSPACE.projects);
  const projectIdRef = useRef(STARTUP_CURRENT.id);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopBatchRef = useRef(false);
  const rawScriptUndoRef = useRef<string[]>([]);
  const rawScriptRedoRef = useRef<string[]>([]);
  const t = COPY[language];

  const selected = segments.find((segment) => segment.id === selectedId) ?? segments[0];
  const selectedReferenceAudio = referenceSyncAll ? referenceAudio : selected?.referenceAudio;
  const selectedReferenceName = referenceSyncAll ? referenceName : (selected?.referenceName || "");
  const selectedReferenceTranscript = referenceSyncAll ? referenceTranscript : (selected?.referenceTranscript || "");
  const completeCount = segments.filter((segment) => segment.status === "done").length;
  const overallProgress = Math.round(
    segments.reduce((sum, segment) => sum + segment.progress, 0) / Math.max(segments.length, 1),
  );
  const estimatedSeconds = Math.round(segments.reduce(
    (sum, segment, index) => sum + (segment.text.length / NATURAL_SPEED_CPM * 60) + (index < segments.length - 1 ? segment.pauseSeconds : 0),
    0,
  ));
  const rootProjects = useMemo(() => projects.filter((project) => !project.parentNodeId), [projects]);
  const childrenByParent = useMemo(() => {
    const result = new Map<string, SavedProject[]>();
    projects.forEach((project) => {
      if (!project.parentNodeId) return;
      const children = result.get(project.parentNodeId);
      if (children) children.push(project);
      else result.set(project.parentNodeId, [project]);
    });
    return result;
  }, [projects]);
  const hasDirectorTable = activeNav === "director" && segments.some((segment) => {
    const textValue = segment.text.trim();
    return textValue
      && textValue !== "在这里输入第一段旁白。"
      && textValue !== "Enter the first narration segment here.";
  });
  const importButtonLabel = hasDirectorTable
    ? (language === "zh" ? "重新导入内容" : "Re-import content")
    : t.importScript;
  const projectDeleteTarget = projectDeleteTargetId
    ? projects.find((project) => project.id === projectDeleteTargetId) || null
    : null;
  const projectDeleteIds = projectDeleteTarget ? descendantIds(projects, projectDeleteTarget.id) : new Set<string>();
  const projectDeleteChildCount = Math.max(0, projectDeleteIds.size - 1);
  const projectDeleteSegmentCount = projectDeleteTarget
    ? projects.reduce((sum, project) => projectDeleteIds.has(project.id) ? sum + project.segments.length : sum, 0)
    : 0;
  const currentProvider = MODEL_PROVIDERS.find((provider) => provider.id === CURRENT_PROVIDER_ID) || MODEL_PROVIDERS[0];
  const capabilityLabel = (enabled: boolean, label: string) => enabled ? label : "";
  const providerCapabilityTags = (provider: ModelProvider) => [
    capabilityLabel(provider.capabilities.voiceClone, language === "zh" ? "音色克隆" : "Voice clone"),
    capabilityLabel(provider.capabilities.durationControl, language === "zh" ? "时长控制" : "Duration"),
    capabilityLabel(provider.capabilities.emotionControl, language === "zh" ? "情绪控制" : "Emotion"),
    capabilityLabel(provider.capabilities.streaming, language === "zh" ? "流式" : "Streaming"),
    capabilityLabel(provider.capabilities.dialects, language === "zh" ? "方言/口音" : "Dialects"),
  ].filter(Boolean);
  const commercialLabel = (provider: ModelProvider) => {
    if (provider.capabilities.commercialUse === "safe") return language === "zh" ? "商用友好" : "Commercial-friendly";
    if (provider.capabilities.commercialUse === "nonCommercial") return language === "zh" ? "非商用" : "Non-commercial";
    return language === "zh" ? "商用需确认" : "Check license";
  };
  const readableModelError = (message: string) => {
    const value = message.toLowerCase();
    if (value.includes("network") || value.includes("dns") || value.includes("timed out") || value.includes("connection")) {
      return language === "zh" ? "网络连接失败。请检查网络、代理或稍后重试；也可以改用手动下载模型。" : "Network connection failed. Check your network/proxy, retry later, or install manually.";
    }
    if (value.includes("space") || value.includes("no space")) {
      return language === "zh" ? "磁盘空间不足。请清理空间后重试，或把模型安装到空间更大的磁盘。" : "Not enough disk space. Free up storage or install the model on a larger disk.";
    }
    if (value.includes("python") || value.includes("runtime") || value.includes("venv")) {
      return language === "zh" ? "本地 Python 运行环境不可用。请尝试重新检测，或使用 DubCue 的独立运行环境。" : "The local Python runtime is unavailable. Try detecting again or use DubCue's isolated runtime.";
    }
    if (value.includes("memory") || value.includes("mps") || value.includes("cuda") || value.includes("metal")) {
      return language === "zh" ? "本机内存或加速环境不足。建议关闭其他程序，或选择更轻量的模型。" : "Memory or acceleration resources are insufficient. Close other apps or choose a lighter model.";
    }
    if (value.includes("license")) {
      return language === "zh" ? "这个模型需要先确认授权。商用前请阅读模型仓库的许可证说明。" : "This model requires license confirmation. Read the upstream license before commercial use.";
    }
    if (value.includes("missing") || value.includes("not found") || value.includes("incomplete")) {
      return language === "zh" ? "模型或运行文件不完整。请重新检测，或手动选择正确的模型目录。" : "Model or runtime files are incomplete. Detect again or choose the correct model folder manually.";
    }
    return message;
  };
  const installSteps = [
    language === "zh" ? "检查环境" : "Check environment",
    language === "zh" ? "下载模型/运行时" : "Download model/runtime",
    language === "zh" ? "安装依赖" : "Install dependencies",
    language === "zh" ? "启动服务" : "Start service",
    language === "zh" ? "测试生成" : "Test generation",
    language === "zh" ? "设为当前模型" : "Set current model",
  ];
  const activeInstallStep = runtime?.status === "downloading" ? 1 : runtime?.status === "verifying" ? 2 : runtime?.status === "starting" ? 3 : backendHealth ? 5 : 0;
  const providerStatusLabel = (provider: ModelProvider) => {
    if (provider.id === CURRENT_PROVIDER_ID) return language === "zh" ? "已接入" : "Available";
    if (provider.status === "experimental") return language === "zh" ? "建议手动安装" : "Manual install recommended";
    if (provider.status === "available") return language === "zh" ? "可用" : "Available";
    return language === "zh" ? "手动接入" : "Manual connection";
  };
  const providerGuideCopy = (provider: ModelProvider) => {
    if (provider.id === "voxcpm2") {
      return language === "zh"
        ? "DubCue 当前默认后端。若本机已经有 VoxCPM2，直接检测并连接即可。"
        : "DubCue's default backend. If VoxCPM2 is already on this machine, detect and connect it directly.";
    }
    if (provider.id === "spark-tts") {
      return language === "zh"
        ? "推荐先尝试：仓库轻、双语、Apache-2.0。打开官方仓库，按 README 安装并跑通示例后，再回 DubCue 手动接入。"
        : "Recommended first: lightweight, bilingual, Apache-2.0. Open the official repo, follow its README, run a sample, then connect it manually in DubCue.";
    }
    if (provider.id === "cosyvoice") {
      return language === "zh"
        ? "适合多语种、中文方言和更完整的第三方能力。按官方 README 部署服务后，再用本地 API 接入。"
        : "Good for multilingual and Chinese dialect workflows. Deploy it from the official README, then connect the local API.";
    }
    if (provider.id === "indextts2") {
      return language === "zh"
        ? "适合视频配音里更重视时长和情绪控制的场景；商用前要先确认授权。"
        : "Useful when duration and emotion control matter for video dubbing; confirm licensing before commercial use.";
    }
    if (provider.id === "gpt-sovits") {
      return language === "zh"
        ? "适合高级音色克隆和自定义声音包；部署链路更像专业工具，建议熟悉本地 Python 环境后使用。"
        : "Good for advanced cloning and custom voice packs; it is more of a pro local-Python workflow.";
    }
    return provider.summary[language];
  };

  const statusCopy = useMemo(
    () => ({ pending: t.idle, generating: t.processing, done: t.ready, error: t.failed }),
    [t],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void watchRuntime((value) => { if (!disposed) setRuntime(value); }).then((dispose) => { unlisten = dispose; });
    void (async () => {
      const status = await runtimeStatus();
      if (disposed) return;
      setRuntime(status);
      if (status.status === "ready" || status.status === "updateRequired") {
        try {
          const running = await startBackend();
          configureDesktopBackend(running.backendUrl, running.sessionToken);
          setBackendAddress(running.backendUrl || backendUrl());
          setRuntime(running);
          setBackendHealth(await getBackendHealth());
          setBackendError("");
        } catch (error) {
          setBackendError(String(error));
        }
      }
      const recovered = await loadAutosave<SavedProject>();
      if (recovered?.projects?.length) {
        const recoveredProjects = normalizeSavedProjects(recovered.projects);
        setProjects(recoveredProjects);
        projectsRef.current = recoveredProjects;
        activateProject(recoveredProjects.find((item) => item.id === recovered.currentProjectId) || recoveredProjects[0]);
      } else if (!window.localStorage.getItem("dubcue.native-migration.v1")) {
        await autosaveWorkspace({ savedAt: new Date().toISOString(), currentProjectId: projectId, projects: projectsRef.current });
      }
      window.localStorage.setItem("dubcue.native-migration.v1", "complete");
    })().catch((error) => setBackendError(String(error)));
    return () => { disposed = true; unlisten?.(); };
  }, []);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearInterval(timer));
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setIsSaved(true);
      return;
    }
    setIsSaved(false);
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ version: 1, segments }));
      window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId);
      setProjects((current) => {
        const existing = current.find((item) => item.id === projectId);
        const parentId = existing?.parentId || projectId;
        const project: SavedProject = {
          id: projectId,
          parentId,
          parentNodeId: existing?.parentNodeId ?? null,
          name: projectName,
          episodeName,
          rawScript,
          segments,
          directorState: {
            referenceAudio,
            referenceName,
            referenceSyncAll,
            promptSyncAll,
            ultimateClone,
            referenceTranscript,
          },
          updatedAt: Date.now(),
        };
        const next = current.some((item) => item.id === projectId)
          ? current.map((item) => item.id === projectId ? project : item)
          : [...current, project];
        window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
        void autosaveWorkspace({ savedAt: new Date().toISOString(), currentProjectId: projectId, projects: next });
        projectsRef.current = next;
        return next;
      });
      setSavedAt(new Date());
      setIsSaved(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [segments, projectId, projectName, episodeName, rawScript, referenceAudio, referenceName, referenceSyncAll, promptSyncAll, ultimateClone, referenceTranscript]);

  const checkBackend = async () => {
    try {
      const health = await getBackendHealth();
      setBackendHealth(health);
      setBackendError("");
    } catch {
      setBackendHealth(null);
      setBackendError(language === "zh" ? "本地生成服务未启动" : "Local generation service is offline");
    }
  };

  useEffect(() => {
    void checkBackend();
    const timer = window.setInterval(checkBackend, 15000);
    return () => window.clearInterval(timer);
  }, [language]);

  const commitSegments = (updater: (current: Segment[]) => Segment[]) => {
    setSegments((current) => {
      const next = updater(current);
      if (next === current) return current;
      setUndoStack((stack) => [...stack, current].slice(-50));
      setRedoStack([]);
      return next;
    });
  };

  const updateSegment = (id: number, patch: Partial<Segment> | ((segment: Segment) => Segment)) => {
    commitSegments((current) => current.map((segment) => {
      if (segment.id !== id) return segment;
      return typeof patch === "function" ? patch(segment) : { ...segment, ...patch };
    }));
  };

  const updatePerformancePrompt = (id: number, prompt: string) => {
    commitSegments((current) => current.map((segment) => (
      promptSyncAll || segment.id === id ? { ...segment, prompt } : segment
    )));
  };

  const updateSegmentForProject = (targetProjectId: string, id: number, patch: Partial<Segment> | ((segment: Segment) => Segment)) => {
    if (!targetProjectId) return;
    const applySegmentPatch = (segment: Segment) => (
      segment.id === id
        ? (typeof patch === "function" ? patch(segment) : { ...segment, ...patch })
        : segment
    );
    if (targetProjectId === projectIdRef.current) {
      setSegments((current) => current.map(applySegmentPatch));
      return;
    }
    const nextProjects = projectsRef.current.map((project) => (
      project.id === targetProjectId
        ? {
            ...project,
            segments: project.segments.map(applySegmentPatch),
            updatedAt: Date.now(),
          }
        : project
    ));
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects));
    void autosaveWorkspace({ savedAt: new Date().toISOString(), currentProjectId: projectIdRef.current, projects: nextProjects });
  };

  const makeAudioVersion = (result: { audioUrl: string; audioFile: string; durationSeconds: number; actualCpm?: number }): AudioVersion => ({
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    duration: formatDuration(result.durationSeconds),
    audioUrl: result.audioUrl,
    audioFile: result.audioFile,
    actualCpm: result.actualCpm,
  });

  const segmentWithActiveVersion = (segment: Segment, version: AudioVersion): Segment => ({
    ...segment,
    status: "done",
    progress: 100,
    duration: version.duration,
    audioUrl: version.audioUrl,
    audioFile: version.audioFile,
    actualCpm: version.actualCpm,
    activeAudioVersionId: version.id,
    error: undefined,
  });

  const renumber = (items: Segment[]) => items.map((item, index) => ({ ...item, id: index + 1 }));

  const splitSegment = (id: number, before: string, after: string) => {
    if (!before.trim() || !after.trim()) return;
    commitSegments((current) => {
      const index = current.findIndex((item) => item.id === id);
      const source = current[index];
      const next = [
        ...current.slice(0, index),
        { ...source, text: before.trim(), status: "pending" as const, progress: 0, duration: undefined },
        {
          ...source,
          id: source.id + 1,
          text: after.trim(),
          status: "pending" as const,
          progress: 0,
          duration: undefined,
        },
        ...current.slice(index + 1),
      ];
      return renumber(next);
    });
  };

  const mergePrevious = (id: number) => {
    if (id <= 1) return;
    commitSegments((current) => {
      const index = current.findIndex((item) => item.id === id);
      const previous = current[index - 1];
      const source = current[index];
      const next = [
        ...current.slice(0, index - 1),
        {
          ...previous,
          text: `${previous.text}${source.text}`,
          status: "pending" as const,
          progress: 0,
          duration: undefined,
        },
        ...current.slice(index + 1),
      ];
      setSelectedId(Math.max(1, id - 1));
      return renumber(next);
    });
  };

  const deleteSegment = (id: number) => {
    if (segments.length === 1 || deletingSegmentId !== null) return;
    setDeletingSegmentId(id);
    const deleteTimer = window.setTimeout(() => {
      commitSegments((current) => {
        if (current.length === 1) return current;
        const next = renumber(current.filter((item) => item.id !== id));
        setSelectedId(Math.min(id, next.length));
        return next;
      });
      setDeletingSegmentId(null);
    }, 340);
    timers.current.push(deleteTimer);
  };

  const insertSegmentAfter = (id: number) => {
    const source = segments.find((segment) => segment.id === id);
    const nextId = id + 1;
    commitSegments((current) => {
      const index = current.findIndex((segment) => segment.id === id);
      if (index < 0) return current;
      const inserted: Segment = {
        id: nextId,
        text: language === "zh" ? "在这里输入新的旁白分段。" : "Enter a new narration segment here.",
        speedCpm: source?.speedCpm || NATURAL_SPEED_CPM,
        prompt: source?.prompt || (language === "zh" ? "保持同一音色，自然讲述。" : "Keep the same voice and narrate naturally."),
        pauseSeconds: source?.pauseSeconds ?? 1,
        status: "pending",
        progress: 0,
        referenceAudio: source?.referenceAudio,
        referenceName: source?.referenceName,
        referenceTranscript: source?.referenceTranscript,
      };
      return renumber([...current.slice(0, index + 1), inserted, ...current.slice(index + 1)]);
    });
    setSelectedId(nextId);
    setEnteringSegmentId(nextId);
    const entranceTimer = window.setTimeout(() => setEnteringSegmentId(null), 700);
    timers.current.push(entranceTimer);
  };

  const formatDuration = (seconds: number) => {
    const rounded = Math.max(0, Math.round(seconds));
    return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
  };

  const generateOne = async (segment: Segment, targetProjectId = projectIdRef.current) => {
    const generationProjectId = targetProjectId;
    const generationReferenceAudio = referenceSyncAll ? referenceAudio : segment.referenceAudio;
    const generationReferenceTranscript = referenceSyncAll ? referenceTranscript : (segment.referenceTranscript || "");
    const generationUltimateClone = ultimateClone;
    const generationLanguage = language;
    const generationCfgValue = cfgValue;
    const generationInferenceTimesteps = inferenceTimesteps;
    if (generationUltimateClone && (!generationReferenceAudio || !generationReferenceTranscript.trim())) {
      updateSegmentForProject(generationProjectId, segment.id, {
        status: "error",
        progress: 0,
        error: generationLanguage === "zh"
          ? "超级克隆需要同时选择参考声音并填写参考音频文字。"
          : "Ultimate cloning requires reference audio and its transcript.",
      });
      return false;
    }
    updateSegmentForProject(generationProjectId, segment.id, { status: "generating", progress: 0, error: undefined });
    try {
      const result = await requestSegmentGeneration({
        text: segment.text,
        direction: generationUltimateClone ? "" : segment.prompt,
        targetCpm: NATURAL_SPEED_CPM,
        cfgValue: generationCfgValue,
        inferenceTimesteps: generationInferenceTimesteps,
        promptText: generationUltimateClone ? generationReferenceTranscript.trim() : undefined,
        referenceAudio: generationReferenceAudio,
      });
      const nextVersion = makeAudioVersion(result);
      updateSegmentForProject(generationProjectId, segment.id, (current) => {
        const audioVersions = [...(current.audioVersions || []), nextVersion].slice(-20);
        return segmentWithActiveVersion({
          ...current,
          audioVersions,
        }, nextVersion);
      });
      await checkBackend();
      return true;
    } catch (error) {
      updateSegmentForProject(generationProjectId, segment.id, { status: "error", progress: 0, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  };

  const selectAudioVersion = (segmentId: number, versionId: string) => {
    updateSegment(segmentId, (segment) => {
      const version = segment.audioVersions?.find((item) => item.id === versionId);
      return version ? segmentWithActiveVersion(segment, version) : segment;
    });
  };

  const deleteAudioVersion = (segmentId: number, versionId: string) => {
    updateSegment(segmentId, (segment) => {
      const audioVersions = (segment.audioVersions || []).filter((version) => version.id !== versionId);
      const fallback = audioVersions[audioVersions.length - 1];
      if (!fallback) {
        return {
          ...segment,
          status: "pending",
          progress: 0,
          duration: undefined,
          audioUrl: undefined,
          audioFile: undefined,
          actualCpm: undefined,
          audioVersions: [],
          activeAudioVersionId: undefined,
          error: undefined,
        };
      }
      const activeVersion = segment.activeAudioVersionId === versionId
        ? fallback
        : audioVersions.find((version) => version.id === segment.activeAudioVersionId) || fallback;
      return segmentWithActiveVersion({ ...segment, audioVersions }, activeVersion);
    });
  };

  const generateAll = async () => {
    if (isBatchGenerating) {
      stopBatchRef.current = true;
      return;
    }
    stopBatchRef.current = false;
    setIsBatchGenerating(true);
    const batchProjectId = projectIdRef.current;
    setSegments((current) => current.map((segment) => ({ ...segment, status: "pending", progress: 0 })));
    for (const segment of segments) {
      if (stopBatchRef.current) break;
      await generateOne(segment, batchProjectId);
    }
    setIsBatchGenerating(false);
  };

  const mergeExport = async () => {
    const ready = segments.filter((segment) => segment.audioFile);
    if (ready.length !== segments.length) {
      setBackendError(language === "zh" ? "请先生成全部分段，再进行合并。" : "Generate every segment before merging.");
      return;
    }
    try {
      const result = await requestMergeSegments(ready.map((segment) => ({
        audioFile: segment.audioFile!,
        pauseSeconds: segment.pauseSeconds,
      })));
      setMergedAudio(result);
      setBackendError("");
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : String(error));
    }
  };

  const togglePlayback = (segment: Segment) => {
    if (!segment.audioUrl) return;
    if (playingId === segment.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(absoluteAudioUrl(segment.audioUrl));
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(segment.id);
    void audio.play();
  };

  const audioFilename = (text: string, fallback: string) => {
    const filenameCharacters = Array.from(text.normalize("NFKC")).filter((character) => /[\p{L}\p{N}]/u.test(character));
    const stem = filenameCharacters.slice(0, 10).join("") || fallback;
    return `${stem}${filenameCharacters.length > 10 ? "..." : ""}.wav`;
  };

  const downloadAudio = async (audioUrl: string, filename: string) => {
    const picker = (window as typeof window & {
      showSaveFilePicker?: (options: {
        id: string;
        suggestedName: string;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker;
    let fileHandle: FileSystemFileHandle | undefined;
    if (!isDesktopApp() && picker) {
      try {
        fileHandle = await picker.call(window, {
          id: "dubcue-audio-download",
          suggestedName: filename,
          types: [{ description: "WAV Audio", accept: { "audio/wav": [".wav"] } }],
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      }
    }

    const response = await fetch(absoluteAudioUrl(audioUrl));
    if (!response.ok) throw new Error(language === "zh" ? "音频下载失败。" : "Audio download failed.");
    const blob = await response.blob();

    if (isDesktopApp()) {
      const storageKey = "dubcue.audio-download-directory";
      const defaultDirectory = window.localStorage.getItem(storageKey) || undefined;
      const savedPath = await saveAudioFile(filename, Array.from(new Uint8Array(await blob.arrayBuffer())), defaultDirectory);
      if (savedPath && !defaultDirectory) {
        const shouldRemember = window.confirm(language === "zh" ? "是否将这个文件夹设为默认音频保存位置？" : "Use this folder as the default audio save location?");
        if (shouldRemember) {
          const directory = savedPath.replace(/[\\/][^\\/]+$/, "");
          if (directory && directory !== savedPath) window.localStorage.setItem(storageKey, directory);
        }
      }
      return;
    }

    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openModelDocs = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void openExternalUrl(event.currentTarget.href);
  };

  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setRedoStack((stack) => [segments, ...stack].slice(0, 50));
    setUndoStack((stack) => stack.slice(0, -1));
    setSegments(previous);
    setSelectedId(Math.min(selectedId, previous.length));
  };

  const redo = () => {
    const next = redoStack[0];
    if (!next) return;
    setUndoStack((stack) => [...stack, segments].slice(-50));
    setRedoStack((stack) => stack.slice(1));
    setSegments(next);
    setSelectedId(Math.min(selectedId, next.length));
  };

  const saveSettings = () => {
    if (!isDesktopApp()) window.localStorage.setItem("dubcue.backend-url", backendAddress.replace(/\/$/, ""));
    window.localStorage.setItem(CFG_STORAGE_KEY, String(cfgValue));
    window.localStorage.setItem(INFERENCE_STEPS_STORAGE_KEY, String(inferenceTimesteps));
    setSettingsOpen(false);
    window.setTimeout(checkBackend, 0);
  };

  const connectDetectedRuntime = async () => {
    setBackendError("");
    try {
      const ready = await runtimeStatus();
      setRuntime(ready);
      if (ready.status !== "ready" && ready.status !== "updateRequired") return;
      const running = await startBackend();
      configureDesktopBackend(running.backendUrl, running.sessionToken);
      setBackendAddress(running.backendUrl || backendUrl());
      setRuntime(running);
      await checkBackend();
    } catch (error) {
      const message = readableModelError(error instanceof Error ? error.message : String(error));
      setBackendError(message);
      setRuntime((current) => current ? { ...current, status: "error", message } : current);
    }
  };

  const currentNativeWorkspace = (): NativeWorkspace<SavedProject> => ({
    savedAt: new Date().toISOString(), currentProjectId: projectId, projects: projectsRef.current,
  });

  const saveNativeProject = async (saveAs = false) => {
    const path = await saveProjectFile(currentNativeWorkspace(), saveAs ? undefined : nativeProjectPath);
    if (path) { setNativeProjectPath(path); setSavedAt(new Date()); setIsSaved(true); }
  };

  const chooseReferenceAudio = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_REFERENCE_AUDIO_BYTES) {
      setReferenceTranscriptStatus(language === "zh"
        ? `参考音频过大。请上传 25MB 以内的 WAV / MP3 / FLAC；较长音频建议先截取 5～20 秒。`
        : "Reference audio is too large. Use a WAV / MP3 / FLAC under 25MB; 5–20 seconds is recommended.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const nextReference = { name: file.name, base64: dataUrl.split(",")[1] || "" };
      if (referenceSyncAll) {
        setReferenceAudio(nextReference);
        setReferenceName(file.name);
        setReferenceTranscript("");
      } else if (selected) {
        updateSegment(selected.id, {
          referenceAudio: nextReference,
          referenceName: file.name,
          referenceTranscript: "",
        });
      }
      setReferenceTranscriptStatus(language === "zh" ? "参考音频已更新，可自动识别文字。" : "Reference audio updated; transcription is available.");
    };
    reader.onerror = () => {
      setReferenceTranscriptStatus(language === "zh" ? "参考音频读取失败，请换一个文件。" : "Could not read the reference audio.");
    };
    reader.readAsDataURL(file);
  };

  const recognizeReferenceAudio = async () => {
    const targetReferenceAudio = referenceSyncAll ? referenceAudio : selected?.referenceAudio;
    if (!targetReferenceAudio) {
      setReferenceTranscriptStatus(language === "zh" ? "请先选择参考音频。" : "Choose reference audio first.");
      return;
    }
    setIsTranscribingReference(true);
    setReferenceTranscriptStatus(language === "zh" ? "正在识别参考音频文字…" : "Transcribing reference audio…");
    try {
      const result = await requestReferenceTranscription(targetReferenceAudio);
      if (referenceSyncAll) setReferenceTranscript(result.text);
      else if (selected) updateSegment(selected.id, { referenceTranscript: result.text });
      setReferenceTranscriptStatus(language === "zh" ? "识别完成，你可以继续修改文字。" : "Transcription complete. You can edit the text.");
    } catch (error) {
      setReferenceTranscriptStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsTranscribingReference(false);
    }
  };

  const buildDirectorTable = (text = rawScript, requestedMaxChars = segmentMaxChars) => {
    const parsedMaxChars = Number.parseInt(String(requestedMaxChars).replace(/\D/g, ""), 10);
    const maxChars = Math.max(20, Math.min(300, Number.isFinite(parsedMaxChars) ? parsedMaxChars : 70));
    const sentenceChunks = (text.match(/[^。！？!?\n]+[。！？!?]?/g) || [])
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    const chunks = sentenceChunks.flatMap((sentence) => {
      const result: string[] = [];
      let remaining = sentence;
      while (remaining.length > maxChars) {
        const preview = remaining.slice(0, maxChars + 1);
        const punctuation = ["，", ",", "；", ";", "：", ":", "、"];
        let cut = Math.max(...punctuation.map((mark) => preview.lastIndexOf(mark) + 1));
        if (cut < Math.floor(maxChars * 0.45)) cut = maxChars;
        result.push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut).trim();
      }
      if (remaining) result.push(remaining);
      return result;
    });
    if (!chunks.length) return;
    const builtSegments = chunks.map((textValue, index) => ({
      id: index + 1,
      text: textValue,
      speedCpm: 215,
      prompt: language === "zh" ? "保持自然、清晰，按文本情绪讲述。" : "Natural, clear delivery that follows the text.",
      pauseSeconds: /[。！？!?]$/.test(textValue) ? 1 : 0.5,
      status: "pending" as const,
      progress: 0,
    }));
    const currentNode = projectsRef.current.find((project) => project.id === projectId);
    if (currentNode && !currentNode.parentNodeId) {
      const savedProjects = saveCurrentProject();
      const siblingCount = savedProjects.filter((project) => project.parentNodeId === currentNode.id).length;
      const childName = siblingCount
        ? (language === "zh" ? `主内容 ${siblingCount + 1}` : `Main content ${siblingCount + 1}`)
        : (language === "zh" ? "主内容" : "Main content");
      const created: SavedProject = {
        id: crypto.randomUUID(),
        parentId: currentNode.id,
        parentNodeId: currentNode.id,
        name: currentNode.name,
        episodeName: childName,
        rawScript: text,
        segments: builtSegments,
        directorState: {
          referenceAudio,
          referenceName,
          referenceSyncAll,
          promptSyncAll,
          ultimateClone,
          referenceTranscript,
        },
        updatedAt: Date.now(),
      };
      const next = [...savedProjects, created];
      projectsRef.current = next;
      setProjects(next);
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
      activateProject(created);
    } else {
      commitSegments(() => builtSegments);
    }
    setSelectedId(1);
    setImportOpen(false);
    setActiveNav("director");
    setIsTableEntering(true);
    const entranceTimer = window.setTimeout(() => setIsTableEntering(false), 1250);
    timers.current.push(entranceTimer);
  };

  const updateRawScriptFromEditor = (value: string) => {
    setRawScript((current) => {
      if (current === value) return current;
      rawScriptUndoRef.current = [...rawScriptUndoRef.current.slice(-49), current];
      rawScriptRedoRef.current = [];
      return value;
    });
  };

  const undoRawScriptEdit = () => {
    const previous = rawScriptUndoRef.current[rawScriptUndoRef.current.length - 1];
    if (previous === undefined) return;
    rawScriptUndoRef.current = rawScriptUndoRef.current.slice(0, -1);
    setRawScript((current) => {
      rawScriptRedoRef.current = [...rawScriptRedoRef.current.slice(-49), current];
      return previous;
    });
  };

  const redoRawScriptEdit = () => {
    const next = rawScriptRedoRef.current[rawScriptRedoRef.current.length - 1];
    if (next === undefined) return;
    rawScriptRedoRef.current = rawScriptRedoRef.current.slice(0, -1);
    setRawScript((current) => {
      rawScriptUndoRef.current = [...rawScriptUndoRef.current.slice(-49), current];
      return next;
    });
  };

  const importScript = async (file?: File) => {
    if (!file) return;
    setScriptImportMessage(language === "zh" ? "正在读取稿件…" : "Reading script…");
    setScriptImportFailed(false);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let textValue: string;
      if (extension === "docx") {
        const mammoth = await import("mammoth");
        textValue = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
      } else {
        textValue = await file.text();
      }
      textValue = textValue.trim();
      if (!textValue) {
        throw new Error(language === "zh" ? "稿件中没有可读取的文字。" : "No readable text was found in the document.");
      }
      setRawScript((current) => {
        rawScriptUndoRef.current = [...rawScriptUndoRef.current.slice(-49), current];
        rawScriptRedoRef.current = [];
        return textValue;
      });
      setScriptImportMessage(
        language === "zh"
          ? `${file.name} · 已导入 ${textValue.length} 字`
          : `${file.name} · ${textValue.length} characters imported`,
      );
    } catch (error) {
      setScriptImportFailed(true);
      setScriptImportMessage(
        error instanceof Error
          ? error.message
          : (language === "zh" ? "稿件读取失败。" : "Could not read the script."),
      );
    }
  };

  const saveCurrentProject = () => {
    const currentProjects = projectsRef.current;
    if (!projectId) return currentProjects;
    const existing = currentProjects.find((item) => item.id === projectId);
    const parentId = existing?.parentId || projectId;
    const project: SavedProject = {
      id: projectId,
      parentId,
      parentNodeId: existing?.parentNodeId ?? null,
      name: projectName,
      episodeName,
      rawScript,
      segments,
      directorState: {
        referenceAudio,
        referenceName,
        referenceSyncAll,
        promptSyncAll,
        ultimateClone,
        referenceTranscript,
      },
      updatedAt: Date.now(),
    };
    const next = currentProjects.some((item) => item.id === projectId)
      ? currentProjects.map((item) => item.id === projectId ? project : item)
      : [...currentProjects, project];
    projectsRef.current = next;
    setProjects(next);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId);
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ version: 1, segments }));
    setSavedAt(new Date());
    setIsSaved(true);
    return next;
  };

  function activateProject(next: SavedProject) {
    audioRef.current?.pause();
    setPlayingId(null);
    setProjectId(next.id);
    const root = nodePath(projectsRef.current, next.id)[0] ?? next;
    setProjectName(root.name);
    setEpisodeName(next.episodeName);
    setSegments(normalizeSavedSegments(next.segments));
    setRawScript(next.rawScript);
    rawScriptUndoRef.current = [];
    rawScriptRedoRef.current = [];
    setSelectedId(1);
    setUndoStack([]);
    setRedoStack([]);
    setReferenceAudio(next.directorState.referenceAudio);
    setReferenceName(next.directorState.referenceName);
    setReferenceSyncAll(next.directorState.referenceSyncAll);
    setPromptSyncAll(next.directorState.promptSyncAll);
    setUltimateClone(next.directorState.ultimateClone);
    setReferenceTranscript(next.directorState.referenceTranscript);
    setReferenceTranscriptStatus("");
    setMergedAudio(null);
    window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, next.id);
  }

  const switchProject = (nextId: string) => {
    if (nextId === projectId) return;
    const savedProjects = projectId ? saveCurrentProject() : projectsRef.current;
    const next = savedProjects.find((project) => project.id === nextId);
    if (next) activateProject(next);
  };

  const createProject = () => {
    const name = newProjectName.trim() || (language === "zh" ? "未命名项目" : "Untitled project");
    const savedProjects = projectId ? saveCurrentProject() : projectsRef.current;
    const id = crypto.randomUUID();
    const created: SavedProject = {
      id,
      parentId: id,
      parentNodeId: null,
      name,
      episodeName: name,
      rawScript: "",
      segments: [],
      directorState: {
        referenceName: "",
        referenceSyncAll: false,
        promptSyncAll: false,
        ultimateClone: false,
        referenceTranscript: "",
      },
      updatedAt: Date.now(),
    };
    const nextProjects = [...savedProjects, created];
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
    setProjectId(id);
    setProjectName(name);
    setEpisodeName(name);
    setSegments([]);
    setRawScript("");
    rawScriptUndoRef.current = [];
    rawScriptRedoRef.current = [];
    setSelectedId(1);
    setUndoStack([]);
    setRedoStack([]);
    setReferenceAudio(undefined);
    setReferenceName("");
    setReferenceSyncAll(false);
    setPromptSyncAll(false);
    setUltimateClone(false);
    setReferenceTranscript("");
    setReferenceTranscriptStatus("");
    setMergedAudio(null);
    setNewProjectName("");
    setNewProjectOpen(false);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects));
    window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, id);
    setActiveNav("script");
  };

  const openCreateChild = (parentId: string) => {
    setNewChildParentId(parentId);
    setNewChildName("");
    setNewChildOpen(true);
  };

  const createChild = () => {
    if (!newChildParentId) return;
    const savedProjects = saveCurrentProject();
    const parent = savedProjects.find((project) => project.id === newChildParentId);
    if (!parent) return;
    const siblings = savedProjects.filter((project) => project.parentNodeId === parent.id);
    const id = crypto.randomUUID();
    const childName = newChildName.trim() || (language === "zh" ? `子项目 ${siblings.length + 1}` : `Child ${siblings.length + 1}`);
    const root = nodePath(savedProjects, parent.id)[0] ?? parent;
    const created: SavedProject = {
      id,
      parentId: root.id,
      parentNodeId: parent.id,
      name: root.name,
      episodeName: childName,
      rawScript: "",
      segments: [],
      directorState: {
        referenceName: "",
        referenceSyncAll: false,
        promptSyncAll: false,
        ultimateClone: false,
        referenceTranscript: "",
      },
      updatedAt: Date.now(),
    };
    const next = [...savedProjects, created];
    projectsRef.current = next;
    setProjects(next);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
    setNewChildName("");
    setNewChildParentId(null);
    setNewChildOpen(false);
    activateProject(created);
    setActiveNav("director");
  };

  const duplicateProject = (targetId: string) => {
    const savedProjects = saveCurrentProject();
    const sourceIds = descendantIds(savedProjects, targetId);
    const source = savedProjects.filter((project) => sourceIds.has(project.id));
    const target = savedProjects.find((project) => project.id === targetId);
    if (!target || !source.length) return;
    const idMap = new Map(source.map((project) => [project.id, crypto.randomUUID()]));
    const suffix = language === "zh" ? " 副本" : " Copy";
    const duplicated = source.map((project) => ({
      ...project,
      id: idMap.get(project.id)!,
      parentId: target.parentNodeId ? target.parentId : idMap.get(target.id)!,
      parentNodeId: project.id === target.id
        ? target.parentNodeId
        : (project.parentNodeId ? idMap.get(project.parentNodeId) ?? target.parentNodeId : null),
      name: target.parentNodeId ? project.name : `${target.name}${suffix}`,
      episodeName: project.id === target.id
        ? `${project.episodeName}${suffix}`
        : project.episodeName,
      segments: project.segments.map((segment) => ({ ...segment })),
      directorState: {
        ...project.directorState,
        referenceAudio: project.directorState.referenceAudio ? { ...project.directorState.referenceAudio } : undefined,
      },
      updatedAt: Date.now(),
    }));
    const next = [...savedProjects, ...duplicated];
    projectsRef.current = next;
    setProjects(next);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
    const duplicateRoot = duplicated.find((project) => project.id === idMap.get(target.id)) ?? duplicated[0];
    activateProject(duplicateRoot);
    setActiveNav(duplicateRoot.parentNodeId ? "director" : "script");
  };

  const requestDeleteProject = (targetId: string) => {
    const target = projectsRef.current.find((project) => project.id === targetId);
    if (!target) return;
    setProjectDeleteTargetId(targetId);
  };

  const deleteProject = () => {
    const targetId = projectDeleteTargetId;
    if (!targetId) return;
    const target = projectsRef.current.find((project) => project.id === targetId);
    if (!target) {
      setProjectDeleteTargetId(null);
      return;
    }
    const removedIds = descendantIds(projectsRef.current, targetId);
    const next = projectsRef.current.filter((project) => !removedIds.has(project.id));
    projectsRef.current = next;
    setProjects(next);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
    if (removedIds.has(projectId) && next[0]) {
      const fallback = target.parentNodeId
        ? next.find((project) => project.id === target.parentNodeId) ?? next[0]
        : next[0];
      activateProject(fallback);
      setActiveNav(fallback.parentNodeId ? "director" : "script");
    } else if (!next.length) {
      setProjectId("");
      setProjectName("");
      setEpisodeName("");
      setSegments([]);
      setRawScript("");
      rawScriptUndoRef.current = [];
      rawScriptRedoRef.current = [];
      setSelectedId(1);
      setUndoStack([]);
      setRedoStack([]);
      setReferenceAudio(undefined);
      setReferenceName("");
      setReferenceSyncAll(false);
      setPromptSyncAll(false);
      setUltimateClone(false);
      setReferenceTranscript("");
      setReferenceTranscriptStatus("");
      setMergedAudio(null);
      window.localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY);
      window.localStorage.removeItem(PROJECT_STORAGE_KEY);
      setActiveNav("script");
    }
    setProjectDeleteTargetId(null);
  };

  const moveColumn = (source: ColumnId, target: ColumnId) => {
    if (source === target) return;
    setColumnOrder((current) => {
      const next = current.filter((column) => column !== source);
      next.splice(next.indexOf(target), 0, source);
      return next;
    });
  };

  const moveColumnByOffset = (column: ColumnId, offset: -1 | 1) => {
    setColumnOrder((current) => {
      const sourceIndex = current.indexOf(column);
      const targetIndex = sourceIndex + offset;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
      return next;
    });
  };

  const moveSegment = (sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    commitSegments((current) => {
      const selectedOriginalId = selectedId;
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      const nextSelectedIndex = next.findIndex((item) => item.id === selectedOriginalId);
      setSelectedId(nextSelectedIndex + 1);
      return renumber(next);
    });
  };

  const beginTreeRename = (node: "project" | "content", targetProjectId: string, value: string) => {
    setTreeNameDraft(value);
    setEditingTreeNode(`${node}:${targetProjectId}`);
  };

  const commitTreeRename = (_node: "project" | "content", targetProjectId: string) => {
    const value = treeNameDraft.trim();
    if (value) {
      const target = projectsRef.current.find((project) => project.id === targetProjectId);
      const isRoot = !target?.parentNodeId;
      const affectedIds = isRoot ? descendantIds(projectsRef.current, targetProjectId) : new Set([targetProjectId]);
      const next = projectsRef.current.map((project) => (
        affectedIds.has(project.id)
          ? {
              ...project,
              ...(isRoot ? { name: value } : {}),
              ...(project.id === targetProjectId ? { episodeName: value } : {}),
              updatedAt: Date.now(),
            }
          : project
      ));
      projectsRef.current = next;
      setProjects(next);
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
      if (affectedIds.has(projectId)) {
        if (isRoot) setProjectName(value);
        if (targetProjectId === projectId) setEpisodeName(value);
      }
    }
    setEditingTreeNode(null);
  };

  const renderTreeName = (node: "project" | "content", targetProjectId: string, value: string) => (
    editingTreeNode === `${node}:${targetProjectId}` ? (
      <input
        className="tree-name-input"
        autoFocus
        value={treeNameDraft}
        aria-label={language === "zh" ? "重命名" : "Rename"}
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onChange={(event) => setTreeNameDraft(event.target.value)}
        onBlur={() => commitTreeRename(node, targetProjectId)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setEditingTreeNode(null);
        }}
      />
    ) : (
      <span
        className="tree-name"
        title={language === "zh" ? "双击重命名" : "Double-click to rename"}
        onDoubleClick={(event) => {
          event.stopPropagation();
          beginTreeRename(node, targetProjectId, value);
        }}
      >
        {value}
      </span>
    )
  );

  const activateTreeNode = (node: SavedProject) => {
    switchProject(node.id);
    setActiveNav(node.parentNodeId ? "director" : "script");
  };

  const renderHierarchyNode = (node: SavedProject, depth = 0): React.ReactNode => {
    const children = childrenByParent.get(node.id) ?? [];
    const isExpanded = !collapsedProjectIds.includes(node.id);
    const isCurrent = node.id === projectId;
    const displayName = isCurrent ? episodeName : node.episodeName;
    const segmentCount = isCurrent ? segments.length : node.segments.length;
    return (
      <div className="hierarchy-node" key={node.id}>
        <div
          className={`hierarchy-node-row${isCurrent ? " active" : ""}`}
          style={{ paddingLeft: `${4 + depth * 16}px` }}
        >
          <button
            className={`tree-toggle${children.length ? "" : " empty"}`}
            type="button"
            tabIndex={children.length ? 0 : -1}
            aria-hidden={!children.length}
            aria-label={isExpanded
              ? (language === "zh" ? `折叠 ${displayName}` : `Collapse ${displayName}`)
              : (language === "zh" ? `展开 ${displayName}` : `Expand ${displayName}`)}
            onClick={(event) => {
              event.stopPropagation();
              if (children.length) setCollapsedProjectIds((current) => current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id]);
            }}
          >
            {children.length && <ChevronDown className={isExpanded ? "" : "collapsed"} size={13} />}
          </button>
          <div
            className="project-nav-name"
            role="button"
            tabIndex={0}
            onClick={() => activateTreeNode(node)}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              beginTreeRename(node.parentNodeId ? "content" : "project", node.id, displayName);
            }}
            onKeyDown={(event) => { if (event.key === "Enter") activateTreeNode(node); }}
          >
            {renderTreeName(node.parentNodeId ? "content" : "project", node.id, displayName)}
          </div>
          {!!node.parentNodeId && <span className="nav-count">{segmentCount || ""}</span>}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="project-more-button"
                type="button"
                aria-label={language === "zh" ? `层级操作 ${displayName}` : `Actions for ${displayName}`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="project-menu project-actions-menu" align="start" sideOffset={4} onClick={(event) => event.stopPropagation()}>
                <DropdownMenu.Item className="project-menu-item" onSelect={() => beginTreeRename(node.parentNodeId ? "content" : "project", node.id, displayName)}><Pencil size={14} />{language === "zh" ? "重命名" : "Rename"}</DropdownMenu.Item>
                <DropdownMenu.Item className="project-menu-item" onSelect={() => openCreateChild(node.id)}><Plus size={14} />{language === "zh" ? "新建子项目" : "New child project"}</DropdownMenu.Item>
                <DropdownMenu.Item className="project-menu-item" onSelect={() => duplicateProject(node.id)}><FilePlus2 size={14} />{language === "zh" ? "复制" : "Duplicate"}</DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item className="project-menu-item danger" onSelect={() => requestDeleteProject(node.id)}><Trash2 size={14} />{language === "zh" ? "删除" : "Delete"}</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        {isExpanded && children.map((child) => renderHierarchyNode(child, depth + 1))}
      </div>
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [segments, undoStack, redoStack, selectedId]);

  const columnLabels: Record<ColumnId, string> = {
    text: t.text,
    speed: t.speed,
    prompt: t.prompt,
    pause: t.pause,
    audio: language === "zh" ? "分段音频" : "Segment audio",
  };
  const tableGridStyle = {
    gridTemplateColumns: `42px ${columnOrder.map((column) => COLUMN_TRACKS[column]).join(" ")}`,
  };

  const renderColumnCell = (column: ColumnId, segment: Segment, isPlaying: boolean) => {
    switch (column) {
      case "text":
        return (
          <div className="text-cell" key={column}>
            <textarea
              value={segment.text}
              aria-label={`${t.text} ${segment.id}`}
              onChange={(event) => updateSegment(segment.id, { text: event.target.value })}
              onKeyDown={(event) => {
                const target = event.currentTarget;
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  splitSegment(segment.id, target.value.slice(0, target.selectionStart), target.value.slice(target.selectionStart));
                }
                if (event.key === "Backspace" && target.selectionStart === 0 && target.selectionEnd === 0) {
                  event.preventDefault();
                  mergePrevious(segment.id);
                }
              }}
            />
            <span className="char-count">{segment.text.length}</span>
          </div>
        );
      case "speed":
        return (
          <div className="speed-cell" key={column}>
            <input
              className="inline-number"
              type="number"
              min="80"
              max="420"
              step="5"
              value={segment.speedCpm}
              aria-label={`${t.speed} ${segment.id}`}
              onChange={(event) => updateSegment(segment.id, { speedCpm: Number(event.target.value) })}
            />
            <span>{language === "zh" ? "字/分" : "CPM"}</span>
          </div>
        );
      case "prompt":
        return <div className="prompt-cell" title={segment.prompt} key={column}>{segment.prompt}</div>;
      case "pause":
        return (
          <div className="pause-cell" key={column}>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={segment.pauseSeconds}
              aria-label={`${t.pause} ${segment.id}`}
              onChange={(event) => updateSegment(segment.id, { pauseSeconds: Number(event.target.value) })}
            />
            <span>{language === "zh" ? "秒" : "sec"}</span>
          </div>
        );
      case "audio":
        const audioVersions = segment.audioVersions || [];
        const activeVersionIndex = Math.max(0, audioVersions.findIndex((version) => version.id === segment.activeAudioVersionId));
        return (
          <div className="audio-cell" key={column}>
            {segment.status === "done" ? (
              <div className="audio-ready">
                <button
                  className={`play-button${isPlaying ? " playing" : ""}`}
                  type="button"
                  aria-label={t.play}
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePlayback(segment);
                  }}
                >
                  {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                </button>
                <WaveformBars active={isPlaying} />
                <span className="duration" title={segment.actualCpm ? `${segment.actualCpm} ${language === "zh" ? "字/分" : "CPM"}` : undefined}>{segment.duration}</span>
                {audioVersions.length > 0 && (
                  <details className="audio-version-menu">
                    <summary aria-label={language === "zh" ? "音频版本" : "Audio versions"}>
                      <span>{language === "zh" ? `版本 ${activeVersionIndex + 1}` : `V${activeVersionIndex + 1}`}</span>
                      <ChevronDown size={12} />
                    </summary>
                    <div className="audio-version-list" onClick={(event) => event.stopPropagation()}>
                      {audioVersions.map((version, versionIndex) => (
                        <div className={`audio-version-item${version.id === segment.activeAudioVersionId ? " active" : ""}`} key={version.id}>
                          <button
                            type="button"
                            onClick={() => selectAudioVersion(segment.id, version.id)}
                          >
                            <span>{language === "zh" ? `版本 ${versionIndex + 1}` : `Version ${versionIndex + 1}`}</span>
                            <small>{version.duration || "00:00"}</small>
                          </button>
                          <IconButton label={language === "zh" ? "删除版本" : "Delete version"} onClick={() => deleteAudioVersion(segment.id, version.id)}><Trash2 size={12} /></IconButton>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <IconButton label={t.download} onClick={() => void downloadAudio(segment.audioUrl!, audioFilename(segment.text, `dubcue-${segment.id}`))}><Download size={14} /></IconButton>
                <IconButton label={t.regenerate} onClick={() => void generateOne(segment)}><RefreshCw size={14} /></IconButton>
              </div>
            ) : segment.status === "generating" ? (
              <div className="generating-state">
                <div className="generation-meta"><span>{t.processing}</span><strong>{language === "zh" ? "请稍候" : "Please wait"}</strong></div>
                <div className="progress-track indeterminate"><span /></div>
              </div>
            ) : (
              <button className="generate-row" type="button" onClick={() => void generateOne(segment)}>
                <AudioLines size={15} />{segment.status === "error" ? t.failed : t.idle}
              </button>
            )}
            <span className={`status-dot ${segment.status}`} title={segment.error || statusCopy[segment.status]} />
          </div>
        );
    }
  };

  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="app-shell">
        <header className="titlebar">
          <div className="brand-lockup">
            <img className="brand-mark" src="/dubcue-mark.png" alt="" aria-hidden="true" />
            <strong>DubCue</strong>
          </div>

          <div className="titlebar-status">
            <span className="save-status" title={savedAt?.toLocaleTimeString()}>
              <span className={`save-dot${isSaved ? " saved" : ""}`} />
              {isSaved ? t.saved : (language === "zh" ? "正在保存…" : "Saving…")}
            </span>
            <span className={`model-status${backendHealth ? " online" : " offline"}`} title={backendError || backendHealth?.modelId}>
              <span className="model-dot" />
              {backendHealth
                ? `${backendHealth.modelId} · ${backendHealth.modelLoaded ? (language === "zh" ? "已就绪" : "ready") : (language === "zh" ? "已连接" : "connected")}`
                : (language === "zh" ? "尚未连接生成模型" : "No generation model connected")}
            </span>
          </div>

          <div className="window-actions">
            <IconButton label={t.undo} onClick={undo} disabled={!undoStack.length}><Undo2 size={16} /></IconButton>
            <IconButton label={t.redo} onClick={redo} disabled={!redoStack.length}><Redo2 size={16} /></IconButton>
            <span className="toolbar-separator" />
            <IconButton label={t.language} onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>
              <Languages size={16} />
            </IconButton>
            <IconButton label={t.theme} onClick={() => setDark((value) => !value)}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
            <IconButton label={t.settings} onClick={() => setSettingsOpen(true)}><Settings2 size={16} /></IconButton>
          </div>
        </header>

        <aside className="sidebar">
          <button className="new-project-button" type="button" onClick={() => setNewProjectOpen(true)}>
            <FilePlus2 size={16} />
            {t.newProject}
          </button>

          <nav className="primary-nav project-navigation" aria-label={language === "zh" ? "项目层级" : "Project hierarchy"}>
            {rootProjects.map((project) => renderHierarchyNode(project))}
          </nav>

          <div className="sidebar-footer">
            <button type="button" onClick={() => setHelpOpen(true)}><CircleHelp size={16} />{t.help}</button>
            <button type="button" onClick={() => { saveCurrentProject(); if (isDesktopApp()) void saveNativeProject(); }}>
              <Save size={16} />{t.save}<span className="shortcut">⌘S</span>
            </button>
          </div>
        </aside>

        <main className="workspace">
          {!projects.length ? (
            <section className="empty-workspace">
              <div className="empty-workspace-icon"><BookOpen size={24} /></div>
              <h1>{language === "zh" ? "给我看看你的本子呗~" : "Show me your script~"}</h1>
              <p>{language === "zh" ? "创建一个项目，开始导入稿件并制作配音。" : "Create a project to import a script and start producing voiceover."}</p>
              <button className="button primary" type="button" onClick={() => setNewProjectOpen(true)}><FilePlus2 size={16} />{t.newProject}</button>
            </section>
          ) : activeNav === "script" ? (
            <div className="script-workspace">
              <section className="workspace-heading">
                <div>
                  <div className="eyebrow">{language === "zh" ? "项目" : "Project"}</div>
                  <h1>{projectName}</h1>
                </div>
              </section>
              <section className="new-script-prompt">
                <h2>{language === "zh" ? "新建台本" : "Create a script"}</h2>
                <button className="button primary" type="button" onClick={() => setImportOpen(true)}>
                  <Upload size={16} />{t.importScript}
                </button>
              </section>
            </div>
          ) : (
            <>
          <section className="workspace-heading">
            <div className="heading-actions">
              <button className="button secondary" type="button" onClick={() => setImportOpen(true)}>
                <Upload size={16} />{importButtonLabel}
              </button>
            </div>
          </section>

          {hasDirectorTable ? <div className="editor-layout">
            <section className="director-surface">
              <div className="surface-toolbar">
                <div className="toolbar-copy">
                  <h2>{t.workspace}</h2>
                  <span>{segments.length} {language === "zh" ? "个分段" : "segments"}</span>
                </div>
                <div className="surface-tools">
                  <span className="keyboard-hint">{t.tableHint}</span>
                </div>
              </div>

              <div className="director-table" role="table" aria-label={t.director}>
                <div className="table-header" role="row" style={tableGridStyle}>
                  <div>#</div>
                  {columnOrder.map((column) => (
                    <div
                      className={`draggable-column${draggedColumn === column ? " dragging" : ""}${dragOverColumn === column && draggedColumn !== column ? " drag-over" : ""}`}
                      data-column-id={column}
                      draggable
                      key={column}
                      role="columnheader"
                      tabIndex={0}
                      title={language === "zh" ? "拖动调整列顺序" : "Drag to reorder columns"}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", column);
                        setDraggedColumn(column);
                      }}
                      onDragEnter={() => setDragOverColumn(column)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const source = draggedColumn ?? event.dataTransfer.getData("text/plain") as ColumnId;
                        if (DEFAULT_COLUMN_ORDER.includes(source)) moveColumn(source, column);
                        setDraggedColumn(null);
                        setDragOverColumn(null);
                      }}
                      onDragEnd={() => {
                        setDraggedColumn(null);
                        setDragOverColumn(null);
                      }}
                      onKeyDown={(event) => {
                        if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
                        event.preventDefault();
                        moveColumnByOffset(column, event.key === "ArrowLeft" ? -1 : 1);
                      }}
                    >
                      <GripVertical className="column-grip" size={13} aria-hidden="true" />
                      <span>{columnLabels[column]}</span>
                    </div>
                  ))}
                </div>

                <div className="table-body">
                  {segments.map((segment) => {
                    const isSelected = segment.id === selectedId;
                    const isPlaying = segment.id === playingId;
                    return (
                      <div
                        className={`segment-row${isSelected ? " selected" : ""}${dragOverSegmentId === segment.id && draggedSegmentId !== segment.id ? " row-drag-over" : ""}${isTableEntering ? " table-entering" : ""}${enteringSegmentId === segment.id ? " segment-entering" : ""}${deletingSegmentId === segment.id ? " segment-deleting" : ""}`}
                        role="row"
                        style={{
                          ...tableGridStyle,
                          animationDelay: isTableEntering ? `${Math.min(segment.id - 1, 30) * 18}ms` : undefined,
                        }}
                        key={segment.id}
                        onClick={() => setSelectedId(segment.id)}
                        onDragEnter={() => setDragOverSegmentId(segment.id)}
                        onDragOver={(event) => {
                          if (draggedSegmentId === null) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const source = draggedSegmentId ?? Number(event.dataTransfer.getData("text/plain"));
                          if (source) moveSegment(source, segment.id);
                          setDraggedSegmentId(null);
                          setDragOverSegmentId(null);
                        }}
                      >
                        <div className="row-number">
                          <button
                            className="row-drag-handle"
                            type="button"
                            draggable
                            aria-label={language === "zh" ? `拖动分段 ${segment.id}` : `Drag segment ${segment.id}`}
                            title={language === "zh" ? "拖动调整分段顺序" : "Drag to reorder segments"}
                            onClick={(event) => event.stopPropagation()}
                            onDragStart={(event) => {
                              event.stopPropagation();
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", String(segment.id));
                              setDraggedSegmentId(segment.id);
                            }}
                            onDragEnd={() => {
                              setDraggedSegmentId(null);
                              setDragOverSegmentId(null);
                            }}
                            onKeyDown={(event) => {
                              if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                              event.preventDefault();
                              const targetId = segment.id + (event.key === "ArrowUp" ? -1 : 1);
                              if (targetId >= 1 && targetId <= segments.length) moveSegment(segment.id, targetId);
                            }}
                          >
                            <GripVertical size={12} aria-hidden="true" />
                            <span>{String(segment.id).padStart(2, "0")}</span>
                          </button>
                          <button
                            className="row-insert-button"
                            type="button"
                            aria-label={`${t.addSegment} ${segment.id}`}
                            title={language === "zh" ? "在下方新增分段" : "Add segment below"}
                            onClick={(event) => {
                              event.stopPropagation();
                              insertSegmentAfter(segment.id);
                            }}
                          >
                            <Plus size={13} aria-hidden="true" />
                          </button>
                          <button
                            className="row-delete-button"
                            type="button"
                            disabled={segments.length === 1}
                            aria-label={`${t.deleteSegment} ${segment.id}`}
                            title={segments.length === 1
                              ? (language === "zh" ? "至少保留一个分段" : "Keep at least one segment")
                              : t.deleteSegment}
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteSegment(segment.id);
                            }}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                        {columnOrder.map((column) => renderColumnCell(column, segment, isPlaying))}
                      </div>
                    );
                  })}
                </div>

              </div>
            </section>

            <aside className="inspector">
              <div className="inspector-header">
                <div>
                  <span className="eyebrow">{t.selected}</span>
                  <h2>{t.inspector}</h2>
                </div>
              </div>

              {selected && (
                <div className="inspector-content">
                  <div className="segment-identity">
                    <span>{String(selected.id).padStart(2, "0")}</span>
                    <div>
                      <strong>{language === "zh" ? "旁白分段" : "Narration segment"}</strong>
                      <small>{selected.text.length} {language === "zh" ? "字" : "chars"}</small>
                    </div>
                    <span className={`status-badge ${selected.status}`}>{statusCopy[selected.status]}</span>
                  </div>

                  <label className="field">
                    <span>{t.text}</span>
                    <textarea value={selected.text} onChange={(event) => updateSegment(selected.id, { text: event.target.value })} />
                  </label>

                  <label className={`field${ultimateClone ? " disabled-field" : ""}`}>
                    <span>{t.prompt}</span>
                    <textarea disabled={ultimateClone} className="prompt-editor" value={selected.prompt} onChange={(event) => updatePerformancePrompt(selected.id, event.target.value)} />
                    <label className="inline-check prompt-sync-check">
                      <input
                        type="checkbox"
                        checked={promptSyncAll}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setPromptSyncAll(checked);
                          if (checked) {
                            commitSegments((current) => current.map((segment) => ({ ...segment, prompt: selected.prompt })));
                          }
                        }}
                        disabled={ultimateClone}
                      />
                      <span>{language === "zh" ? "同步到所有分段" : "Sync to all segments"}</span>
                    </label>
                    <small>{ultimateClone
                      ? (language === "zh" ? "超级克隆已开启，表演提示词暂不生效。" : "Ultimate cloning is on; performance direction is disabled.")
                      : (language === "zh" ? "描述语气、重音与情绪变化，不会作为正文朗读。" : "Describe tone, emphasis, and emotional movement. This text is never spoken.")}</small>
                  </label>

                  <div className="field">
                    <span>{t.voice}</span>
                    <label className="voice-picker">
                      <span className="voice-avatar"><AudioWaveform size={16} /></span>
                      <span>
                        <strong>{selectedReferenceName || (language === "zh" ? "选择参考声音" : "Choose reference voice")}</strong>
                        {!selectedReferenceName && <small>{language === "zh" ? "WAV / MP3 / FLAC · 25MB 以内" : "WAV / MP3 / FLAC · under 25MB"}</small>}
                      </span>
                      <ChevronDown size={15} />
                      <input
                        type="file"
                        accept="audio/*,.wav,.mp3,.flac,.m4a,.ogg"
                        onChange={(event) => {
                          chooseReferenceAudio(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={referenceSyncAll}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setReferenceSyncAll(checked);
                          if (checked) {
                            if (!referenceAudio && selected.referenceAudio) {
                              setReferenceAudio(selected.referenceAudio);
                              setReferenceName(selected.referenceName || selected.referenceAudio.name);
                              setReferenceTranscript(selected.referenceTranscript || "");
                            }
                          }
                        }}
                      />
                      <span>{language === "zh" ? "同步到所有分段" : "Sync to all segments"}</span>
                    </label>
                    <small>{referenceSyncAll
                      ? (language === "zh" ? "开启后，新上传的参考声音会作为全片共享参考。" : "When enabled, newly uploaded reference audio is shared by every segment.")
                      : (language === "zh" ? "未开启时，新上传的参考声音只用于当前分段。" : "When disabled, newly uploaded reference audio only changes the current segment.")}</small>
                  </div>

                  <div className="clone-mode">
                    <label className="switch-row">
                      <span>
                        <strong>{language === "zh" ? "超级克隆" : "Ultimate cloning"}</strong>
                        <small>{language === "zh" ? "更好地还原参考声音的音色、节奏和情感，但开启后表演提示词不再起作用。" : "Better preserves the reference voice, rhythm, and emotion, but disables performance direction."}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={ultimateClone}
                        onChange={(event) => setUltimateClone(event.target.checked)}
                      />
                    </label>
                    {ultimateClone && (
                      <label className="field clone-transcript">
                        <span>{language === "zh" ? "参考音频文字" : "Reference transcript"}</span>
                        <textarea
                          value={selectedReferenceTranscript}
                          placeholder={language === "zh" ? "请准确填写参考音频中说出的内容" : "Enter exactly what is spoken in the reference audio"}
                          onChange={(event) => {
                            if (referenceSyncAll) setReferenceTranscript(event.target.value);
                            else updateSegment(selected.id, { referenceTranscript: event.target.value });
                          }}
                        />
                        <div className="clone-transcript-actions">
                          <button
                            className="button secondary"
                            type="button"
                            disabled={!selectedReferenceAudio || isTranscribingReference}
                            onClick={() => void recognizeReferenceAudio()}
                          >
                            <RefreshCw className={isTranscribingReference ? "spinning" : ""} size={14} />
                            {isTranscribingReference
                              ? (language === "zh" ? "正在识别…" : "Transcribing…")
                              : (language === "zh" ? "自动识别参考音频文字" : "Auto-transcribe reference audio")}
                          </button>
                          {referenceTranscriptStatus && <span role="status" aria-live="polite">{referenceTranscriptStatus}</span>}
                        </div>
                        <small>{language === "zh" ? "开启后不再发送表演提示词；生成前需同时选择参考声音并填写文字。" : "Performance direction is disabled in this mode. Reference audio and transcript are both required."}</small>
                      </label>
                    )}
                  </div>

                  <div className="inspector-actions">
                    <button className="button primary wide" type="button" onClick={() => void generateOne(selected)} disabled={selected.status === "generating"}>
                      <RefreshCw size={15} />{t.regenerate}
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div> : (
            <section className="empty-director-workspace">
              <div className="empty-workspace-icon"><BookOpen size={24} /></div>
              <h2>{language === "zh" ? "先把内容给我看看吧" : "Import your content first"}</h2>
              <p>{language === "zh" ? "导入文件或粘贴文本，生成导演台本后再进行配音。" : "Import a file or paste text, then create the director script before generating audio."}</p>
              <button className="button primary" type="button" onClick={() => setImportOpen(true)}><Upload size={16} />{importButtonLabel}</button>
            </section>
          )}
            </>
          )}
        </main>

        {hasDirectorTable && <footer className="render-bar">
          <div className="render-summary">
            <div className="render-icon"><Gauge size={18} /></div>
            <div>
              <strong>{t.overall}</strong>
              <span title={backendError}>{completeCount} / {segments.length} {language === "zh" ? "已完成" : "complete"} · {language === "zh" ? "预计" : "Est."} {formatDuration(estimatedSeconds)}</span>
            </div>
          </div>
          {mergedAudio ? (
            <audio className="merged-player" controls src={absoluteAudioUrl(mergedAudio.audioUrl)} />
          ) : (
            <div className="overall-progress">
              <div className="progress-track"><span style={{ width: `${overallProgress}%` }} /></div>
              <strong>{overallProgress}%</strong>
            </div>
          )}
          <div className="render-actions">
            <button className="button secondary" type="button" onClick={() => void generateAll()}>
              {isBatchGenerating ? <Square size={14} /> : <Sparkles size={15} />}
              {isBatchGenerating ? t.stop : t.generateAll}
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => mergedAudio
                ? void downloadAudio(mergedAudio.audioUrl, audioFilename(projectName, "dubcue-merged"))
                : void mergeExport()}
            >
              <Download size={15} />{mergedAudio ? (language === "zh" ? "下载成片" : "Download mix") : t.mergeExport}
            </button>
          </div>
        </footer>}

        <Dialog.Root open={newProjectOpen} onOpenChange={setNewProjectOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog new-project-dialog">
              <div className="dialog-heading">
                <div>
                  <Dialog.Title>{t.newProject}</Dialog.Title>
                  <Dialog.Description>
                    {language === "zh" ? "创建一个新的配音项目；当前项目会先保存到本机。" : "Create a new dubbing project. The current project is saved locally first."}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild><IconButton label={language === "zh" ? "关闭" : "Close"}><X size={17} /></IconButton></Dialog.Close>
              </div>
              <label className="field">
                <span>{language === "zh" ? "项目名称" : "Project name"}</span>
                <input
                  autoFocus
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") createProject();
                  }}
                />
              </label>
              <div className="dialog-actions">
                <Dialog.Close asChild><button className="button secondary" type="button">{language === "zh" ? "取消" : "Cancel"}</button></Dialog.Close>
                <button className="button primary" type="button" onClick={createProject}>{language === "zh" ? "创建项目" : "Create project"}</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={newChildOpen} onOpenChange={(open) => {
          setNewChildOpen(open);
          if (!open) {
            setNewChildName("");
            setNewChildParentId(null);
          }
        }}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog new-project-dialog">
              <div className="dialog-heading">
                <div>
                  <Dialog.Title>{language === "zh" ? "新建子项目" : "New child project"}</Dialog.Title>
                  <Dialog.Description>{language === "zh" ? "在当前层级下创建子项目；之后还可以继续向下创建。" : "Create a child under the current level. You can continue nesting levels."}</Dialog.Description>
                </div>
                <Dialog.Close asChild><IconButton label={language === "zh" ? "关闭" : "Close"}><X size={17} /></IconButton></Dialog.Close>
              </div>
              <label className="field">
                <span>{language === "zh" ? "子项目名称" : "Child name"}</span>
                <input
                  autoFocus
                  value={newChildName}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setNewChildName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") createChild(); }}
                />
              </label>
              <div className="dialog-actions">
                <Dialog.Close asChild><button className="button secondary" type="button">{language === "zh" ? "取消" : "Cancel"}</button></Dialog.Close>
                <button className="button primary" type="button" onClick={createChild}>{language === "zh" ? "创建子项目" : "Create child"}</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={!!projectDeleteTarget} onOpenChange={(open) => {
          if (!open) setProjectDeleteTargetId(null);
        }}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog confirm-dialog">
              <div className="dialog-heading">
                <div>
                  <Dialog.Title>{language === "zh" ? "删除项目" : "Delete project"}</Dialog.Title>
                  <Dialog.Description>
                    {projectDeleteTarget
                      ? (language === "zh"
                        ? `即将删除“${projectDeleteTarget.episodeName}”。这个操作不能撤销。`
                        : `You are about to delete “${projectDeleteTarget.episodeName}”. This cannot be undone.`)
                      : ""}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild><IconButton label={language === "zh" ? "关闭" : "Close"}><X size={17} /></IconButton></Dialog.Close>
              </div>
              <div className="confirm-panel danger">
                <Trash2 size={18} aria-hidden="true" />
                <div>
                  <strong>{projectDeleteTarget?.parentNodeId
                    ? (language === "zh" ? "删除这个子项目？" : "Delete this child project?")
                    : (language === "zh" ? "删除这个项目及其内容？" : "Delete this project and its contents?")}</strong>
                  <p>{language === "zh"
                    ? `将删除 ${projectDeleteChildCount} 个下级项目、${projectDeleteSegmentCount} 个分段，以及其中保存的生成音频版本和参考声音设置。`
                    : `This will delete ${projectDeleteChildCount} child project(s), ${projectDeleteSegmentCount} segment(s), and saved audio versions plus reference voice settings.`}</p>
                </div>
              </div>
              <div className="dialog-actions">
                <Dialog.Close asChild><button className="button secondary" type="button">{language === "zh" ? "取消" : "Cancel"}</button></Dialog.Close>
                <button className="button danger" type="button" onClick={deleteProject}>{language === "zh" ? "确认删除" : "Delete"}</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog import-dialog">
              <div className="dialog-heading">
                <div>
                  <Dialog.Title>{language === "zh" ? "导入内容" : "Import content"}</Dialog.Title>
                  <Dialog.Description>
                    {language === "zh" ? "导入文件或直接粘贴文本，确认内容后再生成导演台本。" : "Import a file or paste text, review it, then create the director script."}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild><IconButton label={language === "zh" ? "关闭" : "Close"}><X size={17} /></IconButton></Dialog.Close>
              </div>

              <div className="import-file-row">
                <label className="button secondary file-button">
                  <Upload size={16} />{language === "zh" ? "导入文件" : "Import file"}<small>TXT / DOCX</small>
                  <input
                    type="file"
                    accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => {
                      void importScript(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                {scriptImportMessage && (
                  <span className={scriptImportFailed ? "error" : ""} role="status" aria-live="polite">{scriptImportMessage}</span>
                )}
              </div>

              <label className="field import-text-field">
                <span>{language === "zh" ? "内容文本" : "Content text"}</span>
                <textarea
                  autoFocus
                  value={rawScript}
                  placeholder={language === "zh" ? "在这里粘贴或输入需要配音的文本……" : "Paste or enter the text to narrate…"}
                  onChange={(event) => updateRawScriptFromEditor(event.target.value)}
                  onKeyDown={(event) => {
                    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
                    event.preventDefault();
                    if (event.shiftKey) redoRawScriptEdit();
                    else undoRawScriptEdit();
                  }}
                />
                <small>{language === "zh" ? `${rawScript.length} 字 · 文件内容导入后会显示在这里，可以继续编辑。` : `${rawScript.length} characters · Imported text appears here and remains editable.`}</small>
              </label>

              <div className="import-segment-settings">
                <label className="field">
                  <span>{language === "zh" ? "分段字数" : "Segment length"}</span>
                  <div className="number-field">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={segmentMaxChars}
                      onChange={(event) => setSegmentMaxChars(event.target.value.replace(/\D/g, "").slice(0, 3))}
                    />
                    <span>{language === "zh" ? "字" : "chars"}</span>
                  </div>
                  <small className={Number(segmentMaxChars || 0) > 100 ? "segment-warning active" : "segment-warning"}>
                    {language === "zh" ? "平衡质量与效率建议70字左右，分段字数过多会降低生成质量" : "For a balance of quality and efficiency, around 70 characters is recommended. Longer segments can reduce generation quality."}
                  </small>
                </label>
              </div>

              <div className="dialog-actions">
                <Dialog.Close asChild><button className="button secondary" type="button">{language === "zh" ? "取消" : "Cancel"}</button></Dialog.Close>
                <button className="button primary" type="button" disabled={!rawScript.trim()} onClick={() => buildDirectorTable(rawScript, segmentMaxChars)}>
                  <WandSparkles size={16} />{t.generateTable}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog tips-dialog">
              <div className="dialog-heading">
                <div>
                  <Dialog.Title>{t.help}</Dialog.Title>
                  <Dialog.Description>{language === "zh" ? "DubCue 的常用操作与推荐工作流程" : "Common actions and recommended DubCue workflow"}</Dialog.Description>
                </div>
                <Dialog.Close asChild><IconButton label={language === "zh" ? "关闭" : "Close"}><X size={17} /></IconButton></Dialog.Close>
              </div>
              <div className="tips-list">
                <div><strong>1</strong><span><b>{language === "zh" ? "先整理项目稿件" : "Prepare the project script"}</b><small>{language === "zh" ? "点击左侧项目名，导入 TXT / DOCX 或直接编辑文本。" : "Click the project name to import TXT / DOCX or edit text directly."}</small></span></div>
                <div><strong>2</strong><span><b>{language === "zh" ? "生成导演台本" : "Create the director script"}</b><small>{language === "zh" ? "建议每段约 70 字；系统会依据标点自然分段。" : "Around 70 characters per segment is recommended; punctuation guides natural splitting."}</small></span></div>
                <div><strong>3</strong><span><b>{language === "zh" ? "逐段调整与试听" : "Direct and preview each segment"}</b><small>{language === "zh" ? "设置语速、表演提示和参考声音；拖动序号或表头可调整顺序。" : "Set pacing, performance direction, and reference voice; drag rows or headers to reorder."}</small></span></div>
                <div><strong>4</strong><span><b>{language === "zh" ? "生成并导出" : "Generate and export"}</b><small>{language === "zh" ? "先生成分段音频，再使用“合并导出”得到完整音频。" : "Generate segment audio first, then use Merge & export for the complete mix."}</small></span></div>
              </div>
              <div className="tips-shortcuts">
                <span><kbd>⌘ Z</kbd>{language === "zh" ? "撤销" : "Undo"}</span>
                <span><kbd>⇧ ⌘ Z</kbd>{language === "zh" ? "重做" : "Redo"}</span>
                <span><kbd>{language === "zh" ? "双击" : "Double-click"}</kbd>{language === "zh" ? "重命名项目或子项目" : "Rename project or child"}</span>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={modelWizardOpen} onOpenChange={setModelWizardOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog model-wizard-dialog compact">
              <div className="dialog-heading">
                <div>
                  <Dialog.Title>{language === "zh" ? "添加本地开源模型" : "Add local open-source model"}</Dialog.Title>
                  <Dialog.Description>{language === "zh" ? "DubCue 先给你清楚的模型推荐和安装路径：按官方仓库安装，跑通后再回到 DubCue 手动接入。" : "DubCue gives clear model recommendations and setup paths first: install from the official repo, run a sample, then connect it manually."}</Dialog.Description>
                </div>
                <Dialog.Close asChild><IconButton label={language === "zh" ? "关闭" : "Close"}><X size={17} /></IconButton></Dialog.Close>
              </div>
              <div className="model-wizard-note">
                <BookOpen size={15} />
                <span>{language === "zh"
                  ? "现在不再展示半成品自动安装按钮。除了 VoxCPM2，其他模型请先打开官方仓库按 README 安装；DubCue 后续再补齐稳定的一键安装。"
                  : "This screen no longer exposes half-finished managed install buttons. Besides VoxCPM2, install each model from its official README first; reliable one-click setup will come later."}</span>
              </div>
              <div className="recommended-models simple">
                {MODEL_PROVIDERS.map((provider) => (
                  <article className={`model-recommendation simple ${provider.status}`} key={provider.id}>
                    <div className="model-recommendation-heading">
                      <span>
                        <strong>{provider.name}</strong>
                        <small>{provider.bestFor[language]}</small>
                      </span>
                      <b>{providerStatusLabel(provider)}</b>
                    </div>
                    <p>{providerGuideCopy(provider)}</p>
                    <div className="capability-tags">
                      {providerCapabilityTags(provider).map((tag) => <em key={tag}>{tag}</em>)}
                      <em>{commercialLabel(provider)}</em>
                    </div>
                    <div className="model-setup-line">
                      <span>{language === "zh" ? "安装：" : "Setup:"}</span>
                      <code>{provider.id === CURRENT_PROVIDER_ID
                        ? (language === "zh" ? "检测本机 VoxCPM2" : "Detect local VoxCPM2")
                        : (language === "zh" ? "打开官方仓库，按 README 安装" : "Open official repo and follow README")}</code>
                    </div>
                    <div className="model-card-actions">
                      {provider.id === "voxcpm2" ? (
                        <button className="button primary" type="button" onClick={() => void connectDetectedRuntime()}>{language === "zh" ? "检测并连接 VoxCPM2" : "Detect and connect VoxCPM2"}</button>
                      ) : (
                        <a className="button secondary" href={provider.sourceUrl} onClick={openModelDocs} target="_blank" rel="noreferrer">{language === "zh" ? "打开官方仓库" : "Open repo"}</a>
                      )}
                      {provider.id === "voxcpm2" && <a className="model-doc-link" href={provider.sourceUrl} onClick={openModelDocs} target="_blank" rel="noreferrer">{language === "zh" ? "查看官方仓库" : "Open repo"}</a>}
                    </div>
                  </article>
                ))}
              </div>
              <section className="manual-model-section simple">
                <div className="settings-section-heading">
                  <strong>{language === "zh" ? "安装好之后怎么接入？" : "How to connect after installing?"}</strong>
                  <small>{language === "zh" ? "先让模型在本机跑通。下一步 DubCue 会开放三种接入口：模型目录、本地服务 API、自定义适配器。" : "First make sure the model runs locally. DubCue will then expose three connection paths: model folder, local API, and custom adapter."}</small>
                </div>
                <div className="manual-entry-actions" aria-label={language === "zh" ? "后续接入方式" : "Upcoming connection paths"}>
                  <span>{language === "zh" ? "模型目录" : "Model folder"}</span>
                  <span>{language === "zh" ? "本地服务 API" : "Local API"}</span>
                  <span>{language === "zh" ? "自定义适配器" : "Custom adapter"}</span>
                </div>
              </section>
              <div className="dialog-actions">
                <Dialog.Close asChild><button className="button primary" type="button">{language === "zh" ? "完成" : "Done"}</button></Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog">
              <div className="dialog-heading">
                <div>
                  <Dialog.Title>{t.settings}</Dialog.Title>
                  <Dialog.Description>{language === "zh" ? "本地模型连接与项目默认设置" : "Local model connection and project defaults"}</Dialog.Description>
                </div>
                <Dialog.Close asChild><IconButton label={language === "zh" ? "关闭" : "Close"}><X size={17} /></IconButton></Dialog.Close>
              </div>
              <section className="model-connections" aria-labelledby="model-connections-title">
                <div className="settings-section-heading">
                  <strong id="model-connections-title">{language === "zh" ? "生成模型" : "Generation models"}</strong>
                  <small>{language === "zh" ? "DubCue 0.6 起按模型能力接入本地开源语音后端；当前模型决定右侧生成控件和高级设置。" : "Starting in 0.6, DubCue connects local open-source voice backends through capabilities; the current model controls generation UI and advanced settings."}</small>
                </div>
                <div className={`provider-card${runtime?.modelInstalled ? " detected" : ""}`}>
                  <span className="provider-icon"><AudioWaveform size={17} /></span>
                  <span><strong>{currentProvider.name}</strong><small>{backendHealth
                    ? (backendHealth.modelLoaded
                      ? (language === "zh" ? "模型已加载，可直接生成" : "Model loaded and ready")
                      : (language === "zh" ? "服务已连接，首次生成时加载模型" : "Connected; model loads on first generation"))
                    : runtime?.modelInstalled
                      ? (language === "zh" ? "已发现本机模型，将直接复用" : "Existing local model detected and reused")
                      : (language === "zh" ? "本机未检测到" : "Not detected locally")}</small>
                    <a
                      className="model-doc-link"
                      href="https://github.com/OpenBMB/VoxCPM"
                      onClick={openModelDocs}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {language === "zh" ? "查看 OpenBMB 官方说明文档" : "Open official OpenBMB docs"}
                    </a>
                    <span className="capability-tags">
                      {providerCapabilityTags(currentProvider).map((tag) => <em key={tag}>{tag}</em>)}
                      <em>{commercialLabel(currentProvider)}</em>
                    </span>
                  </span>
                  <b>{backendHealth ? (language === "zh" ? "已连接" : "Connected") : runtime?.modelInstalled ? (language === "zh" ? "已发现" : "Detected") : (language === "zh" ? "未配置" : "Not configured")}</b>
                </div>
                <button className="provider-card provider-card-button" type="button" onClick={() => setModelWizardOpen(true)}>
                  <span className="provider-icon"><Plus size={17} /></span>
                  <span><strong>{language === "zh" ? "添加其他本地开源模型" : "Add another local open-source model"}</strong><small>{language === "zh" ? "打开推荐模型向导，或手动接入本地模型目录 / 本地服务 API / 自定义适配器。" : "Open the recommended model guide, or manually connect a model folder, local API, or custom adapter."}</small></span>
                  <b>{language === "zh" ? "打开向导" : "Open guide"}</b>
                </button>
                <div className="model-connection-actions">
                  <button className="button secondary" type="button" onClick={() => void connectDetectedRuntime()}>{language === "zh" ? "重新检测并连接" : "Detect and connect"}</button>
                </div>
                {backendError && <small className="connection-hint" role="status">{backendError}</small>}
                <div className="install-task">
                  <strong>{language === "zh" ? "统一安装任务" : "Unified install task"}</strong>
                  <div>
                    {installSteps.map((step, index) => (
                      <span className={index <= activeInstallStep ? "active" : ""} key={step}>{step}</span>
                    ))}
                  </div>
                  <small>{language === "zh" ? "当前先接入 VoxCPM2 现有运行时；其他模型会复用这套任务和错误提示框架。" : "VoxCPM2 uses this existing runtime first; future models will reuse this task and error framework."}</small>
                </div>
                <details className="troubleshooting">
                  <summary>{language === "zh" ? "故障排查" : "Troubleshooting"}<ChevronDown size={14} /></summary>
                  <p>{language === "zh" ? "日志主要用于排查模型启动失败、端口占用、依赖缺失或生成报错。普通使用时不需要打开。" : "Logs help diagnose model startup failures, port conflicts, missing dependencies, or generation errors. You usually do not need them."}</p>
                  <button className="button secondary" type="button" onClick={() => void openLogs()}>{language === "zh" ? "查看诊断日志" : "Open diagnostic logs"}</button>
                </details>
              </section>
              {!isDesktopApp() && <label className="field">
                <span>{language === "zh" ? "本地生成服务地址" : "Local generation service"}</span>
                <input value={backendAddress} onChange={(event) => setBackendAddress(event.target.value)} />
                <small>{backendError || (backendHealth ? `${backendHealth.modelId} · ${backendHealth.outputDirectory}` : "")}</small>
              </label>}
              <div className="settings-status">
                <span className={`model-dot${backendHealth ? " online" : ""}`} />
                <strong>{backendHealth ? (language === "zh" ? "服务已连接" : "Service connected") : (language === "zh" ? "当前未连接模型，仍可正常编辑工程" : "No model connected; project editing remains available")}</strong>
                <button className="button secondary" type="button" onClick={() => void checkBackend()}>{language === "zh" ? "重新检测" : "Check again"}</button>
              </div>
              <details className="generation-quality">
                <summary>
                  <span>
                    <strong>{language === "zh" ? "当前模型高级设置" : "Current model advanced settings"}</strong>
                    <small>{currentProvider.id === "voxcpm2"
                      ? (language === "zh" ? `VoxCPM2 · 默认最高质量 · CFG ${cfgValue.toFixed(1)} · ${inferenceTimesteps} 步` : `VoxCPM2 · Highest quality by default · CFG ${cfgValue.toFixed(1)} · ${inferenceTimesteps} steps`)
                      : (language === "zh" ? "当前模型暂无 DubCue 内置高级参数面板。" : "No built-in DubCue advanced panel for the current model yet.")}</small>
                  </span>
                  <ChevronDown size={15} aria-hidden="true" />
                </summary>
                {currentProvider.id === "voxcpm2" ? (
                  <div className="quality-controls">
                    <label className="quality-control">
                      <span><strong>CFG</strong><small>{language === "zh" ? "控制提示词和参考音色的贴合程度，不代表音质高低" : "Controls prompt and voice adherence, not audio quality"}</small></span>
                      <input type="range" min="1" max="3" step="0.1" value={cfgValue} aria-label="CFG" onChange={(event) => setCfgValue(Number(event.target.value))} />
                      <output>{cfgValue.toFixed(1)}</output>
                    </label>
                    <label className="quality-control">
                      <span><strong>LocDiT {language === "zh" ? "迭代步数" : "steps"}</strong><small>{language === "zh" ? "降低步数可以加快生成，但可能减少声音细节" : "Lower values generate faster but may reduce detail"}</small></span>
                      <input type="range" min="1" max="50" step="1" value={inferenceTimesteps} aria-label={language === "zh" ? "LocDiT 迭代步数" : "LocDiT steps"} onChange={(event) => setInferenceTimesteps(Number(event.target.value))} />
                      <output>{inferenceTimesteps}</output>
                    </label>
                  </div>
                ) : <p className="provider-placeholder">{language === "zh" ? "DubCue 会根据当前模型的能力声明加载对应参数，不会把 VoxCPM2 的 CFG/LocDiT 强套给其他模型。" : "DubCue loads settings from the current model's capabilities instead of forcing VoxCPM2 CFG/LocDiT controls onto every model."}</p>}
              </details>
              <div className="dialog-actions">
                <Dialog.Close asChild><button className="button secondary" type="button">{language === "zh" ? "取消" : "Cancel"}</button></Dialog.Close>
                <button className="button primary" type="button" onClick={saveSettings}>{language === "zh" ? "保存设置" : "Save settings"}</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </Tooltip.Provider>
  );
}

export default App;
