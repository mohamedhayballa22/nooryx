import { source } from '@/lib/source';
import type { Metadata } from 'next';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { LLMCopyButton, ViewOptions } from '@/components/page-actions';

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownContent = await page.data.getText('raw');

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{
        style: 'clerk',
        single: false,
      }}
    >
      <DocsBody>
        <h1>{page.data.title}</h1>
        
        <div className="flex flex-row gap-2 items-center">
          <LLMCopyButton markdownContent={markdownContent} />
          <ViewOptions
            pageUrl={page.url}
          />
        </div>

        <MDX />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
