import { urlFor } from '@/lib/sanity/image'
import { client } from '@/lib/sanity/client'
import { PortableTextComponents } from '@portabletext/react'

export const components: PortableTextComponents = {
  types: {
    image: ({ value }) => {
      if (!value?.asset?._ref) {
        return null
      }
      return (
        <div>
          <img
            src={urlFor(value)
              .width(2400)
              .quality(90)
              .format('webp')
              .auto('format')
              .url()
            }
            alt={value.alt || 'Changelog image'}
          />
          {value.alt && (
            <p className="mt-2 text-xs text-gray-500 text-center">{value.alt}</p>
          )}
        </div>
      )
    },
    file: ({ value }) => {
      if (!value?.asset?._ref) {
        return null
      }
      
      // Build the file URL from the asset reference
      const [, id, extension] = value.asset._ref.split('-')
      const projectId = client.config().projectId
      const dataset = client.config().dataset
      
      const videoUrl = `https://cdn.sanity.io/files/${projectId}/${dataset}/${id}.${extension}`
      
      return (
        <div className="my-6">
          <video 
            autoPlay
            loop
            muted
            playsInline
            className="w-full !rounded-sm"
          >
            <source src={videoUrl} type={`video/${extension}`} />
            Your browser does not support the video tag.
          </video>
        </div>
      )
    },
  },
  block: {
    h2: ({ children }) => <h2 className="text-2xl font-semibold mt-10 mb-4 text-foreground">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xl font-medium mt-8 mb-3 text-foreground">{children}</h3>,
    normal: ({ children }) => <p className="mb-4 leading-7 text-gray-700 dark:text-gray-300">{children}</p>,
  },
  marks: {
    link: ({ children, value }) => {
      const rel = !value.href.startsWith('/') ? 'noreferrer noopener' : undefined
      return (
        <a 
          href={value.href} 
          rel={rel} 
          className="font-medium text-blue-600 hover:text-blue-500 underline decoration-blue-600/30 hover:decoration-blue-500/50 underline-offset-2 rounded-sm transition-colors"
        >
          {children}
        </a>
      )
    },
  },
}
