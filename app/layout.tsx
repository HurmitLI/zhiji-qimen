import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '一局 · 人生岔路口占测',
  description: '继续、转向还是等待？起一局，看此刻更顺的方向，并亲眼看到十二步奇门成盘。',
  openGraph: {
    title: '一局 · 人生岔路口占测',
    description: '继续、转向还是等待，起一局，看此刻更顺的方向。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/qimen-og.png', width: 1200, height: 630, alt: '一局人生岔路口占测' }],
  },
  twitter: { card: 'summary_large_image', images: ['/qimen-og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
