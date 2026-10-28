import { Text } from '@/components/preferences'
import { ScrollArea } from '@/components/scroll-area'
import { FloatingHeader } from '@/components/floating-header'
import { PageTitle } from '@/components/page-title'

export function NotFound() {
  return (
    <ScrollArea className="flex flex-col" hasScrollTitle>
      <FloatingHeader scrollTitle={<Text id="notFound" />} />
      <div className="content-wrapper">
        <div className="content">
          <PageTitle title={<Text id="notFound" />} />
          <p>
            <Text id="notFoundDescription" />
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}
