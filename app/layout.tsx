import type { Metadata } from 'next';
import '@fontsource-variable/noto-serif-sc';
import './globals.css';
import './v36.css';
import './v37.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3002'),
  title: '知几 · 奇门问事',
  description: '观时定局，见势知行。按当前时间完成奇门排盘，阅读本局命书，并围绕同一盘继续追问。',
  openGraph: {
    title: '知几 · 奇门问事',
    description: '观时定局，见势知行。奇门规则起局，一事一问。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/qimen-og.png', width: 1200, height: 630, alt: '知几 · 观时定局，见势知行' }],
  },
  twitter: { card: 'summary_large_image', images: ['/qimen-og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
