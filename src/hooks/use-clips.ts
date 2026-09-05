'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clip } from '@/types/database';

interface UseClipsOptions {
  groupId?: string | null;
  showPinned?: boolean;
  showTrashed?: boolean;
  /**
   * Fetch every clip for the user — trashed and active both — with no
   * server-side is_deleted/pinned/group filter, and treat every realtime
   * event as belonging to this view. Used by ClipsProvider so every
   * dashboard page can share one fetch + one realtime subscription and
   * just filter the shared list client-side, instead of each page
   * running its own query and its own channel.
   */
  all?: boolean;
}

export function useClips(options: UseClipsOptions = {}) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClips = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('clips')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!options.all) {
        if (options.showTrashed) {
          query = query.eq('is_deleted', true);
        } else {
          query = query.eq('is_deleted', false);
        }

        if (options.showPinned) {
          query = query.eq('is_pinned', true);
        }

        if (options.groupId) {
          query = query.eq('group_id', options.groupId);
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setClips((data as Clip[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch clips');
    } finally {
      setLoading(false);
    }
  }, [options.all, options.groupId, options.showPinned, options.showTrashed]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // ── Realtime subscription ──────────────────────────────────────────
  // Listens for INSERT / UPDATE / DELETE on the clips table and patches
  // local state from the payload directly — no full re-fetch. The old
  // implementation re-queried the entire filtered list on every event,
  // which thrashed the UI under bursty writes and burned read quota.
  //
  // The view filters (showPinned / showTrashed / groupId) are applied
  // client-side here so an event for a clip outside the active view is
  // safely ignored.
  useEffect(() => {
    const supabase = createClient();
    const passesView = (clip: Clip) => {
      if (options.all) return true;
      if (options.showTrashed) {
        if (!clip.is_deleted) return false;
      } else {
        if (clip.is_deleted) return false;
      }
      if (options.showPinned && !clip.is_pinned) return false;
      if (options.groupId && clip.group_id !== options.groupId) return false;
      return true;
    };

    const sortClips = (rows: Clip[]) =>
      rows.slice().sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    type ClipRealtimePayload = {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      new: Clip;
      old: Partial<Clip> & { id?: string };
    };

    const channel = supabase
      .channel('clips-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clips' },
        (payload: ClipRealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            const next = payload.new as Clip;
            if (!passesView(next)) return;
            setClips((prev) =>
              prev.some((c) => c.id === next.id) ? prev : sortClips([next, ...prev]),
            );
          } else if (payload.eventType === 'UPDATE') {
            const next = payload.new as Clip;
            setClips((prev) => {
              const passes = passesView(next);
              const existing = prev.some((c) => c.id === next.id);
              if (passes && existing) {
                return sortClips(prev.map((c) => (c.id === next.id ? next : c)));
              }
              if (passes && !existing) {
                return sortClips([next, ...prev]);
              }
              // No longer passes filter — drop it from this view.
              return prev.filter((c) => c.id !== next.id);
            });
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id?: string };
            if (!old?.id) return;
            setClips((prev) => prev.filter((c) => c.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.all, options.groupId, options.showPinned, options.showTrashed]);

  const createClip = async (content: string, title?: string, groupId?: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('clips')
      .insert({
        content,
        title: title || null,
        group_id: groupId || null,
        user_id: user.id,
        is_pinned: false,
        is_deleted: false,
      })
      .select()
      .single();

    if (error) throw error;
    
    // Optimistic update — realtime will also fire but this gives instant feedback
    if (data) {
      setClips(prev => [data as Clip, ...prev]);
    }
    
    return data;
  };

  const updateClip = async (
    id: string,
    updates: Partial<Pick<Clip, 'content' | 'title' | 'group_id' | 'is_pinned' | 'is_locked' | 'width_span' | 'height_span'>>,
  ) => {
    const supabase = createClient();
    
    // Optimistic update
    const previousClips = clips;
    setClips(prev => {
      const updated = prev.map(clip => 
        clip.id === id 
          ? { ...clip, ...updates, updated_at: new Date().toISOString() }
          : clip
      );
      
      // If is_pinned changed, re-sort to move pinned clips to top
      if ('is_pinned' in updates) {
        return updated.sort((a, b) => {
          // Pinned first
          if (a.is_pinned !== b.is_pinned) {
            return a.is_pinned ? -1 : 1;
          }
          // Then by created_at (most recent first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }
      
      return updated;
    });
    
    const { error } = await supabase
      .from('clips')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      // Rollback on error
      setClips(previousClips);
      throw error;
    }
  };

  const togglePin = async (id: string, isPinned: boolean) => {
    await updateClip(id, { is_pinned: !isPinned });
  };

  /**
   * Persist a clip's grid spans after a corner-drag resize. Thin wrapper
   * around updateClip so the page-level handler signature stays small.
   */
  const resizeClip = async (id: string, width_span: number, height_span: number) => {
    await updateClip(id, { width_span, height_span });
  };

  /**
   * Flip the internal-lock flag. Card UI renders a "locked cover" until
   * unlocked — see ClipCard's locked branch.
   */
  const toggleLock = async (id: string, isLocked: boolean) => {
    await updateClip(id, { is_locked: !isLocked });
  };

  const softDelete = async (id: string) => {
    const supabase = createClient();
    
    // Optimistic update - remove from view immediately
    const previousClips = clips;
    setClips(prev => prev.filter(clip => clip.id !== id));
    
    const { error } = await supabase
      .from('clips')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      // Rollback on error
      setClips(previousClips);
      throw error;
    }
  };

  const restore = async (id: string) => {
    const supabase = createClient();
    
    // Optimistic update - remove from trash view
    const previousClips = clips;
    setClips(prev => prev.filter(clip => clip.id !== id));
    
    const { error } = await supabase
      .from('clips')
      .update({ is_deleted: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      // Rollback on error
      setClips(previousClips);
      throw error;
    }
  };

  const permanentDelete = async (id: string) => {
    const supabase = createClient();
    
    // Optimistic update - remove immediately
    const previousClips = clips;
    setClips(prev => prev.filter(clip => clip.id !== id));
    
    const { error } = await supabase
      .from('clips')
      .delete()
      .eq('id', id);

    if (error) {
      // Rollback on error
      setClips(previousClips);
      throw error;
    }
  };

  return {
    clips,
    loading,
    error,
    refetch: fetchClips,
    createClip,
    updateClip,
    togglePin,
    toggleLock,
    resizeClip,
    softDelete,
    restore,
    permanentDelete,
  };
}
