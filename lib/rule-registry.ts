export const QIMEN_RULESET={
  id:'mainline-cn-v1',
  plateVersion:'qimen-skill-python-v1-20260827',
  interpretationVersion:'qimen-interpretation-v20-20260827',
  readingPromptVersion:'reading-ai-synthesis-v15-20260827',
  methodLabel:'mainline-cn-v1 · 时家转盘奇门',
  sourceStatus:'固定调用 qimen-dunjia Skill 脚本',
  sourceNotes:[
    '节令、三元、阴阳遁、局数、九宫与格局统一由 qimen_cli.py 固定计算。',
    '事项取用遵循 Skill 的 yongshen.md；AI不得换用神或修改盘面，但负责依据事实生成本局结论与行动建议。',
    '同一输入必须得到同一张标准盘；不同问题只通过用神和解读区分。',
    '默认时区 Asia/Shanghai；中宫相关判断按 mainline-cn-v1 寄坤处理。',
  ],
} as const;
