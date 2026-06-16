import { SiteHeader } from '@/components/layout/site-header';
import { HeroSection } from '@/components/home/hero-section';
import { CategoryGrid } from '@/components/home/category-grid';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <CategoryGrid />
      </main>
    </div>
  );
}
