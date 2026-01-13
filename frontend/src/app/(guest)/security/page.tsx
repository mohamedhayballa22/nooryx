import TOSContent from './security.mdx';

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 pb-20 max-w-4xl">
      <article className="prose prose-slate dark:prose-invert lg:prose-lg max-w-none">
        <TOSContent />
      </article>
    </div>
  );
}
