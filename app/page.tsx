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
  intakeResponseStillAsking,
  type AiReading,
  type ChatMessage,
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
];
const focusOptions = ["看未来主线", "找机会来源", "识别阻力", "决定下一步"];
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
  all: "全盘",
  sky: "天盘",
  earth: "地盘",
  star: "九星",
  door: "八门",
  god: "八神",
} as const;
type Layer = keyof typeof layerNames;
type Screen =
  | "landing"
  | "question"
  | "intake"
  | "confirm"
  | "ritual"
  | "result";
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
  const [intakeMessages, setIntakeMessages] = useState<ChatMessage[]>([]);
  const [intakeInput, setIntakeInput] = useState("");
  const [intakeOptions, setIntakeOptions] = useState<string[]>([]);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeReady, setIntakeReady] = useState(false);
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
  function applyIntakeResult(result: IntakeResult) {
    setTopic(result.questionType);
    setFocus(result.focus);
    setQuestion(result.refinedQuestion);
    setContext(result.contextSummary);
    setIntakeOptions(result.options || []);
    setIntakeReady(result.ready);
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
    setIntakeLoading(true);
    setAiError("");
    try {
      const response = await requestAi<{ mode: "intake" } & IntakeResult>({
        mode: "intake",
        messages: nextMessages,
        question: clean,
      });
      const normalizedResponse = {
        ...response,
        ready: response.ready && !intakeResponseStillAsking(response),
      };
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: normalizedResponse.assistantMessage,
      };
      setIntakeMessages([...nextMessages, assistantMessage]);
      applyIntakeResult(normalizedResponse);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI 问事官暂时没有回应";
      setAiError(message);
      if (existingMessages.length >= 2) {
        const words = nextMessages
          .filter((item) => item.role === "user")
          .map((item) => item.content)
          .join(" ");
        const fallbackTopic = /感情|关系|伴侣|恋爱|婚姻/.test(words)
          ? "感情关系"
          : /工作|事业|职业|公司|跳槽|创业/.test(words)
            ? "事业发展"
            : /钱|收入|财富|生意|资源/.test(words)
              ? "财富趋势"
              : /考试|学习|学业|读书/.test(words)
                ? "学业成长"
                : /城市|搬家|远行|出国|迁移/.test(words)
                  ? "迁移远行"
                  : "人生方向";
        const fallbackFocus = /阻力|卡住|困难|原因/.test(words)
          ? "识别阻力"
          : /机会|可能|来源/.test(words)
            ? "找机会来源"
            : /选择|决定|怎么办|下一步/.test(words)
              ? "决定下一步"
              : "看未来主线";
        const original = nextMessages.find((item) => item.role === "user")?.content || clean;
        setTopic(fallbackTopic);
        setFocus(fallbackFocus);
        setQuestion(original.slice(0, 120));
        setContext(words.slice(0, 180));
        setIntakeReady(true);
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
    setScreen("intake");
    void askIntake(question.trim(), []);
  }
  function submitIntakeReply(e?: FormEvent, option?: string) {
    e?.preventDefault();
    const value = (option || intakeInput).trim();
    if (!value) return;
    void askIntake(value);
  }
  function skipIntakeQuestion() {
    if (intakeLoading || intakeReady) return;
    setIntakeOptions([]);
    setIntakeReady(true);
    setAiError("");
    setIntakeMessages((messages) => [
      ...messages,
      {
        role: "assistant",
        content: `不再继续追问。我会按你目前提供的信息，将这一问归入“${topic}”，重点看“${focus}”。确认后即可起局。`,
      },
    ]);
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
          <span>一局 · 奇门 AI 问事</span>
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
              <small>QIMEN × DEEPSEEK</small>
            </span>
          </div>
          <button className="ghost-button" onClick={() => setScreen("landing")}>
            返回首页
          </button>
        </header>
        <section className="intake-entry">
          <div className="intake-entry-copy">
            <span>AI 问事官 · 第一步</span>
            <h1>只管说你想算的事。</h1>
            <p>不用先选分类，也不用研究奇门术语。AI 会听懂你的处境，再用一两个问题帮你把这一局定清楚。</p>
          </div>
          <form className="intake-single-box" onSubmit={startIntake}>
            <textarea
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              minLength={2}
              maxLength={600}
              placeholder="比如：我现在的工作越来越没有意义，但离开又担心走错，我该怎么看接下来的方向？"
              aria-label="写下想算的事情"
            />
            <div>
              <small>{question.length}/600 · AI 会继续问你</small>
              <button disabled={question.trim().length < 2}>
                交给 AI 梳理 <i>→</i>
              </button>
            </div>
          </form>
          <div className="intake-examples">
            <span>不知道怎么说？试试</span>
            {starterPrompts.slice(0, 3).map((item) => (
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
              <small>AI 问事官</small>
            </span>
          </div>
          <div className="intake-status"><i /> AI 正在为这一局定题</div>
          <button className="ghost-button" onClick={() => setScreen("question")}>重新描述</button>
        </header>
        <section className="intake-chat-layout">
          <aside>
            <span>AI 定题</span>
            <h1>先听懂你，<br />再开始算。</h1>
            <p>AI 只负责理解问题和选择取用方向，不参与排盘，也不会提前给出结果。</p>
            <ol>
              <li className="done">说出困惑</li>
              <li className={intakeReady ? "done" : "active"}>追问关键点</li>
              <li className={intakeReady ? "active" : ""}>确认这一问</li>
            </ol>
          </aside>
          <div className="intake-conversation">
            <div className="intake-chat-stream" aria-live="polite">
              <div className="intake-ai-intro">
                <i>AI</i>
                <p>你不需要先判断这属于事业、感情还是人生方向。把真实处境告诉我，我会替你完成分类。</p>
              </div>
              {intakeMessages.map((message, index) => (
                <div className={`intake-message ${message.role}`} key={`${message.role}-${index}`}>
                  <small>{message.role === "user" ? "你" : "AI 问事官"}</small>
                  <p>{message.content}</p>
                </div>
              ))}
              {intakeLoading && (
                <div className="intake-thinking"><i /><span>正在理解你真正想问的事…</span></div>
              )}
            </div>
            {intakeOptions.length > 0 && !intakeLoading && (
              <div className="intake-choice-row">
                {intakeOptions.map((option) => (
                  <button key={option} onClick={() => submitIntakeReply(undefined, option)}>{option}</button>
                ))}
              </div>
            )}
            {intakeReady ? (
              <div className="intake-ready-card">
                <span>AI 已完成定题</span>
                <blockquote>“{question}”</blockquote>
                <div>
                  <b>{topic}</b><i>·</i><b>{focus}</b>
                </div>
                <div className="intake-ready-actions">
                  <button onClick={() => setScreen("confirm")}>确认这一问，准备起局 →</button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setIntakeReady(false);
                      setIntakeOptions([]);
                      setAiError("");
                    }}
                  >
                    我还想补充
                  </button>
                </div>
              </div>
            ) : (
              <div className="intake-reply-area">
                <form className="intake-reply-box" onSubmit={submitIntakeReply}>
                  <textarea
                    value={intakeInput}
                    onChange={(e) => setIntakeInput(e.target.value)}
                    maxLength={600}
                    placeholder="也可以直接补充你的真实想法……"
                  />
                  <button disabled={intakeLoading || intakeInput.trim().length < 2}>发送 <i>↑</i></button>
                </form>
                {!intakeLoading && intakeMessages.some((message) => message.role === "assistant") && (
                  <button className="intake-skip-button" onClick={skipIntakeQuestion}>
                    跳过追问，直接按当前问题起局 →
                  </button>
                )}
              </div>
            )}
            {aiError && <small className="intake-error">AI 刚才短暂失去响应，你仍可以选择一个方向继续。</small>}
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
              <small>QIMEN × DEEPSEEK</small>
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
            <div className="ai-selection-summary">
              <span>AI 问事官已完成取用选择</span>
              <div><b>{topic}</b><i>·</i><b>{focus}</b></div>
              <small>如需改变所问方向，请返回对话重新说明；这里不再让你手动理解分类。</small>
            </div>
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
            <small>QIMEN × DEEPSEEK</small>
          </span>
        </div>
        <nav className="oracle-nav" aria-label="首页导航">
          <a href="#why-yiju">为什么是一局</a>
          <a href="#ai-showcase">AI 如何工作</a>
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
            <i /> 新一代奇门 AI 问事体验 <i />
          </p>
          <h1>
            观时定局，<em>见势知行</em>
          </h1>
          <p className="oracle-subtitle">
            不必先懂奇门，也不必先选分类。说出此刻真正困住你的事，
            AI 会先听懂你，再用一张完整奇门局把问题照亮。
          </p>
          <button className="oracle-primary-cta" onClick={() => setScreen("question")}>
            把心事交给 AI <i>→</i>
          </button>
          <small className="oracle-hero-note">无需注册 · 一事一问 · AI 不参与改盘</small>
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
          <h2>不是把古书搬上网页，<br /><em>而是让 AI 真正听懂你。</em></h2>
          <p>克制、清楚、可追溯。让奇门回到一个问题、一张盘和一条可以带回现实的线索。</p>
        </div>
        <div className="home-feature-list">
          {[
            ["壹", "终于有 AI 先听懂你的纠结", "你只需说出真实处境。AI 会继续追问关键点，替你判断这是事业、关系、迁移还是人生方向。"],
            ["贰", "一个问题，只起一张真实时间盘", "节令、四柱、阴阳遁、局数、九宫与值使都由规则计算，AI 不能为了迎合答案而修改。"],
            ["叁", "从封题到成局，十二步全部可见", "不是播放一段与结果无关的视频。每一步演出都对应同一张盘的真实计算输出。"],
            ["肆", "命书不是终点，还能沿着同一局追问", "AI 会保留你的原问题、盘面和命书上下文，继续回答阻力、机会与下一步怎么验证。"],
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
          <span>AI 驱动</span>
          <h2>它不给你一句判词，<br /><em>而是陪你把问题看清。</em></h2>
          <p>从一段说不清的困惑，到可以起局的一问，再到盘面依据与现实行动。</p>
        </div>
        <div className="ai-demo-card">
          <div className="ai-demo-question">
            <small>用户写下</small>
            <blockquote>“工作越来越没有意义，但离开又怕走错，我到底该怎么办？”</blockquote>
          </div>
          <div className="ai-demo-steps">
            <article><i>AI</i><span><small>理解处境</small><b>你更想确认的是去留，还是转向后的具体方向？</b></span></article>
            <article><i>局</i><span><small>规则成盘</small><b>以此刻时间完成十二步排盘，锁定议题宫、主体宫与行动宫</b></span></article>
            <article><i>解</i><span><small>个性命书</small><b>给出主运、机会、阻力、转机与三条现实核验动作</b></span></article>
          </div>
          <div className="ai-demo-answer">
            <span>AI 命书摘要</span>
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
          <article><i>人</i><h3>所问</h3><p>AI 从对话中判断取用方向，但同一时间不会因此改成另一张盘。</p></article>
          <article><i>神</i><h3>命书</h3><p>把传统象意翻译成与你处境相关、可以继续追问的现代语言。</p></article>
        </div>
      </section>
      <section className="home-trust">
        <div><span>你的问题，只属于这一局</span><h2>不需要表演虔诚，<br />也不需要交出隐私。</h2></div>
        <ul>
          <li><b>本地历史</b><small>最近命书只保存在当前设备，随时可以清除。</small></li>
          <li><b>规则与 AI 分工</b><small>规则负责排盘，AI 负责理解与表达，边界始终可见。</small></li>
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
