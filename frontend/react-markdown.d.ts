// Module stub for react-markdown to avoid importing internal TypeScript sources
declare module 'react-markdown' {
  import { ComponentType, ReactNode } from 'react'
  interface ReactMarkdownProps {
    children?: ReactNode
    className?: string
    remarkPlugins?: any[]
    rehypePlugins?: any[]
  }
  const ReactMarkdown: ComponentType<ReactMarkdownProps>
  export default ReactMarkdown
}

// Stubs for remark and rehype plugins without types
declare module 'remark-gfm'
declare module 'remark-math'
declare module 'rehype-katex'
