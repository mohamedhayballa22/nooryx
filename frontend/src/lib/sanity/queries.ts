import { client } from './client'

export interface ChangelogEntry {
  _id: string
  title: string
  date: string
  content: any[]
  slug: {
    current: string
  }
}

export async function getChangelogEntries(): Promise<ChangelogEntry[]> {
  return await client.fetch(
    `*[_type == "changelog"] | order(date desc) {
      _id,
      title,
      date,
      content,
      slug
    }`
  )
}

export async function getChangelogEntry(slug: string): Promise<ChangelogEntry | null> {
  return await client.fetch(
    `*[_type == "changelog" && slug.current == $slug][0] {
      _id,
      title,
      date,
      content,
      slug
    }`,
    { slug }
  )
}
