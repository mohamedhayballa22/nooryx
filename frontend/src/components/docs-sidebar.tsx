// @/components/docs-sidebar.tsx

'use client';
import { ExternalLink } from 'lucide-react';
import { usePathname } from 'fumadocs-core/framework';
import {
  type ComponentProps,
  createContext,
  type FC,
  Fragment,
  type ReactNode,
  useContext,
  useMemo,
} from 'react';
import Link, { type LinkProps } from 'fumadocs-core/link';
import { cn } from '../lib/cn';
import { ScrollArea, ScrollViewport } from './ui/scroll-area';
import { isActive } from '../lib/is-active';
import { type ScrollAreaProps } from '@radix-ui/react-scroll-area';
import { useSidebar } from 'fumadocs-ui/contexts/sidebar';
import type * as PageTree from 'fumadocs-core/page-tree';
import { useTreeContext } from 'fumadocs-ui/contexts/tree';
import { useMediaQuery } from 'fumadocs-core/utils/use-media-query';
import { Presence } from '@radix-ui/react-presence';

export interface SidebarProps {
  /**
   * Open folders by default if their level is lower or equal to a specific level
   * (Starting from 1)
   *
   * @defaultValue 0
   */
  defaultOpenLevel?: number;

  /**
   * Prefetch links
   *
   * @defaultValue true
   */
  prefetch?: boolean;

  /**
   * Children to render
   */
  Content: ReactNode;

  /**
   * Alternative children for mobile
   */
  Mobile?: ReactNode;
}

interface InternalContext {
  defaultOpenLevel: number;
  prefetch: boolean;
  level: number;
}

const Context = createContext<InternalContext | null>(null);

export function Sidebar({
  defaultOpenLevel = 0,
  prefetch = true,
  Mobile,
  Content,
}: SidebarProps) {
  const isMobile = useMediaQuery('(width < 768px)') ?? false;
  const context = useMemo<InternalContext>(() => {
    return {
      defaultOpenLevel,
      prefetch,
      level: 1,
    };
  }, [defaultOpenLevel, prefetch]);

  return (
    <Context.Provider value={context}>
      {isMobile && Mobile != null ? Mobile : Content}
    </Context.Provider>
  );
}

export function SidebarContent(props: ComponentProps<'aside'>) {
  return (
    <aside
      id="nd-sidebar"
      {...props}
      className={cn(
        'fixed left-0 rtl:left-auto rtl:right-0 flex flex-col top-(--fd-sidebar-top) bottom-0 z-20 text-sm max-md:hidden',
        props.className,
      )}
      style={
        {
          ...props.style,
          '--fd-sidebar-top': `calc(var(--fd-banner-height) + var(--fd-nav-height))`,
          paddingLeft: 'max(var(--fd-layout-offset), calc((100vw - var(--fd-page-width) - var(--fd-sidebar-width)) / 2))',
          width: 'calc(var(--fd-sidebar-width) + max(var(--fd-layout-offset), calc((100vw - var(--fd-page-width) - var(--fd-sidebar-width)) / 2)))',
        } as object
      }
    >
      <div className="w-(--fd-sidebar-width)">
        {props.children}
      </div>
    </aside>
  );
}

export function SidebarContentMobile({
  className,
  children,
  ...props
}: ComponentProps<'aside'>) {
  const { open, setOpen } = useSidebar();
  const state = open ? 'open' : 'closed';

  return (
    <>
      <Presence present={open}>
        <div
          data-state={state}
          className="fixed z-50 inset-0 backdrop-blur-xs data-[state=open]:animate-fd-fade-in data-[state=closed]:animate-fd-fade-out"
          onClick={() => setOpen(false)}
        />
      </Presence>
      <Presence present={open}>
        {({ present }) => (
          <aside
            id="nd-sidebar-mobile"
            {...props}
            data-state={state}
            className={cn(
              'fixed text-[0.9375rem] flex flex-col shadow-lg border-e start-0 inset-y-0 w-[85%] max-w-[380px] z-50 bg-fd-background data-[state=open]:animate-in data-[state=open]:slide-in-from-left-full data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left-full duration-300',
              !present && 'invisible',
              className,
            )}
          >
            {children}
          </aside>
        )}
      </Presence>
    </>
  );
}

export function SidebarHeader(props: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('flex flex-col gap-3 pl-12 pt-9', props.className)}
    >
      {props.children}
    </div>
  );
}

export function SidebarFooter(props: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('flex flex-col p-4 pt-2', props.className)}
    >
      {props.children}
    </div>
  );
}

export function SidebarViewport(props: ScrollAreaProps) {
  return (
    <ScrollArea {...props} className={cn('h-full', props.className)}>
      <ScrollViewport
        className="pl-10 py-4 overscroll-contain"
        style={
          {
            '--sidebar-item-offset': 'calc(var(--spacing) * 2)',
            maskImage:
              'linear-gradient(to bottom, transparent, white 12px, white calc(100% - 12px), transparent)',
          } as object
        }
      >
        {props.children}
      </ScrollViewport>
    </ScrollArea>
  );
}

export function SidebarSeparator(props: ComponentProps<'p'>) {
  return (
    <p
      {...props}
      className={cn(
        'inline-flex items-center gap-2 mb-1 px-2 ps-(--sidebar-item-offset) empty:mb-0 [&_svg]:size-4 [&_svg]:shrink-0',
        props.className,
      )}
    >
      {props.children}
    </p>
  );
}

export function SidebarItem({
  icon,
  ...props
}: LinkProps & {
  icon?: ReactNode;
}) {
  const pathname = usePathname();
  const active =
    props.href !== undefined && isActive(props.href, pathname, false);
  const { prefetch } = useInternalContext();

  return (
    <Link
      {...props}
      data-active={active}
      className={cn(
        'relative flex flex-row items-center gap-2 p-1 ps-(--sidebar-item-offset) text-start text-fd-muted-foreground [overflow-wrap:anywhere] [&_svg]:size-4 [&_svg]:shrink-0 transition-colors',
        !active && 'hover:text-fd-primary',
        active && 'text-fd-primary',
        props.className,
      )}
      prefetch={prefetch}
    >
      {icon ?? (props.external ? <ExternalLink /> : null)}
      {props.children}
    </Link>
  );
}

export function SidebarFolder(props: ComponentProps<'div'>) {
  return <div {...props}>{props.children}</div>;
}

export function SidebarFolderTrigger(props: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative flex flex-row items-center gap-2 p-2 ps-(--sidebar-item-offset) text-start text-fd-muted-foreground [overflow-wrap:anywhere] [&_svg]:size-4 [&_svg]:shrink-0',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function SidebarFolderLink(props: LinkProps) {
  const { prefetch } = useInternalContext();
  const pathname = usePathname();
  const active =
    props.href !== undefined && isActive(props.href, pathname, false);

  return (
    <Link
      {...props}
      data-active={active}
      className={cn(
        'relative flex flex-row items-center gap-2 p-1 ps-(--sidebar-item-offset) text-start text-fd-muted-foreground [overflow-wrap:anywhere] [&_svg]:size-4 [&_svg]:shrink-0 transition-colors',
        !active && 'hover:text-fd-primary',
        active && 'text-fd-primary',
        props.className,
      )}
      prefetch={prefetch}
    >
      {props.children}
    </Link>
  );
}

export function SidebarFolderContent(props: ComponentProps<'div'>) {
  const { level, ...ctx } = useInternalContext();

  return (
    <div
      {...props}
      className={cn(
        'relative',
        level === 1 && [
          "before:content-[''] before:absolute before:w-px before:inset-y-0.5 before:bg-fd-border before:start-2.5",
          "**:data-[active=true]:before:content-[''] **:data-[active=true]:before:bg-fd-border **:data-[active=true]:before:absolute **:data-[active=true]:before:w-px **:data-[active=true]:before:inset-y-1 **:data-[active=true]:before:start-2.5",
        ],
        props.className,
      )}
      style={
        {
          '--sidebar-item-offset': `calc(var(--spacing) * ${(level + 1) * 3})`,
          ...props.style,
        } as object
      }
    >
      <Context.Provider
        value={useMemo(
          () => ({
            ...ctx,
            level: level + 1,
          }),
          [ctx, level],
        )}
      >
        {props.children}
      </Context.Provider>
    </div>
  );
}

export function SidebarTrigger({
  children,
  ...props
}: ComponentProps<'button'>) {
  const { setOpen } = useSidebar();

  return (
    <button
      {...props}
      aria-label="Open Sidebar"
      onClick={() => setOpen((prev) => !prev)}
    >
      {children}
    </button>
  );
}

export function SidebarCollapseTrigger(props: ComponentProps<'button'>) {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <button
      type="button"
      aria-label="Collapse Sidebar"
      data-collapsed={collapsed}
      {...props}
      onClick={() => {
        setCollapsed((prev) => !prev);
      }}
    >
      {props.children}
    </button>
  );
}

function useInternalContext() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('<Sidebar /> component required.');

  return ctx;
}

export interface SidebarComponents {
  Item: FC<{ item: PageTree.Item }>;
  Folder: FC<{ item: PageTree.Folder; level: number; children: ReactNode }>;
  Separator: FC<{ item: PageTree.Separator }>;
}

/**
 * Render sidebar items from page tree
 */
export function SidebarPageTree(props: {
  components?: Partial<SidebarComponents>;
}) {
  const { root } = useTreeContext();

  return useMemo(() => {
    const { Separator, Item, Folder } = props.components ?? {};

    function renderSidebarList(
      items: PageTree.Node[],
      level: number,
    ): ReactNode[] {
      return items.map((item, i) => {
        if (item.type === 'separator') {
          if (Separator) return <Separator key={i} item={item} />;
          return (
            <SidebarSeparator key={i} className={cn(i !== 0 && 'mt-6')}>
              {item.icon}
              {item.name}
            </SidebarSeparator>
          );
        }

        if (item.type === 'folder') {
          const children = renderSidebarList(item.children, level + 1);

          if (Folder)
            return (
              <Folder key={i} item={item} level={level}>
                {children}
              </Folder>
            );
          return (
            <PageTreeFolder key={i} item={item}>
              {children}
            </PageTreeFolder>
          );
        }

        if (Item) return <Item key={item.url} item={item} />;
        return (
          <SidebarItem
            key={item.url}
            href={item.url}
            external={item.external}
            icon={item.icon}
          >
            {item.name}
          </SidebarItem>
        );
      });
    }

    return (
      <Fragment key={root.$id}>{renderSidebarList(root.children, 1)}</Fragment>
    );
  }, [props.components, root]);
}

function PageTreeFolder({
  item,
  ...props
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  return (
    <SidebarFolder>
      {item.index ? (
        <SidebarFolderLink
          href={item.index.url}
          external={item.index.external}
          {...props}
        >
          {item.icon}
          {item.name}
        </SidebarFolderLink>
      ) : (
        <SidebarFolderTrigger {...props}>
          {item.icon}
          {item.name}
        </SidebarFolderTrigger>
      )}
      <SidebarFolderContent>{props.children}</SidebarFolderContent>
    </SidebarFolder>
  );
}
