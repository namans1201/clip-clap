'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Files, Pin, Folder, Plus, Menu } from 'lucide-react';
import { TrashButton } from '@/components/trash-button';
import { LockButton } from '@/components/lock-button';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useGroupsContext } from '@/contexts/groups-context';
import { useCompact } from '@/contexts/compact-context';
import { CompactToggle } from '@/components/compact-toggle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SidebarToggle } from '@/components/sidebar-toggle';
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { groups, createGroup } = useGroupsContext();
  const { compact, setCompact } = useCompact();
  const [newGroupName, setNewGroupName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      await createGroup(newGroupName.trim());
      setNewGroupName('');
      setIsDialogOpen(false);
      toast.success('Group created!');
    } catch (error) {
      if (error instanceof Error && error.message !== 'Duplicate group name') {
        toast.error('Failed to create group');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const navItems = [
    { href: '/',       label: 'All Clips', icon: Files },
    { href: '/pinned', label: 'Pinned',    icon: Pin   },
  ];

  return (
    <>
      {/* ── Header: brand + compact toggle. No icon — "Clip::Clap" is a
          monospace wordmark on its own, the :: emphasises the
          code-editor feel of the rest of the app. ── */}
      <div className="px-4 pt-5 pb-4 border-b flex items-center justify-between gap-2">
        <Link
          href="/"
          className="group flex items-center transition-opacity hover:opacity-80"
          onClick={onNavigate}
          aria-label="Clip::Clap home"
        >
          <span className="font-mono font-semibold text-[17px] tracking-tight">
            <span className="text-sidebar-foreground">Clip</span>
            <span className="text-primary mx-[1px]">::</span>
            <span className="text-sidebar-foreground">Clap</span>
          </span>
        </Link>

        {/* grid / list view toggle (theme toggle now lives inline with each page's search bar). */}
        <CompactToggle checked={compact} onChange={setCompact} />
      </div>

      <ScrollArea className="flex-1 px-2.5 py-3 smooth-scroll">
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  // font-sans: nav links act as menu buttons, not body
                  // copy, so they stay on the UI font under the new
                  // Gambetta body default.
                  'group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-sans transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold shadow-sm ring-1 ring-primary/15'
                    : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-[15px] w-[15px] flex-shrink-0 transition-transform',
                    isActive
                      ? 'text-primary'
                      : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground group-hover:scale-110',
                  )}
                />
                <span className="tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Separator className="my-3 opacity-60" />

        {/* ── Groups section ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2.5 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold font-sans uppercase tracking-[0.12em] text-sidebar-foreground/55">
                Groups
              </span>
              {groups.length > 0 && (
                <span className="text-[10px] font-mono text-sidebar-foreground/40 rounded-full bg-sidebar-foreground/5 px-1.5">
                  {groups.length}
                </span>
              )}
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 hover:bg-sidebar-accent hover:text-primary h-5 w-5"
                title="New group"
              >
                <Plus className="h-3 w-3" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateGroup} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input
                      id="group-name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g., Work, Personal"
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating || !newGroupName.trim()}>
                      {isCreating ? 'Creating…' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {groups.length === 0 ? (
            <p className="px-2.5 text-[11px] text-sidebar-foreground/45 italic">
              No groups yet — click <span aria-hidden>+</span> to add one.
            </p>
          ) : (
            <div className="space-y-0.5">
              {groups.map((group) => {
                const isActive = pathname === `/group/${group.id}`;
                return (
                  <Link
                    key={group.id}
                    href={`/group/${group.id}`}
                    onClick={onNavigate}
                    className={cn(
                      'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-sans transition-all',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold shadow-sm ring-1 ring-primary/15'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    )}
                  >
                    <Folder
                      className={cn(
                        'h-[14px] w-[14px] flex-shrink-0 transition-transform',
                        isActive
                          ? 'text-primary'
                          : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground',
                      )}
                    />
                    <span className="truncate tracking-tight">{group.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Bottom: Trash on the left, Lock on the right.
          LockButton lives here (no longer in a top-right cluster) so
          mobile users can reach it on every viewport, and so it shares
          the sidebar's neumorphic palette with the trash pill. */}
      <div className="p-3 border-t flex items-center justify-between gap-2">
        <TrashButton onClick={onNavigate} />
        <LockButton />
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          aria-label="Open navigation menu"
          className="md:hidden fixed top-4 left-4 z-50 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none bg-background/80 backdrop-blur-sm shadow-md hover:bg-accent hover:text-accent-foreground h-10 w-10"
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-56" showCloseButton={false}>
          {/* Paint with --surface-gradient (the swapped main-area gradient).
              Inline style overrides the default sidebar bg. */}
          <aside
            className="flex flex-col h-full"
            style={{ background: 'var(--surface-gradient)' }}
          >
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar — width animates between 14rem (open) and 0 (collapsed).
          Narrowed from 16rem so the neumorphic toggle on its right edge no
          longer overlaps the clip grid. The toggle's `left` value in
          sidebar-toggle.module.css must stay in lock-step with this width. */}
      <aside
        className={cn(
          'hidden md:flex border-r flex-col h-screen gpu-accelerated overflow-hidden',
          'transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          collapsed ? 'w-0 border-r-0' : 'w-56',
        )}
        style={{ background: 'var(--surface-gradient)' }}
        aria-hidden={collapsed}
      >
        <SidebarContent />
      </aside>

      {/* Neomorphic toggle — vertically centred on the sidebar's right edge */}
      <SidebarToggle
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
    </>
  );
}
