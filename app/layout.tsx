import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '一局 · 奇门 AI 问事',
  description: '观时定局，见势知行。亲眼看完十二步奇门成盘，再由 DeepSeek AI 生成个性命书与同局追问。',
  openGraph: {
    title: '一局 · 奇门 AI 问事',
    description: '观时定局，见势知行。规则起局，DeepSeek AI 解局。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/qimen-og.png', width: 1200, height: 630, alt: '一局 · 观时定局，见势知行' }],
  },
  twitter: { card: 'summary_large_image', images: ['/qimen-og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
