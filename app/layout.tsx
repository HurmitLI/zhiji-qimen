import type { Metadata } from 'next';
import './globals.css';
import './v36.css';
import './v37.css';

export const metadata: Metadata = {
  title: '一局 · 奇门问事',
  description: '观时定局，见势知行。亲眼看完十二步奇门成盘，阅读个性命书，并围绕同一局继续追问。',
  openGraph: {
    title: '一局 · 奇门问事',
    description: '观时定局，见势知行。奇门规则起局，一事一问。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/qimen-og.png', width: 1200, height: 630, alt: '一局 · 观时定局，见势知行' }],
  },
  twitter: { card: 'summary_large_image', images: ['/qimen-og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
