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
import { requestAi, type AiReading, type ChatMessage } from "../lib/ai";
import { mediaForStage, ritualMedia } from "../lib/ritual-media";

const topicMeta = [
  { name: "人生方向", glyph: "命", hint: "继续、转向、等待与人生主线" },
  { name: "事业发展", glyph: "业", hint: "机会、职位、合作与长期路径" },
  { name: "财富趋势", glyph: "财", hint: "资源、收入、积累与风险节奏" },
  { name: "感情关系", glyph: "缘", hint: "相处、边界、选择与关系走向" },
  { name: "学业成长", glyph: "学", hint: "学习、考试、能力与成长阶段" },
  { name: "迁移远行", glyph: "行", hint: "城市、远行、变化与新环境" },
];
const focusOptions = ["看未来主线", "找机会来源", "识别阻力", "决定下一步"];
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
  all: "全盘",
  sky: "天盘",
  earth: "地盘",
  star: "九星",
  door: "八门",
  god: "八神",
} as const;
type Layer = keyof typeof layerNames;
type Screen = "landing" | "question" | "confirm" | "ritual" | "result";
type ResultTab =
  "omen" | "book" | "action" | "chart" | "ask" | "process" | "method";
type SavedReading = { id: string; chart: QimenChart; focus: string };

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

function QimenEngineVisual() {
  return (
    <div className="engine-visual">
      <video
        src={ritualMedia.intro}
        poster={ritualMedia.poster}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
      <div className="engine-vignette" />
      <div className="engine-scanline" />
      <div className="engine-hud">
        <div className="engine-status">
          <span>
            <i />
            QIMEN ENGINE · LIVE
          </span>
          <b>规则排盘 × AI 命书</b>
        </div>
        <div className="engine-coordinates">
          <span>天时 · TIME</span>
          <span>地利 · SPACE</span>
          <span>人事 · INTENT</span>
        </div>
        <div className="engine-pipeline">
          <span>
            <i>01</i>校准时空
          </span>
          <em>→</em>
          <span>
            <i>12</i>九宫成盘
          </span>
          <em>→</em>
          <span className="ai">
            <i>AI</i>生成命书
          </span>
        </div>
      </div>
    </div>
  );
}

function PalaceMatrix({
  chart,
  stage = 11,
  layer = "all",
  selected,
  onSelect,
  mode = "result",
}: {
  chart: QimenChart;
  stage?: number;
  layer?: Layer;
  selected?: number;
  onSelect?: (n: number) => void;
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
            className={`matrix-cell ${active ? "active" : ""} ${p.isCenter ? "center" : ""}`}
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
  muted,
  speed,
}: {
  chart: QimenChart;
  stage: number;
  muted: boolean;
  speed: 1 | 2;
}) {
  const videoSrc = mediaForStage(stage, chart.zhishi.door);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRate =
    stage <= 5
      ? speed === 2
        ? 0.92
        : 0.51
      : stage <= 10
        ? speed === 2
          ? 1.1
          : 0.61
        : speed === 2
          ? 1.78
          : 0.94;

  const syncPlaybackRate = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.defaultPlaybackRate = playbackRate;
    videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(syncPlaybackRate, [videoSrc, syncPlaybackRate]);

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
          <span>本局值使</span>
          <b>{chart.zhishi.door}</b>
          <em>
            {palaceByNumber(chart, chart.zhishi.palace).direction} ·{" "}
            {palaceByNumber(chart, chart.zhishi.palace).name}
          </em>
        </div>
      )}
    </div>
  );
}

function stageOutput(chart: QimenChart, index: number) {
  const outputs = [
    `“${chart.input.question}”`,
    `${chart.calendar.solar} · ${chart.input.city} · 北京时间`,
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
  const [question, setQuestion] = useState(
    "未来一段时间，我的人生方向更适合继续、转向还是等待？",
  );
  const [context, setContext] = useState("");
  const [city, setCity] = useState("上海");
  const [timeMode, setTimeMode] = useState<"now" | "custom">("now");
  const [customTime, setCustomTime] = useState(() => toLocalInput(new Date()));
  const [chart, setChart] = useState<QimenChart | null>(null);
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [resultTab, setResultTab] = useState<ResultTab>("omen");
  const [soundMuted, setSoundMuted] = useState(true);
  const [layer, setLayer] = useState<Layer>("all");
  const [selectedPalace, setSelectedPalace] = useState<number>();
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<SavedReading[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiReading, setAiReading] = useState<AiReading | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [clarifying, setClarifying] = useState(false);
  const [clarifyResult, setClarifyResult] = useState<{
    refinedQuestion: string;
    reason: string;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const interpretation = useMemo(
    () => (chart ? interpretChart(chart) : null),
    [chart],
  );
  const selectedTopic = topicMeta.find((x) => x.name === topic)!;

  useEffect(() => {
    if (!chart) return;
    const sources = [
      ritualMedia.ritual,
      mediaForStage(11, chart.zhishi.door),
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
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI解读暂时不可用");
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
    if (screen !== "ritual" || paused) return;
    const delay =
      stage === 11 ? (speed === 2 ? 2800 : 5300) : speed === 2 ? 900 : 1650;
    const timer = window.setTimeout(() => {
      if (stage < 11) setStage((s) => s + 1);
      else {
        if (chart) {
          setHistory((list) => {
            const item = {
              id: chart.input.time,
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
        setScreen("result");
        setResultTab("omen");
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
      city: city.trim() || "未填写",
      focus,
      context: context.trim(),
    });
    setChart(next);
    setStage(0);
    setPaused(false);
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
    setChart(null);
    setStage(0);
    setPaused(false);
    setResultTab("omen");
    setSelectedPalace(undefined);
    setAiReading(null);
    setAiError("");
    setChatMessages([]);
    window.scrollTo({ top: 0 });
  }
  function restore(item: SavedReading) {
    setChart(item.chart);
    setFocus(item.focus);
    setSelectedPalace(interpretChart(item.chart).issuePalace);
    setResultTab("omen");
    setHistoryOpen(false);
    setAiReading(null);
    setChatMessages([]);
    setScreen("result");
    void generateAiReading(item.chart);
  }
  async function clarifyQuestion() {
    if (question.trim().length < 2) return;
    setClarifying(true);
    setAiError("");
    try {
      const response = await requestAi<{
        mode: "clarify";
        refinedQuestion: string;
        reason: string;
      }>({
        mode: "clarify",
        topic,
        question: question.trim(),
        context: context.trim(),
      });
      setClarifyResult({
        refinedQuestion: response.refinedQuestion,
        reason: response.reason,
      });
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "AI问事助手暂时不可用",
      );
    } finally {
      setClarifying(false);
    }
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
    } catch (error) {
      setChatMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `本次追问没有完成：${error instanceof Error ? error.message : "AI服务暂时不可用"}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }
  async function copySummary() {
    if (!chart || !interpretation) return;
    const title = aiReading?.omenTitle || interpretation.omenTitle;
    const oracle = aiReading?.oracle || interpretation.oracle;
    const actions = aiReading?.actions || interpretation.actions;
    await navigator.clipboard.writeText(
      `一局命书｜${title}·${interpretation.toneLabel}\n所问：${chart.input.question}\n局式：${chart.dunType}${chart.juNumber}局·${chart.yuan}·值使${chart.zhishi.door}\n断语：${oracle}\n行动：${actions.join("\n")}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (screen === "ritual" && chart) {
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
            <span>已封题</span>
            <b>{chart.input.question}</b>
          </div>
          <button className="ghost-button" onClick={reset}>
            退出
          </button>
        </header>
        <section className="ritual-workbench">
          <aside className="stage-rail">
            <p>起局进度</p>
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
          </aside>
          <div className="ritual-main">
            <div className="stage-heading">
              <p>
                {stages[stage].key} · {pad(stage + 1)}/12
              </p>
              <h1>{stages[stage].title}</h1>
              <span>{stages[stage].desc}</span>
              <em>
                {stage < 11
                  ? "规则引擎正在排盘"
                  : "规则成盘 · 即将交给 AI 解读"}
              </em>
            </div>
            <RitualVisual
              chart={chart}
              stage={stage}
              muted={soundMuted}
              speed={speed}
            />
            <div className="stage-output">
              <span>{stage < 11 ? "规则计算输出" : "最终盘面输出"}</span>
              <b>{stageOutput(chart, stage)}</b>
            </div>
          </div>
          <aside className="live-ledger">
            <p>LIVE LEDGER</p>
            <dl>
              <div>
                <dt>节令</dt>
                <dd>{stage >= 2 ? chart.calendar.activeJie : "—"}</dd>
              </div>
              <div>
                <dt>四柱</dt>
                <dd>
                  {stage >= 3
                    ? `${chart.calendar.day}·${chart.calendar.time}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>遁局</dt>
                <dd>
                  {stage >= 5 ? `${chart.dunType}${chart.juNumber}局` : "—"}
                </dd>
              </div>
              <div>
                <dt>旬首</dt>
                <dd>
                  {stage >= 6 ? `${chart.xunshou}遁${chart.hiddenYi}` : "—"}
                </dd>
              </div>
              <div>
                <dt>值符</dt>
                <dd>{stage >= 7 ? chart.zhifu.star : "—"}</dd>
              </div>
              <div>
                <dt>值使</dt>
                <dd>{stage >= 8 ? chart.zhishi.door : "—"}</dd>
              </div>
            </dl>
            <small>每一项都来自同一时间盘，不是动画随机数。</small>
          </aside>
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
            <button onClick={() => setSoundMuted((v) => !v)}>
              {soundMuted ? "开启音效" : "关闭音效"}
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
    const selected = palaceByNumber(
      chart,
      selectedPalace || interpretation.issuePalace,
    );
    const readingTitle = aiReading?.omenTitle || interpretation.omenTitle;
    const displayReadingTitle = readingTitle.endsWith(interpretation.toneLabel)
      ? readingTitle
          .slice(0, -interpretation.toneLabel.length)
          .replace(/[·・\s-]+$/, "")
      : readingTitle;
    const readingOracle = aiReading?.oracle || interpretation.oracle;
    const readingActions = aiReading?.actions || interpretation.actions;
    const readingChapters =
      aiReading?.chapters || interpretation.fortuneChapters;
    const followupPrompts = aiReading?.followupPrompts || [
      "这局更适合继续还是转向？",
      "我现在最大的阻力是什么？",
      "未来七天先验证什么？",
    ];
    return (
      <main
        className={`app-shell result-screen paged-result fortune-${interpretation.tone}`}
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
                ["omen", "总断"],
                ["book", "命书"],
                ["action", "行动"],
                ["chart", "命盘"],
                ["ask", "AI追问"],
                ["process", "过程"],
                ["method", "规则"],
              ] as [ResultTab, string][]
            ).map(([key, label], i) => (
              <button
                key={key}
                className={resultTab === key ? "active" : ""}
                onClick={() => setResultTab(key)}
              >
                <i>{i + 1}</i>
                {label}
              </button>
            ))}
          </nav>
          <button className="ghost-button" onClick={reset}>
            新起一局
          </button>
        </header>
        <section className="result-mast">
          <div>
            <p>
              {chart.input.questionType} · {chart.input.focus || focus} ·{" "}
              {chart.calendar.solar}
            </p>
            <h1>
              {displayReadingTitle} <i>·</i> {interpretation.toneLabel}
            </h1>
            <blockquote>“{chart.input.question}”</blockquote>
            {chart.input.context && (
              <small>问事背景：{chart.input.context}</small>
            )}
            <div className="reading-badges">
              <span>盘面由规则计算</span>
              {aiReading && <b>DeepSeek AI 已生成</b>}
              {aiLoading && <em>DeepSeek AI 命书生成中…</em>}
            </div>
          </div>
          <div className="mast-actions">
            <button
              onClick={() => {
                setScreen("ritual");
                setStage(0);
                setPaused(false);
              }}
            >
              重看起局
            </button>
            <button onClick={copySummary}>
              {copied ? "命书已复制" : "分享命书摘要"}
            </button>
            <button className="mobile-reset" onClick={reset}>
              新起一局
            </button>
          </div>
        </section>
        <section
          className={`ai-pipeline-strip ${aiLoading ? "loading" : aiReading ? "ready" : "fallback"}`}
        >
          <div className="rule">
            <i>01</i>
            <span>
              <b>规则引擎</b>
              <small>节令、四柱、九宫与值使已经固定</small>
            </span>
          </div>
          <em>→</em>
          <div className="ai">
            <i>AI</i>
            <span>
              <b>
                {aiLoading
                  ? "DeepSeek 正在写命书"
                  : aiReading
                    ? "DeepSeek 个性命书已生成"
                    : "基础命书模式"}
              </b>
              <small>AI 只解读，不修改任何盘面数据</small>
            </span>
          </div>
          <em>→</em>
          <button className="ask" onClick={() => setResultTab("ask")}>
            <i>03</i>
            <span>
              <b>AI 同局追问</b>
              <small>围绕这一局继续问选择与行动</small>
            </span>
          </button>
        </section>

        {resultTab === "omen" && (
          <section className="result-view omen-page">
            <div className="page-kicker">
              <span>第五页 · 本局显相</span>
              <b>先看这一局最核心的判断</b>
            </div>
            {aiLoading && (
              <div className="ai-status">
                <i />
                <span>
                  <b>DeepSeek AI 正在结合你的问题写命书</b>
                  <small>规则盘面已经生成，你可以先看基础总断。</small>
                </span>
              </div>
            )}
            {aiError && (
              <div className="ai-fallback">
                <b>基础命书已就绪</b>
                <span>DeepSeek 个性化解读暂未完成：{aiError}</span>
              </div>
            )}
            <div className="oracle-hero">
              <div className="omen-seal">
                <small>值使</small>
                <b>{interpretation.mainDoor}</b>
                <i>{interpretation.toneLabel}</i>
              </div>
              <div>
                <span>
                  {aiReading ? "DeepSeek AI 个性化核心断语" : "本局核心断语"}
                </span>
                <h2>{readingOracle}</h2>
                <p>
                  {chart.dunType}
                  {chart.juNumber}局 · {chart.yuan} · 值符{chart.zhifu.star} ·
                  值使{chart.zhishi.door}
                </p>
              </div>
            </div>
            {aiReading && (
              <div className="ai-overview">
                <span>DeepSeek AI 综合解读</span>
                <p>{aiReading.overview}</p>
              </div>
            )}
            <div className="omen-signals">
              {interpretation.signals.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setSelectedPalace(s.palace);
                    setResultTab("chart");
                  }}
                >
                  <ToneDot tone={s.tone} />
                  <small>{s.label}</small>
                  <b>{s.value}</b>
                  <em>{s.detail}</em>
                </button>
              ))}
            </div>
            <div className="page-turn">
              <span>01 / 07 · 结果阅读</span>
              <button onClick={() => setResultTab("book")}>
                继续读一局命书 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "book" && (
          <section className="result-view book-page">
            <div className="section-title fortune-title">
              <span>第六页 · 命书六章</span>
              <h3>{aiReading ? "DeepSeek AI 个性命书" : "一局命书"}</h3>
              <p>主运、课题、方向、机会、阻力与转机分章阅读。</p>
            </div>
            <div className="fortune-grid">
              {readingChapters.map((item, i) => {
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
                    <em>{item.evidence} · 查看依据 →</em>
                  </button>
                );
              })}
            </div>
            <div className="page-turn">
              <button className="back" onClick={() => setResultTab("omen")}>
                ← 返回总断
              </button>
              <span>02 / 07 · 结果阅读</span>
              <button onClick={() => setResultTab("action")}>
                继续看行动建议 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "action" && (
          <section className="result-view action-page">
            <div className="page-kicker">
              <span>第七页 · 把命书带回现实</span>
              <b>这一局之后，具体做什么</b>
            </div>
            <div className="action-layout">
              <div className="action-scroll">
                <span>
                  {aiReading ? "DeepSeek AI 生成的转机行动" : "转机行动"}
                </span>
                <h3>转运三步</h3>
                <p>
                  所谓“转运”，不是等待命运改变，而是用盘面提示安排接下来的现实动作。
                </p>
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
                <small>{checks.filter(Boolean).length}/3 已完成</small>
              </div>
              <aside className="evidence-quick">
                <span>盘面关键印记</span>
                {interpretation.signals.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => {
                      setSelectedPalace(s.palace);
                      setResultTab("chart");
                    }}
                  >
                    <ToneDot tone={s.tone} />
                    <small>{s.label}</small>
                    <b>{s.value}</b>
                    <em>{s.detail}</em>
                  </button>
                ))}
              </aside>
            </div>
            <div className="page-turn">
              <button className="back" onClick={() => setResultTab("book")}>
                ← 返回命书
              </button>
              <span>03 / 07 · 结果阅读</span>
              <button onClick={() => setResultTab("chart")}>
                查看九宫依据 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "chart" && (
          <section className="result-view chart-view">
            <div className="chart-toolbar">
              <div>
                <span>九宫盘面依据</span>
                <h2>九宫探索台</h2>
                <p>切换图层或点击宫位，看清每条线索来自哪里。</p>
              </div>
              <div className="layer-switch">
                {(Object.keys(layerNames) as Layer[]).map((key) => (
                  <button
                    className={layer === key ? "active" : ""}
                    key={key}
                    onClick={() => setLayer(key)}
                  >
                    {layerNames[key]}
                  </button>
                ))}
              </div>
            </div>
            <div className="explorer-layout">
              <div className="matrix-stage">
                <div className="celestial-ring ring-a" />
                <div className="celestial-ring ring-b" />
                <PalaceMatrix
                  chart={chart}
                  layer={layer}
                  selected={selectedPalace || interpretation.issuePalace}
                  onSelect={setSelectedPalace}
                />
              </div>
              <aside className="evidence-panel">
                <p>
                  {selected.direction} · {selected.name}
                </p>
                <h3>
                  {selected.trigram}宫 <i>五行{selected.element}</i>
                </h3>
                <div className="palace-symbols">
                  <span>
                    <small>天盘</small>
                    <b>{selected.skyStem || "—"}</b>
                  </span>
                  <span>
                    <small>地盘</small>
                    <b>{selected.earthStem || "—"}</b>
                  </span>
                  <span>
                    <small>九星</small>
                    <b>{selected.star}</b>
                  </span>
                  <span>
                    <small>八门</small>
                    <b>{selected.door || "无门"}</b>
                  </span>
                  <span>
                    <small>八神</small>
                    <b>{selected.god || "无神"}</b>
                  </span>
                  <span>
                    <small>干关系</small>
                    <b>{selected.stemRelation || "—"}</b>
                  </span>
                </div>
                <div className="evidence-meaning">
                  <span>传统象意</span>
                  <p>
                    {interpretation.insights.find(
                      (x) => x.palace === selected.palace,
                    )?.body ||
                      "此宫不是当前三条主线之一，可结合盘面图层查看，不单独做确定性推断。"}
                  </p>
                </div>
                <div className="index-list">
                  <b>本局索引</b>
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
              </aside>
            </div>
            <div className="page-turn">
              <button className="back" onClick={() => setResultTab("action")}>
                ← 返回行动
              </button>
              <span>04 / 07 · 结果阅读</span>
              <button onClick={() => setResultTab("ask")}>
                围绕这一局继续问 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "ask" && (
          <section className="result-view ask-page">
            <div className="ask-heading">
              <span>同局追问 · DeepSeek AI 问命官</span>
              <h2>继续问这一局</h2>
              <p>
                DeepSeek AI
                会沿用刚才的时间盘、你的问题和命书回答，不会重新随机起盘。
              </p>
            </div>
            <div className="ask-shell">
              <div className="prompt-chips">
                {followupPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    disabled={chatLoading}
                    onClick={() => void submitFollowup(undefined, prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="chat-stream" aria-live="polite">
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <i>问</i>
                    <b>你还想看清什么？</b>
                    <span>
                      可以追问选择、阻力、机会或下一步，不适合的问题会被明确说明。
                    </span>
                  </div>
                ) : (
                  chatMessages.map((message, i) => (
                    <div
                      key={`${message.role}-${i}`}
                      className={`chat-message ${message.role}`}
                    >
                      <small>
                        {message.role === "user" ? "你" : "DeepSeek AI"}
                      </small>
                      <p>{message.content}</p>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="chat-thinking">
                    <i />
                    <span>正在结合本局九宫寻找依据…</span>
                  </div>
                )}
              </div>
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
              <b>DeepSeek AI 负责个性化解读</b>
              <span>
                排盘结果由规则引擎固定，AI 无法修改值符、值使、九宫与局数。
              </span>
            </div>
            <div className="page-turn">
              <button className="back" onClick={() => setResultTab("chart")}>
                ← 返回命盘
              </button>
              <span>05 / 07 · 结果阅读</span>
              <button onClick={() => setResultTab("process")}>
                查看起局过程 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "process" && (
          <section className="result-view process-view">
            <div className="process-intro">
              <span>完整起局记录</span>
              <h2>
                十二步不是等待动画，
                <br />
                每一步都有可核对的输出。
              </h2>
              <button
                onClick={() => {
                  setScreen("ritual");
                  setStage(0);
                  setPaused(false);
                }}
              >
                全屏重新播放
              </button>
            </div>
            <div className="process-ledger">
              {stages.map((s, i) => (
                <article key={s.name}>
                  <i>{pad(i + 1)}</i>
                  <div>
                    <small>{s.key}</small>
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                  <b>{stageOutput(chart, i)}</b>
                </article>
              ))}
            </div>
            <div className="page-turn">
              <button className="back" onClick={() => setResultTab("ask")}>
                ← 返回追问
              </button>
              <span>06 / 07 · 结果阅读</span>
              <button onClick={() => setResultTab("method")}>
                查看规则边界 →
              </button>
            </div>
          </section>
        )}

        {resultTab === "method" && (
          <section className="result-view method-view">
            <div className="method-hero">
              <span>规则与边界</span>
              <h2>
                把“玄”拆成规则，
                <br />
                把边界说在前面。
              </h2>
              <p>
                本产品展示的是传统奇门排盘结构，并不主张它具有科学预测能力。
              </p>
            </div>
            <div className="method-grid">
              <article>
                <i>01</i>
                <h3>时间决定盘</h3>
                <p>
                  公历时间换算节令与四柱，再据节令、日干支和三元查定阴阳遁与局数。
                </p>
              </article>
              <article>
                <i>02</i>
                <h3>问题决定取用</h3>
                <p>
                  同一个时间只有一张盘。问题类型只决定先看哪几个宫，不会反向修改盘面。
                </p>
              </article>
              <article>
                <i>03</i>
                <h3>中宫寄坤</h3>
                <p>
                  当前规则集中宫相关判断统一寄坤，这是本版本明确固定的专业口径。
                </p>
              </article>
              <article>
                <i>04</i>
                <h3>解释可追溯</h3>
                <p>
                  每条提示都标注宫位、天盘、地盘、九星、八门和八神，避免只给一段无法核对的话。
                </p>
              </article>
            </div>
            <div className="ai-boundary-map">
              <div>
                <i>RULE</i>
                <span>
                  <b>规则引擎负责成盘</b>
                  <small>时间、节令、四柱、遁局、九宫、值符与值使</small>
                </span>
              </div>
              <em>不可改盘 →</em>
              <div className="ai">
                <i>AI</i>
                <span>
                  <b>DeepSeek 负责理解你</b>
                  <small>凝练问题、个性命书、行动建议与同局追问</small>
                </span>
              </div>
              <p>
                AI
                不能修改盘面，也不代表科学预测，只把传统象意转成与你问题相关、可以现实核验的语言。
              </p>
            </div>
            <div className="boundary-panel">
              <b>不提供</b>
              <span>
                精确位置 · 金额 · 生死 · 医疗诊断 · 法律判断 · 投资涨跌 ·
                确定性未来
              </span>
              <b>适合用来</b>
              <span>
                观看传统起局过程 · 整理注意力 · 产生现实核验问题 · 文化体验
              </span>
            </div>
            <div className="page-turn">
              <button className="back" onClick={() => setResultTab("process")}>
                ← 返回过程
              </button>
              <span>07 / 07 · 结果阅读</span>
              <button onClick={reset}>完成 · 再起一局</button>
            </div>
          </section>
        )}
        <footer className="result-footer">
          <span>一局 · 人生岔路口占测</span>
          <b>传统文化体验 · 重大决定仍需结合现实信息</b>
        </footer>
      </main>
    );
  }

  if (screen === "question")
    return (
      <main className="app-shell wizard-screen">
        <div className="noise" />
        <header className="topbar">
          <div className="brand">
            <i>壹</i>
            <span>
              <b>一局</b>
              <small>LIFE CROSSROADS</small>
            </span>
          </div>
          <div className="flow-progress">
            <i className="active" />
            <i />
            <span>01 / 02 · 建立问事</span>
          </div>
          <button className="ghost-button" onClick={() => setScreen("landing")}>
            返回首页
          </button>
        </header>
        <section className="wizard-layout">
          <div className="wizard-intro">
            <span>第二页 · 起念问事</span>
            <h1>
              先把这一刻，
              <br />
              真正想问的事说清楚。
            </h1>
            <p>
              同一时间只有一张盘。问题不会改变盘面，只决定命书先读哪一条人生主线。
            </p>
            <div className="ai-role-note">
              <i>AI</i>
              <span>
                <b>DeepSeek AI 问事官</b>
                <small>只帮你把问题问清楚，不参与排盘。</small>
              </span>
            </div>
          </div>
          <form
            className="question-console wizard-panel"
            onSubmit={(e) => {
              e.preventDefault();
              setScreen("confirm");
            }}
          >
            <div className="console-heading">
              <span>选择人生议题</span>
              <h2>你想问人生的哪一面？</h2>
            </div>
            <fieldset className="topic-field">
              <legend>选择议题</legend>
              <div>
                {topicMeta.map((item) => (
                  <button
                    type="button"
                    key={item.name}
                    className={topic === item.name ? "selected" : ""}
                    onClick={() => setTopic(item.name)}
                  >
                    <i>{item.glyph}</i>
                    <span>
                      <b>{item.name}</b>
                      <small>{item.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="wizard-inputs">
              <label className="textarea-label">
                <span>此刻真正关心的一件事</span>
                <textarea
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    setClarifyResult(null);
                  }}
                  minLength={6}
                  maxLength={120}
                  required
                />
                <small>{question.length}/120</small>
              </label>
              <label className="textarea-label context">
                <span>
                  现实背景 <i>选填</i>
                </span>
                <textarea
                  placeholder="例如：已经有两个方案，但资源有限……"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  maxLength={180}
                />
                <small>{context.length}/180</small>
              </label>
            </div>
            <div className="ai-question-helper">
              <button
                type="button"
                disabled={clarifying || question.trim().length < 2}
                onClick={() => void clarifyQuestion()}
              >
                <i>AI</i>
                <span>
                  <b>
                    {clarifying
                      ? "正在凝练问题…"
                      : "DeepSeek AI 帮我把问题问清楚"}
                  </b>
                  <small>保留原意，把模糊念头整理成适合问事的一句话</small>
                </span>
                <em>→</em>
              </button>
              {clarifyResult && (
                <div className="clarify-card">
                  <small>AI 问事助手建议</small>
                  <blockquote>“{clarifyResult.refinedQuestion}”</blockquote>
                  <p>{clarifyResult.reason}</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestion(clarifyResult.refinedQuestion);
                        setClarifyResult(null);
                      }}
                    >
                      采用这个问题
                    </button>
                    <button
                      type="button"
                      onClick={() => setClarifyResult(null)}
                    >
                      保留原问题
                    </button>
                  </div>
                </div>
              )}
              {aiError && <p className="ai-helper-error">{aiError}</p>}
            </div>
            <div className="wizard-actions">
              <button
                type="button"
                className="back"
                onClick={() => setScreen("landing")}
              >
                ← 上一页
              </button>
              <button type="submit">确认问题，进入封题 →</button>
            </div>
          </form>
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
              <small>LIFE CROSSROADS</small>
            </span>
          </div>
          <div className="flow-progress">
            <i className="done" />
            <i className="active" />
            <span>02 / 02 · 确认封题</span>
          </div>
          <button
            className="ghost-button"
            onClick={() => setScreen("question")}
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
              <i>AI</i>
              <span>
                <b>先规则起局，再由 AI 写命书</b>
                <small>AI 会读取固定盘面和你的真实背景，但不会改盘。</small>
              </span>
            </div>
          </div>
          <form
            className="question-console wizard-panel confirm-panel"
            onSubmit={begin}
          >
            <div className="sealed-summary">
              <small>{topic}</small>
              <blockquote>“{question}”</blockquote>
              {context && <p>{context}</p>}
            </div>
            <fieldset className="focus-field">
              <legend>这次最想看清</legend>
              {focusOptions.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={focus === item ? "selected" : ""}
                  onClick={() => setFocus(item)}
                >
                  {item}
                </button>
              ))}
            </fieldset>
            <div className="time-fields confirm-time">
              <label>
                <span>起局时间</span>
                <select
                  value={timeMode}
                  onChange={(e) =>
                    setTimeMode(e.target.value as "now" | "custom")
                  }
                >
                  <option value="now">以北京时间此刻起局</option>
                  <option value="custom">指定北京时间</option>
                </select>
              </label>
              {timeMode === "custom" && (
                <label>
                  <span>指定时间</span>
                  <input
                    type="datetime-local"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    required
                  />
                </label>
              )}
              <label>
                <span>
                  城市 <i>当前仅作记录</i>
                </span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={20}
                />
              </label>
            </div>
            <div className="use-rule">
              <i>{selectedTopic.glyph}</i>
              <span>
                <b>{selectedTopic.name}的取用</b>
                <small>
                  {selectedTopic.hint}。问题不改变盘，只改变结果首先观察的位置。
                </small>
              </span>
            </div>
            <div className="confirm-note">
              <b>传统文化体验</b>
              <span>不处理生死、医疗、法律与投资涨跌等高风险问题。</span>
            </div>
            <div className="wizard-actions">
              <button
                type="button"
                className="back"
                onClick={() => setScreen("question")}
              >
                ← 修改问题
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
      <header className="topbar">
        <div className="brand">
          <i>壹</i>
          <span>
            <b>一局</b>
            <small>LIFE CROSSROADS</small>
          </span>
        </div>
        <div className="header-actions">
          <span>传统奇门 · AI 人生问事</span>
          {history.length > 0 && (
            <button
              className="ghost-button"
              onClick={() => setHistoryOpen(true)}
            >
              最近起局 {history.length}
            </button>
          )}
        </div>
      </header>
      <section className="landing-layout">
        <div className="landing-copy">
          <p>第一页 · 人生岔路口占测</p>
          <h1>
            <span>当人生走到岔路，</span>
            <br />
            <i>
              该继续、转向，
              <br />
              还是等待？
            </i>
          </h1>
          <b>起一局，看此刻更顺的方向。</b>
          <p className="landing-desc">
            从一个真实问题开始，亲眼看完十二步奇门成盘，再由 DeepSeek AI
            结合你的处境，生成可以回到九宫核对的个性命书。
          </p>
          <button className="primary-cta" onClick={() => setScreen("question")}>
            <i>启</i>
            <span>
              <b>开始问事</b>
              <small>规则起局 · DeepSeek AI 解命</small>
            </span>
            <em>→</em>
          </button>
          <div className="landing-proof">
            <span>
              <b>01</b>聚焦问事
            </span>
            <span>
              <b>12</b>规则起局
            </span>
            <span>
              <b>AI</b>个性命书
            </span>
          </div>
          <div className="landing-ai-note">
            <i>AI</i>
            <span>
              <b>AI 不排盘，只负责理解你</b>
              <small>先由规则固定盘面，再生成个性解读与同局追问。</small>
            </span>
          </div>
        </div>
        <div className="landing-instrument">
          <QimenEngineVisual />
        </div>
      </section>
      <footer className="landing-footer">
        <span>传统文化体验</span>
        <b>规则排盘不随机 · AI 解读不改盘 · 每条结论可回到九宫依据</b>
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
                      {item.chart.zhishi.door}
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
