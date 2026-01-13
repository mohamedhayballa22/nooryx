import { getChangelogEntries } from '@/lib/sanity/queries'
import { PortableText } from '@portabletext/react'
import { components } from '@/components/PortableTextComponents'

export const revalidate = false 

export default async function ChangelogPage() {
  const entries = await getChangelogEntries()

  return (
    <div className="min-h-screen -mt-5"> 
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 mb-4">
          <div className="md:col-span-3"></div>
          <div className="md:col-span-9 pl-4 md:pl-0">
            <h1 className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wider">
              Changelog
            </h1>
          </div>
        </div>

        {/* Feed */}
        <div className="relative border-l border-gray-200 dark:border-gray-800 ml-4 md:ml-0 md:border-l-0">
          {entries.map((entry) => {
            const date = new Date(entry.date)
            const formattedDate = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })

            // -Version number
            // const version = entry.version || "1.0"

            return (
              <div 
                key={entry._id} 
                className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 mb-16 md:mb-24 relative"
              >
                
                {/* Left Column: Date & Sticky Meta */}
                <div className="md:col-span-3">
                  <div className="md:sticky md:top-24 flex flex-row md:flex-col items-center md:items-start gap-3">
                    {/* Timeline Dot (Mobile only) */}
                    <div className="absolute -left-[21px] md:hidden w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
                    
                    <time className="text-sm font-medium text-gray-500 dark:text-gray-400 font-mono pt-0.5 md:pt-0">
                      {formattedDate}
                    </time>
                    
                    {/* Version Badge */}
                    {/* <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      v{version}
                    </span> */}
                  </div>
                </div>

                {/* Right Column: Content */}
                <div className="md:col-span-9 pl-4 md:pl-0">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    {entry.title}
                  </h2>

                  <div className="prose prose-lg prose-gray dark:prose-invert max-w-none 
                    prose-headings:font-semibold 
                    prose-a:text-blue-600 dark:prose-a:text-blue-400 
                    prose-img:rounded-sm prose-img:my-6">
                    <PortableText value={entry.content} components={components} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
