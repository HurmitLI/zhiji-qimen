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
  type QimenChart,
} from "../lib/qimen";
import { interpretChart, type Tone } from "../lib/interpret";
import {
  requestAi,
  classifySeekScope,
  fallbackFollowupAnswer,
  intakeResponseStillAsking,
  intakeBoundaryReply,
  intakeRuleRoute,
  type AiReading,
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
    desc: "以时干落宫定位门盘",
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
const signalPlainLanguage: Record<string, string> = {
  主用神: "这道题主要看什么",
  主体宫: "你现在是什么状态",
  事情宫: "事情正在怎样发展",
  时段值使: "当下环境是否顺手",
};
const topicUsePreview: Record<string, string> = {
  人生方向: "主看时干所代表的事情动态，同时看日干所代表的本人",
  事业发展: "主用神取开门；日干看本人，时干看事情发展",
  财富趋势: "主用神取生门，戊作资金辅助；日干看本人",
  感情关系: "主用神取六合观察关系连接；日干看本人",
  学业成长: "主用神取景门，天辅作学习辅助；日干看本人",
  迁移远行: "主看驿马，开门作通行辅助；日干看本人",
  项目决策: "主用神取开门，天心作判断辅助；日干看本人",
  寻人寻物: "主看时干所代表的对象动态，玄武作遮蔽辅助",
  方位择时: "主看驿马，开门作行动入口辅助；日干看本人",
};
type Layer = keyof typeof layerNames;
type Screen =
  | "landing"
  | "question"
  | "intake"
  | "confirm"
  | "ritual"
  | "result";
type ResultTab = "book" | "chart" | "ask";
type SavedReading = { id: string; chart: QimenChart; focus: string; reading?: AiReading };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function wallClockMinutes(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  ) / 60000;
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

function conditionalVerdict(
  chart: QimenChart,
  interpretation: ReturnType<typeof interpretChart>,
) {
  const isCareer = chart.input.questionType === "事业发展" || chart.input.questionType === "事业选择";
  if (isCareer) {
    if (interpretation.tone === "bright") {
      return {
        label: "条件化倾向",
        title: "更偏向主动验证新机会，但不支持立即离开现职",
        condition: "先核实职责、回报、汇报线与试用标准；连续获得可复核的正向反馈后，再决定是否转向。",
      };
    }
    if (interpretation.tone === "caution") {
      return {
        label: "条件化倾向",
        title: "现阶段更偏向稳住现职，暂缓不可逆转向",
        condition: "先补齐关键信息并降低转换成本；条件没有落到书面、承诺仍有落差时，不建议贸然离开。",
      };
    }
    return {
      label: "条件化倾向",
      title: "先保留现职，同时低成本验证新机会",
      condition: "这局不支持立即二选一；用一到两周完成条件核验，再根据连续反馈决定是否加码。",
    };
  }
  if (interpretation.tone === "bright") {
    return {
      label: "本局倾向",
      title: "可以推进，但先从可撤回的小动作开始",
      condition: "先验证主用神所代表的关键条件，现实反馈与盘面方向连续同向后再扩大投入。",
    };
  }
  if (interpretation.tone === "caution") {
    return {
      label: "本局倾向",
      title: "暂缓大动，先解除最主要的限制",
      condition: "在信息、资源或承受边界没有补齐前，不做不可逆决定。",
    };
  }
  return {
    label: "本局倾向",
    title: "先试后定，用现实反馈收拢选择",
    condition: "先完成一个低成本验证，再决定继续、转向还是等待。",
  };
}

function dedupeEvidence(value: string) {
  const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
  return parts.filter((part, index) => parts.indexOf(part) === index).join(" / ");
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

function ToneDot({ tone }: { tone: Tone }) {
  return <i className={`tone-dot ${tone}`} />;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [topic, setTopic] = useState(topicMeta[0].name);
  const [focus, setFocus] = useState(focusOptions[0]);
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [city, setCity] = useState("");
  const [timeMode, setTimeMode] = useState<"now" | "custom">("now");
  const [customTime, setCustomTime] = useState(() => toLocalInput(new Date()));
  const [chart, setChart] = useState<QimenChart | null>(null);
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [resultTab, setResultTab] = useState<ResultTab>("book");
  const [bookExpanded, setBookExpanded] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const [layer, setLayer] = useState<Layer>("all");
  const [selectedPalace, setSelectedPalace] = useState<number>();
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<SavedReading[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [samePeriodNotice, setSamePeriodNotice] = useState("");
  const [aiReading, setAiReading] = useState<AiReading | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [intakeMessages, setIntakeMessages] = useState<ChatMessage[]>([]);
  const [intakeInput, setIntakeInput] = useState("");
  const [intakeOptions, setIntakeOptions] = useState<string[]>([]);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeReady, setIntakeReady] = useState(false);
  const [, setIntakeIntentStatus] = useState<IntakeIntentStatus | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const interpretation = useMemo(
    () => (chart ? interpretChart(chart) : null),
    [chart],
  );
  const selectedTopic = topicMeta.find((x) => x.name === topic) || topicMeta[0];

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
          fallback: interpretChart(nextChart),
        },
      );
      setAiReading(response.reading);
      setHistory((list) => {
        const next = list.map((item) =>
          item.chart.input.time === nextChart.input.time &&
          item.chart.input.question === nextChart.input.question
            ? { ...item, reading: response.reading }
            : item,
        );
        localStorage.setItem("yiju-readings", JSON.stringify(next));
        return next;
      });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "个性解读暂时不可用");
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
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("yiju-readings") || "[]",
        ) as SavedReading[];
        setHistory(saved.slice(0, 6));
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!rulesOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRulesOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [rulesOpen]);

  useEffect(() => {
    if (screen !== "ritual" || paused) return;
    const delay =
      stage === 11 ? (speed === 2 ? 2800 : 5300) : speed === 2 ? 260 : 430;
    const timer = window.setTimeout(() => {
      if (stage < 11) setStage((s) => s + 1);
      else {
        if (chart) {
          setHistory((list) => {
            const item = {
              id: `${chart.input.time}-${Date.now()}`,
              chart,
              focus: chart.input.focus || focus,
            };
            const next = [item, ...list.filter((x) => x.id !== item.id)].slice(
              0,
              6,
            );
            localStorage.setItem("yiju-readings", JSON.stringify(next));
            return next;
          });
          void generateAiReading(chart);
        }
        setSoundMuted(true);
        setScreen("result");
        setResultTab("book");
        setBookExpanded(false);
        setSelectedPalace(interpretation?.issuePalace);
        window.scrollTo({ top: 0 });
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    screen,
    stage,
    paused,
    speed,
    interpretation,
    chart,
    focus,
    generateAiReading,
  ]);
  function begin(e: FormEvent) {
    e.preventDefault();
    const date = timeMode === "now" ? beijingNow() : new Date(customTime);
    const next = buildQimenChart({
      date,
      questionType: topic,
      question: question.trim(),
      city: city.trim() || "未记录",
      focus,
      context: context.trim(),
    });
    const nextMinutes = wallClockMinutes(next.input.time);
    const priorInSamePeriod = history.find((item) => {
      const difference = Math.abs(
        nextMinutes - wallClockMinutes(item.chart.input.time),
      );
      return item.chart.xunshou === next.xunshou && difference < 20 * 60;
    });
    if (priorInSamePeriod) {
      const sameQuestion =
        priorInSamePeriod.chart.input.question.replace(/\s+/g, "") ===
        next.input.question.replace(/\s+/g, "");
      setSamePeriodNotice(
        sameQuestion
          ? `你在较短时间内重复问了同一件事。奇门排盘主要由起局时间决定，所以基础盘面会和上一次相似。建议先保留第一次结果，等现实出现新变化后再起局。`
          : `这次起局与上一局相隔较近，仍处在同一个排盘时段，所以基础盘面可能相似。这不是随机重复；所问之事不同，本次重点观察的位置和解读也会不同。`,
      );
    } else {
      setSamePeriodNotice("");
    }
    setChart(next);
    setStage(0);
    setPaused(false);
    setSoundMuted(false);
    setAiReading(null);
    setAiError("");
    setChatMessages([]);
    setChatInput("");
    setScreen("ritual");
    setChecks([false, false, false]);
    window.scrollTo({ top: 0 });
  }
  function reset() {
    setScreen("landing");
    setQuestion("");
    setContext("");
    setIntakeMessages([]);
    setIntakeOptions([]);
    setIntakeReady(false);
    setIntakeIntentStatus(null);
    setChart(null);
    setStage(0);
    setPaused(false);
    setSoundMuted(true);
    setResultTab("book");
    setBookExpanded(false);
    setRulesOpen(false);
    setSelectedPalace(undefined);
    setAiReading(null);
    setAiError("");
    setChatMessages([]);
    setSamePeriodNotice("");
    window.scrollTo({ top: 0 });
  }
  function restore(item: SavedReading) {
    setChart(item.chart);
    setFocus(item.focus);
    setSelectedPalace(interpretChart(item.chart).issuePalace);
    setResultTab("book");
    setBookExpanded(false);
    setRulesOpen(false);
    setHistoryOpen(false);
    setAiReading(item.reading || null);
    setChatMessages([]);
    setSamePeriodNotice("");
    setScreen("result");
    if (!item.reading) void generateAiReading(item.chart);
  }
  function applyIntakeResult(result: IntakeResult) {
    const canStart =
      result.intentStatus === "supported" ||
      result.intentStatus === "supported_symbolic";
    if (canStart) {
      setTopic(result.questionType);
      setFocus(result.focus);
      setQuestion(result.refinedQuestion);
      setContext(result.contextSummary);
    }
    setIntakeOptions(result.options || []);
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
      setIntakeOptions(boundary.options);
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
      const normalizedResponse = {
        ...response,
        ready:
          (response.intentStatus === "supported" ||
            response.intentStatus === "supported_symbolic") &&
          response.ready &&
          !intakeResponseStillAsking(response),
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
          setIntakeOptions(["换问事业选择", "换问关系走向", "换问人生方向"]);
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
    } catch {
      setChatMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: fallbackFollowupAnswer(chart, nextQuestion, aiReading),
        },
      ]);
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
      `一局命书｜${title}·${interpretation.toneLabel}\n所问：${chart.input.question}\n主用：${interpretation.mainSymbol}（${interpretation.mainLabel}）\n局式：${chart.dunType}${chart.juNumber}局·${chart.yuan}·时段值使${chart.zhishi.door}\n断语：${oracle}\n行动：${actions.join("\n")}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (screen === "ritual" && chart) {
    const revealDoor = interpretation?.mainDoor || chart.zhishi.door;
    return (
      <main className={`app-shell ritual-screen stage-${stage}`}>
        <div className="noise" />
        <header className="topbar">
          <div className="brand">
            <i>壹</i>
            <span>
              <b>一局</b>
              <small>QIMEN PROCESS</small>
            </span>
          </div>
          <div className="locked-question">
            <b>{chart.input.question}</b>
          </div>
          <button className="ghost-button" onClick={reset}>
            退出
          </button>
        </header>
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
                    onClick={() => {
                      setStage(i);
                      setPaused(true);
                    }}
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
              paused={paused}
              speed={speed}
            />
            <div className="stage-output">
              <span>{stage < 11 ? "规则计算输出" : "最终盘面输出"}</span>
              <b>{stageOutput(chart, stage)}</b>
            </div>
          </div>
          <div className="transport">
            <button
              onClick={() => setStage((s) => Math.max(0, s - 1))}
              disabled={stage === 0}
            >
              ← 上一步
            </button>
            <button
              className="play-button"
              onClick={() => setPaused((v) => !v)}
            >
              {paused ? "继续" : "暂停"}
            </button>
            <button onClick={() => setSpeed((v) => (v === 1 ? 2 : 1))}>
              {speed}× 速度
            </button>
            <div className="transport-track">
              <i style={{ width: `${((stage + 1) / 12) * 100}%` }} />
            </div>
            <button
              onClick={() => {
                setStage(11);
                setPaused(false);
              }}
            >
              跳至成局
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "result" && chart && interpretation) {
    const isSeeking = chart.input.questionType === "寻人寻物";
    const selected = palaceByNumber(
      chart,
      selectedPalace || interpretation.issuePalace,
    );
    const issuePalace = palaceByNumber(chart, interpretation.issuePalace);
    const selfPalace = palaceByNumber(chart, interpretation.selfPalace);
    const matterPalace = palaceByNumber(chart, interpretation.matterPalace);
    const environmentPalace = palaceByNumber(chart, interpretation.environmentPalace);
    const verdict = conditionalVerdict(chart, interpretation);
    const readingOracle = aiReading?.oracle || interpretation.oracle;
    const seekScope = isSeeking ? classifySeekScope(chart.input.question) : null;
    const readingActions = seekScope === "symbolic_or_distant"
      ? [
          "先复盘最后确认它存在的时间、地点、经手人和移动路线，建立一条可核对的现实时间线。",
          `把${issuePalace.direction}方与“${issuePalace.element}”象作为线索优先级，核对外地住所、交通中转、寄存收纳及失物招领渠道。`,
          "仍无证据时，联系承运方、场所人员或同行者继续查证；盘中方象只用于排定先后，不当作具体坐标。",
        ]
      : (aiReading?.actions || interpretation.actions);
    const readingChapters =
      aiReading?.chapters || interpretation.fortuneChapters;
    const followupPrompts = aiReading?.followupPrompts || [
      "这局更适合继续还是转向？",
      "我现在最大的阻力是什么？",
      "未来七天先验证什么？",
    ];
    const palaceMarkers: Partial<Record<number, string[]>> = {};
    const addPalaceMarker = (palace: number, label: string) => {
      palaceMarkers[palace] = [...(palaceMarkers[palace] || []), label];
    };
    addPalaceMarker(interpretation.issuePalace, "本题核心");
    addPalaceMarker(interpretation.selfPalace, "你本人");
    addPalaceMarker(interpretation.matterPalace, "事情发展");
    addPalaceMarker(interpretation.environmentPalace, "当下环境");
    return (
      <main
        className={`app-shell result-screen paged-result tab-${resultTab} fortune-${interpretation.tone}`}
      >
        <div className="noise" />
        <header className="topbar">
          <div className="brand">
            <i>壹</i>
            <span>
              <b>一局</b>
              <small>QIMEN DESTINY READING</small>
            </span>
          </div>
          <nav className="result-nav">
            {(
              [
                ["book", "命书"],
                ["chart", "命盘"],
                ["ask", "问命"],
              ] as [ResultTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
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
              <span className="mast-conclusion-label">本局结论</span>
              <h1>{aiReading?.decisionTitle || interpretation.decisionTitle}</h1>
            </div>
            <div className="result-question-block">
              <span>你问的是</span>
              <blockquote>“{chart.input.question}”</blockquote>
            </div>
            <div className="conditional-verdict">
              <span>{verdict.label}</span>
              <b>{verdict.title}</b>
              <small>{verdict.condition}</small>
            </div>
            {chart.input.context && (
              <div className="result-context-block">
                <span>你的处境</span>
                <small>{chart.input.context}</small>
              </div>
            )}
            <div className="reading-badges">
              <span><i>✓</i> 规则盘面已生成</span>
              {aiReading && <b><i>✓</i> 处境解读已生成</b>}
              {aiLoading && <em><i /> 处境解读生成中</em>}
            </div>
            {isSeeking && (
              <small className="symbolic-scope-note">
                寻迹有界 · 近身小物取其方与象，不落到寸尺；贵人与远方目标观其来路与时机
              </small>
            )}
          </div>
          <div className="mast-actions">
            <button
              onClick={() => {
                setScreen("ritual");
                setStage(0);
                setPaused(false);
                setSoundMuted(false);
              }}
            >
              重看起局
            </button>
            <button onClick={() => setRulesOpen(true)}>规则说明</button>
            <button onClick={copySummary}>
              {copied ? "命书已复制" : "分享命书摘要"}
            </button>
            <button className="mobile-reset" onClick={reset}>
              新起一局
            </button>
          </div>
        </section>
        {resultTab === "book" && (
          <section className="result-view book-page unified-book-page">
            <div className="page-kicker">
              <span>结论之后</span>
              <b>先把行动带回现实，再按需要查看盘面解释</b>
            </div>
            <div className="book-action-block primary-action-block">
              <div className="book-action-heading">
                <span>本局最重要的部分</span>
                <h3>接下来，先做这三件事</h3>
                <p>结论只有落到现实动作才有用。先完成能够验证、能够撤回的步骤，再决定是否继续投入。</p>
              </div>
              <div className="book-action-list">
                {readingActions.map((item, i) => (
                  <label key={item}>
                    <input
                      type="checkbox"
                      checked={checks[i]}
                      onChange={() =>
                        setChecks((list) =>
                          list.map((v, n) => (n === i ? !v : v)),
                        )
                      }
                    />
                    <i>{checks[i] ? "✓" : pad(i + 1)}</i>
                    <b>{item}</b>
                  </label>
                ))}
              </div>
            </div>
            {aiLoading && (
              <div className="ai-status">
                <i />
                <span>
                  <b>正在结合你的问题写命书</b>
                  <small>规则盘面已经生成，你可以先看基础判断。</small>
                </span>
              </div>
            )}
            {aiError && (
              <div className="ai-fallback">
                <div>
                  <b>基础命书已就绪</b>
                  <span>补充解读暂未生成，不影响盘面与本局结论。</span>
                </div>
                <button onClick={() => void generateAiReading(chart)}>
                  重新生成
                </button>
              </div>
            )}
            {samePeriodNotice && (
              <div className="same-period-note">
                <b>为什么和上一局相似？</b>
                <span>{samePeriodNotice}</span>
              </div>
            )}
            <div className="oracle-hero">
              <div className="oracle-copy">
                <span>结论说明</span>
                <h2>{readingOracle}</h2>
                <p>{interpretation.evidenceSummary}</p>
                <small>
                  {interpretation.mainSymbol}不是测算结果，而是本题采用的传统观察依据；
                  它所在的{issuePalace.name}及同宫的门、星、神共同形成上面的判断。
                </small>
              </div>
            </div>
            {aiReading && (
              <div className="ai-overview">
                <span>结合处境的综合解读</span>
                <p>{aiReading.overview}</p>
              </div>
            )}
            <div className="signal-section-heading">
              <div>
                <span>结论依据</span>
                <h3>下面四张卡，解释这次结论从哪里来。</h3>
              </div>
              <p>
                依次看：这道题的核心、你当前的状态、事情的发展、当下环境。
                点击任意卡片，可查看它在九宫中的位置。
              </p>
            </div>
            <div className="omen-signals compact-signals">
              {interpretation.signals.map((s, index) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setSelectedPalace(s.palace);
                    setResultTab("chart");
                  }}
                >
                  <i className="signal-index">0{index + 1}</i>
                  <ToneDot tone={s.tone} />
                  <small className="signal-label">
                    <span>{signalPlainLanguage[s.label] || s.label}</span>
                    <em>奇门术语 · {s.label}</em>
                  </small>
                  <b>{s.value}</b>
                  <em className="signal-detail">{s.detail}</em>
                </button>
              ))}
            </div>
            <div className="book-section-heading">
              <div>
                <span>盘面拆解 · 按需阅读</span>
                <h3>{isSeeking ? "寻找线索六步" : "结论的六层解释"}</h3>
                <p>{isSeeking ? "把结论拆成主线、状态、方位、环境、遮蔽与下一步；想追线索时再看。" : "这里不是另一份预测，而是把本局结论拆成六个观察层；想追原因时再展开。"}</p>
              </div>
              {bookExpanded && (
                <button onClick={() => setBookExpanded(false)}>收起细节</button>
              )}
            </div>
            <div className="chapter-reading-guide">
              <span>
                <i>01—03</i>
                <b>{isSeeking ? "先缩小范围" : "先认清局面"}</b>
                <small>{isSeeking ? "主线、状态、方位" : "主运、课题、方向"}</small>
              </span>
              <em>→</em>
              <span>
                <i>04—06</i>
                <b>{isSeeking ? "再按顺序排查" : "再寻找行动线索"}</b>
                <small>{isSeeking ? "环境、遮蔽、下一步" : "机会、阻力、转机"}</small>
              </span>
              <p>{isSeeking ? "先循盘中所示的方向与藏露之象，再以最后接触、移动与收纳的现实动线逐一印证。" : "建议按顺序读；每章底部的“查看依据”会带你回到对应的九宫位置。"}</p>
            </div>
            <div className={`fortune-grid ${bookExpanded ? "expanded" : "collapsed"}`}>
              {(bookExpanded ? readingChapters : readingChapters.slice(0, 3)).map((item, i) => {
                const base =
                  interpretation.fortuneChapters.find(
                    (chapter) => chapter.label === item.label,
                  ) || interpretation.fortuneChapters[i];
                return (
                  <button
                    key={item.label}
                    className={base.tone}
                    onClick={() => {
                      setSelectedPalace(base.palace);
                      setResultTab("chart");
                    }}
                  >
                    <i>{pad(i + 1)}</i>
                    <small>{item.label}</small>
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                    <em>{dedupeEvidence(item.evidence)} · 查看依据 →</em>
                  </button>
                );
              })}
            </div>
            {!bookExpanded && (
              <button className="book-expand-button" onClick={() => setBookExpanded(true)}>
                {isSeeking ? "继续查看 04—06 · 环境、遮蔽与寻找顺序 →" : "继续阅读 04—06 · 机会、阻力与转机 →"}
              </button>
            )}
            <div className="page-turn">
              <span>01 / 03 · 命书</span>
              <button onClick={() => setResultTab("chart")}>
                查看命盘依据 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "chart" && (
          <section className="result-view chart-view">
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
                <button onClick={() => setSelectedPalace(selfPalace.palace)}>
                  <small>你本人 · 日干</small>
                  <b>{chart.dayStem.stem}</b>
                  <span>{selfPalace.direction} · {selfPalace.name}</span>
                </button>
                <div className="use-relation">
                  <i>主体 ↔ 主用神</i>
                  <b>{interpretation.relation}</b>
                </div>
                <button className="primary" onClick={() => setSelectedPalace(issuePalace.palace)}>
                  <small>本题核心 · 主用神</small>
                  <b>{interpretation.mainSymbol}</b>
                  <span>{issuePalace.direction} · {issuePalace.name}</span>
                </button>
                <button onClick={() => setSelectedPalace(matterPalace.palace)}>
                  <small>事情发展 · 时干</small>
                  <b>{chart.timeStem.stem}</b>
                  <span>{matterPalace.direction} · {matterPalace.name}</span>
                </button>
                <button onClick={() => setSelectedPalace(environmentPalace.palace)}>
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
                  <button className={layer === key ? "active" : ""} key={key} onClick={() => setLayer(key)}>
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
                <p>你点的是：{selected.direction} · {selected.name}</p>
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
              <button className="back" onClick={() => setResultTab("book")}>
                ← 返回命书
              </button>
              <span>02 / 03 · 命盘</span>
              <button onClick={() => setResultTab("ask")}>
                继续问这一局 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "ask" && (
          <section className="result-view ask-page">
            <div className="ask-heading">
              <span>同局追问</span>
              <h2>针对刚才的结论，继续问清原因和下一步</h2>
              <p>这里不会重新算一遍，只回答这局为什么这样判断、主要阻力是什么，以及下一步可以怎么做。</p>
            </div>
            <div className="ask-shell">
              <div className="ask-purpose">
                <b>点选推荐问题后会先放入输入框，你可以修改，再决定是否发送。</b>
                <span>如果问题已经换了主题或时间，应重新起局。</span>
              </div>
              <div className="prompt-chips">
                {followupPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    disabled={chatLoading}
                    onClick={() => setChatInput(prompt)}
                  >
                    {prompt}
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
                        {message.role === "user" ? "你" : "问命官"}
                      </small>
                      <p>{message.content}</p>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="chat-thinking">
                      <i />
                      <span>正在结合本局九宫寻找依据…</span>
                    </div>
                  )}
                </div>
              )}
              <form className="chat-form" onSubmit={submitFollowup}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={600}
                  placeholder="例如：如果我想转向，第一步该验证什么？"
                />
                <div>
                  <small>{chatInput.length}/600 · 回答只围绕本局</small>
                  <button disabled={chatLoading || chatInput.trim().length < 2}>
                    追问此局 →
                  </button>
                </div>
              </form>
            </div>
            <div className="ask-boundary">
              <b>解读不会改变排盘</b>
              <span>
                值符、值使、九宫与局数由规则固定，后续问答只围绕同一张盘展开。
              </span>
            </div>
            <div className="page-turn">
              <button className="back" onClick={() => setResultTab("chart")}>
                ← 返回命盘
              </button>
              <span>03 / 03 · 问命</span>
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
                  <strong>解读</strong>
                  <span>
                    <b>问事与解读负责说明结论</b>
                    <small>整理问题、解释依据、给出现实动作与同局追问</small>
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
          <span>一局 · 奇门问事</span>
          <b>传统文化体验 · 重大决定仍需结合现实信息</b>
        </footer>
      </main>
    );
  }

  if (screen === "question")
    return (
      <main className="app-shell intake-entry-screen">
        <div className="noise" />
        <header className="topbar oracle-topbar">
          <div className="brand">
            <i>壹</i>
            <span>
              <b>一局</b>
              <small>观时 · 定局</small>
            </span>
          </div>
          <button className="ghost-button" onClick={() => setScreen("landing")}>
            返回首页
          </button>
        </header>
        <section className="intake-entry">
          <div className="intake-entry-copy">
            <span>问事 · 第一步</span>
            <h1>只管说你想算的事。</h1>
            <p>这里只做起局前定题，不会在这里解读结果。你先写下真实处境，AI会判断问事类型；信息不够时，只补问一个关键点。</p>
          </div>
          <form className="intake-single-box" onSubmit={startIntake}>
            <textarea
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              minLength={2}
              maxLength={600}
              aria-label="写下想算的事情"
            />
            <div>
              <small>{question.length}/600 · 下一步只整理问题，不提前分析结果</small>
              <button disabled={question.trim().length < 2}>
                进入定题 <i>→</i>
              </button>
            </div>
          </form>
          <div className="intake-examples">
            <span>不知道怎么说？试试</span>
            {starterPrompts.slice(0, 6).map((item) => (
              <button key={item.question} onClick={() => setQuestion(item.question)}>
                {item.question}
              </button>
            ))}
          </div>
        </section>
      </main>
    );

  if (screen === "intake")
    return (
      <main className="app-shell intake-chat-screen">
        <div className="noise" />
        <header className="topbar oracle-topbar">
          <div className="brand">
            <i>壹</i>
            <span>
              <b>一局</b>
              <small>定题助手</small>
            </span>
          </div>
          <div className="intake-status"><i /> 第 2 步 · 只定题，不解读</div>
          <button className="ghost-button" onClick={() => setScreen("question")}>重新描述</button>
        </header>
        <section className="intake-chat-layout">
          <aside>
            <span>起局前 · 定题</span>
            <h1>把一件事，<br />问清楚。</h1>
            <p>这里不是普通聊天。AI只把你的描述整理成一条可起局的问题，不会在这里回答结果。</p>
            <ol>
              <li className="done">已收到原问题</li>
              <li className={intakeReady ? "done" : "active"}>必要时补一个关键点</li>
              <li className={intakeReady ? "active" : ""}>确认后进入起局</li>
            </ol>
          </aside>
          <div className="intake-conversation">
            <div className="intake-purpose-note">
              <div><small>当前任务</small><b>整理最终起局问题</b></div>
              <p><span>AI会做：</span>判断问事类型、补齐一个必要信息。<span>AI不会做：</span>在这里预测结果或持续闲聊。</p>
            </div>
            <div className="intake-chat-stream" aria-live="polite">
              {intakeMessages.map((message, index) => (
                <div className={`intake-message ${message.role}`} key={`${message.role}-${index}`}>
                  <small className="intake-speaker">{message.role === "user" ? "你提供的信息" : "定题助手"}</small>
                  <p>{message.content}</p>
                </div>
              ))}
              {intakeLoading && (
                <div className="intake-thinking"><i /><span>正在判断是否还缺一个关键信息…</span></div>
              )}
            </div>
            {intakeOptions.length > 0 && !intakeLoading && (
              <div className="intake-choice-row">
                <small>选最接近的一项；点选后会直接作为补充提交</small>
                <div>{intakeOptions.map((option) => (
                  <button key={option} onClick={() => submitIntakeReply(undefined, option)}>{option}</button>
                ))}</div>
              </div>
            )}
            {intakeReady ? (
              <div className="intake-ready-card">
                <span>AI整理出的最终起局问题</span>
                <blockquote>“{question}”</blockquote>
                <div>
                  <small>问事类型</small><b>{topic}</b><i>·</i><small>本局重点</small><b>{focus}</b>
                </div>
                <div className="intake-ready-actions">
                  <button onClick={() => setScreen("confirm")}>确认定题，进入起局设置 →</button>
                  <button
                    className="secondary"
                    onClick={() => {
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
              <div className="intake-reply-area">
                <div className="intake-reply-head">
                  <b>补充一条与这件事直接相关的信息</b>
                  <span>不用和它聊天；回答当前缺少的那一点即可</span>
                </div>
                <form className="intake-reply-box" onSubmit={submitIntakeReply}>
                  <textarea
                    value={intakeInput}
                    onChange={(e) => setIntakeInput(e.target.value)}
                    maxLength={600}
                    placeholder="例如：明天要谈一个新工作；要找的是车钥匙……"
                  />
                  <button disabled={intakeLoading || intakeInput.trim().length < 2}>提交补充 <i>↑</i></button>
                </form>
              </div>
            )}
            {aiError && <small className="intake-error">刚才短暂失去响应。可点选上方选项，或重新提交一条补充。</small>}
          </div>
        </section>
      </main>
    );

  if (screen === "confirm")
    return (
      <main className="app-shell wizard-screen confirm-screen">
        <div className="noise" />
        <header className="topbar">
          <div className="brand">
            <i>壹</i>
            <span>
              <b>一局</b>
              <small>观时 · 定局</small>
            </span>
          </div>
          <div className="flow-progress">
            <i className="done" />
            <i className="active" />
            <span>03 / 03 · 确认封题</span>
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
            <span>第三页 · 确认封题</span>
            <h1>
              一念既定，
              <br />
              以此刻时空起局。
            </h1>
            <p>确认无误后，问题将被封存。接下来进入十二步奇门起局过程。</p>
            <div className="ai-role-note confirm">
              <span>
                <b>先规则起局，再依固定盘面写命书</b>
                <small>命书会结合你的真实背景，但不会改变盘面。</small>
              </span>
            </div>
          </div>
          <form
            className="question-console wizard-panel confirm-panel"
            onSubmit={begin}
          >
            <div className="sealed-summary confirm-content-card">
              <span className="confirm-card-index">01 · 这一问</span>
              <small>{topic}</small>
              <blockquote>“{question}”</blockquote>
              {context && <p>{context}</p>}
            </div>
            <div className="ai-selection-summary confirm-content-card">
              <span className="confirm-card-index">02 · 判断方向</span>
              <small>系统已根据你的问题完成分类</small>
              <div><b>{topic}</b><i>·</i><b>{focus}</b></div>
              <p>如需改变方向，请返回对话重新说明。</p>
            </div>
            <div className="confirm-time-group confirm-content-card">
              <div className="confirm-time-heading">
                <span className="confirm-card-index">03 · 起局时间</span>
                <small>时间用于确定节令、四柱和九宫位置</small>
              </div>
              <div className="confirm-time-simple">
                <div>
                  <span>本局采用</span>
                  <b>
                    {timeMode === "now"
                      ? "现在起局"
                      : `${customTime.replace("T", " ")} 起局`}
                  </b>
                  <small>{timeMode === "now" ? "自动取你点击开始时的北京时间" : "按你指定的北京时间成盘"}</small>
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
                  <span>记录地点（可选）</span>
                  <small>仅显示在命书中，不参与排盘</small>
                </summary>
                <label>
                  <span>城市名称</span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={20}
                    placeholder="例如：上海；不填写也可以起局"
                  />
                </label>
              </details>
            </div>
            <div className="confirm-guidance-grid">
              <div className="use-rule confirm-content-card">
                <span className="confirm-card-index">04 · 本题取用</span>
                <span>
                  <b>{selectedTopic.name}</b>
                  <small>
                    {topicUsePreview[selectedTopic.name] || `${selectedTopic.hint}。本题会按这一类问题对应的传统取用方式判断。`}
                  </small>
                </span>
              </div>
              <div className="confirm-note confirm-content-card">
                <span className="confirm-card-index">使用边界</span>
                <b>传统文化体验</b>
                <span>不处理生死、医疗、法律与投资涨跌等高风险问题。</span>
              </div>
            </div>
            {topic === "寻人寻物" && (
              <div className="confirm-note seeking-note confirm-content-card">
                <b>寻迹有界</b>
                <span>近身小物取大致方位与藏露之象；贵人、机缘或远处之物，则观其来路、环境与时机。</span>
              </div>
            )}
            <div className="wizard-actions">
              <button
                type="button"
                className="back"
                onClick={() => setScreen("intake")}
              >
                ← 返回对话
              </button>
              <button type="submit">封存此念 · 开始起局 →</button>
            </div>
          </form>
        </section>
      </main>
    );

  return (
    <main className="app-shell landing-screen">
      <div className="noise" />
      <header className="topbar oracle-topbar">
        <div className="brand">
          <i>壹</i>
          <span>
            <b>一局</b>
            <small>观时 · 定局</small>
          </span>
        </div>
        <nav className="oracle-nav" aria-label="首页导航">
          <a href="#why-yiju">为什么是一局</a>
          <a href="#ai-showcase">如何问一局</a>
          <a href="#qimen-system">奇门体系</a>
          {history.length > 0 && (
            <button onClick={() => setHistoryOpen(true)}>最近命书</button>
          )}
        </nav>
        <div className="header-actions">
          <span>
            <i /> 服务正常
          </span>
          <button className="ghost-button" onClick={() => setScreen("question")}>
            立即问事
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
          <button className="oracle-primary-cta" onClick={() => setScreen("question")}>
            说出想问的事 <i>→</i>
          </button>
          <small className="oracle-hero-note">无需注册 · 一事一问 · 问题不改变盘面</small>
          <div className="oracle-prompts">
            <span>他们常从这些问题开始</span>
            <div>
              {starterPrompts.map((item) => (
                <button
                  key={item.question}
                  onClick={() => {
                    setQuestion(item.question);
                    setScreen("question");
                  }}
                >
                  {item.question}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="home-why" id="why-yiju">
        <div className="home-section-heading">
          <span>为什么选择一局</span>
          <h2>不是把古书搬上网页，<br /><em>而是先把真正想问的事说清。</em></h2>
          <p>克制、清楚、可追溯。让奇门回到一个问题、一张盘和一条可以带回现实的线索。</p>
        </div>
        <div className="home-feature-list">
          {[
            ["壹", "先把纠结整理成真正的一问", "你只需说出真实处境。定题助手会判断问事类型，必要时只补问一个关键点。"],
            ["贰", "一个问题，只起一张真实时间盘", "节令、四柱、阴阳遁、局数、九宫与值使都由规则计算，不会为了迎合答案而修改。"],
            ["叁", "从封题到成局，十二步全部可见", "不是播放一段与结果无关的视频。每一步演出都对应同一张盘的真实计算输出。"],
            ["肆", "命书不是终点，还能沿着同一局追问", "同局追问会保留原问题、盘面与命书，继续回答阻力、机会与下一步怎么验证。"],
            ["伍", "玄而不吓人，答案始终留在现实里", "不做确定性预言，不拿生死、疾病、投资涨跌制造焦虑。每个提示都落到可撤回、可验证的行动。"],
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
        <div className="ai-demo-card">
          <div className="ai-demo-question">
            <small>用户写下</small>
            <blockquote>“工作越来越没有意义，但离开又怕走错，我到底该怎么办？”</blockquote>
          </div>
          <div className="ai-demo-steps">
            <article><span><small>01 · 理解处境</small><b>只在问题过于宽泛时追问一次，随后由你确认是否起局</b></span></article>
            <article><span><small>02 · 规则成盘</small><b>以此刻时间完成十二步排盘，锁定议题宫、主体宫与行动宫</b></span></article>
            <article><span><small>03 · 形成命书</small><b>先给直接判断，再说明取用依据、机会、阻力与下一步行动</b></span></article>
          </div>
          <div className="ai-demo-answer">
            <span>本局命书摘要</span>
            <h3>先结束无效消耗，<br />再验证新方向是否值得投入。</h3>
            <p>答案会同时说明盘面依据与现实核验方式，而不是只留下一句模糊的吉凶。</p>
            <button onClick={() => setScreen("question")}>开始问我的事 →</button>
          </div>
        </div>
      </section>
      <section className="home-qimen-system" id="qimen-system">
        <div className="home-section-heading compact">
          <span>奇门体系</span>
          <h2>天地人神，<em>汇于一局。</em></h2>
          <p>一局不混用塔罗、星盘和八字。只把奇门这一套规则做完整、讲清楚。</p>
        </div>
        <div className="qimen-system-grid">
          <article><i>天</i><h3>天时</h3><p>节令、四柱、阴阳遁与局数，固定这一刻的时空底盘。</p></article>
          <article><i>地</i><h3>九宫</h3><p>三奇六仪、九星、八门与八神依规则旋布，各有落宫。</p></article>
          <article><i>人</i><h3>所问</h3><p>对话只用于判断取用方向，同一时间不会因此改成另一张盘。</p></article>
          <article><i>神</i><h3>命书</h3><p>把传统象意翻译成与你处境相关、可以继续追问的现代语言。</p></article>
        </div>
      </section>
      <section className="home-trust">
        <div><span>你的问题，只属于这一局</span><h2>不需要表演虔诚，<br />也不需要交出隐私。</h2></div>
        <ul>
          <li><b>本地历史</b><small>最近命书只保存在当前设备，随时可以清除。</small></li>
          <li><b>成盘与解读分开</b><small>规则负责排盘，问事与命书负责理解和表达，边界始终可见。</small></li>
          <li><b>不制造依赖</b><small>重大决定仍需结合现实信息与专业判断。</small></li>
        </ul>
      </section>
      <section className="home-final-cta">
        <span>下一步，从这里开始</span>
        <h2>一个问题的距离，<br /><em>看见更多可能。</em></h2>
        <button onClick={() => setScreen("question")}>开始免费问一局 →</button>
        <small>传统文化体验 · 不提供确定性未来</small>
      </section>
      <footer className="landing-footer">
        <span>一局 · 奇门问事</span>
        <b>传统文化体验 · 不替代医疗、法律、投资及其他专业判断</b>
      </footer>
      {historyOpen && (
        <div className="history-backdrop" onClick={() => setHistoryOpen(false)}>
          <aside
            className="history-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span>最近起局</span>
                <h2>最近起局</h2>
              </div>
              <button onClick={() => setHistoryOpen(false)}>×</button>
            </header>
            <p>仅保存在当前设备，不需要登录。</p>
            <div>
              {history.map((item) => {
                const reading = interpretChart(item.chart);
                return (
                  <button
                    className="history-card"
                    key={item.id}
                    onClick={() => restore(item)}
                  >
                    <small>
                      {item.chart.input.questionType} ·{" "}
                      {item.chart.calendar.solar}
                    </small>
                    <b>{item.chart.input.question}</b>
                    <span>
                      {reading.omenTitle} · {reading.toneLabel} · 值使
                      {item.chart.zhishi.door} · 主用{reading.mainSymbol}
                    </span>
                    <em>打开命书 →</em>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
