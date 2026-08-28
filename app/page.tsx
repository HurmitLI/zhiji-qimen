"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildQimenChart,
  GRID_ORDER,
  palaceByNumber,
  requestSkillQimenChart,
  type QimenChart,
} from "../lib/qimen";
import { interpretChart } from "../lib/interpret";
import { cleanGeneratedText } from "../lib/quality";
import { QIMEN_RULESET } from "../lib/rule-registry";
import {
  requestAi,
  intakeResponseStillAsking,
  intakeBoundaryReply,
  intakeRuleRoute,
  inferRelationshipMode,
  type AiReading,
  type AiSource,
  type ChatMessage,
  type IntakeIntentStatus,
  type IntakeResult,
} from "../lib/ai";
import { mediaForStage, ritualMedia } from "../lib/ritual-media";

const topicMeta = [
  { name: "人生方向", glyph: "命", hint: "继续、转向、等待与人生主线" },
  { name: "事业发展", glyph: "业", hint: "机会、职位、合作与长期路径" },
  { name: "财富趋势", glyph: "财", hint: "资源、收入、积累与风险节奏" },
  { name: "感情关系", glyph: "缘", hint: "相处、边界、选择与关系走向" },
  { name: "学业成长", glyph: "学", hint: "学习、考试、能力与成长阶段" },
  { name: "迁移远行", glyph: "行", hint: "城市、远行、变化与新环境" },
  { name: "项目决策", glyph: "策", hint: "方案、推进、合作与成立条件" },
  { name: "寻人寻物", glyph: "寻", hint: "象征方位、环境特征与寻找顺序" },
  { name: "方位择时", glyph: "时", hint: "行动方向、时机与备用方案" },
];
const focusOptions = ["看未来主线", "找机会来源", "识别阻力", "决定下一步", "找方位线索", "选择行动时机"];
const relationshipModeLabels = {
  男问女: "男方问女方",
  女问男: "女方问男方",
  同性关系: "双方同性",
} as const;
const starterPrompts = [
  {
    label: "人生方向",
    question: "未来一段时间，我更适合继续、转向还是等待？",
  },
  {
    label: "事业选择",
    question: "面对眼前的事业选择，我应该稳住积累还是主动突破？",
  },
  {
    label: "感情关系",
    question: "这段关系接下来更适合靠近、沟通还是暂时留白？",
  },
  {
    label: "迁移远行",
    question: "近期是否适合换一个城市或环境重新开始？",
  },
  {
    label: "财富趋势",
    question: "接下来我更该开拓收入，还是先守住已有积累？",
  },
  {
    label: "学业成长",
    question: "面对接下来的学习与考试，我该继续深耕还是调整方法？",
  },
] as const;
const stages = [
  {
    name: "封题",
    title: "封存问题",
    desc: "锁定此刻真正关心的一件事",
    key: "QUESTION",
  },
  {
    name: "校时",
    title: "校准时空",
    desc: "固定公历时间、城市与计算时区",
    key: "TIME",
  },
  {
    name: "候气",
    title: "辨识节令",
    desc: "取已经进入的节令，观察阴阳气机",
    key: "SOLAR TERM",
  },
  {
    name: "干支",
    title: "换算四柱",
    desc: "生成当下年、月、日、时干支",
    key: "GANZHI",
  },
  {
    name: "阴阳",
    title: "分定阴阳遁",
    desc: "依据节令区间决定顺逆",
    key: "DUN",
  },
  {
    name: "定局",
    title: "确定三元局数",
    desc: "日干支定三元，节令与三元共同定局",
    key: "JU",
  },
  {
    name: "布仪",
    title: "三奇六仪入宫",
    desc: "地盘骨架从这里真正建立",
    key: "EARTH PLATE",
  },
  {
    name: "九星",
    title: "九星旋布",
    desc: "以旬首和值符位置旋转九星",
    key: "NINE STARS",
  },
  {
    name: "八门",
    title: "八门定位",
    desc: "按 mainline-cn-v1 使值使与值符同落时干宫",
    key: "EIGHT DOORS",
  },
  {
    name: "八神",
    title: "八神成列",
    desc: "阳遁顺布、阴遁逆布八神",
    key: "EIGHT SPIRITS",
  },
  {
    name: "取用",
    title: "议题宫定位",
    desc: "问题类型只影响解读取用，不改变盘本身",
    key: "FOCUS",
  },
  {
    name: "成局",
    title: "天地人神合盘",
    desc: "生成可探索的盘面、线索与现实核验",
    key: "COMPLETE",
  },
] as const;
const layerNames = {
  all: "完整盘",
  sky: "天盘干",
  earth: "地盘干",
  star: "九星",
  door: "八门",
  god: "八神",
} as const;
const layerHelp: Record<keyof typeof layerNames, string> = {
  all: "同时查看每个宫位中的天盘干、地盘干、九星、八门与八神。",
  sky: "只突出事情当前呈现出来的状态与动作。",
  earth: "只突出事情原有的基础条件。",
  star: "只突出事情的能力、行动方式与发展特征。",
  door: "只突出事情推进时的入口、节奏与阻力。",
  god: "只突出外部关系、主导力量与环境气氛。",
};
type Layer = keyof typeof layerNames;
type Screen =
  | "landing"
  | "question"
  | "intake"
  | "confirm"
  | "ritual"
  | "result";
type ResultTab = "chart" | "ask";

function TideLoader({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`tide-loader${compact ? " tide-loader--compact" : ""}`}
      role="status"
      aria-label={label}
    >
      <span className="tide-loader__viewport" aria-hidden="true">
        <i className="tide-loader__wave tide-loader__wave--soft" />
        <i className="tide-loader__wave tide-loader__wave--strong" />
      </span>
      <span className="tide-loader__label">{label}</span>
    </span>
  );
}
type SavedReading = { id: string; chart: QimenChart; focus: string; reading?: AiReading };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function beijingNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return new Date(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
  );
}

function displayQuestionText(value: string) {
  return value
    .replace(/^(?:循象寻迹|观其来路与应象)[：:]\s*/, "")
    .replace(/（取大致方位、明暗高低与藏露之象）$/, "")
    .replace(/(?:现在)?大致在什么方位[、，]\s*明暗高低如何[？?]?$/, "在哪里？")
    .replace(/[、，]\s*明暗高低(?:如何|怎样|与藏露之象)?[？?]?$/, "")
    .trim();
}

function normalizeSavedQuestionChart(chart: QimenChart) {
  const normalizedQuestion = displayQuestionText(chart.input.question);
  const homeworkTiming = /(?:作业|论文|报告).{0,10}(?:什么时候|多久|何时|做完|做好|完成)|(?:什么时候|多久|何时).{0,10}(?:作业|论文|报告)/i.test(chart.input.question);
  const routed = intakeRuleRoute(chart.input.question);
  const routedType = routed?.ready ? routed.questionType : chart.input.questionType;
  const routedFocus = routed?.ready ? routed.focus : chart.input.focus;
  const needsRebuild = Boolean(
    chart.input.experiencePalace ||
    normalizedQuestion !== chart.input.question ||
    (homeworkTiming && chart.input.questionType !== "学业成长") ||
    routedType !== chart.input.questionType ||
    routedFocus !== chart.input.focus
  );
  if (!needsRebuild) return chart;
  const match = chart.input.time.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) return chart;
  return buildQimenChart({
    date: new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])),
    questionType: homeworkTiming ? "学业成长" : routedType,
    question: normalizedQuestion,
    city: chart.input.city,
    focus: homeworkTiming ? "选择行动时机" : routedFocus,
    context: chart.input.context,
  });
}

function readingNeedsRefresh(chart: QimenChart, reading?: AiReading) {
  if (!reading) return true;
  if (reading.ruleVersion !== QIMEN_RULESET.interpretationVersion || reading.promptVersion !== QIMEN_RULESET.readingPromptVersion) return true;
  const text = [reading.decisionTitle, reading.oracle, reading.overview, ...reading.actions].join(" ");
  return /(?:作业|论文|报告)/.test(chart.input.question) && /的作业什么时候|职位|客户|公开表达/.test(text);
}

function PalaceMatrix({
  chart,
  stage = 11,
  layer = "all",
  selected,
  onSelect,
  primary,
  markers,
  mode = "result",
}: {
  chart: QimenChart;
  stage?: number;
  layer?: Layer;
  selected?: number;
  onSelect?: (n: number) => void;
  primary?: number;
  markers?: Partial<Record<number, string[]>>;
  mode?: "ritual" | "result";
}) {
  return (
    <div className={`palace-matrix ${mode} stage-${stage} layer-${layer}`}>
      {GRID_ORDER.map((number, index) => {
        const p = palaceByNumber(chart, number);
        const active =
          selected === number ||
          (stage === 10 && number === chart.zhishi.palace);
        return (
          <button
            type="button"
            key={number}
            onClick={() => onSelect?.(number)}
            className={`matrix-cell ${active ? "active" : ""} ${primary === number ? "primary" : ""} ${p.isCenter ? "center" : ""}`}
            style={{ "--i": index } as React.CSSProperties}
            aria-label={`${p.direction}${p.name}`}
          >
            <span className="cell-coord">
              {number} · {p.direction}
            </span>
            <span className="cell-sky">{p.skyStem || "·"}</span>
            <span className="cell-earth">{p.earthStem || "·"}</span>
            <b className="cell-door">{p.door || "中宫"}</b>
            <span className="cell-star">{p.star}</span>
            <span className="cell-god">{p.god || "寄坤"}</span>
            {markers?.[number]?.length ? (
              <span className="cell-role">{markers[number]?.join(" · ")}</span>
            ) : null}
            {chart.kongwangPalaces.includes(number) && <mark>空</mark>}
            <i className="cell-glow" />
          </button>
        );
      })}
    </div>
  );
}

function RitualVisual({
  chart,
  stage,
  revealDoor,
  muted,
  paused,
  speed,
}: {
  chart: QimenChart;
  stage: number;
  revealDoor: string;
  muted: boolean;
  paused: boolean;
  speed: 1 | 2;
}) {
  const videoSrc = mediaForStage(stage, revealDoor);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRate = speed === 2 ? 1.8 : 1;

  const syncPlaybackRate = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.defaultPlaybackRate = playbackRate;
    videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(syncPlaybackRate, [videoSrc, syncPlaybackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (paused) {
      video.pause();
      return;
    }
    const playback = video.play();
    playback?.catch(() => {
      video.muted = true;
      void video.play();
    });
    return () => video.pause();
  }, [muted, paused, videoSrc]);

  return (
    <div className={`ritual-universe phase-${stage}`}>
      <video
        ref={videoRef}
        key={videoSrc}
        className="ritual-media-layer"
        src={videoSrc}
        poster={ritualMedia.poster}
        autoPlay
        playsInline
        muted={muted}
        loop={false}
        preload="auto"
        onLoadedMetadata={syncPlaybackRate}
      />
      <div className="ritual-media-shade" />
      {stage === 11 && (
        <div className="door-reveal-caption">
          <small>DESTINY GATE REVEALED</small>
          <span>本局主门</span>
          <b>{revealDoor}</b>
          <em>
            {palaceByNumber(chart, chart.doorIndex[revealDoor] || chart.zhishi.palace).direction} ·{" "}
            {palaceByNumber(chart, chart.doorIndex[revealDoor] || chart.zhishi.palace).name}
          </em>
        </div>
      )}
    </div>
  );
}

function stageOutput(chart: QimenChart, index: number) {
  const outputs = [
    `“${chart.input.question}”`,
    `${chart.calendar.solar} · ${chart.input.city === "未记录" ? "" : `${chart.input.city} · `}北京时间`,
    `${chart.calendar.activeJie}已入节 · 下节${chart.calendar.nextJie}`,
    `${chart.calendar.year}年 · ${chart.calendar.month}月 · ${chart.calendar.day}日 · ${chart.calendar.time}时`,
    `${chart.calendar.activeJie} → ${chart.dunType}`,
    `${chart.calendar.day} → ${chart.yuan} · ${chart.calendar.activeJie} → ${chart.juNumber}局`,
    `旬首${chart.xunshou} · 遁${chart.hiddenYi} · 地盘完成`,
    `值符${chart.zhifu.star}落${palaceByNumber(chart, chart.zhifu.palace).name}`,
    `值使${chart.zhishi.door}落${palaceByNumber(chart, chart.zhishi.palace).name}`,
    `${chart.dunType === "阳遁" ? "顺" : "逆"}布八神 · 值符起首`,
    `${chart.input.questionType} · 议题宫、主体宫、行动宫`,
    `九宫、三盘、四层线索全部可追溯`,
  ];
  return outputs[index];
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [topic, setTopic] = useState(topicMeta[0].name);
  const [focus, setFocus] = useState(focusOptions[0]);
  const [question, setQuestion] = useState("");
  const [heroPromptIndex, setHeroPromptIndex] = useState(0);
  const [context, setContext] = useState("");
  const [city, setCity] = useState("");
  const [outputPreference, setOutputPreference] = useState<"direct" | "detailed">("direct");
  const [relationshipMode, setRelationshipMode] = useState<"男问女" | "女问男" | "同性关系" | "">("");
  const [timeMode, setTimeMode] = useState<"now" | "custom">("now");
  const [customTime, setCustomTime] = useState(() => toLocalInput(new Date()));
  const [chart, setChart] = useState<QimenChart | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [resultTab, setResultTab] = useState<ResultTab>("chart");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const [layer, setLayer] = useState<Layer>("all");
  const [selectedPalace, setSelectedPalace] = useState<number>();
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<SavedReading[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiReading, setAiReading] = useState<AiReading | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSource, setAiSource] = useState<AiSource>("unknown");
  const [intakeMessages, setIntakeMessages] = useState<ChatMessage[]>([]);
  const [intakeInput, setIntakeInput] = useState("");
  const [intakeOptions, setIntakeOptions] = useState<string[]>([]);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeReady, setIntakeReady] = useState(false);
  const [intakeIntentStatus, setIntakeIntentStatus] = useState<IntakeIntentStatus | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [accessState, setAccessState] = useState<"checking" | "granted" | "required">("checking");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const rulesCloseRef = useRef<HTMLButtonElement>(null);
  const historyCloseRef = useRef<HTMLButtonElement>(null);
  const aiReadingRef = useRef<AiReading | null>(null);
  const interpretation = useMemo(
    () => (chart ? interpretChart(chart) : null),
    [chart],
  );

  useEffect(() => {
    if (!chart) return;
    const revealDoor = interpretChart(chart).mainDoor;
    const sources = [
      ritualMedia.intro,
      mediaForStage(11, revealDoor),
    ];
    const preloaders = [...new Set(sources)].map((src) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.src = src;
      video.load();
      return video;
    });
    return () => {
      preloaders.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
    };
  }, [chart]);

  const generateAiReading = useCallback(async (nextChart: QimenChart) => {
    setAiLoading(true);
    setAiError("");
    try {
      const response = await requestAi<{ mode: "reading"; reading: AiReading }>(
        {
          mode: "reading",
          chart: nextChart,
        },
      );
      aiReadingRef.current = response.reading;
      setAiReading(response.reading);
      setAiSource(response.aiSource);
      setHistory((list) => {
        const next = list.map((item) =>
          item.chart.input.time === nextChart.input.time &&
          item.chart.input.question === nextChart.input.question
            ? { ...item, chart: nextChart, reading: response.reading }
            : item,
        );
        localStorage.setItem("yiju-readings", JSON.stringify(next));
        return next;
      });
    } catch (error) {
      setAiSource("unknown");
      setAiError(error instanceof Error ? error.message : "白话说明暂时不可用");
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0 });
      document.querySelector("main")?.scrollTo({ top: 0, left: 0 });
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
  }, [screen]);

  useEffect(() => {
    if (screen !== "landing") return;
    const timer = window.setInterval(() => {
      setHeroPromptIndex((index) => (index + 1) % starterPrompts.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("yiju-readings") || "[]",
        ) as SavedReading[];
        setHistory(saved.slice(0, 8));
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/invite/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => {
        if (active) setAccessState(data.authenticated ? "granted" : "required");
      })
      .catch(() => {
        if (active) setAccessState("required");
      });
    return () => { active = false; };
  }, []);

  function enterExperience(nextQuestion?: string) {
    if (nextQuestion) setQuestion(nextQuestion);
    if (accessState === "granted") {
      setScreen("question");
      return;
    }
    setInviteError("");
    setInviteOpen(true);
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteCode.trim() || inviteLoading) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      const response = await fetch("/api/invite/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "邀请码验证失败");
      setAccessState("granted");
      setInviteCode("");
      setInviteOpen(false);
      setScreen("question");
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "邀请码验证失败");
    } finally {
      setInviteLoading(false);
    }
  }

  useEffect(() => {
    if (!rulesOpen && !historyOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const activeDrawer = () => document.querySelector<HTMLElement>(rulesOpen ? ".rules-drawer" : ".history-drawer");
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      (rulesOpen ? rulesCloseRef : historyCloseRef).current?.focus();
    });
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (rulesOpen) setRulesOpen(false);
        if (historyOpen) setHistoryOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(activeDrawer()?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ) || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.removeEventListener("keydown", handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [rulesOpen, historyOpen]);

  const finishRitual = useCallback(() => {
    if (!chart) return;
    setHistory((list) => {
      const item = {
        id: `${chart.input.time}-${Date.now()}`,
        chart,
        focus: chart.input.focus || focus,
        ...(aiReadingRef.current ? { reading: aiReadingRef.current } : {}),
      };
      const next = [item, ...list.filter((x) => x.chart.input.time !== chart.input.time || x.chart.input.question !== chart.input.question)].slice(0, 8);
      localStorage.setItem("yiju-readings", JSON.stringify(next));
      return next;
    });
    setSoundMuted(true);
    setScreen("result");
    setResultTab("chart");
    setSelectedPalace(interpretation?.issuePalace);
    window.scrollTo({ top: 0 });
  }, [chart, focus, interpretation]);

  useEffect(() => {
    if (screen !== "ritual") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reducedMotion ? (stage === 11 ? 300 : 40) : (stage === 11 ? 5300 : 430);
    const timer = window.setTimeout(() => {
      if (stage < 11) setStage((s) => s + 1);
      else finishRitual();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [screen, stage, finishRitual]);
  async function begin(e?: FormEvent) {
    e?.preventDefault();
    if (question.trim().length < 2) return;
    setAiError("");
    setChartLoading(true);
    try {
      const baseChart = await requestSkillQimenChart({
      questionType: topic,
      question: question.trim(),
      questionGoal: focus,
      context: context.trim(),
      city: city.trim() || "未记录",
      timezone: "Asia/Shanghai",
      calendarType: timeMode === "now" ? "now" : "solar",
      timeInput: timeMode === "now" ? "现在" : customTime.replace("T", " "),
      outputPreference,
      relationshipMode: relationshipMode || undefined,
      });
      const next = baseChart;
      setChart(next);
      setStage(0);
      setSoundMuted(false);
      aiReadingRef.current = null;
      setAiReading(null);
      setAiSource("unknown");
      setChatMessages([]);
      setChatInput("");
      void generateAiReading(next);
      setScreen("ritual");
      window.scrollTo({ top: 0 });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Skill 排盘暂时不可用");
    } finally {
      setChartLoading(false);
    }
  }
  function reset() {
    setScreen("landing");
    setQuestion("");
    setContext("");
    setCity("");
    setOutputPreference("direct");
    setRelationshipMode("");
    setIntakeMessages([]);
    setIntakeOptions([]);
    setIntakeReady(false);
    setIntakeIntentStatus(null);
    setChart(null);
    setStage(0);
    setSoundMuted(true);
    setResultTab("chart");
    setRulesOpen(false);
    setSelectedPalace(undefined);
    aiReadingRef.current = null;
    setAiReading(null);
    setAiSource("unknown");
    setAiError("");
    setChatMessages([]);
    window.scrollTo({ top: 0 });
  }
  function restore(item: SavedReading) {
    const isLegacyChart = item.chart.ruleset?.id !== "mainline-cn-v1";
    const restoredChart = isLegacyChart ? item.chart : normalizeSavedQuestionChart(item.chart);
    const shouldRefresh = !isLegacyChart && (
      restoredChart !== item.chart || readingNeedsRefresh(restoredChart, item.reading)
    );
    setChart(restoredChart);
    setFocus(restoredChart.input.focus || item.focus);
    setSelectedPalace(interpretChart(restoredChart).issuePalace);
    setResultTab("chart");
    setRulesOpen(false);
    setHistoryOpen(false);
    aiReadingRef.current = shouldRefresh ? null : item.reading || null;
    setAiReading(aiReadingRef.current);
    setAiSource(!shouldRefresh && item.reading?.model?.includes("deepseek") ? "vefaas" : "unknown");
    setChatMessages([]);
    setScreen("result");
    if (shouldRefresh) void generateAiReading(restoredChart);
  }
  function applyIntakeResult(result: IntakeResult) {
    const canStart =
      result.intentStatus === "supported" ||
      result.intentStatus === "supported_symbolic";
    if (canStart) {
      const refinedQuestion = displayQuestionText(result.refinedQuestion);
      setTopic(result.questionType);
      setFocus(result.focus);
      setQuestion(refinedQuestion);
      setContext(result.contextSummary);
      setRelationshipMode(result.questionType === "感情关系"
        ? inferRelationshipMode(`${refinedQuestion} ${result.contextSummary}`)
        : "");
    }
    setIntakeOptions(canStart ? result.options || [] : []);
    setIntakeReady(canStart && result.ready);
    setIntakeIntentStatus(result.intentStatus);
  }
  async function askIntake(
    nextQuestion: string,
    existingMessages: ChatMessage[] = intakeMessages,
  ) {
    const clean = nextQuestion.trim();
    if (clean.length < 2 || intakeLoading) return;
    const userMessage: ChatMessage = { role: "user", content: clean };
    const nextMessages = [...existingMessages, userMessage];
    setIntakeMessages(nextMessages);
    setIntakeInput("");
    setIntakeOptions([]);
    setAiError("");
    const boundary = intakeBoundaryReply(clean);
    if (boundary) {
      const hasSubstantiveQuestion = existingMessages.some(
        (item) => item.role === "user" && !intakeBoundaryReply(item.content),
      );
      setIntakeMessages([
        ...nextMessages,
        { role: "assistant", content: boundary.message },
      ]);
      setIntakeOptions([]);
      setIntakeReady(Boolean(boundary.preserveReady && hasSubstantiveQuestion));
      setIntakeIntentStatus(boundary.preserveReady && hasSubstantiveQuestion ? "supported" : "unsupported");
      return;
    }
    const routed = intakeRuleRoute(clean, existingMessages);
    if (routed) {
      setIntakeMessages([
        ...nextMessages,
        { role: "assistant", content: routed.assistantMessage },
      ]);
      applyIntakeResult(routed);
      return;
    }
    const substantiveMessages = nextMessages.filter(
      (item) => item.role === "user" && !intakeBoundaryReply(item.content),
    );
    setIntakeLoading(true);
    try {
      const response = await requestAi<{ mode: "intake" } & IntakeResult>({
        mode: "intake",
        messages: nextMessages.slice(-6),
        question: clean,
      });
      const canStart =
        response.intentStatus === "supported" ||
        response.intentStatus === "supported_symbolic";
      const reachedClarificationLimit =
        substantiveMessages.length >= 2 &&
        canStart &&
        response.questionType !== "不适用" &&
        response.refinedQuestion.trim().length >= 2;
      const normalizedResponse = {
        ...response,
        ready:
          canStart &&
          (reachedClarificationLimit ||
            (response.ready && !intakeResponseStillAsking(response))),
        options: reachedClarificationLimit || !canStart ? [] : response.options,
        assistantMessage: reachedClarificationLimit
          ? `补充信息已经足够，我已完成定题。已归入“${response.questionType}”，重点看“${response.focus}”。确认后即可起局。`
          : response.assistantMessage,
      };
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: normalizedResponse.assistantMessage,
      };
      setIntakeMessages([...nextMessages, assistantMessage]);
      applyIntakeResult(normalizedResponse);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "问事官暂时没有回应";
      setAiError(message);
      if (substantiveMessages.length >= 2) {
        const words = substantiveMessages
          .map((item) => item.content)
          .join(" ");
        const routedFallback = intakeRuleRoute(words);
        if (routedFallback) {
          setIntakeMessages([
            ...nextMessages,
            { role: "assistant", content: routedFallback.assistantMessage },
          ]);
          applyIntakeResult(routedFallback);
          return;
        }
        const fallbackTopic = /感情|关系|伴侣|恋爱|婚姻/.test(words)
          ? "感情关系"
          : /工作|事业|职业|公司|跳槽|创业/.test(words)
            ? "事业发展"
            : /项目|方案|产品|合作|推进/.test(words)
              ? "项目决策"
            : /钱|收入|财富|生意|资源/.test(words)
              ? "财富趋势"
              : /考试|学习|学业|读书/.test(words)
                ? "学业成长"
                : /城市|搬家|远行|出国|迁移/.test(words)
                  ? "迁移远行"
                  : /方位|择时|什么时候行动|哪个方向/.test(words)
                    ? "方位择时"
                    : /人生|未来|方向|继续|转向|等待/.test(words)
                      ? "人生方向"
                      : null;
        if (!fallbackTopic) {
          setIntakeReady(false);
          setIntakeIntentStatus("unsupported");
          setIntakeOptions([]);
          setIntakeMessages([
            ...nextMessages,
            {
              role: "assistant",
              content: "我还不能确认这是否属于当前支持的奇门问事范围，因此不会把它强行归为人生方向。请换成一件关于事业、关系、学业、财富、迁移、项目、寻物或方位时机的具体问题。",
            },
          ]);
          return;
        }
        const fallbackFocus = /阻力|卡住|困难|原因/.test(words)
          ? "识别阻力"
          : /机会|可能|来源/.test(words)
            ? "找机会来源"
            : /选择|决定|怎么办|下一步/.test(words)
              ? "决定下一步"
              : "看未来主线";
        const original = substantiveMessages[0]?.content || clean;
        setTopic(fallbackTopic);
        setFocus(fallbackFocus);
        setQuestion(original.slice(0, 120));
        setContext(words.slice(0, 180));
        setIntakeReady(true);
        setIntakeIntentStatus("supported");
        setIntakeOptions([]);
        setIntakeMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: `我理解了。你真正想看清的不是一个抽象的吉凶，而是这件事接下来该如何取舍。我已把这一问归入“${fallbackTopic}”，重点看“${fallbackFocus}”。请确认后以此起局。`,
          },
        ]);
      } else {
        setIntakeOptions(["更想看未来方向", "更想做眼前选择", "更想识别主要阻力"]);
        setIntakeMessages([
          ...nextMessages,
          {
            role: "assistant",
            content:
              "我先从一个关键点确认：你这次更想看清未来主线、眼前选择，还是当前最大的阻力？",
          },
        ]);
      }
    } finally {
      setIntakeLoading(false);
    }
  }
  function startIntake(e: FormEvent) {
    e.preventDefault();
    if (question.trim().length < 2) return;
    setIntakeMessages([]);
    setIntakeOptions([]);
    setIntakeReady(false);
    setIntakeIntentStatus(null);
    setScreen("intake");
    void askIntake(question.trim(), []);
  }
  function submitIntakeReply(e?: FormEvent, option?: string) {
    e?.preventDefault();
    const value = (option || intakeInput).trim();
    if (!value) return;
    void askIntake(value);
  }
  async function submitFollowup(e?: FormEvent, quickQuestion?: string) {
    e?.preventDefault();
    if (!chart || chatLoading) return;
    const nextQuestion = (quickQuestion || chatInput).trim();
    if (nextQuestion.length < 2) return;
    const userMessage: ChatMessage = { role: "user", content: nextQuestion };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setAiError("");
    try {
      const response = await requestAi<{ mode: "followup"; answer: string }>({
        mode: "followup",
        chart,
        reading: aiReading,
        messages: chatMessages,
        question: nextQuestion,
      });
      setChatMessages([
        ...nextMessages,
        { role: "assistant", content: response.answer },
      ]);
      setAiSource(response.aiSource);
      setAiError("");
    } catch (error) {
      const message=error instanceof Error ? error.message : "AI追问暂时不可用";
      setAiSource("unknown");
      setAiError(message);
    } finally {
      setChatLoading(false);
    }
  }
  async function copySummary() {
    if (!chart || !interpretation) return;
    const title = interpretation.omenTitle;
    const oracle = aiReading?.oracle || interpretation.oracle;
    const actions = aiReading?.actions || interpretation.actions;
    await navigator.clipboard.writeText(
      `知几摘要｜${title}·${interpretation.toneLabel}\n所问：${chart.input.question}\n主用：${interpretation.mainSymbol}（${interpretation.mainLabel}）\n局式：${chart.dunType}${chart.juNumber}局·${chart.yuan}·时段值使${chart.zhishi.door}\n断语：${oracle}\n行动：${actions.join("\n")}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (screen === "ritual" && chart) {
    const revealDoor = interpretation?.mainDoor || chart.zhishi.door;
    return (
      <main className={`app-shell ritual-screen stage-${stage}`}>
        <div className="noise" />
        <button className="ritual-skip" type="button" onClick={finishRitual} aria-label="跳过起局过程">跳过 <span aria-hidden="true">→</span></button>
        <section className="ritual-workbench">
          <div className="ritual-main">
            <details className="ritual-step-directory">
              <summary>
                <span>{pad(stage + 1)} / 12</span>
                <b>{stages[stage].name}</b>
                <small>查看起局步骤</small>
              </summary>
              <div>
                {stages.map((s, i) => (
                  <button
                    key={s.name}
                    className={`${i === stage ? "current" : ""} ${i < stage ? "done" : ""}`}
                    onClick={() => setStage(i)}
                  >
                    <i>{pad(i + 1)}</i>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </details>
            <div className="stage-heading">
              <p>
                {stages[stage].key} · {pad(stage + 1)}/12
              </p>
              <h1>{stages[stage].title}</h1>
              <span>{stages[stage].desc}</span>
              <em>
                {stage < 11
                  ? "规则引擎正在排盘"
                  : "规则成盘 · 即将依盘成书"}
              </em>
            </div>
            <RitualVisual
              chart={chart}
              stage={stage}
              revealDoor={revealDoor}
              muted={soundMuted}
              paused={false}
              speed={1}
            />
            <div className="stage-output">
              <span>{stage < 11 ? "规则计算输出" : "最终盘面输出"}</span>
              <b>{stageOutput(chart, stage)}</b>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "result" && chart && interpretation) {
    const selected = palaceByNumber(
      chart,
      selectedPalace || interpretation.issuePalace,
    );
    const issuePalace = palaceByNumber(chart, interpretation.issuePalace);
    const selfPalace = palaceByNumber(chart, interpretation.selfPalace);
    const matterPalace = palaceByNumber(chart, interpretation.matterPalace);
    const environmentPalace = palaceByNumber(chart, interpretation.environmentPalace);
    const verdict = interpretation.verdict;
    const hasAiSynthesis = aiReading?.generationMode === "ai-synthesis";
    const resultDecisionTitle = hasAiSynthesis
      ? cleanGeneratedText(aiReading.decisionTitle)
      : aiLoading
        ? "正在理解你的问题，并核对盘面依据"
        : "这次回答没有通过质量检查";
    const resultOverview = hasAiSynthesis
      ? cleanGeneratedText(aiReading.overview)
      : aiLoading
        ? "盘面已经排定；正在结合你的原问题和上下文组织本局回答，不会用固定判词代替。"
        : aiError || "请重新生成回答；盘面仍然保留，不需要重新起局。";
    const resultReason = hasAiSynthesis
      ? cleanGeneratedText(aiReading.oracle)
      : "";
    const resultActions = hasAiSynthesis
      ? aiReading.actions.map(cleanGeneratedText)
      : [];
    const resultSourceLabel = hasAiSynthesis && aiSource !== "skill-rule-engine"
      ? "盘面参详"
      : aiLoading ? "正在参详盘面" : "等待重新参详";
    const followupPrompts = (hasAiSynthesis ? aiReading.followupPrompts : []).map(cleanGeneratedText);
    const palaceMarkers: Partial<Record<number, string[]>> = {};
    const addPalaceMarker = (palace: number, label: string) => {
      palaceMarkers[palace] = [...(palaceMarkers[palace] || []), label];
    };
    addPalaceMarker(interpretation.issuePalace, "本题核心");
    addPalaceMarker(interpretation.selfPalace, "问事主体");
    addPalaceMarker(interpretation.matterPalace, "事情发展");
    addPalaceMarker(interpretation.environmentPalace, "当下环境");
    return (
      <main
        className={`app-shell result-screen paged-result tab-${resultTab} fortune-${interpretation.tone}`}
      >
        <div className="noise" />
        <header className="topbar oracle-topbar result-oracle-topbar">
          <div className="brand">
            <i className="brand-mark" aria-hidden="true"><span /></i>
            <span>
              <b>知几</b>
              <small>观时 · 定局</small>
            </span>
          </div>
          <nav className="result-nav" role="tablist" aria-label="结果页">
            {(
              [
                ["chart", "命盘"],
                ["ask", "问命"],
              ] as [ResultTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                id={`result-tab-${key}`}
                role="tab"
                aria-selected={resultTab === key}
                aria-controls={`result-panel-${key}`}
                className={resultTab === key ? "active" : ""}
                onClick={() => setResultTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          <button className="ghost-button" onClick={reset}>
            新起一局
          </button>
        </header>
        <section className="result-mast">
          <div className="mast-content">
            <p className="result-meta">
              {chart.input.questionType} · {chart.input.focus || focus} ·{" "}
              {chart.calendar.solar}
            </p>
            <div className="result-conclusion-block">
              <div className="mast-label-row">
                <span className="mast-conclusion-label">{verdict.label}{interpretation.experienceMode ? " · 另取一象" : ""}</span>
                <span
                  className={`result-source source-${aiSource}${aiLoading ? " is-loading" : ""}`}
                  role={aiLoading ? "status" : undefined}
                  aria-live={aiLoading ? "polite" : undefined}
                >
                  {aiLoading && <i aria-hidden="true" />}
                  {resultSourceLabel}
                </span>
              </div>
              <h1 className="mast-answer concise">{resultDecisionTitle}</h1>
              <div className="mast-overview-block">
                <span>核心解释</span>
                <p className="mast-overview">{resultOverview}</p>
              </div>
              {resultActions[0] && <p className="mast-next-action"><span>先做</span>{resultActions[0].replace(/^(?:开始前|今天|第一轮)[：:]\s*/, "")}</p>}
            </div>
          </div>
          <div className="mast-reference-row">
            <p className="mast-question-line"><span>所问</span>{displayQuestionText(chart.input.question)}</p>
            <div className="mast-actions" aria-label="本局辅助操作">
              {!hasAiSynthesis && !aiLoading && <button onClick={() => void generateAiReading(chart)}>重新生成回答</button>}
              <button onClick={() => setRulesOpen(true)}>规则说明</button>
              <button onClick={copySummary}>
                {copied ? "摘要已复制" : "分享本局摘要"}
              </button>
              <button className="mobile-reset" onClick={reset}>
                新起一局
              </button>
            </div>
          </div>
        </section>
        {resultTab === "chart" && (
          <section className="result-view chart-view" id="result-panel-chart" role="tabpanel" aria-labelledby="result-tab-chart">
            {hasAiSynthesis ? <div className="conclusion-brief" aria-label="本局完整结论">
              <div className="conclusion-brief-heading">
                <span>行动与依据</span>
                <h2>接下来怎么做，以及为什么</h2>
              </div>
              <div className="conclusion-brief-grid">
                <article className="conclusion-explanation">
                  <small>盘面依据</small>
                  <p>{resultReason}</p>
                </article>
                <article className="conclusion-actions">
                  <small>完整行动</small>
                  <ol>
                    {resultActions.map((action, index) => (
                      <li key={`${index}-${action}`}>
                        <i>{pad(index + 1)}</i>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              </div>
            </div> : <div className="conclusion-brief reading-generation-state" aria-live="polite">
              <div className="conclusion-brief-heading">
                <span>{aiLoading ? "正在生成" : "回答未采用"}</span>
                <h2>{aiLoading ? "正在结合原问题、上下文与盘面事实组织回答" : "没有用固定模板冒充本局答案"}</h2>
              </div>
              <p>{resultOverview}</p>
              {!aiLoading && <button onClick={() => void generateAiReading(chart)}>重新生成回答</button>}
            </div>}
            <div className="calculation-summary">
              <div className="calculation-summary-heading">
                <span>本局计算摘要</span>
                <h2>先看时间如何固定这一张盘</h2>
                <p>下面都是本局实际计算结果，不是通用规则说明。</p>
              </div>
              <div className="calculation-facts">
                <span><small>起局时间</small><b>{chart.calendar.solar}</b><em>北京时间</em></span>
                <span><small>当前节令</small><b>{chart.calendar.activeJie}</b><em>下节 {chart.calendar.nextJie}</em></span>
                <span><small>四柱</small><b>{chart.calendar.year} · {chart.calendar.month}</b><em>{chart.calendar.day} · {chart.calendar.time}</em></span>
                <span><small>遁局</small><b>{chart.dunType}{chart.juNumber}局</b><em>{chart.yuan}</em></span>
                <span><small>旬首遁仪</small><b>{chart.xunshou}</b><em>遁 {chart.hiddenYi}</em></span>
                <span><small>值符</small><b>{chart.zhifu.star}</b><em>{palaceByNumber(chart, chart.zhifu.palace).name}</em></span>
                <span><small>值使</small><b>{chart.zhishi.door}</b><em>{palaceByNumber(chart, chart.zhishi.palace).name}</em></span>
                <span><small>时空亡</small><b>{chart.kongwang.join("、")}</b><em>{chart.kongwangPalaces.map((n) => palaceByNumber(chart, n).name).join("、")}</em></span>
              </div>
            </div>
            <div className="chart-toolbar">
              <div>
                <span>这张盘怎么读</span>
                <h2>九宫是本局的证据地图</h2>
                <p>先看下面的取用关系，再到九宫中核对落位；不需要从九格里盲猜应该看哪一格。</p>
              </div>
            </div>
            <div className="use-selection-map">
              <div className="use-selection-heading">
                <span>为什么看这几个宫</span>
                <h3>问题决定取用，时间决定落宫</h3>
                <p>{interpretation.primaryReason}。完成排盘后，再找到它与日干、时干各自所在的宫。</p>
              </div>
              <div className="use-selection-flow">
                  <button aria-pressed={selected.palace === selfPalace.palace} onClick={() => setSelectedPalace(selfPalace.palace)}>
                  <small>问事主体 · 日干</small>
                  <b>{chart.dayStem.stem}</b>
                  <span>{selfPalace.direction} · {selfPalace.name}</span>
                </button>
                <div className="use-relation">
                  <i>主体 ↔ 主用神</i>
                  <b>{interpretation.relation}</b>
                </div>
                <button aria-pressed={selected.palace === issuePalace.palace} className="primary" onClick={() => setSelectedPalace(issuePalace.palace)}>
                  <small>本题核心 · 主用神</small>
                  <b>{interpretation.mainSymbol}</b>
                  <span>{issuePalace.direction} · {issuePalace.name}</span>
                </button>
                <button aria-pressed={selected.palace === matterPalace.palace} onClick={() => setSelectedPalace(matterPalace.palace)}>
                  <small>事情发展 · 时干</small>
                  <b>{chart.timeStem.stem}</b>
                  <span>{matterPalace.direction} · {matterPalace.name}</span>
                </button>
                <button aria-pressed={selected.palace === environmentPalace.palace} onClick={() => setSelectedPalace(environmentPalace.palace)}>
                  <small>当下环境 · 值使</small>
                  <b>{chart.zhishi.door}</b>
                  <span>{environmentPalace.direction} · {environmentPalace.name}</span>
                </button>
              </div>
              <small className="use-selection-note">点击任意角色，可直接在九宫中定位对应宫位。</small>
            </div>
            <details className="layer-guide">
              <summary><b>专业分层（可选）</b><span>只想看结论可以跳过</span></summary>
              <div className="layer-switch">
                {(Object.keys(layerNames) as Layer[]).map((key) => (
                  <button aria-pressed={layer === key} className={layer === key ? "active" : ""} key={key} onClick={() => setLayer(key)}>
                    {layerNames[key]}
                  </button>
                ))}
              </div>
              <p>{layerHelp[layer]}</p>
            </details>
            <div className="explorer-layout">
              <div className="matrix-stage">
                <div className="matrix-use-note">先找有文字标签的宫位，再点击查看解释；没有标签的宫位只作为全盘背景。</div>
                <PalaceMatrix
                  chart={chart}
                  layer={layer}
                  selected={selectedPalace || interpretation.issuePalace}
                  onSelect={setSelectedPalace}
                  primary={interpretation.issuePalace}
                  markers={palaceMarkers}
                />
              </div>
              <aside className="evidence-panel">
                <p>当前选择：{selected.direction} · {selected.name}</p>
                <em className="selected-role">
                  {palaceMarkers[selected.palace]?.join(" · ") || "全盘辅助宫位"}
                </em>
                <h3>
                  {selected.trigram}宫 <i>五行{selected.element}</i>
                </h3>
                <div className="palace-role-explain">这格在本局中代表：{palaceMarkers[selected.palace]?.join("、") || "辅助观察位置"}</div>
                <div className="palace-symbols">
                  <span>
                    <small>天盘 · 当前表现</small>
                    <b>{selected.skyStem || "—"}</b>
                  </span>
                  <span>
                    <small>地盘 · 基础条件</small>
                    <b>{selected.earthStem || "—"}</b>
                  </span>
                  <span>
                    <small>九星 · 行动特征</small>
                    <b>{selected.star}</b>
                  </span>
                  <span>
                    <small>八门 · 推进节奏</small>
                    <b>{selected.door || "无门"}</b>
                  </span>
                  <span>
                    <small>八神 · 外部气氛</small>
                    <b>{selected.god || "无神"}</b>
                  </span>
                  <span>
                    <small>干关系 · 承接状态</small>
                    <b>{selected.stemRelation || "—"}</b>
                  </span>
                </div>
                <div className="evidence-meaning">
                  <span>这格怎样影响结论</span>
                  <p>
                    {interpretation.insights.find(
                      (x) => x.palace === selected.palace,
                    )?.body ||
                      "此宫不是当前三条主线之一，可结合盘面图层查看，不单独做确定性推断。"}
                  </p>
                </div>
                <details className="chart-advanced-index">
                  <summary>查看专业索引</summary>
                  <div className="index-list">
                  <span>
                    值符 {chart.zhifu.star} ·{" "}
                    {palaceByNumber(chart, chart.zhifu.palace).name}
                  </span>
                  <span>
                    值使 {chart.zhishi.door} ·{" "}
                    {palaceByNumber(chart, chart.zhishi.palace).name}
                  </span>
                  <span>
                    驿马 {chart.yima.branch} ·{" "}
                    {palaceByNumber(chart, chart.yima.palace).name}
                  </span>
                  <span>
                    时空亡 {chart.kongwang.join("、")} ·{" "}
                    {chart.kongwangPalaces
                      .map((n) => palaceByNumber(chart, n).name)
                      .join("、")}
                  </span>
                  </div>
                </details>
              </aside>
            </div>
            <div className="page-turn">
              <span>01 / 02 · 命盘</span>
              <button onClick={() => setResultTab("ask")}>
                继续问这一局 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "ask" && (
          <section className="result-view ask-page" id="result-panel-ask" role="tabpanel" aria-labelledby="result-tab-ask">
            <div className="ask-heading">
              <span>同局追问</span>
              <h2>针对刚才的结论，继续问清原因和下一步</h2>
              <p>这里不会重新算一遍，只回答这局为什么这样判断、主要阻力是什么，以及下一步可以怎么做。</p>
            </div>
            <div className="ask-shell">
              <div className="ask-purpose">
                <div>
                  <small>选择追问方向</small>
                  <b>选一个最想弄清的问题，也可以直接写自己的问题。</b>
                </div>
                <span>同一件事、同一时间才沿用当前命盘；主题或时间改变，请重新问事。</span>
              </div>
              <div className="prompt-chips">
                {followupPrompts.map((prompt, index) => (
                  <button
                    key={prompt}
                    disabled={chatLoading}
                    onClick={() => setChatInput(prompt)}
                  >
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
              {(chatMessages.length > 0 || chatLoading) && (
                <div className="chat-stream" aria-live="polite">
                  {chatMessages.length > 0 && chatMessages.map((message, i) => (
                    <div
                      key={`${message.role}-${i}`}
                      className={`chat-message ${message.role}`}
                    >
                      <small>
                        {message.role === "user" ? "问事人" : "问命官"}
                      </small>
                      <p>{message.role === "assistant" ? cleanGeneratedText(message.content) : message.content}</p>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="chat-thinking">
                      <TideLoader label="正在结合本局九宫寻找依据…" />
                    </div>
                  )}
                </div>
              )}
              <form className="chat-form" onSubmit={submitFollowup}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={600}
                  placeholder="例如：若要转向，第一步该验证什么？"
                />
                <div>
                  <small>{chatInput.length}/600 · 回答只围绕当前命盘</small>
                  <button disabled={chatLoading || chatInput.trim().length < 2}>
                    发送追问 →
                  </button>
                </div>
              </form>
              {aiError && (
                <p className="followup-error" role="alert">
                  {aiError}
                </p>
              )}
            </div>
            <div className="page-turn">
              <button className="back" onClick={() => setResultTab("chart")}>
                ← 返回命盘
              </button>
              <span>02 / 02 · 问命</span>
              <button onClick={reset}>完成 · 再起一局</button>
            </div>
          </section>
        )}

        {rulesOpen && (
          <div
            className="rules-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="排盘规则与使用边界"
            onClick={() => setRulesOpen(false)}
          >
            <aside className="rules-drawer" onClick={(event) => event.stopPropagation()}>
              <button
                className="rules-close"
                ref={rulesCloseRef}
                onClick={() => setRulesOpen(false)}
                aria-label="关闭规则说明"
              >
                ×
              </button>
              <div className="method-hero">
                <span>排盘规则与使用边界</span>
                <h2>这张盘怎么来，结论怎么看。</h2>
                <p>时间固定盘面，问题决定观察位置；页面给出的结论可以回到九宫查看依据。</p>
              </div>
              <div className="method-grid">
                <article>
                  <i>01</i>
                  <h3>时间决定盘</h3>
                  <p>公历时间换算节令与四柱，再据节令、日干支和三元查定阴阳遁与局数。</p>
                </article>
                <article>
                  <i>02</i>
                  <h3>问题决定取用</h3>
                  <p>同一个时间只有一张盘。不同问题看不同主用神；日干看主体，时干看事情。</p>
                </article>
                <article>
                  <i>03</i>
                  <h3>结果可以追溯</h3>
                  <p>每条提示都可以回到对应宫位，查看天盘、地盘、九星、八门与八神。</p>
                </article>
              </div>
              <div className="ai-boundary-map">
                <div>
                  <strong>成盘</strong>
                  <span>
                    <b>规则引擎负责成盘</b>
                    <small>时间、节令、四柱、遁局、九宫、值符与值使</small>
                  </span>
                </div>
                <em>不可改盘 →</em>
                <div className="ai">
                  <strong>表达</strong>
                  <span>
                    <b>规则先定结论与行动，AI只整理成白话</b>
                    <small>AI不能改盘、改倾向、增加证据或代替现实决定</small>
                  </span>
                </div>
              </div>
              <div className="boundary-panel">
                <b>不提供</b>
                <span>精确位置 · 金额 · 生死 · 医疗诊断 · 法律判断 · 投资涨跌 · 确定性未来</span>
                <b>适合用来</b>
                <span>观看传统起局过程 · 整理注意力 · 产生现实核验问题 · 文化体验</span>
              </div>
            </aside>
          </div>
        )}
        <footer className="result-footer">
          <span>知几 · 奇门问事</span>
        </footer>
      </main>
    );
  }

  if (screen === "question" || screen === "intake")
    return (
      <main className={`app-shell intake-entry-screen${screen === "intake" ? " intake-chat-screen intake-unified-screen" : ""}`}>
        <div className="noise" />
        <header className="topbar oracle-topbar">
          <div className="brand">
            <i className="brand-mark" aria-hidden="true"><span /></i>
            <span>
              <b>知几</b>
              <small>观时 · 定局</small>
            </span>
          </div>
          <button
            className="ghost-button"
            onClick={() => {
              if (screen === "intake") {
                setScreen("question");
                setIntakeReady(false);
                setIntakeOptions([]);
                setAiError("");
              } else {
                setScreen("landing");
              }
            }}
          >
            {screen === "intake" ? "重新描述" : "返回首页"}
          </button>
        </header>
        <section className="intake-entry">
          <div className="intake-entry-copy">
            <span>{screen === "intake" ? "起局前 · 定题" : "问事 · 第一步"}</span>
            <h1>{screen === "intake" ? (intakeIntentStatus === "unsupported" || intakeIntentStatus === "high_risk" ? "这次不进入起局" : intakeReady ? "问题已经定好" : "还差一个关键点") : "只管说想问的事"}</h1>
            <p>{screen === "intake" ? (intakeIntentStatus === "unsupported" || intakeIntentStatus === "high_risk" ? "这个问题到这里结束，不会继续生成推荐或补充追问。" : intakeReady ? "请核对整理后的问题；没有偏离原意，就可以开始起局。" : "描述已经收到。这里只补当前缺少的一个信息，不会反复盘问。") : "写下一件事，并确认问事时刻。城市可选，不填写也可以直接定题。"}</p>
          </div>
          {screen === "question" ? (
            <>
              <form className="intake-single-box" onSubmit={startIntake}>
                <textarea
                  autoFocus
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  minLength={2}
                  maxLength={600}
                  rows={2}
                  placeholder="心有所问，写下此刻最想确认的一件事…"
                  aria-label="写下想算的事情"
                />
                <div>
                  <small>{question.length}/600 · 写清一件事即可进入定题</small>
                  <button disabled={question.trim().length < 2} aria-label="进入定题">
                    <span>进入定题</span><i>→</i>
                  </button>
                </div>
              </form>
              <div className="intake-origin-strip" aria-label="问事时刻与地点">
                <div className="intake-origin-item">
                  <span>问事时刻</span>
                  <div>
                    <b>{timeMode === "now" ? "现在 · 北京时间" : customTime.replace("T", " ")}</b>
                    <button
                      type="button"
                      onClick={() => {
                        if (timeMode === "now") {
                          setCustomTime(toLocalInput(beijingNow()));
                          setTimeMode("custom");
                        } else {
                          setTimeMode("now");
                        }
                      }}
                    >
                      {timeMode === "now" ? "指定时间" : "改用此刻"}
                    </button>
                  </div>
                  {timeMode === "custom" && (
                    <input
                      aria-label="指定北京时间"
                      type="datetime-local"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                    />
                  )}
                </div>
                <label className="intake-origin-item intake-city-item">
                  <span>问事地点 <i>可略</i></span>
                  <input
                    aria-label="问事地点"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={20}
                    placeholder="如：上海；留空则以北京时间排盘"
                  />
                </label>
              </div>
              <div className="intake-examples">
                <span>不知道怎么说？试试</span>
                {starterPrompts.slice(0, 6).map((item) => (
                  <button key={item.question} onClick={() => setQuestion(item.question)}>
                    {item.question}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="intake-conversation intake-inline-conversation">
              <div className="intake-chat-stream" aria-live="polite">
                {intakeMessages
                  .filter(() => !intakeReady)
                  .map((message, index) => (
                    <div className={`intake-message ${message.role}`} key={`${message.role}-${index}`}>
                      <small className="intake-speaker">{message.role === "user" ? "原问题" : "定题助手"}</small>
                      <p>{message.content}</p>
                    </div>
                  ))}
                {intakeLoading && (
                  <div className="intake-thinking">
                    <TideLoader label="正在判断是否还缺一个关键信息…" />
                  </div>
                )}
              </div>
              {intakeOptions.length > 0 && !intakeLoading && intakeIntentStatus !== "unsupported" && intakeIntentStatus !== "high_risk" && (
                <div className="intake-choice-row">
                  <small>选最接近的一项；点选后会直接作为补充提交</small>
                  <div>{intakeOptions.map((option) => (
                    <button key={option} onClick={() => submitIntakeReply(undefined, option)}>{option}</button>
                  ))}</div>
                </div>
              )}
              {intakeIntentStatus === "unsupported" || intakeIntentStatus === "high_risk" ? (
                <div className="intake-terminal-card" role="status">
                  <span>这次不进入起局</span>
                  <p>当前问题不适合沿着命盘继续判断，也不需要再补充细节。</p>
                  <button
                    type="button"
                    onClick={() => {
                      setScreen("question");
                      setQuestion("");
                      setContext("");
                      setIntakeMessages([]);
                      setIntakeOptions([]);
                      setIntakeInput("");
                      setIntakeReady(false);
                      setIntakeIntentStatus(null);
                      setAiError("");
                    }}
                  >
                    换一个问题
                  </button>
                </div>
              ) : intakeReady ? (
                <div className="intake-ready-card">
                  <span>整理后的最终起局问题</span>
                  <blockquote>“{displayQuestionText(question)}”</blockquote>
                  <div>
                    <small>问事类型</small><b>{topic}</b><i>·</i><small>本局重点</small><b>{focus}</b>
                  </div>
                  <div className="intake-ready-actions">
                    {topic === "感情关系" && (
                      <div className={`intake-ready-relation ${relationshipMode ? "has-choice" : "needs-choice"}`}>
                        <div className="relationship-choice-heading">
                          <div>
                            <b id="relationship-choice-title">1. 选择双方身份</b>
                            <small>用于区分盘中的提问者与对方</small>
                          </div>
                          <em>必选</em>
                        </div>
                        <div
                          className="relationship-choice-options"
                          role="radiogroup"
                          aria-labelledby="relationship-choice-title"
                          aria-required="true"
                        >
                          {(["男问女", "女问男", "同性关系"] as const).map((item) => (
                            <button
                              type="button"
                              role="radio"
                              aria-checked={relationshipMode === item}
                              className={relationshipMode === item ? "active" : "secondary"}
                              onClick={() => setRelationshipMode(item)}
                              key={item}
                            >
                              <i aria-hidden="true" />
                              <span>{relationshipModeLabels[item]}</span>
                            </button>
                          ))}
                        </div>
                        <span className="relationship-mode-note" id="relationship-choice-note" role="status">
                          {relationshipMode
                            ? `已选择“${relationshipModeLabels[relationshipMode]}”；如不准确，可以重新选择。`
                            : "请选择其中一项。完成选择后，下方按钮会立即启用。"}
                        </span>
                      </div>
                    )}
                    {topic === "感情关系" && !relationshipMode && (
                      <div className="relationship-required-note" role="status">
                        <b>还差一步</b>
                        <span>先完成上方必选项，才能开始起局。</span>
                      </div>
                    )}
                    <button
                      className="start-ritual-button"
                      onClick={() => void begin()}
                      disabled={chartLoading || (topic === "感情关系" && !relationshipMode)}
                      aria-describedby={topic === "感情关系" ? "relationship-choice-note" : undefined}
                    >
                      {chartLoading ? (
                        <TideLoader compact label="正在排盘…" />
                      ) : topic === "感情关系" && !relationshipMode
                        ? "2. 完成选择后继续"
                        : topic === "感情关系"
                          ? "2. 确认问题，开始起局"
                          : "确认问题，开始起局"}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setScreen("question");
                        setIntakeReady(false);
                        setIntakeOptions([]);
                        setAiError("");
                      }}
                    >
                      修改这句话
                    </button>
                  </div>
                </div>
              ) : (
                !intakeLoading && (
                  <div className="intake-reply-area">
                    <div className="intake-reply-head">
                      <b>补充一个关键点</b>
                      <span>回答当前缺少的那一点即可</span>
                    </div>
                    <form className="intake-reply-box" onSubmit={submitIntakeReply}>
                      <textarea
                        value={intakeInput}
                        onChange={(e) => setIntakeInput(e.target.value)}
                        maxLength={600}
                        placeholder="例如：明天要谈一个新工作；要找的是车钥匙……"
                      />
                      <button disabled={intakeInput.trim().length < 2}>提交补充 <i>↑</i></button>
                    </form>
                  </div>
                )
              )}
              {aiError && <small className="intake-error">{aiError}</small>}
            </div>
          )}
        </section>
      </main>
    );

  if (screen === "confirm")
    return (
      <main className="app-shell wizard-screen confirm-screen">
        <div className="noise" />
        <header className="topbar">
          <div className="brand">
            <i className="brand-mark" aria-hidden="true"><span /></i>
            <span>
              <b>知几</b>
              <small>观时 · 定局</small>
            </span>
          </div>
          <button
            className="ghost-button"
            onClick={() => setScreen("intake")}
          >
            修改问题
          </button>
        </header>
        <section className="wizard-layout confirm-layout">
          <div className="wizard-intro">
            <span>起局前最后确认</span>
            <h1>确认问题与时间。</h1>
            <p>确认后，将按这件事和这个时间排盘。</p>
          </div>
          <form
            className="question-console wizard-panel confirm-panel"
            onSubmit={begin}
          >
            <div className="confirm-essential confirm-content-card">
              <span className="confirm-card-index">所问</span>
              <blockquote>“{displayQuestionText(question)}”</blockquote>
              <small>{topic} · {focus}</small>
            </div>
            <div className="confirm-time-group confirm-content-card">
              <span className="confirm-card-index">问事时刻</span>
              <div className="confirm-time-simple">
                <div>
                  <b>
                    {timeMode === "now"
                      ? "现在（北京时间）"
                      : customTime.replace("T", " ")}
                  </b>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (timeMode === "now") {
                      setCustomTime(toLocalInput(beijingNow()));
                      setTimeMode("custom");
                    } else {
                      setTimeMode("now");
                    }
                  }}
                >
                  {timeMode === "now" ? "指定时间" : "改用现在"}
                </button>
              </div>
              {timeMode === "custom" && (
                <label className="custom-time-field">
                  <span>指定北京时间</span>
                  <input
                    type="datetime-local"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    required
                  />
                </label>
              )}
              <details className="confirm-advanced">
                <summary>
                  <span>所在城市（必填）</span>
                  <small>用于确认时区和起局地点</small>
                </summary>
                <label>
                  <span>城市名称</span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={20}
                    placeholder="例如：上海"
                    required
                  />
                </label>
              </details>
            </div>
            <div className="confirm-skill-fields confirm-content-card">
              <span className="confirm-card-index">补齐起局信息</span>
              <label className="confirm-progress-field">
                <span>事情目前进展到哪一步</span>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  maxLength={180}
                  placeholder="例如：已经沟通过一次，正在等待明确回复"
                  required
                />
              </label>
              {topic === "感情关系" && (
                <div className="confirm-choice-field">
                  <span>关系取用</span>
                  <div>
                    {(["男问女", "女问男", "同性关系"] as const).map((item) => (
                      <button type="button" className={relationshipMode === item ? "active" : ""} onClick={() => setRelationshipMode(item)} key={item}>{item}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="confirm-choice-field">
                <span>希望怎么看</span>
                <div>
                  <button type="button" className={outputPreference === "direct" ? "active" : ""} onClick={() => setOutputPreference("direct")}>直接结论</button>
                  <button type="button" className={outputPreference === "detailed" ? "active" : ""} onClick={() => setOutputPreference("detailed")}>详细讲解</button>
                </div>
              </div>
            </div>
            {topic === "寻人寻物" && (
              <p className="confirm-scope-line">寻物结果只给排查方向和顺序，不会定位到具体抽屉或桌角。</p>
            )}
            {aiError && <small className="intake-error confirm-error">{aiError}</small>}
            <div className="wizard-actions">
              <button
                type="button"
                className="back"
                onClick={() => setScreen("intake")}
              >
                返回修改问题
              </button>
              <button type="submit" disabled={chartLoading || (topic === "感情关系" && !relationshipMode)}>
                {chartLoading ? <TideLoader compact label="正在排盘…" /> : "封存此念 · 开始起局 →"}
              </button>
            </div>
          </form>
        </section>
      </main>
    );

  return (
    <main className="app-shell landing-screen" lang="zh-CN">
      <div className="noise" />
      <header className="topbar oracle-topbar">
        <div className="brand">
          <i className="brand-mark" aria-hidden="true"><span /></i>
          <span>
            <b>知几</b>
            <small>观时 · 定局</small>
          </span>
        </div>
        <nav className="oracle-nav" aria-label="首页导航">
          <a href="#why-yiju">为何知几</a>
          <a href="#ai-showcase">如何问事</a>
          <a href="#reading-example">如何解读</a>
        </nav>
        <div className="header-actions">
          {history.length > 0 && <button className="history-quick" onClick={() => setHistoryOpen(true)}>最近起局</button>}
          <button className="ghost-button" onClick={() => enterExperience()}>
            即刻体验
          </button>
        </div>
      </header>
      <section className="landing-oracle-hero">
        <div className="oracle-ambient ambient-a" />
        <div className="oracle-ambient ambient-b" />
        <div className="oracle-copy">
          <p className="oracle-eyebrow">
            <i /> 一事一问 · 观时定局 <i />
          </p>
          <h1>
            观时定局，<em>见势知行</em>
          </h1>
          <p className="oracle-subtitle">
            不必先懂奇门，也不必先选分类。说出此刻真正困住你的事，
            先把问题理清，再用一张完整奇门局照见其中的关系与变化。
          </p>
          <button className="oracle-primary-cta" onClick={() => enterExperience()}>
            以此刻，问一事
          </button>
          <div className="oracle-live-example">
            <div className="oracle-example-divider"><i /><span>可以这样问</span><i /></div>
            <form
              className="oracle-prompt-window"
              onSubmit={(event) => {
                event.preventDefault();
                if (!question.trim()) return;
                enterExperience();
              }}
            >
              <label className="oracle-live-field">
                <span className="sr-only">在这里输入想问的事</span>
                <input
                  className="oracle-live-input"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={600}
                  autoComplete="off"
                />
                {!question && (
                  <span key={heroPromptIndex} className="oracle-live-placeholder" aria-hidden="true">
                    {starterPrompts[heroPromptIndex].question}
                  </span>
                )}
              </label>
              <button className="oracle-prompt-submit" type="submit" disabled={!question.trim()} aria-label="提交问题">
                →
              </button>
            </form>
          </div>
        </div>
      </section>
      <section className="home-why" id="why-yiju">
        <div className="home-section-heading">
          <span>为什么选择知几</span>
          <h2>不是把古书搬上网页，<br /><em>而是先把真正想问的事说清。</em></h2>
          <p>克制、清楚、可追溯。让奇门回到一个问题、一张盘和一条可以带回现实的线索。</p>
        </div>
        <div className="home-feature-list">
          {[
            ["壹", "先把纠结整理成真正的一问", "你只需说出真实处境。定题助手会判断问事类型，必要时只补问一个关键点。"],
            ["贰", "一个问题，只起一张真实时间盘", "节令、四柱、阴阳遁、局数、九宫与值使都由规则计算，不会为了迎合答案而修改。"],
            ["叁", "从封题到成局，盘面依据可以查证", "起局时间、局数、值符值使与九宫盘面保留在同一张命盘中，关键判断可以回到对应宫位查看。"],
            ["肆", "看完命盘，还能沿着同一局追问", "同局追问会保留原问题和盘面，继续回答阻力、机会与下一步怎么验证。"],
            ["伍", "从盘中看见线索，让下一步更清楚", "不只停在一句吉凶，而是把盘中的方向、时机与变化，整理成容易理解的现实提示。"],
          ].map(([number, title, body], index) => (
            <article key={number} className={index % 2 ? "reverse" : ""}>
              <i>{number}</i>
              <div><small>0{index + 1}</small><h3>{title}</h3><p>{body}</p></div>
            </article>
          ))}
        </div>
      </section>
      <section className="home-ai-showcase" id="ai-showcase">
        <div className="home-section-heading">
          <span>问事方法</span>
          <h2>不急着给一句判词，<br /><em>先把问题放回完整处境。</em></h2>
          <p>从一段说不清的困惑，到可以起局的一问，再到盘面依据与现实行动。</p>
        </div>
        <div className="ai-insight-example" id="reading-example">
          <blockquote className="ai-insight-question">“工作越来越没有意义，但离开又怕走错，到底该怎么办？”</blockquote>
          <div className="ai-insight-card">
            <header className="ai-insight-head"><span>知几洞察</span><i aria-hidden="true" /></header>
            <div className="ai-insight-lead">
              <p>离开不是眼下最难的决定。真正要先看清的，是哪条新路值得走。</p>
            </div>
            <div className="ai-insight-results">
              <article>
                <small>01 · 此刻</small>
                <h3>先把精力收回来，不急着做最后决定。</h3>
              </article>
              <article>
                <small>02 · 试路</small>
                <h3>选一个最想去的方向，做一次真实接触。</h3>
              </article>
              <article>
                <small>03 · 决定</small>
                <h3>当回应持续出现，再决定留下还是离开。</h3>
              </article>
            </div>
            <footer className="ai-insight-foot">
              <span>观一时之势，也看下一步怎么走</span>
              <button onClick={() => enterExperience()}>以此刻，问一事</button>
            </footer>
          </div>
        </div>
      </section>
      <footer className="landing-site-footer">
        <div className="site-footer-grid">
          <section className="site-footer-brand">
            <div><i className="brand-mark" aria-hidden="true"><span /></i><b>知几</b></div>
            <p>观时定局，见势知行</p>
            <span>一事一问 · 奇门问事</span>
          </section>
          <nav aria-label="页脚产品入口">
            <h3>快速开始</h3>
            <button onClick={() => enterExperience()}>立即问事</button>
            <a href="#why-yiju">为何知几</a>
            <a href="#ai-showcase">如何问事</a>
            <a href="#reading-example">如何解读</a>
            {history.length > 0 && <button onClick={() => setHistoryOpen(true)}>最近起局</button>}
          </nav>
          <nav aria-label="页脚常问主题">
            <h3>常问主题</h3>
            {[
              ["事业发展", "面对眼前的事业选择，我应该稳住积累还是主动突破？"],
              ["感情关系", "这段关系接下来更适合靠近、沟通还是暂时留白？"],
              ["财富趋势", "接下来我更该开拓收入，还是先守住已有积累？"],
              ["学业成长", "面对接下来的学习与考试，我该继续深耕还是调整方法？"],
            ].map(([label, prompt]) => (
              <button key={label} onClick={() => enterExperience(prompt)}>{label}</button>
            ))}
          </nav>
          <nav aria-label="页脚更多方向">
            <h3>更多方向</h3>
            {[
              ["人生方向", "未来一段时间，我更适合继续、转向还是等待？"],
              ["迁移远行", "近期是否适合换一个城市或环境重新开始？"],
              ["项目决策", "眼前这个项目是否值得继续投入，下一步该先验证什么？"],
              ["寻人寻物", "想找的东西可能在哪里，应该先从什么方向开始找？"],
            ].map(([label, prompt]) => (
              <button key={label} onClick={() => enterExperience(prompt)}>{label}</button>
            ))}
          </nav>
        </div>
        <div className="site-footer-bottom">
          <span>© 2026 知几 · 奇门问事</span>
          <i className="brand-mark" aria-hidden="true"><span /></i>
          <span>观时 · 定局 · 见势 · 知行</span>
        </div>
      </footer>
      {historyOpen && (
        <div className="history-backdrop" role="dialog" aria-modal="true" aria-label="最近起局" onClick={() => setHistoryOpen(false)}>
          <aside
            className="history-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span>最近起局</span>
                <h2>最近起局</h2>
              </div>
              <button ref={historyCloseRef} aria-label="关闭最近起局" onClick={() => setHistoryOpen(false)}>×</button>
            </header>
            <p>仅保存在当前设备，不需要登录。</p>
            <div>
              {history.map((item) => {
                const normalizedChart = normalizeSavedQuestionChart(item.chart);
                const reading = interpretChart(normalizedChart);
                return (
                  <button
                    className="history-card"
                    key={item.id}
                    onClick={() => restore({ ...item, chart: normalizedChart })}
                  >
                    <small>
                      {normalizedChart.input.questionType} ·{" "}
                      {normalizedChart.calendar.solar}
                    </small>
                    <b>{normalizedChart.input.question}</b>
                    <span>
                      {reading.omenTitle} · {reading.toneLabel} · 值使
                      {normalizedChart.zhishi.door} · 主用{reading.mainSymbol}
                    </span>
                    <em>打开命盘 →</em>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}
      {inviteOpen && (
        <div className="invite-gate-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setInviteOpen(false);
        }}>
          <section className="invite-gate" role="dialog" aria-modal="true" aria-labelledby="invite-gate-title">
            <button className="invite-gate-close" type="button" aria-label="关闭邀请码窗口" onClick={() => setInviteOpen(false)}>×</button>
            <i className="brand-mark" aria-hidden="true"><span /></i>
            <span className="invite-gate-kicker">凭邀入局</span>
            <h2 id="invite-gate-title">进入知几</h2>
            <p>知几目前采用邀请体验。请输入邀请码，验证一次后，这台设备会记住你的访问资格。</p>
            <form onSubmit={submitInvite}>
              <label htmlFor="invite-code">邀请码</label>
              <div className="invite-gate-field">
                <input
                  id="invite-code"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  placeholder="ZJ-XXXX-XXXX-XXXX"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  autoFocus
                  disabled={accessState === "checking" || inviteLoading}
                />
                <button type="submit" disabled={accessState === "checking" || inviteLoading || !inviteCode.trim()}>
                  {accessState === "checking" ? "正在核对…" : inviteLoading ? "正在进入…" : "验证并进入"}
                </button>
              </div>
              {inviteError && <span className="invite-gate-error" role="alert">{inviteError}</span>}
            </form>
            <small>邀请码由知几后台发放，可设置永久有效、到期时间或随时停用。</small>
          </section>
        </div>
      )}
    </main>
  );
}
