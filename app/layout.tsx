import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '一局 · 奇门遁甲可视化体验',
  description: '看见一局奇门如何形成，并理解每一句传统象意来自哪里。',
  openGraph: {
    title: '一局 · 看见奇门遁甲的推演过程',
    description: '十二步生成九宫盘，每一句传统象意都能回到盘面依据。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/qimen-og.png', width: 1200, height: 630, alt: '一局奇门遁甲可视化体验' }],
  },
  twitter: { card: 'summary_large_image', images: ['/qimen-og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
